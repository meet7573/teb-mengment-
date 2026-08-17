import { Student, Tablet, TabletBox, TabletAssignment, DailyAttendanceRecord, AuditLog } from '../types';

const listeners: Record<string, Set<(data: any[]) => void>> = {};
const collections = ['students', 'tablets', 'boxes', 'assignments', 'attendance', 'auditLogs'];

function notifyListeners(collectionName: string, data: any[]) {
  listeners[collectionName]?.forEach((callback) => callback(data));
}

function getLocalData(collectionName: string): any[] {
  try {
    const data = localStorage.getItem(`db_${collectionName}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setLocalData(collectionName: string, data: any[]) {
  localStorage.setItem(`db_${collectionName}`, JSON.stringify(data));
  notifyListeners(collectionName, data);
}

async function fetchCollection(collectionName: string): Promise<any[]> {
  const response = await fetch(`/api/db/${collectionName}`);
  if (!response.ok) throw new Error(`Database read failed: ${response.status}`);
  return response.json();
}

export function subscribeToCollection<T>(collectionName: string, callback: (data: T[]) => void) {
  if (!listeners[collectionName]) listeners[collectionName] = new Set();
  listeners[collectionName].add(callback);

  // In production, the PostgreSQL database is the source of truth.
  // In local development without a database, keep the existing localStorage fallback.
  fetchCollection(collectionName)
    .then((data) => {
      setLocalData(collectionName, data);
    })
    .catch((error) => {
      if (import.meta.env.PROD) {
        console.error(`Failed to load ${collectionName} from the database`, error);
        callback([]);
      } else {
        callback(getLocalData(collectionName));
      }
    });

  return () => {
    listeners[collectionName]?.delete(callback);
  };
}

export async function syncCollection<T extends { id: string }>(
  collectionName: string,
  _current: T[],
  updated: T[],
) {
  const response = await fetch(`/api/db/${collectionName}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  });

  if (!response.ok) {
    if (!import.meta.env.PROD) {
      setLocalData(collectionName, updated);
      return;
    }
    throw new Error(`Database save failed: ${response.status}`);
  }

  setLocalData(collectionName, updated);
}

export async function resetPersistentDatabase() {
  const response = await fetch('/api/db', { method: 'DELETE' });
  if (!response.ok) throw new Error(`Database reset failed: ${response.status}`);

  collections.forEach((collectionName) => {
    localStorage.removeItem(`db_${collectionName}`);
    notifyListeners(collectionName, []);
  });
}
