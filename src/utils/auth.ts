import { UserRole } from '../types';

export interface AppUser {
  id: string;
  fullName: string;
  username: string;
  email: string;
  mobileNumber: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  createdAt: string;
  avatarUrl?: string;
}

const USERS_KEY = 'stm_users_v2';
const CURRENT_USER_KEY = 'stm_current_user_v2';

export const DEFAULT_USERS: AppUser[] = [
  {
    id: 'usr-101',
    fullName: 'Meet Devani',
    username: 'meetdevani',
    email: 'meetdevani2003@gmail.com',
    mobileNumber: '+91 00000 00000',
    role: 'Super Admin',
    status: 'Active',
    createdAt: '2026-07-28',
  }
];

export function initUsersStorage(): AppUser[] {
  try {
    const stored = localStorage.getItem(USERS_KEY);
    if (!stored) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    return JSON.parse(stored);
  } catch {
    return DEFAULT_USERS;
  }
}

export function getUsers(): AppUser[] {
  return initUsersStorage();
}

export function saveUsers(users: AppUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getCurrentUser(): AppUser | null {
  try {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: AppUser | null): void {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

export function logoutUser(): void {
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem('token');
}
