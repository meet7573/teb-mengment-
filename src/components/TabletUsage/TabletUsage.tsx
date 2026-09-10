import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Download, Eye, Filter, History, RefreshCw, Search, Tablet, Trash2, UserRound, X } from 'lucide-react';

interface UsageSession { id: string; studentId: string; studentName: string; tabletId: string; startedAt: string; returnedAt: string | null; durationMinutes: number | null; status: 'active' | 'returned'; }

type DateFilter = 'today' | '7days' | 'all';
type StatusFilter = 'all' | 'active' | 'returned';

const CHECKOUT_WARNING_MINUTES = 90;
const minutesLabel = (minutes: number) => `${Math.floor(Math.max(0, minutes) / 60)}h ${Math.max(0, minutes) % 60}m`;
const elapsedMinutes = (startedAt: string) => Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
const sameDay = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
const withinLastDays = (iso: string, days: number) => Date.now() - new Date(iso).getTime() <= days * 24 * 60 * 60 * 1000;
const formatDateTime = (iso: string | null) => iso ? new Date(iso).toLocaleString() : '—';

export const TabletUsage: React.FC = () => {
  const [sessions, setSessions] = useState<UsageSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [tick, setTick] = useState(Date.now());
  const [selectedSession, setSelectedSession] = useState<UsageSession | null>(null);
  const [retentionCount, setRetentionCount] = useState(0);
  const [retentionCutoff, setRetentionCutoff] = useState('');
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const [deletingHistory, setDeletingHistory] = useState(false);

  const loadRetention = async () => {
    try {
      const token = localStorage.getItem('stm_admin_session_token') || '';
      const response = await fetch('/api/admin/tablet-usage/retention', { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setRetentionCount(Number(data?.eligibleCount || 0));
        setRetentionCutoff(String(data?.cutoffAt || ''));
      }
    } catch { /* retention status is non-blocking for the usage page */ }
  };

  const load = async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('stm_admin_session_token') || '';
      const response = await fetch('/api/admin/tablet-usage', { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        localStorage.removeItem('stm_admin_session_token');
        window.dispatchEvent(new CustomEvent('stm-admin-session-expired'));
        throw new Error(data?.error || 'Admin session required. Please login again.');
      }
      if (!response.ok) throw new Error(data?.error || 'Could not load tablet usage.');
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      await loadRetention();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tablet usage.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { const timer = window.setInterval(() => setTick(Date.now()), 30000); return () => window.clearInterval(timer); }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sessions.filter((s) => {
      const dateMatch = dateFilter === 'today' ? sameDay(s.startedAt) : dateFilter === '7days' ? withinLastDays(s.startedAt, 7) : true;
      const statusMatch = statusFilter === 'all' || s.status === statusFilter;
      const searchMatch = !term || `${s.studentName} ${s.studentId} ${s.tabletId}`.toLowerCase().includes(term);
      return dateMatch && statusMatch && searchMatch;
    });
  }, [dateFilter, statusFilter, search, sessions, tick]);

  const active = visible.filter((s) => s.status === 'active').length;
  const returned = visible.filter((s) => s.status === 'returned');
  const totalMinutes = returned.reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0);
  const activeMinutes = visible.filter((s) => s.status === 'active').reduce((sum, s) => sum + elapsedMinutes(s.startedAt), 0);
  const average = returned.length ? Math.round(totalMinutes / returned.length) : 0;
  const totalSessions = visible.length;

  const deleteOldHistory = async () => {
    setDeletingHistory(true); setError('');
    try {
      const token = localStorage.getItem('stm_admin_session_token') || '';
      const response = await fetch('/api/admin/tablet-usage/history', { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        localStorage.removeItem('stm_admin_session_token');
        window.dispatchEvent(new CustomEvent('stm-admin-session-expired'));
        throw new Error(data?.error || 'Admin session required. Please login again.');
      }
      if (!response.ok) throw new Error(data?.error || 'Could not delete old tablet usage history.');
      setShowRetentionModal(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete old tablet usage history.');
    } finally { setDeletingHistory(false); }
  };

  const exportCsv = () => {
    const headers = ['Student', 'Tablet', 'Start', 'Return', 'Duration', 'Status'];
    const rows = visible.map((s) => [s.studentName, s.tabletId, formatDateTime(s.startedAt), formatDateTime(s.returnedAt), s.status === 'active' ? `${minutesLabel(elapsedMinutes(s.startedAt))} (in progress)` : minutesLabel(Number(s.durationMinutes || 0)), s.status === 'active' ? 'Active' : 'Returned']);
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `tablet-usage-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click();
    URL.revokeObjectURL(url);
  };

  const statCards = [
    ['Total Sessions', totalSessions, History],
    ['Active Now', active, UserRound],
    ['Returned', returned.length, Tablet],
    ['Total Usage', minutesLabel(totalMinutes + activeMinutes), Clock3],
    ['Average Session', minutesLabel(average), Clock3],
  ] as const;

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Phase 2</p><h1 className="text-2xl font-black text-slate-900">Tablet Usage Tracking</h1><p className="text-sm text-slate-500 mt-1">Track tablet activation, return time and usage duration.</p></div>
      <div className="flex items-center gap-2"><button onClick={exportCsv} disabled={!visible.length} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm disabled:opacity-50"><Download className="h-4 w-4" /> Export</button><button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button></div>
    </div>

    {retentionCount > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="font-bold text-amber-900">Old tablet usage history found</p><p className="text-sm text-amber-800">{retentionCount} returned session{retentionCount === 1 ? '' : 's'} are older than one month. Admin approval is required before deletion.</p></div></div><button onClick={() => setShowRetentionModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-amber-700"><Trash2 className="h-4 w-4" /> Review & Delete</button></div>}

    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      {statCards.map(([label, value, Icon]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span><Icon className="h-5 w-5 text-blue-600" /></div><div className="mt-3 text-2xl font-black text-slate-900">{value}</div></div>)}
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2"><button onClick={() => setDateFilter('today')} className={`rounded-lg px-3 py-2 text-xs font-bold ${dateFilter === 'today' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}><CalendarDays className="inline h-4 w-4 mr-1" />Today</button><button onClick={() => setDateFilter('7days')} className={`rounded-lg px-3 py-2 text-xs font-bold ${dateFilter === '7days' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Last 7 Days</button><button onClick={() => setDateFilter('all')} className={`rounded-lg px-3 py-2 text-xs font-bold ${dateFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>All History</button></div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Filter className="h-4 w-4" /> Filters</div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[260px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student or tablet..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />{search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>}</div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"><option value="all">All Status</option><option value="active">Active</option><option value="returned">Returned</option></select>
        </div>
      </div>
      {error && <div className="m-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Tablet</th><th className="px-4 py-3">Start</th><th className="px-4 py-3">Return</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">
        {visible.map((s) => { const liveMinutes = s.status === 'active' ? elapsedMinutes(s.startedAt) : Number(s.durationMinutes || 0); const warning = s.status === 'active' && liveMinutes >= CHECKOUT_WARNING_MINUTES; return <tr key={s.id} className={warning ? 'bg-amber-50/50' : ''}><td className="px-4 py-3 font-semibold text-slate-800">{s.studentName}</td><td className="px-4 py-3 font-medium">{s.tabletId || '—'}</td><td className="px-4 py-3 whitespace-nowrap">{formatDateTime(s.startedAt)}</td><td className="px-4 py-3 whitespace-nowrap">{formatDateTime(s.returnedAt)}</td><td className="px-4 py-3 font-semibold"><div>{s.status === 'active' ? `${minutesLabel(liveMinutes)} in progress` : minutesLabel(liveMinutes)}</div>{warning && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800"><AlertTriangle className="h-3 w-3" /> 90 min completed</span>}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.status === 'active' ? warning ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{s.status === 'active' ? 'Active' : 'Returned'}</span></td><td className="px-4 py-3 text-right"><button onClick={() => setSelectedSession(s)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700"><Eye className="h-4 w-4" /> View</button></td></tr>; })}
        {!loading && !visible.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No tablet usage records found for the selected filters.</td></tr>}
      </tbody></table></div>
    </div>

    {selectedSession && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-lg font-black text-slate-900">Tablet Usage Details</h2><p className="text-xs text-slate-500 mt-0.5">Complete session information</p></div><button onClick={() => setSelectedSession(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button></div><div className="grid grid-cols-2 gap-4 p-5 text-sm"><div><p className="text-xs font-bold uppercase text-slate-400">Student</p><p className="mt-1 font-bold text-slate-800">{selectedSession.studentName}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Tablet</p><p className="mt-1 font-bold text-slate-800">{selectedSession.tabletId || '—'}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Start Time</p><p className="mt-1 font-semibold text-slate-700">{formatDateTime(selectedSession.startedAt)}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Return Time</p><p className="mt-1 font-semibold text-slate-700">{formatDateTime(selectedSession.returnedAt)}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Duration</p><p className="mt-1 font-bold text-slate-800">{selectedSession.status === 'active' ? `${minutesLabel(elapsedMinutes(selectedSession.startedAt))} in progress` : minutesLabel(Number(selectedSession.durationMinutes || 0))}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Status</p><p className="mt-1 font-bold text-slate-800">{selectedSession.status === 'active' ? 'Active' : 'Returned'}</p></div></div><div className="border-t border-slate-100 px-5 py-4 text-right"><button onClick={() => setSelectedSession(null)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Close</button></div></div></div>}

    {showRetentionModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-amber-100 p-2 text-amber-700"><Trash2 className="h-5 w-5" /></div><div><h2 className="text-lg font-black text-slate-900">Delete Old History?</h2><p className="text-xs text-slate-500">Admin confirmation required</p></div></div><button onClick={() => setShowRetentionModal(false)} disabled={deletingHistory} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="space-y-3 p-5"><div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p className="font-bold">{retentionCount} old session{retentionCount === 1 ? '' : 's'} found.</p><p className="mt-1">Only completed/returned tablet usage records older than one month will be deleted. Active sessions are never deleted.</p>{retentionCutoff && <p className="mt-2 text-xs font-semibold">Retention cutoff: {formatDateTime(retentionCutoff)}</p>}</div><div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-600"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Current students, tablets, active sessions and newer history will remain unchanged.</div></div><div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4"><button onClick={() => setShowRetentionModal(false)} disabled={deletingHistory} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">Cancel</button><button onClick={deleteOldHistory} disabled={deletingHistory} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Trash2 className="h-4 w-4" /> {deletingHistory ? 'Deleting...' : 'Confirm Delete'}</button></div></div></div>}
  </section>;
};