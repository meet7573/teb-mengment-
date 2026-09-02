import React, { useMemo, useState } from 'react';
import { ClipboardList, Plus, Search, Pencil, Trash2, CheckCircle2, XCircle, LogOut, RotateCcw, X } from 'lucide-react';
import { Student, Tablet, TabletAssignment, UserRole, TabletMovement } from '../../types';
import { logAuditAction } from '../../utils/storage';

interface Props {
  movements: TabletMovement[];
  students: Student[];
  tablets: Tablet[];
  assignments: TabletAssignment[];
  activeRole: UserRole;
  onSave: (items: TabletMovement[]) => Promise<void> | void;
}

type Candidate = { id:string; assignmentId:string; studentId:string; studentName:string; pinNumber:string; tabletId:string; tabletName:string; tabletNumber:string };

const today = () => new Date().toISOString().slice(0,10);
const currentStatus = (m:TabletMovement):TabletMovement['status'] =>
  m.status === 'OUTSIDE' && m.expectedReturnDate < today() ? 'OVERDUE' : m.status;

const badge: Record<TabletMovement['status'],string> = {
  PENDING:'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED:'bg-blue-50 text-blue-700 border-blue-200',
  REJECTED:'bg-rose-50 text-rose-700 border-rose-200',
  OUTSIDE:'bg-violet-50 text-violet-700 border-violet-200',
  RETURNED:'bg-emerald-50 text-emerald-700 border-emerald-200',
  OVERDUE:'bg-red-50 text-red-700 border-red-200'
};

function buildCandidates(students:Student[], tablets:Tablet[], assignments:TabletAssignment[]):Candidate[] {
  const result:Candidate[] = [];
  const used = new Set<string>();

  const add = (candidate:Candidate) => {
    const key = candidate.studentId + '|' + candidate.tabletId;
    if (!candidate.studentId || !candidate.tabletId || used.has(key)) return;
    used.add(key);
    result.push(candidate);
  };

  // Assignment records are the primary source. Use the assignment data itself
  // so the dropdown still works even if older Student/Tablet records use
  // different IDs or have not yet refreshed.
  assignments
    .filter(a => String(a.status ?? '').toLowerCase() !== 'returned')
    .forEach(a => add({
      id: 'assignment-' + a.id,
      assignmentId: a.id,
      studentId: String(a.studentId ?? ''),
      studentName: String(a.studentName ?? 'Student'),
      pinNumber: String(a.pinNumber ?? ''),
      tabletId: String(a.tabletId ?? a.tabletNumber ?? ''),
      tabletName: String(a.tabletName ?? a.tabletNumber ?? 'Tablet'),
      tabletNumber: String(a.tabletNumber ?? a.tabletName ?? '')
    }));

  // Fallback: resolve every existing student-to-tablet connection.
  students.forEach(student => {
    const assignedId = String(student.assignedTabletId ?? '').trim();
    const assignedNumber = String(student.assignedTabletNumber ?? '').trim();
    const tablet =
      tablets.find(t => String(t.id) === assignedId) ||
      tablets.find(t => String(t.tabletNumber).trim().toLowerCase() === assignedNumber.toLowerCase()) ||
      tablets.find(t => String(t.assignedToStudentId ?? '') === String(student.id)) ||
      tablets.find(t => String(t.assignedToStudentName ?? '').trim().toLowerCase() === String(student.name ?? '').trim().toLowerCase());

    if (tablet) add({
      id: 'linked-' + student.id + '-' + tablet.id,
      assignmentId: 'linked-' + student.id + '-' + tablet.id,
      studentId: student.id,
      studentName: student.name,
      pinNumber: student.pinNumber,
      tabletId: tablet.id,
      tabletName: tablet.tabletName || tablet.tabletNumber,
      tabletNumber: tablet.tabletNumber
    });
  });

  return result.sort((a,b) => a.studentName.localeCompare(b.studentName));
}

export const TabletMovementManagement:React.FC<Props> = ({movements,students,tablets,assignments,activeRole,onSave}) => {
  const [open,setOpen] = useState(false);
  const [editing,setEditing] = useState<TabletMovement|null>(null);
  const [search,setSearch] = useState('');
  const [saving,setSaving] = useState(false);

  const candidates = useMemo(() => buildCandidates(students,tablets,assignments), [students,tablets,assignments]);
  const list = useMemo(() => movements.filter(m =>
    [m.studentName,m.tabletName,m.tabletNumber,m.movementType,m.status].join(' ').toLowerCase().includes(search.toLowerCase())
  ), [movements,search]);

  const persist = async (next:TabletMovement[]) => { setSaving(true); try { await onSave(next); } finally { setSaving(false); } };

  const updateStatus = async (m:TabletMovement, status:TabletMovement['status']) => {
    await persist(movements.map(x => x.id === m.id ? {...x,status,updatedAt:new Date().toISOString()} : x));
    await logAuditAction('System User',activeRole,'TABLET_MOVEMENT_STATUS','Tablet Movement',m.tabletNumber + ' → ' + status);
  };

  const remove = async (m:TabletMovement) => {
    if (!window.confirm('Delete this tablet movement record?')) return;
    await persist(movements.filter(x => x.id !== m.id));
  };

  return <div className="max-w-[1500px] mx-auto space-y-5">
    <div className="flex items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-black text-slate-900"><ClipboardList className="w-6 h-6 text-blue-600"/>Tablet Movement</h1><p className="text-sm text-slate-500 mt-1">Simple tablet outside movement tracking.</p></div>
      <button onClick={()=>{setEditing(null);setOpen(true)}} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"><Plus className="w-4 h-4"/>Add Movement</button>
    </div>

    {open && <MovementForm candidates={candidates} movements={movements} initial={editing} onCancel={()=>{setOpen(false);setEditing(null)}} onSave={async data=>{
      const now=new Date().toISOString();
      const next = editing
        ? movements.map(x=>x.id===editing.id?{...editing,...data,updatedAt:now}:x)
        : [{...data,id:'movement-'+Date.now(),requestDate:today(),status:'PENDING' as const,createdAt:now,updatedAt:now},...movements];
      await persist(next);
      await logAuditAction('System User',activeRole,editing?'TABLET_MOVEMENT_UPDATED':'TABLET_MOVEMENT_CREATED','Tablet Movement',data.studentName+' - '+data.tabletNumber);
      setOpen(false);setEditing(null);
    }}/>}

    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <div className="relative max-w-xl"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student or tablet..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"/></div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left">
        <thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="p-4">Student</th><th className="p-4">Tablet</th><th className="p-4">Type</th><th className="p-4">Dates</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead>
        <tbody>{list.length===0?<tr><td colSpan={6} className="p-12 text-center text-sm text-slate-500">No movement records found.</td></tr>:list.map(m=>{const s=currentStatus(m);return <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="p-4 font-semibold">{m.studentName}</td><td className="p-4"><div className="font-semibold">{m.tabletName}</div><div className="text-xs text-slate-500">{m.tabletNumber}</div></td><td className="p-4 text-sm">{m.movementType}</td><td className="p-4 text-sm"><div>{m.startDate}</div><div className="text-xs text-slate-500">Return: {m.expectedReturnDate}</div></td><td className="p-4"><span className={'rounded-full border px-2.5 py-1 text-[11px] font-bold '+badge[s]}>{s}</span></td><td className="p-4"><div className="flex justify-end gap-1">
          <button onClick={()=>{setEditing(m);setOpen(true)}} title="Edit" className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"><Pencil className="w-4 h-4"/></button>
          <button onClick={()=>remove(m)} title="Delete" className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 className="w-4 h-4"/></button>
          {s==='PENDING'&&<><button onClick={()=>updateStatus(m,'APPROVED')} title="Approve" className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50"><CheckCircle2 className="w-4 h-4"/></button><button onClick={()=>updateStatus(m,'REJECTED')} title="Reject" className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"><XCircle className="w-4 h-4"/></button></>}
          {s==='APPROVED'&&<button onClick={()=>updateStatus(m,'OUTSIDE')} title="Check Out" className="p-2 rounded-lg text-violet-600 hover:bg-violet-50"><LogOut className="w-4 h-4"/></button>}
          {(s==='OUTSIDE'||s==='OVERDUE')&&<button onClick={()=>updateStatus(m,'RETURNED')} title="Return" className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50"><RotateCcw className="w-4 h-4"/></button>}
        </div></td></tr>})}</tbody>
      </table></div>
    </div>
    {saving&&<div className="fixed bottom-5 right-5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Saving...</div>}
  </div>;
};

const MovementForm:React.FC<{candidates:Candidate[];movements:TabletMovement[];initial:TabletMovement|null;onCancel:()=>void;onSave:(data:any)=>Promise<void>}> = ({candidates,movements,initial,onCancel,onSave}) => {
  const initialCandidate = initial ? candidates.find(c=>c.studentId===initial.studentId&&c.tabletId===initial.tabletId) : undefined;
  const [candidateId,setCandidateId] = useState(initialCandidate?.id || '');
  const [movementType,setMovementType] = useState(initial?.movementType || 'Vacation');
  const [startDate,setStartDate] = useState(initial?.startDate || today());
  const [returnDate,setReturnDate] = useState(initial?.expectedReturnDate || '');
  const [destination,setDestination] = useState(initial?.destination || '');
  const [reason,setReason] = useState(initial?.reason || '');
  const [error,setError] = useState('');
  const selected = candidates.find(c=>c.id===candidateId);

  const submit = async (e:React.FormEvent) => {
    e.preventDefault(); setError('');
    if(!selected){setError('Please select a student with an assigned tablet.');return;}
    if(!returnDate || returnDate <= startDate){setError('Return date must be after start date.');return;}
    const active = movements.some(m=>m.id!==initial?.id && m.tabletId===selected.tabletId && ['PENDING','APPROVED','OUTSIDE','OVERDUE'].includes(currentStatus(m)));
    if(active){setError('This tablet already has an active movement record.');return;}
    await onSave({assignmentId:selected.assignmentId,studentId:selected.studentId,studentName:selected.studentName,pinNumber:selected.pinNumber,tabletId:selected.tabletId,tabletName:selected.tabletName,tabletNumber:selected.tabletNumber,movementType,startDate,expectedReturnDate:returnDate,destination,reason,notes:''});
  };

  return <form onSubmit={submit} className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between"><div><h2 className="font-black text-slate-900">{initial?'Edit':'Add'} Tablet Movement</h2><p className="text-xs text-slate-500">Only essential details are required.</p></div><button type="button" onClick={onCancel} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-4 h-4"/></button></div>
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="text-xs font-bold text-slate-600 md:col-span-2">Student & Tablet<select required value={candidateId} onChange={e=>setCandidateId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Select student and assigned tablet</option>{candidates.map(c=><option key={c.id} value={c.id}>{c.studentName} — {c.tabletNumber}</option>)}</select></label>
      {selected&&<div className="md:col-span-2 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm"><b>{selected.studentName}</b><span className="mx-2 text-slate-400">•</span><b>{selected.tabletName}</b><span className="text-slate-500"> ({selected.tabletNumber})</span></div>}
      {candidates.length===0&&<div className="md:col-span-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">No student has a tablet assigned yet. Please assign a tablet first from Tablet Assignment.</div>}
      <label className="text-xs font-bold text-slate-600">Movement Type<select value={movementType} onChange={e=>setMovementType(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{['Vacation','Take Home','Holiday','Educational Purpose','Other'].map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-600">Destination<input required value={destination} onChange={e=>setDestination(e.target.value)} placeholder="e.g. Student Home" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/></label>
      <label className="text-xs font-bold text-slate-600">Start Date<input required type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/></label>
      <label className="text-xs font-bold text-slate-600">Return Date<input required type="date" value={returnDate} onChange={e=>setReturnDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/></label>
      <label className="text-xs font-bold text-slate-600 md:col-span-2">Reason<input required value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason for taking the tablet outside" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/></label>
    </div>
    {error&&<div className="mt-4 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">{error}</div>}
    <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">Cancel</button><button className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700">{initial?'Update':'Save Movement'}</button></div>
  </form>;
};