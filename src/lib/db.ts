import { Student, Tablet, TabletBox, TabletAssignment, DailyAttendanceRecord, AuditLog } from '../types';

const listeners: Record<string, Set<(data: any[]) => void>> = {};
const collections = ['students', 'tablets', 'boxes', 'assignments', 'attendance', 'auditLogs'];
const REFRESH_INTERVAL_MS = 3000;

function adminHeaders(extra: Record<string, string> = {}) {
  const token = localStorage.getItem('stm_admin_session_token') || '';
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}
function notifyListeners(collectionName: string, data: any[]) { listeners[collectionName]?.forEach((callback) => callback(data)); }
function getLocalData(collectionName: string): any[] { try { const data = localStorage.getItem(`db_${collectionName}`); return data ? JSON.parse(data) : []; } catch { return []; } }
function setLocalData(collectionName: string, data: any[]) { localStorage.setItem(`db_${collectionName}`, JSON.stringify(data)); notifyListeners(collectionName, data); }
function notifyAdminSessionExpired() { window.dispatchEvent(new CustomEvent('stm-admin-session-expired')); }

function normalizeCollectionData(collectionName: string, data: any[]): any[] {
  if (!Array.isArray(data)) return [];
  const visibleData = collectionName === 'students' ? data.filter((student) => student?.isDeleted !== true && student?.deleted !== true) : data;
  if (collectionName === 'students') {
    return visibleData.map((student) => {
      const rawStatus = String(student?.status ?? '').trim();
      // The backend uses Approved for a student who has completed admin approval,
      // while the Attendance Register expects Active students. Normalize this
      // presentation state without changing pending/inactive records.
      if (rawStatus.toLowerCase() === 'approved') {
        return { ...student, status: 'Active', approvalStatus: 'Approved' };
      }
      return student;
    });
  }
  if (collectionName === 'tablets') return visibleData.map((tablet) => { const rawStatus = String(tablet?.status ?? '').trim().toLowerCase(); const status = rawStatus === 'assigned' ? 'Assigned' : rawStatus === 'maintenance' ? 'Maintenance' : 'Available'; return { ...tablet, status }; });
  if (collectionName === 'assignments') return visibleData.map((assignment) => ({ ...assignment, status: String(assignment?.status ?? '').trim().toLowerCase() === 'returned' ? 'Returned' : 'Active' }));
  if (collectionName === 'attendance') {
    // Older attendance rows can exist without a details array. Attendance and
    // Reports both iterate over details, so always normalize malformed rows to
    // a safe, empty array instead of allowing a runtime forEach/map crash.
    return visibleData.map((record) => ({
      ...record,
      details: Array.isArray(record?.details) ? record.details.filter(Boolean) : [],
    }));
  }
  return visibleData;
}

async function fetchCollection(collectionName: string): Promise<any[]> {
  const response = await fetch(`/api/db/${collectionName}?_=${Date.now()}`, { headers: { ...adminHeaders(), 'Cache-Control': 'no-cache' }, cache: 'no-store' });
  if (response.status === 401) {
    localStorage.removeItem('stm_admin_session_token');
    notifyAdminSessionExpired();
    throw new Error('Admin session expired. Please login again.');
  }
  if (!response.ok) throw new Error(`Database read failed: ${response.status}`);
  return normalizeCollectionData(collectionName, await response.json());
}

export function subscribeToCollection<T>(collectionName: string, callback: (data: T[]) => void) {
  if (!listeners[collectionName]) listeners[collectionName] = new Set();
  listeners[collectionName].add(callback);
  let stopped = false;
  let refreshing = false;
  const refresh = async () => {
    if (stopped || refreshing || document.visibilityState === 'hidden') return;
    refreshing = true;
    try {
      const data = await fetchCollection(collectionName);
      if (!stopped) setLocalData(collectionName, data);
    } catch (error) {
      console.error(`Failed to refresh ${collectionName} from the database`, error);
      if (!stopped && getLocalData(collectionName).length === 0 && import.meta.env.PROD) callback([]);
    } finally { refreshing = false; }
  };
  void refresh();
  const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS);
  const onVisibilityChange = () => { if (document.visibilityState === 'visible') void refresh(); };
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => { stopped = true; window.clearInterval(intervalId); document.removeEventListener('visibilitychange', onVisibilityChange); listeners[collectionName]?.delete(callback); };
}

export async function syncCollection<T extends { id: string }>(collectionName: string, _current: T[], updated: T[]) {
  const normalizedUpdated = normalizeCollectionData(collectionName, updated) as T[];
  const response = await fetch(`/api/db/${collectionName}`, { method: 'PUT', headers: adminHeaders(), body: JSON.stringify(normalizedUpdated) });
  if (response.status === 401) { localStorage.removeItem('stm_admin_session_token'); notifyAdminSessionExpired(); throw new Error('Admin session expired. Please login again.'); }
  if (!response.ok) { if (!import.meta.env.PROD) { setLocalData(collectionName, normalizedUpdated); return; } throw new Error(`Database save failed: ${response.status}`); }
  if (collectionName === 'students') {
    const role = localStorage.getItem('stm_active_role_v3') || '';
    const credentialsResponse = await fetch('/api/photos/student/credentials', { method: 'POST', headers: adminHeaders({ 'x-admin-role': role }), body: JSON.stringify({ studentIds: normalizedUpdated.map((item) => item.id) }) });
    if (credentialsResponse.status === 401) { localStorage.removeItem('stm_admin_session_token'); notifyAdminSessionExpired(); throw new Error('Admin session expired. Please login again.'); }
    if (!credentialsResponse.ok) { if (!import.meta.env.PROD) { setLocalData(collectionName, normalizedUpdated); return; } throw new Error(`Student credential provisioning failed: ${credentialsResponse.status}`); }
    const data = await credentialsResponse.json(); setLocalData(collectionName, Array.isArray(data.students) ? normalizeCollectionData(collectionName, data.students) : normalizedUpdated); return;
  }
  setLocalData(collectionName, normalizedUpdated);
}

export async function deleteStudent(student: Student) {
  const id = String(student?.id ?? '').trim(); if (!id) throw new Error('Student ID is required.');
  const deletedStudent = { ...student, isDeleted: true, isActive: false, status: 'Inactive', deletedAt: new Date().toISOString() };
  const response = await fetch('/api/db/students', { method: 'PUT', headers: adminHeaders(), body: JSON.stringify([deletedStudent]) });
  if (response.status === 401) { localStorage.removeItem('stm_admin_session_token'); notifyAdminSessionExpired(); throw new Error('Admin session expired. Please login again.'); }
  if (!response.ok) { if (!import.meta.env.PROD) return; throw new Error(`Student delete failed: ${response.status}`); }
  const remaining = normalizeCollectionData('students', getLocalData('students').filter((item) => String(item?.id ?? '') !== id)); setLocalData('students', remaining);
}

export async function resetPersistentDatabase() {
  const response = await fetch('/api/db', { method: 'DELETE', headers: adminHeaders() });
  if (response.status === 401) { localStorage.removeItem('stm_admin_session_token'); notifyAdminSessionExpired(); throw new Error('Admin session expired. Please login again.'); }
  if (!response.ok) throw new Error(`Database reset failed: ${response.status}`);
  collections.forEach((collectionName) => { localStorage.removeItem(`db_${collectionName}`); notifyListeners(collectionName, []); });
}