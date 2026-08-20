import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, RefreshCw, Tablet, UserRound, CalendarDays } from 'lucide-react';

interface UsageSession { id: string; studentId: string; studentName: string; tabletId: string; startedAt: string; returnedAt: string | null; durationMinutes: number | null; status: 'active' | 'returned'; }

const minutesLabel = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
const sameDay = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

export const TabletUsage: React.FC = () => {
  const [sessions, setSessions] = useState<UsageSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'today' | 'all'>('today');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('stm_admin_session_token') || '';
      const response = await fetch('/api/admin/tablet-usage', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        localStorage.removeItem('stm_admin_session_token');
        window.dispatchEvent(new CustomEvent('stm-admin-session-expired'));
        throw new Error(data?.error || 'Admin session required. Please login again.');
      }
      if (!response.ok) throw new Error(data?.error || 'Could not load tablet usage.');
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tablet usage.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => filter === 'today' ? sessions.filter((s) => sameDay(s.startedAt)) : sessions, [filter, sessions]);
  const active = visible.filter((s) => s.status === 'active').length;
  const returned = visible.filter((s) => s.status === 'returned');
  const totalMinutes = returned.reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0);
  const average = returned.length ? Math.round(totalMinutes / returned.length) : 0;

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Phase 2</p><h1 className="text-2xl font-black text-slate-900">Tablet Usage Tracking</h1><p className="text-sm text-slate-500 mt-1">Track tablet activation, return time and usage duration.</p></div><button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[['Active Now', active, UserRound], ['Returned', returned.length, Tablet], ['Total Usage', minutesLabel(totalMinutes), Clock3], ['Average Session', minutesLabel(average), Clock3]].map(([label, value, Icon]: any) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span><Icon className="h-5 w-5 text-blue-600" /></div><div className="mt-3 text-2xl font-black text-slate-900">{value}</div></div>)}
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4"><div className="flex gap-2"><button onClick={() => setFilter('today')} className={`rounded-lg px-3 py-2 text-xs font-bold ${filter === 'today' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}><CalendarDays className="inline h-4 w-4 mr-1" />Today</button><button onClick={() => setFilter('all')} className={`rounded-lg px-3 py-2 text-xs font-bold ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>All History</button></div></div>
      {error && <div className="m-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Tablet</th><th className="px-4 py-3">Start</th><th className="px-4 py-3">Return</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{visible.map((s) => <tr key={s.id}><td className="px-4 py-3 font-semibold text-slate-800">{s.studentName}</td><td className="px-4 py-3">{s.tabletId}</td><td className="px-4 py-3">{new Date(s.startedAt).toLocaleString()}</td><td className="px-4 py-3">{s.returnedAt ? new Date(s.returnedAt).toLocaleString() : '—'}</td><td className="px-4 py-3 font-semibold">{s.status === 'active' ? 'In progress' : minutesLabel(Number(s.durationMinutes || 0))}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{s.status === 'active' ? 'Active' : 'Returned'}</span></td></tr>)}{!loading && !visible.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No tablet usage records found.</td></tr>}</tbody></table></div>
    </div>
  </section>;
};