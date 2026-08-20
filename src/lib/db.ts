import { Student, Tablet, TabletBox, TabletAssignment, DailyAttendanceRecord, AuditLog } from '../types';

const listeners: Record<string, Set<(data: any[]) => void>> = {};
const collections = ['students', 'tablets', 'boxes', 'assignments', 'attendance', 'auditLogs'];

function adminHeaders(extra: Record<string, string> = {}) {
  const token = localStorage.getItem('stm_admin_session_token') || '';
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}
function notifyListeners(collectionName: string, data: any[]) { listeners[collectionName]?.forEach((callback) => callback(data)); }
function getLocalData(collectionName: string): any[] { try { const data = localStorage.getItem(`db_${collectionName}`); return data ? JSON.parse(data) : []; } catch { return []; } }
function setLocalData(collectionName: string, data: any[]) { localStorage.setItem(`db_${collectionName}`, JSON.stringify(data)); notifyListeners(collectionName, data); }

function normalizeCollectionData(collectionName: string, data: any[]): any[] {
  if (!Array.isArray(data)) return [];
  const visibleData = collectionName === 'students' ? data.filter((student) => student?.isDeleted !== true && student?.deleted !== true) : data;
  if (collectionName === 'tablets') return visibleData.map((tablet) => { const rawStatus = String(tablet?.status ?? '').trim().toLowerCase(); const status = rawStatus === 'assigned' ? 'Assigned' : rawStatus === 'maintenance' ? 'Maintenance' : 'Available'; return { ...tablet, status }; });
  if (collectionName === 'assignments') return visibleData.map((assignment) => ({ ...assignment, status: String(assignment?.status ?? '').trim().toLowerCase() === 'returned' ? 'Returned' : 'Active' }));
  return visibleData;
}

async function fetchCollection(collectionName: string): Promise<any[]> {
  const response = await fetch(`/api/db/${collectionName}`, { headers: adminHeaders() });
  if (!response.ok) throw new Error(`Database read failed: ${response.status}`);
  return normalizeCollectionData(collectionName, await response.json());
}

export function subscribeToCollection<T>(collectionName: string, callback: (data: T[]) => void) {
  if (!listeners[collectionName]) listeners[collectionName] = new Set(); listeners[collectionName].add(callback);
  fetchCollection(collectionName).then((data) => setLocalData(collectionName, data)).catch((error) => { if (import.meta.env.PROD) { console.error(`Failed to load ${collectionName} from the database`, error); callback([]); } else callback(normalizeCollectionData(collectionName, getLocalData(collectionName))); });
  return () => { listeners[collectionName]?.delete(callback); };
}

export async function syncCollection<T extends { id: string }>(collectionName: string, _current: T[], updated: T[]) {
  const normalizedUpdated = normalizeCollectionData(collectionName, updated) as T[];
  const response = await fetch(`/api/db/${collectionName}`, { method: 'PUT', headers: adminHeaders(), body: JSON.stringify(normalizedUpdated) });
  if (!response.ok) { if (!import.meta.env.PROD) { setLocalData(collectionName, normalizedUpdated); return; } throw new Error(`Database save failed: ${response.status}`); }
  if (collectionName === 'students') {
    const role = localStorage.getItem('stm_active_role_v3') || '';
    const credentialsResponse = await fetch('/api/photos/student/credentials', { method: 'POST', headers: adminHeaders({ 'x-admin-role': role }), body: JSON.stringify({ studentIds: normalizedUpdated.map((item) => item.id) }) });
    if (!credentialsResponse.ok) { if (!import.meta.env.PROD) { setLocalData(collectionName, normalizedUpdated); return; } throw new Error(`Student credential provisioning failed: ${credentialsResponse.status}`); }
    const data = await credentialsResponse.json(); setLocalData(collectionName, Array.isArray(data.students) ? normalizeCollectionData(collectionName, data.students) : normalizedUpdated); return;
  }
  setLocalData(collectionName, normalizedUpdated);
}

export async function deleteStudent(student: Student) {
  const id = String(student?.id ?? '').trim(); if (!id) throw new Error('Student ID is required.');
  const deletedStudent = { ...student, isDeleted: true, isActive: false, status: 'Inactive', deletedAt: new Date().toISOString() };
  const response = await fetch('/api/db/students', { method: 'PUT', headers: adminHeaders(), body: JSON.stringify([deletedStudent]) });
  if (!response.ok) { if (!import.meta.env.PROD) return; throw new Error(`Student delete failed: ${response.status}`); }
  const remaining = normalizeCollectionData('students', getLocalData('students').filter((item) => String(item?.id ?? '') !== id)); setLocalData('students', remaining);
}

export async function resetPersistentDatabase() {
  const response = await fetch('/api/db', { method: 'DELETE', headers: adminHeaders() });
  if (!response.ok) throw new Error(`Database reset failed: ${response.status}`);
  collections.forEach((collectionName) => { localStorage.removeItem(`db_${collectionName}`); notifyListeners(collectionName, []); });
}
