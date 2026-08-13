
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
  password?: string; // Stored only locally for mock auth
}

const CURRENT_USER_KEY = 'stm_current_user_v3';

export function getCurrentUser(): AppUser | null {
  try {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    return stored ? JSON.parse(stored) : null;
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
  setCurrentUser(null);
}
