import React, { useState } from 'react';
import { Users, Plus, Tablet, CheckCircle2, XCircle, Edit3, Trash2 } from 'lucide-react';
import { Student, StandardGrade, UserRole } from '../../types';
import { deleteStudent } from '../../lib/db';

interface Props {
  students: Student[];
  onSaveStudents: (updated: Student[]) => void;
  activeRole: UserRole;
  onQuickAssignTablet: (student: Student) => void;
}

type ExtendedStudent = Student & { roomNumber?: string; wingNumber?: string; appPin?: string; isDeleted?: boolean };

function normalizePin(value: unknown) {
  return String(value ?? '').replace(/^PIN[-\\s:]*/i, '').replace(/\\D/g, '').slice(0, 4);
}

function getAppPin(student: Student) {
  const s = student as ExtendedStudent;
  return normalizePin(s.pinNumber || s.appPin);
}

function generateLocalUniquePin(students: Student[]) {
  const used = new Set(students.map(getAppPin).filter(pin => /^\\d{4}$/.test(pin)));
  for (let attempt = 0; attempt < 10000; attempt++) {
    const pin = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    if (!used.has(pin)) return pin;
  }
  throw new Error('No unique 4-digit App PIN is available.');
}

export const StudentManagementAutoPin: React.FC<Props> = ({ students, onSaveStudents, onQuickAssignTablet }) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [createdPin, setCreatedPin] = useState('');
  const [editingStudent, setEditingStudent] = useState<ExtendedStudent | null>(null);
  const [form, setForm] = useState({ name: '', standard: 'Std 8' as StandardGrade, coachingType: 'Coaching', roomNumber: '', wingNumber: '', status: 'Active' as 'Active' | 'Inactive' });

  const openCreate = () => {
    setEditingStudent(null);
    setCreatedPin('');
    setError('');
    setSuccessMessage('');
    setForm({ name: '', standard: 'Std 8', coachingType: 'Coaching', roomNumber: '', wingNumber: '', status: 'Active' });
    setOpen(true);
  };

  const openEdit = (student: Student) => {
    const s = student as ExtendedStudent;
    setEditingStudent(s);
    setCreatedPin('');
    setError('');
    setSuccessMessage('');
    setForm({ name: s.name || '', standard: s.standard || 'Std 8', coachingType: s.isCoachingStudent ? 'Coaching' : 'Non-Coaching', roomNumber: s.roomNumber || '', wingNumber: s.wingNumber || '', status: s.status || 'Active' });
    setOpen(true);
  };

  const createStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setCreatedPin('');
    if (!form.name.trim() || !form.roomNumber.trim() || !form.wingNumber.trim()) {
      setError('Name, room and wing are required.');
      return;
    }
    setSaving(true);
    try {
      const appPin = generateLocalUniquePin(students);
      const response = await fetch('/api/student/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), pin: appPin, standard: form.standard, coachingType: form.coachingType, roomNumber: form.roomNumber.trim(), wingNumber: form.wingNumber.trim() })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || `Student creation failed (${response.status}).`);
      const apiStudent = result?.student;
      if (!apiStudent?.id) throw new Error('Student was created but the server did not return a student ID.');
      const newStudent: ExtendedStudent = {
        id: String(apiStudent.id),
        name: String(apiStudent.name || form.name.trim()),
        pinNumber: `PIN-${appPin}`,
        standard: form.standard,
        isCoachingStudent: form.coachingType === 'Coaching',
        status: 'Active',
        roomNumber: form.roomNumber.trim(),
        wingNumber: form.wingNumber.trim(),
        assignedTabletId: undefined,
        createdAt: new Date().toISOString().slice(0, 10)
      };
      onSaveStudents([newStudent, ...students.filter(student => student.id !== newStudent.id)]);
      setSuccessMessage(`Student registered successfully. App PIN: ${appPin}`);
      setCreatedPin(appPin);
      setForm({ name: '', standard: 'Std 8', coachingType: 'Coaching', roomNumber: '', wingNumber: '', status: 'Active' });
      setOpen(false);
      setEditingStudent(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Student creation failed.');
    } finally {
      setSaving(false);
    }
  };

  const updateStudent = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!editingStudent) return;
    if (!form.name.trim() || !form.roomNumber.trim() || !form.wingNumber.trim()) {
      setError('Name, room and wing are required.');
      return;
    }
    const updated = students.map(student => student.id === editingStudent.id ? ({ ...student, name: form.name.trim(), standard: form.standard, isCoachingStudent: form.coachingType === 'Coaching', status: form.status, roomNumber: form.roomNumber.trim(), wingNumber: form.wingNumber.trim() } as Student) : student);
    onSaveStudents(updated);
    setSuccessMessage('Student details updated successfully.');
    setOpen(false);
    setEditingStudent(null);
  };

  const handleDelete = async (student: Student) => {
    if (deletingId) return;
    const confirmed = window.confirm(`Delete ${student.name}? This will remove the student from the active student list and disable Student App login.`);
    if (!confirmed) return;
    setDeletingId(student.id);
    setError('');
    setSuccessMessage('');
    try {
      await deleteStudent(student);
      onSaveStudents(students.filter(item => item.id !== student.id));
      setSuccessMessage(`${student.name} was deleted successfully.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Student delete failed.');
    } finally {
      setDeletingId('');
    }
  };

  return <div className="space-y-4 w-full">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <div><h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Users className="w-6 h-6 text-indigo-600" />Student Directory & Management</h2><p className="text-xs text-slate-500 mt-1">Admin creates students with an automatic unique 4-digit App PIN. PIN cannot be manually changed.</p></div>
      <button onClick={openCreate} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center gap-2"><Plus className="w-4 h-4" />Create Student</button>
    </div>
    {successMessage && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">{successMessage}</div>}
    {error && !open && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">{error}</div>}
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 font-bold">Students ({students.length})</div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="text-left px-6 py-3">Student</th><th className="text-left px-6 py-3">App PIN</th><th className="text-left px-6 py-3">Standard</th><th className="text-left px-6 py-3">Type</th><th className="text-left px-6 py-3">Tablet</th><th className="text-left px-6 py-3">Status</th><th className="px-6 py-3">Action</th></tr></thead><tbody>{students.map(student => { const appPin = getAppPin(student); const isDeleting = deletingId === student.id; return <tr key={student.id} className="border-t border-slate-100"><td className="px-6 py-4 font-semibold">{student.name}</td><td className="px-6 py-4 font-mono font-bold tracking-widest">{appPin || '—'}</td><td className="px-6 py-4">{student.standard}</td><td className="px-6 py-4">{student.isCoachingStudent ? 'Coaching' : 'Non-Coaching'}</td><td className="px-6 py-4">{student.assignedTabletNumber || student.assignedTabletId || 'Unassigned'}</td><td className="px-6 py-4">{student.status === 'Active' ? <span className="text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />Active</span> : <span className="text-red-600 inline-flex items-center gap-1"><XCircle className="w-4 h-4" />Inactive</span>}</td><td className="px-6 py-4 text-center"><div className="flex justify-center gap-2"><button onClick={() => openEdit(student)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 font-semibold"><Edit3 className="w-4 h-4" />Edit</button><button onClick={() => onQuickAssignTablet(student)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 font-semibold"><Tablet className="w-4 h-4" />Assign</button><button onClick={() => handleDelete(student)} disabled={isDeleting} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-red-50 text-red-700 font-semibold disabled:opacity-50"><Trash2 className="w-4 h-4" />{isDeleting ? 'Deleting...' : 'Delete'}</button></div></td></tr>; })}</tbody></table>{students.length === 0 && <div className="p-10 text-center text-slate-500">No students found.</div>}</div>
    </div>
    {open && <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}><form onSubmit={editingStudent ? updateStudent : createStudent} className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 space-y-4"><div><h3 className="text-xl font-bold">{editingStudent ? 'Update Student' : 'Create Student'}</h3><p className="text-sm text-slate-500 mt-1">{editingStudent ? 'Update student details. The existing App PIN will remain unchanged.' : 'No PIN field is shown. A unique 4-digit App PIN is generated automatically.'}</p></div><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Student Name" className="w-full rounded-xl border border-slate-300 px-4 py-3" autoFocus /><select value={form.standard} onChange={e => setForm({ ...form, standard: e.target.value as StandardGrade })} className="w-full rounded-xl border border-slate-300 px-4 py-3"><option>Std 8</option><option>Std 9</option><option>Std 10</option><option>Std 11</option><option>Std 12</option></select><select value={form.coachingType} onChange={e => setForm({ ...form, coachingType: e.target.value })} className="w-full rounded-xl border border-slate-300 px-4 py-3"><option>Coaching</option><option>Non-Coaching</option></select><div className="grid grid-cols-2 gap-3"><input value={form.roomNumber} onChange={e => setForm({ ...form, roomNumber: e.target.value })} placeholder="Room Number" className="w-full rounded-xl border border-slate-300 px-4 py-3" /><input value={form.wingNumber} onChange={e => setForm({ ...form, wingNumber: e.target.value })} placeholder="Wing Number" className="w-full rounded-xl border border-slate-300 px-4 py-3" /></div>{editingStudent && <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'Active' | 'Inactive' })} className="w-full rounded-xl border border-slate-300 px-4 py-3"><option>Active</option><option>Inactive</option></select>}{error && <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="px-4 py-3 rounded-xl border border-slate-300 font-semibold">Cancel</button>{!editingStudent && <button disabled={saving} className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-60">{saving ? 'Creating...' : 'Create Student'}</button>}{editingStudent && <button type="submit" className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold">Update Student</button>}</div></form></div>}
  </div>;
};