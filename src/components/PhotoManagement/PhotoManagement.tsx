import React, { useEffect, useMemo, useState } from 'react';
import { Camera, ImagePlus, Loader2, Search, Trash2, Upload, UserRound, Tablet as TabletIcon } from 'lucide-react';
import { Student, Tablet, UserRole } from '../../types';

interface PhotoManagementProps { students: Student[]; tablets: Tablet[]; onSaveStudents: (updated: Student[]) => Promise<void>; onSaveTablets: (updated: Tablet[]) => Promise<void>; activeRole: UserRole; }
type PhotoKind = 'student' | 'tablet';
type PhotoItem = Student | Tablet;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
function isAdminRole(role: UserRole) { return role === 'Super Admin' || role === 'Admin'; }

export const PhotoManagement: React.FC<PhotoManagementProps> = ({ students, tablets, onSaveStudents, onSaveTablets, activeRole }) => {
  const [section, setSection] = useState<PhotoKind>('student');
  const [search, setSearch] = useState('');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const items = useMemo<PhotoItem[]>(() => {
    const source = section === 'student' ? students : tablets; const q = search.trim().toLowerCase(); if (!q) return source;
    return source.filter((item) => { const value = section === 'student' ? `${(item as Student).name} ${(item as Student).pinNumber} ${(item as Student).standard}` : `${(item as Tablet).tabletName} ${(item as Tablet).tabletNumber} ${(item as Tablet).brand} ${(item as Tablet).model}`; return value.toLowerCase().includes(q); });
  }, [section, students, tablets, search]);
  const getPhotoPath = (item: PhotoItem) => item.photoPath;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const entries = await Promise.all(items.filter((item) => getPhotoPath(item)).map(async (item) => {
        try {
          const response = await fetch(`/api/photos/signed-url?kind=${section}&path=${encodeURIComponent(getPhotoPath(item)!)}`, { headers: { 'X-Admin-Role': activeRole } });
          if (!response.ok) return null; const data = await response.json(); return [item.id, data.url] as const;
        } catch { return null; }
      }));
      if (!cancelled) setPhotoUrls((current) => ({ ...current, ...Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, string]>) }));
    };
    if (isAdminRole(activeRole)) load();
    return () => { cancelled = true; };
  }, [items, section, activeRole]);

  const uploadPhoto = async (item: PhotoItem, file: File) => {
    if (!isAdminRole(activeRole)) return setMessage({ type: 'error', text: 'Only Admin or Super Admin can manage photos.' });
    if (!ALLOWED_TYPES.includes(file.type)) return setMessage({ type: 'error', text: 'Only JPG, PNG and WebP images are allowed.' });
    if (file.size > MAX_FILE_SIZE) return setMessage({ type: 'error', text: 'Image size must be 5 MB or less.' });
    setBusyId(item.id); setMessage(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read image.')); reader.readAsDataURL(file); });
      const response = await fetch('/api/photos/upload', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Role': activeRole }, body: JSON.stringify({ kind: section, itemId: item.id, fileName: file.name, contentType: file.type, dataUrl }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Photo upload failed.');
      if (section === 'student') await onSaveStudents(students.map((student) => student.id === item.id ? { ...student, photoPath: result.path } : student));
      else await onSaveTablets(tablets.map((tablet) => tablet.id === item.id ? { ...tablet, photoPath: result.path } : tablet));
      setPhotoUrls((current) => ({ ...current, [item.id]: result.url })); setMessage({ type: 'success', text: 'Photo uploaded successfully.' });
    } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Photo upload failed.' }); }
    finally { setBusyId(null); }
  };

  const deletePhoto = async (item: PhotoItem) => {
    if (!isAdminRole(activeRole)) return setMessage({ type: 'error', text: 'Only Admin or Super Admin can manage photos.' });
    const path = getPhotoPath(item); if (!path || !window.confirm('Delete this photo?')) return;
    setBusyId(item.id); setMessage(null);
    try {
      const response = await fetch('/api/photos/delete', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Role': activeRole }, body: JSON.stringify({ kind: section, path }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Photo deletion failed.');
      if (section === 'student') await onSaveStudents(students.map((student) => student.id === item.id ? { ...student, photoPath: undefined } : student));
      else await onSaveTablets(tablets.map((tablet) => tablet.id === item.id ? { ...tablet, photoPath: undefined } : tablet));
      setPhotoUrls((current) => { const next = { ...current }; delete next[item.id]; return next; }); setMessage({ type: 'success', text: 'Photo deleted successfully.' });
    } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Photo deletion failed.' }); }
    finally { setBusyId(null); }
  };

  return <section className="space-y-5">
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"><div><div className="flex items-center gap-2"><div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600"><Camera className="w-5 h-5" /></div><h2 className="text-xl font-black text-slate-900">Photo Management</h2><span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase">NEW</span></div><p className="mt-1 text-sm text-slate-500">Manage student and tablet photos securely from the admin portal.</p></div><div className="relative w-full lg:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={section === 'student' ? 'Search students...' : 'Search tablets...'} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400" /></div></div>
    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit"><button onClick={() => setSection('student')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${section === 'student' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}><UserRound className="w-4 h-4" /> Student Photos</button><button onClick={() => setSection('tablet')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${section === 'tablet' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}><TabletIcon className="w-4 h-4" /> Tablet Photos</button></div>
    {message && <div className={`rounded-xl px-4 py-3 text-sm font-semibold border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{message.text}</div>}
    {!isAdminRole(activeRole) && <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm font-semibold">Photo upload and deletion are available only to Admin and Super Admin.</div>}
    {items.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">No {section === 'student' ? 'students' : 'tablets'} found.</div> : <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">{items.map((item) => { const student = section === 'student' ? item as Student : null; const tablet = section === 'tablet' ? item as Tablet : null; const label = student?.name || tablet?.tabletName || 'Unknown'; const subLabel = student ? `${student.pinNumber} • ${student.standard}` : `${tablet?.tabletNumber} • ${tablet?.brand || ''} ${tablet?.model || ''}`; const photo = photoUrls[item.id]; return <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm"><div className="aspect-[4/3] rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center mb-4">{photo ? <img src={photo} alt={label} className="w-full h-full object-cover" /> : <ImagePlus className="w-10 h-10 text-slate-300" />}</div><h3 className="font-extrabold text-slate-900 truncate">{label}</h3><p className="text-xs text-slate-500 truncate mt-1">{subLabel}</p><div className="flex items-center gap-2 mt-4"><label className={`flex-1 cursor-pointer inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${isAdminRole(activeRole) ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>{busyId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{photo ? 'Change Photo' : 'Upload Photo'}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={!isAdminRole(activeRole) || busyId === item.id} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadPhoto(item, file); e.currentTarget.value = ''; }} /></label>{photo && <button onClick={() => deletePhoto(item)} disabled={!isAdminRole(activeRole) || busyId === item.id} className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50" title="Delete photo"><Trash2 className="w-4 h-4" /></button>}</div></div>; })}</div>}
  </section>;
};
