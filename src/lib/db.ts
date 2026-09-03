import { Student, Tablet, TabletBox, TabletAssignment, DailyAttendanceRecord, AttendanceDetail, AttendanceStatus, AuditLog, TabletMovement } from '../types';

const listeners: Record<string, Set<(data: any[]) => void>> = {};
const collections = ['students', 'tablets', 'boxes', 'assignments', 'attendance', 'movements', 'auditLogs', 'studentSessions', 'checkoutRequests', 'adminOtps', 'adminSessions'];
const REFRESH_INTERVAL_MS = 3000;

function adminHeaders(extra: Record<string, string> = {}) {
  const token = localStorage.getItem('stm_admin_session_token') || '';
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}
function notifyListeners(collectionName: string, data: any[]) { listeners[collectionName]?.forEach((callback) => callback(data)); }
function getLocalData(collectionName: string): any[] { try { const data = localStorage.getItem(`db_${collectionName}`); return data ? JSON.parse(data) : []; } catch { return []; } }
function setLocalData(collectionName: string, data: any[]) { localStorage.setItem(`db_${collectionName}`, JSON.stringify(data)); notifyListeners(collectionName, data); }
function notifyAdminSessionExpired() { window.dispatchEvent(new CustomEvent('stm-admin-session-expired')); }

function formatAttendanceTime(value: unknown): string | undefined {
  if (!value) return undefined;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDuration(minutes: unknown): string | undefined {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total < 0) return undefined;
  const rounded = Math.round(total);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function normalizeAttendanceRows(rows: any[]): DailyAttendanceRecord[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const legacyRows = rows.filter((row) => Array.isArray(row?.details));
  const sessionRows = rows.filter((row) => !Array.isArray(row?.details) && (row?.studentId || row?.sessionId));
  if (sessionRows.length === 0) return legacyRows.map((record) => ({ ...record, details: Array.isArray(record?.details) ? record.details.filter(Boolean) : [] }));

  const byDate = new Map<string, any[]>();
  for (const row of sessionRows) {
    const date = String(row?.date || row?.startedAt || row?.returnedAt || '').slice(0, 10);
    if (!date) continue;
    const list = byDate.get(date) || [];
    list.push(row);
    byDate.set(date, list);
  }

  const result: DailyAttendanceRecord[] = [];
  for (const [date, dateRows] of byDate.entries()) {
    const latestByStudent = new Map<string, any>();
    for (const row of dateRows) {
      const studentId = String(row?.studentId ?? row?.studentID ?? '').trim();
      if (!studentId) continue;
      const previous = latestByStudent.get(studentId);
      const rowTime = new Date(String(row?.startedAt || row?.returnedAt || 0)).getTime();
      const previousTime = previous ? new Date(String(previous?.startedAt || previous?.returnedAt || 0)).getTime() : -1;
      if (!previous || rowTime >= previousTime) latestByStudent.set(studentId, row);
    }

    const details: AttendanceDetail[] = Array.from(latestByStudent.values()).map((row: any) => {
      const rawStatus = String(row?.status ?? '').trim().toUpperCase();
      const status: AttendanceStatus = rawStatus === 'OUT' || rawStatus === 'CHECKED OUT' ? 'Checked Out' : 'Checked In';
      return {
        studentId: String(row?.studentId ?? row?.studentID ?? ''),
        studentName: String(row?.studentName ?? 'Student'),
        pinNumber: String(row?.pinNumber ?? ''),
        standard: row?.standard,
        isCoachingStudent: Boolean(row?.isCoachingStudent),
        assignedTabletNumber: String(row?.tabletId ?? row?.assignedTabletNumber ?? '').trim() || undefined,
        status,
        checkInTime: formatAttendanceTime(row?.startedAt ?? row?.checkInTime),
        checkOutTime: formatAttendanceTime(row?.returnedAt ?? row?.checkOutTime),
        totalDuration: formatDuration(row?.durationMinutes),
        markedAt: formatAttendanceTime(row?.returnedAt ?? row?.startedAt) || new Date().toLocaleTimeString(),
      } as AttendanceDetail;
    });

    const latestTimestamp = dateRows.map((row: any) => String(row?.returnedAt || row?.startedAt || '')).filter(Boolean).sort().pop() || new Date().toISOString();
    result.push({ id: `att-${date}`, date, isLocked: false, submittedBy: 'Student App', submittedAt: formatAttendanceTime(latestTimestamp) || latestTimestamp, details });
  }

  return [...legacyRows.map((record) => ({ ...record, details: Array.isArray(record?.details) ? record.details.filter(Boolean) : [] })), ...result].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function normalizeCollectionData(collectionName: string, data: any[]): any[] {
  if (!Array.isArray(data)) return [];
  const visibleData = collectionName === 'students' ? data.filter((student) => student?.isDeleted !== true && student?.deleted !== true) : data;
  if (collectionName === 'students') return visibleData.map((student) => {
    const rawStatus = String(student?.status ?? '').trim();
    return rawStatus.toLowerCase() === 'approved' ? { ...student, status: 'Active', approvalStatus: 'Approved' } : student;
  });
  if (collectionName === 'tablets') return visibleData.map((tablet) => { const rawStatus = String(tablet?.status ?? '').trim().toLowerCase(); const status = rawStatus === 'assigned' ? 'Assigned' : rawStatus === 'maintenance' ? 'Maintenance' : 'Available'; return { ...tablet, status }; });
  if (collectionName === 'assignments') return visibleData.map((assignment) => ({ ...assignment, status: String(assignment?.status ?? '').trim().toLowerCase() === 'returned' ? 'Returned' : 'Active' }));
  if (collectionName === 'attendance') return normalizeAttendanceRows(visibleData);
  return visibleData;
}

async function fetchCollection(collectionName: string): Promise<any[]> {
  const response = await fetch(`/api/db/${collectionName}?_=${Date.now()}`, { headers: { ...adminHeaders(), 'Cache-Control': 'no-cache' }, cache: 'no-store' });
  if (response.status === 401) { localStorage.removeItem('stm_admin_session_token'); notifyAdminSessionExpired(); throw new Error('Admin session expired. Please login again.'); }
  if (!response.ok) throw new Error(`Database read failed: ${response.status}`);
  return normalizeCollectionData(collectionName, await response.json());
}

export function subscribeToCollection<T>(collectionName: string, callback: (data: T[]) => void) {
  if (!listeners[collectionName]) listeners[collectionName] = new Set();
  listeners[collectionName].add(callback);
  let stopped = false; let refreshing = false;
  const refresh = async () => {
    if (stopped || refreshing || document.visibilityState === 'hidden') return;
    refreshing = true;
    try { const data = await fetchCollection(collectionName); if (!stopped) setLocalData(collectionName, data); }
    catch (error) { console.error(`Failed to refresh ${collectionName} from the database`, error); if (!stopped && getLocalData(collectionName).length === 0 && import.meta.env.PROD) callback([]); }
    finally { refreshing = false; }
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
    try {
      const role = localStorage.getItem('stm_active_role_v3') || '';
      const credentialsResponse = await fetch('/api/photos/student/credentials', { method: 'POST', headers: adminHeaders({ 'x-admin-role': role }), body: JSON.stringify({ studentIds: normalizedUpdated.map((item) => item.id) }) });
      if (credentialsResponse.status === 401) { localStorage.removeItem('stm_admin_session_token'); notifyAdminSessionExpired(); throw new Error('Admin session expired. Please login again.'); }
      if (credentialsResponse.ok) {
        const data = await credentialsResponse.json();
        setLocalData(collectionName, Array.isArray(data.students) ? normalizeCollectionData(collectionName, data.students) : normalizedUpdated);
        return;
      }
      console.warn(`Student credential provisioning skipped: ${credentialsResponse.status}`);
    } catch (error) {
      if (String(error).includes('Admin session expired')) throw error;
      console.warn('Student credential provisioning skipped:', error);
    }
  }
  setLocalData(collectionName, normalizedUpdated);
}

/**
 * Delete one student using the same full-collection PUT contract as all other
 * student saves. The old implementation sent only the deleted row, which could
 * overwrite the students collection and race with a second save.
 */
export async function deleteStudent(student: Student, currentStudents?: Student[]) {
  const id = String(student?.id ?? '').trim();
  if (!id) throw new Error('Student ID is required.');

  // Use the dedicated server delete API. A collection PUT is an UPSERT and
  // cannot remove rows that are simply omitted from the submitted array.
  const response = await fetch(`/api/student/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: adminHeaders()
  });

  if (response.status === 401) {
    localStorage.removeItem('stm_admin_session_token');
    notifyAdminSessionExpired();
    throw new Error('Admin session expired. Please login again.');
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error || `Student delete failed: ${response.status}`);
  }

  const source = Array.isArray(currentStudents) && currentStudents.length
    ? currentStudents
    : getLocalData('students');
  const remaining = source.filter((item) => String(item?.id ?? '') !== id);
  setLocalData('students', normalizeCollectionData('students', remaining));
}

export async function resetPersistentDatabase() {
  const response = await fetch('/api/db', { method: 'DELETE', headers: adminHeaders() });
  if (response.status === 401) { localStorage.removeItem('stm_admin_session_token'); notifyAdminSessionExpired(); throw new Error('Admin session expired. Please login again.'); }
  if (!response.ok) throw new Error(`Database reset failed: ${response.status}`);
  collections.forEach((collectionName) => { localStorage.removeItem(`db_${collectionName}`); notifyListeners(collectionName, []); });
}