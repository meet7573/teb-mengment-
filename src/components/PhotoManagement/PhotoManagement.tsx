import React, { useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, Search, Trash2, Upload, UserRound, Tablet as TabletIcon } from 'lucide-react';
import { Student, Tablet, UserRole } from '../../types';

interface Props {
  students: Student[];
  tablets: Tablet[];
  onSaveStudents: (items: Student[]) => Promise<void>;
  onSaveTablets: (items: Tablet[]) => Promise<void>;
  activeRole: UserRole;
}

type Tab = 'students' | 'tablets';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function resizePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Only JPG, PNG and WebP images are allowed.');
  if (file.size > MAX_FILE_SIZE) throw new Error('Image size must be 5 MB or less.');
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unable to read image.')); };
    image.src = url;
  });
  const max = 900;
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing is not supported by this browser.');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

export const PhotoManagement: React.FC<Props> = ({ students, tablets, onSaveStudents, onSaveTablets, activeRole }) => {
  const [tab, setTab] = useState<Tab>('students');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const studentInput = useRef<HTMLInputElement>(null);
  const tabletInput = useRef<HTMLInputElement>(null);

  const isAdmin = activeRole === 'Admin' || activeRole === 'Super Admin';
  const filteredStudents = useMemo(() => students.filter(s => `${s.name} ${s.pinNumber} ${s.standard}`.toLowerCase().includes(query.toLowerCase())), [students, query]);
  const filteredTablets = useMemo(() => tablets.filter(t => `${t.tabletName} ${t.tabletNumber} ${t.brand} ${t.model}`.toLowerCase().includes(query.toLowerCase())), [tablets, query]);

  const uploadStudent = async (student: Student, file?: File) => {
    if (!file) return;
    setBusyId(student.id); setError('');
    try { const photoPath = await resizePhoto(file); await onSaveStudents(students.map(s => s.id === student.id ? { ...s, photoPath } : s)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Photo upload failed.'); }
    finally { setBusyId(null); }
  };
  const uploadTablet = async (tablet: Tablet, file?: File) => {
    if (!file) return;
    setBusyId(tablet.id); setError('');
    try { const photoPath = await resizePhoto(file); await onSaveTablets(tablets.map(t => t.id === tablet.id ? { ...t, photoPath } : t)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Photo upload failed.'); }
    finally { setBusyId(null); }
  };
  const removeStudent = async (student: Student) => { if (!isAdmin) return; await onSaveStudents(students.map(s => s.id === student.id ? { ...s, photoPath: undefined } : s)); };
  const removeTablet = async (tablet: Tablet) => { if (!isAdmin) return; await onSaveTablets(tablets.map(t => t.id === tablet.id ? { ...t, photoPath: undefined } : t)); };

  return <section className="max-w-7xl mx-auto space-y-5">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div><div className="flex items-center gap-2"><Camera className="w-6 h-6 text-blue-600" /><h2 className="text-2xl font-black text-slate-900">Photo Management</h2><span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-black">NEW</span></div><p className="text-sm text-slate-500 mt-1">Manage student and tablet photos from one secure admin screen.</p></div>
      <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search student or tablet..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500/20" /></div>
    </div>
    <div className="bg-white border border-slate-200 rounded-2xl p-1.5 flex gap-1 w-fit shadow-sm"><button onClick={() => setTab('students')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${tab === 'students' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><UserRound className="w-4 h-4" />Student Photos</button><button onClick={() => setTab('tablets')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${tab === 'tablets' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><TabletIcon className="w-4 h-4" />Tablet Photos</button></div>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
    {!isAdmin && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Photo management is available only to Admin and Super Admin.</div>}
    {tab === 'students' ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{filteredStudents.map(student => <div key={student.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm"><div className="flex gap-4 items-center"><div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">{student.photoPath ? <img src={student.photoPath} alt={student.name} className="w-full h-full object-cover" /> : <UserRound className="w-8 h-8 text-slate-400" />}</div><div className="min-w-0 flex-1"><h3 className="font-black text-slate-900 truncate">{student.name}</h3><p className="text-xs text-slate-500">{student.pinNumber} · {student.standard}</p><span className="text-[10px] font-bold text-slate-500">{student.photoPath ? 'Photo added' : 'No photo'}</span></div></div><div className="mt-4 flex gap-2"><input ref={studentInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => uploadStudent(student, e.target.files?.[0])} /><button disabled={!isAdmin || busyId === student.id} onClick={() => studentInput.current?.click()} className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50"><Upload className="w-3.5 h-3.5 inline mr-1" />{busyId === student.id ? 'Saving...' : student.photoPath ? 'Change Photo' : 'Add Photo'}</button>{student.photoPath && <button disabled={!isAdmin} onClick={() => removeStudent(student)} className="px-3 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>}</div></div>)}</div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{filteredTablets.map(tablet => <div key={tablet.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm"><div className="flex gap-4 items-center"><div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">{tablet.photoPath ? <img src={tablet.photoPath} alt={tablet.tabletName} className="w-full h-full object-cover" /> : <ImagePlus className="w-8 h-8 text-slate-400" />}</div><div className="min-w-0 flex-1"><h3 className="font-black text-slate-900 truncate">{tablet.tabletName}</h3><p className="text-xs text-slate-500">{tablet.tabletNumber} · {tablet.brand} {tablet.model}</p><span className="text-[10px] font-bold text-slate-500">{tablet.photoPath ? 'Photo added' : 'No photo'}</span></div></div><div className="mt-4 flex gap-2"><input ref={tabletInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => uploadTablet(tablet, e.target.files?.[0])} /><button disabled={!isAdmin || busyId === tablet.id} onClick={() => tabletInput.current?.click()} className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50"><Upload className="w-3.5 h-3.5 inline mr-1" />{busyId === tablet.id ? 'Saving...' : tablet.photoPath ? 'Change Photo' : 'Add Photo'}</button>{tablet.photoPath && <button disabled={!isAdmin} onClick={() => removeTablet(tablet)} className="px-3 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>}</div></div>)}</div>}
  </section>;
};
