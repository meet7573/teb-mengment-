import { Tablet, AuditLog, UserRole } from '../types';

const KEYS = {
  THEME: 'stm_theme_v3',
  ACTIVE_ROLE: 'stm_active_role_v3',
};

export function getStoredRole(): UserRole {
  return (localStorage.getItem(KEYS.ACTIVE_ROLE) as UserRole) || 'Super Admin';
}

export function saveStoredRole(role: UserRole) {
  localStorage.setItem(KEYS.ACTIVE_ROLE, role);
}

// Manual reset only. This clears the persistent PostgreSQL database and local cache.
export async function clearAllDatabase() {
  const response = await fetch('/api/db', { method: 'DELETE' });
  if (!response.ok) throw new Error('Could not reset persistent database');

  const collections = ['students', 'tablets', 'boxes', 'assignments', 'attendance', 'auditLogs'];
  for (const c of collections) {
    localStorage.removeItem(`db_${c}`);
  }
}

export async function logAuditAction(
  userName: string,
  userRole: UserRole,
  action: string,
  module: AuditLog['module'],
  details: string,
) {
  const newLog: AuditLog = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    userName,
    userRole,
    action,
    module,
    details,
  };

  const currentLogs = JSON.parse(localStorage.getItem('db_auditLogs') || '[]');
  currentLogs.push(newLog);
  localStorage.setItem('db_auditLogs', JSON.stringify(currentLogs));
}

export function validateBoxCapacity(
  tablets: Tablet[],
  boxId: string,
  addingCount: number,
): { valid: boolean; currentCount: number; availableSpace: number; message: string } {
  const currentCount = tablets.filter((t) => t.boxId === boxId).length;
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
