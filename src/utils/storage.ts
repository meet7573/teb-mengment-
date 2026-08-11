import { Student, Tablet, TabletBox, TabletAssignment, DailyAttendanceRecord, AuditLog, UserRole } from '../types';
import { db } from '../lib/firebase';
import { collection, setDoc, doc, getDocs, writeBatch } from 'firebase/firestore';

const KEYS = {
  THEME: 'stm_theme_v3',
  ACTIVE_ROLE: 'stm_active_role_v3',
};

// Client-side local storage (for theme and role preferences)
export function getStoredRole(): UserRole {
  return (localStorage.getItem(KEYS.ACTIVE_ROLE) as UserRole) || 'Super Admin';
}

export function saveStoredRole(role: UserRole) {
  localStorage.setItem(KEYS.ACTIVE_ROLE, role);
}

// Global Reset - wipes Firestore
export async function clearAllDatabase() {
  const batch = writeBatch(db);
  const collections = ['students', 'tablets', 'boxes', 'assignments', 'attendance', 'auditLogs'];
  for (const c of collections) {
    const snap = await getDocs(collection(db, c));
    snap.docs.forEach(d => batch.delete(d.ref));
  }
  await batch.commit();
}

export async function logAuditAction(userName: string, userRole: UserRole, action: string, module: AuditLog['module'], details: string) {
  const newLog: AuditLog = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    userName,
    userRole,
    action,
    module,
    details,
  };
  await setDoc(doc(db, 'auditLogs', newLog.id), newLog);
}

// We need a helper for capacity checks that queries firestore, but since it's used synchronously we can fetch the local state from App.tsx instead.
// Wait, `validateBoxCapacity` is called in `TabletBoxManagement.tsx` synchronously!
// It was reading from `getTablets()`. Since we removed `getTablets()`, we must pass `tablets` to `validateBoxCapacity`.

export function validateBoxCapacity(tablets: Tablet[], boxId: string, addingCount: number): { valid: boolean; currentCount: number; availableSpace: number; message: string } {
  const currentCount = tablets.filter(t => t.boxId === boxId).length;
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
