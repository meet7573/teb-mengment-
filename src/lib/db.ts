import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { Student, Tablet, TabletBox, TabletAssignment, DailyAttendanceRecord, AuditLog } from '../types';

export function subscribeToCollection<T>(collectionName: string, callback: (data: T[]) => void) {
  return onSnapshot(collection(db, collectionName), (snapshot) => {
    const data = snapshot.docs.map(doc => doc.data() as T);
    callback(data);
  });
}

export async function syncCollection<T extends { id: string }>(collectionName: string, current: T[], updated: T[]) {
  const batch = writeBatch(db);
  const currentIds = new Set(current.map(i => i.id));
  const updatedIds = new Set(updated.map(i => i.id));
  
  // Insert / Update
  for (const item of updated) {
    const existing = current.find(i => i.id === item.id);
    if (!existing || JSON.stringify(existing) !== JSON.stringify(item)) {
      batch.set(doc(db, collectionName, item.id), item);
    }
  }
  
  // Delete
  for (const id of currentIds) {
    if (!updatedIds.has(id)) {
      batch.delete(doc(db, collectionName, id));
    }
  }
  
  await batch.commit();
}
