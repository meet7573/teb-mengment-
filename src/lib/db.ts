import { Student, Tablet, TabletBox, TabletAssignment, DailyAttendanceRecord, AuditLog } from '../types';

// Simple event emitter for localStorage sync
const listeners: Record<string, Set<(data: any[]) => void>> = {};

function notifyListeners(collectionName: string, data: any[]) {
  if (listeners[collectionName]) {
    listeners[collectionName].forEach(callback => callback(data));
  }
}

function getLocalData(collectionName: string): any[] {
  const data = localStorage.getItem(`db_\${collectionName}`);
  return data ? JSON.parse(data) : [];
}

function setLocalData(collectionName: string, data: any[]) {
  localStorage.setItem(`db_\${collectionName}`, JSON.stringify(data));
  notifyListeners(collectionName, data);
}

export function subscribeToCollection<T>(collectionName: string, callback: (data: T[]) => void) {
  if (!listeners[collectionName]) {
    listeners[collectionName] = new Set();
  }
  listeners[collectionName].add(callback);
  
  // Initial load
  callback(getLocalData(collectionName));
  
  // Return unsubscribe function
  return () => {
    listeners[collectionName].delete(callback);
  };
}

export async function syncCollection<T extends { id: string }>(collectionName: string, current: T[], updated: T[]) {
  // We simply replace the whole collection with `updated` in localStorage
  setLocalData(collectionName, updated);
}
