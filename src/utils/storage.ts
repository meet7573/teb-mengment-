import { Student, Tablet, TabletBox, TabletAssignment, DailyAttendanceRecord, AuditLog, UserRole } from '../types';
import { mockStudents, mockTablets, mockTabletBoxes, mockAssignments, mockAttendanceRecords, mockAuditLogs } from '../data/mockData';

const KEYS = {
  STUDENTS: 'stm_clean_students_v3',
  TABLETS: 'stm_clean_tablets_v3',
  BOXES: 'stm_clean_boxes_v3',
  ASSIGNMENTS: 'stm_clean_assignments_v3',
  ATTENDANCE: 'stm_clean_attendance_v3',
  LOGS: 'stm_clean_audit_logs_v3',
  THEME: 'stm_theme_v3',
  ACTIVE_ROLE: 'stm_active_role_v3',
  INIT_FLAG: 'stm_clean_initialized_v3',
};

export function clearAllDatabase() {
  localStorage.setItem(KEYS.STUDENTS, JSON.stringify([]));
  localStorage.setItem(KEYS.TABLETS, JSON.stringify([]));
  localStorage.setItem(KEYS.BOXES, JSON.stringify([]));
  localStorage.setItem(KEYS.ASSIGNMENTS, JSON.stringify([]));
  localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify([]));
  localStorage.setItem(KEYS.LOGS, JSON.stringify([]));
  localStorage.setItem(KEYS.INIT_FLAG, 'true');
}

// Initializer
export function initLocalStorage(forceReset = false) {
  if (forceReset) {
    clearAllDatabase();
    return;
  }
  if (!localStorage.getItem(KEYS.INIT_FLAG)) {
    clearAllDatabase();
  }
}

// Students API
export function getStudents(): Student[] {
  initLocalStorage();
  try {
    return JSON.parse(localStorage.getItem(KEYS.STUDENTS) || '[]');
  } catch {
    return [];
  }
}

export function saveStudents(students: Student[]) {
  localStorage.setItem(KEYS.STUDENTS, JSON.stringify(students));
}

// Tablets API
export function getTablets(): Tablet[] {
  initLocalStorage();
  try {
    return JSON.parse(localStorage.getItem(KEYS.TABLETS) || '[]');
  } catch {
    return [];
  }
}

export function saveTablets(tablets: Tablet[]) {
  localStorage.setItem(KEYS.TABLETS, JSON.stringify(tablets));
}

// Tablet Boxes API
export function getTabletBoxes(): TabletBox[] {
  initLocalStorage();
  try {
    const rawBoxes: TabletBox[] = JSON.parse(localStorage.getItem(KEYS.BOXES) || '[]');
    const allTablets = getTablets();
    // Re-bind fresh tablets inside each box dynamically
    return rawBoxes.map(box => ({
      ...box,
      capacity: 7, // Enforce capacity strictly
      tablets: allTablets.filter(t => t.boxId === box.id),
    }));
  } catch {
    return [];
  }
}

export function saveTabletBoxes(boxes: TabletBox[]) {
  localStorage.setItem(KEYS.BOXES, JSON.stringify(boxes));
}

// Tablet Assignments API
export function getAssignments(): TabletAssignment[] {
  initLocalStorage();
  try {
    return JSON.parse(localStorage.getItem(KEYS.ASSIGNMENTS) || '[]');
  } catch {
    return [];
  }
}

export function saveAssignments(assignments: TabletAssignment[]) {
  localStorage.setItem(KEYS.ASSIGNMENTS, JSON.stringify(assignments));
}

// Attendance API
export function getAttendanceRecords(): DailyAttendanceRecord[] {
  initLocalStorage();
  try {
    return JSON.parse(localStorage.getItem(KEYS.ATTENDANCE) || '[]');
  } catch {
    return [];
  }
}

export function saveAttendanceRecords(records: DailyAttendanceRecord[]) {
  localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(records));
}

// Audit Logs API
export function getAuditLogs(): AuditLog[] {
  initLocalStorage();
  try {
    return JSON.parse(localStorage.getItem(KEYS.LOGS) || '[]');
  } catch {
    return [];
  }
}

export function logAuditAction(userName: string, userRole: UserRole, action: string, module: AuditLog['module'], details: string) {
  const logs = getAuditLogs();
  const newLog: AuditLog = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    userName,
    userRole,
    action,
    module,
    details,
  };
  const updated = [newLog, ...logs];
  localStorage.setItem(KEYS.LOGS, JSON.stringify(updated));
  return updated;
}

// Active Role Helper
export function getStoredRole(): UserRole {
  return (localStorage.getItem(KEYS.ACTIVE_ROLE) as UserRole) || 'Super Admin';
}

export function saveStoredRole(role: UserRole) {
  localStorage.setItem(KEYS.ACTIVE_ROLE, role);
}

// Strict Box Capacity Check
export function validateBoxCapacity(boxId: string, addingCount: number): { valid: boolean; currentCount: number; availableSpace: number; message: string } {
  const allTablets = getTablets();
  const currentCount = allTablets.filter(t => t.boxId === boxId).length;
  const availableSpace = 7 - currentCount;
  
  if (currentCount + addingCount > 7) {
    return {
      valid: false,
      currentCount,
      availableSpace,
      message: `Validation Error: Tablet box capacity is strictly limited to 7 tablets. Currently has ${currentCount}/7. Cannot add ${addingCount} more tablet(s).`,
    };
  }
  
  return {
    valid: true,
    currentCount,
    availableSpace,
    message: `Box has space for ${availableSpace} more tablet(s).`,
  };
}
