import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus, Search, Filter, CheckCircle2, XCircle, LogOut, RotateCcw, AlertTriangle } from 'lucide-react';

type MovementStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'OUTSIDE' | 'RETURNED' | 'OVERDUE';
type Movement = {
  id: string; studentName: string; tabletName: string; tabletCode: string;
  movementType: string; startDate: string; expectedReturnDate: string;
  destination: string; reason: string; status: MovementStatus; createdAt: string;
};

const STORAGE_KEY = 'tablet_movement_records';

const getEffectiveStatus = (item: Movement): MovementStatus => {
  if (item.status === 'OUTSIDE' && new Date(item.expectedReturnDate) < new Date(new Date().toDateString())) return 'OVERDUE';
  return item.status;
};

const badgeClass: Record<MovementStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  OUTSIDE: 'bg-violet-50 text-violet-700 border-violet-200',
  RETURNED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OVERDUE: 'bg-red-50 text-red-700 border-red-200',
};

export const TabletMovementManagement: React.FC = () => {
  const [records, setRecords] = useState<Movement[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | MovementStatus>('ALL');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    try { setRecords(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch { setRecords([]); }
  }, []);

  const save = (next: Movement[]) => { setRecords(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); };
  const filtered = useMemo(() => records.filter(r => {
    const effective = getEffectiveStatus(r);
    const q = search.toLowerCase();
    return (status === 'ALL' || effective === status) &&
      [r.studentName, r.tabletName, r.tabletCode, r.movementType].join(' ').toLowerCase().includes(q);
  }), [records, search, status]);

  const counts = useMemo(() => ({
    pending: records.filter(r => getEffectiveStatus(r) === 'PENDING').length,
    approved: records.filter(r => getEffectiveStatus(r) === 'APPROVED').length,
    outside: records.filter(r => getEffectiveStatus(r) === 'OUTSIDE').length,
    overdue: records.filter(r => getEffectiveStatus(r) === 'OVERDUE').length,
  }), [records]);

  const changeStatus = (id: string, nextStatus: MovementStatus) =>
    save(records.map(r => r.id === id ? { ...r, status: nextStatus } : r));

  return <div className="max-w-[1600px] mx-auto space-y-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2"><ClipboardList className="w-6 h-6 text-blue-600"/><h1 className="text-2xl font-black text-slate-900">Tablet Movement Management</h1></div><p className="mt-1 text-sm text-slate-500">Track tablet requests, approvals, check-out, return and overdue records.</p></div>
      <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700"><Plus className="w-4 h-4"/>New Movement</button>
    </div>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[['Pending', counts.pending, 'text-amber-700'], ['Approved', counts.approved, 'text-blue-700'], ['Outside', counts.outside, 'text-violet-700'], ['Overdue', counts.overdue, 'text-red-700']].map(([label, value, color]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div><div className={`mt-2 text-3xl font-black ${color}`}>{value}</div></div>)}
    </div>

    {showForm && <MovementForm onCancel={() => setShowForm(false)} onSave={(item) => { save([{ ...item, id: crypto.randomUUID(), status: 'PENDING', createdAt: new Date().toISOString() }, ...records]); setShowForm(false); }} />}

    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student, tablet or code..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"/></div>
        <div className="relative"><Filter className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><select value={status} onChange={e => setStatus(e.target.value as any)} className="rounded-xl border border-slate-200 py-2.5 pl-9 pr-8 text-sm outline-none"><option value="ALL">All Statuses</option>{(['PENDING','APPROVED','REJECTED','OUTSIDE','RETURNED','OVERDUE'] as MovementStatus[]).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="p-4">Student</th><th className="p-4">Tablet</th><th className="p-4">Type</th><th className="p-4">Start</th><th className="p-4">Expected Return</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>{filtered.length === 0 ? <tr><td colSpan={7} className="p-12 text-center text-sm text-slate-500">No tablet movement records found.</td></tr> : filtered.map(r => { const effective = getEffectiveStatus(r); return <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60"><td className="p-4"><div className="font-bold text-slate-800">{r.studentName}</div><div className="text-xs text-slate-500">{r.destination}</div></td><td className="p-4"><div className="font-semibold">{r.tabletName}</div><div className="text-xs text-slate-500">{r.tabletCode}</div></td><td className="p-4 text-sm">{r.movementType}</td><td className="p-4 text-sm">{r.startDate}</td><td className="p-4 text-sm">{r.expectedReturnDate}</td><td className="p-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${badgeClass[effective]}`}>{effective}</span></td><td className="p-4"><div className="flex justify-end gap-2">{effective === 'PENDING' && <><button onClick={() => changeStatus(r.id, 'APPROVED')} title="Approve" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"><CheckCircle2 className="w-4 h-4"/></button><button onClick={() => changeStatus(r.id, 'REJECTED')} title="Reject" className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><XCircle className="w-4 h-4"/></button></>}{effective === 'APPROVED' && <button onClick={() => changeStatus(r.id, 'OUTSIDE')} title="Check Out" className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"><LogOut className="w-4 h-4"/></button>}{(effective === 'OUTSIDE' || effective === 'OVERDUE') && <button onClick={() => changeStatus(r.id, 'RETURNED')} title="Check In / Return" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"><RotateCcw className="w-4 h-4"/></button>}{effective === 'OVERDUE' && <AlertTriangle className="w-4 h-4 text-red-500 mt-2"/>}</div></td></tr>; })}</tbody></table></div>
    </div>
  </div>;
};

const MovementForm: React.FC<{onCancel:()=>void; onSave:(data:any)=>void}> = ({onCancel,onSave}) => {
  const [form,setForm] = useState({studentName:'',tabletName:'',tabletCode:'',movementType:'Vacation',startDate:'',expectedReturnDate:'',destination:'',reason:''});
  const submit=(e:React.FormEvent)=>{e.preventDefault(); if(new Date(form.expectedReturnDate)<=new Date(form.startDate)){alert('Expected return date must be after start date.');return;} onSave(form);};
  const fields=[['studentName','Student Name'],['tabletName','Tablet Name'],['tabletCode','Tablet Code'],['startDate','Start Date'],['expectedReturnDate','Expected Return Date'],['destination','Destination / Location'],['reason','Reason']];
  return <form onSubmit={submit} className="rounded-2xl border border-blue-200 bg-blue-50/30 p-5 shadow-sm"><h2 className="font-black text-slate-900">Create Tablet Movement</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{fields.map(([key,label])=><label key={key} className="text-xs font-bold text-slate-600">{label}<input required type={key.includes('Date')?'date':'text'} value={(form as any)[key]} onChange={e=>setForm({...form,[key]:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"/></label>)}<label className="text-xs font-bold text-slate-600">Movement Type<select value={form.movementType} onChange={e=>setForm({...form,movementType:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option>Vacation</option><option>Take Home</option><option>Holiday</option><option>Educational Purpose</option><option>Other</option></select></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">Cancel</button><button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">Submit Request</button></div></form>;
};