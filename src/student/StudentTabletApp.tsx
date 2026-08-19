import { useEffect, useMemo, useState } from 'react';

interface StudentProfile {
  name: string;
  standard: string;
  coachingType: string;
  roomNumber: string;
  wingNumber: string;
  tabletId: string;
}

interface ActiveSession {
  sessionToken: string;
  studentId: string;
  studentName: string;
  tabletId: string;
  startedAt: string;
  student?: StudentProfile;
}

const SESSION_KEY = 'teb_student_session_token';

function normalizeTabletId(value: string) { return value.trim().toUpperCase(); }
function normalizePin(value: string) { return value.trim().replace(/^PIN-/i, '').replace(/\D/g, '').slice(0, 12); }

function formatElapsed(startedAt: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function StudentTabletApp() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [tabletId, setTabletId] = useState('');
  const [pin, setPin] = useState('');
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [elapsed, setElapsed] = useState('00:00:00');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', pin: '', standard: '', coachingType: 'Coaching', roomNumber: '', wingNumber: '', tabletId: '' });

  const student = session?.student;
  const hasSession = Boolean(session);

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      const token = window.localStorage.getItem(SESSION_KEY);
      if (!token) { if (!cancelled) setLoading(false); return; }
      try {
        const response = await fetch('/api/student/session', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result?.session) throw new Error('Session expired. Please login again.');
        if (!cancelled) {
          setSession(result.session);
          setTabletId(result.session.tabletId || '');
          setMessage('Active session restored.');
        }
      } catch (e) {
        window.localStorage.removeItem(SESSION_KEY);
        if (!cancelled) setError(e instanceof Error ? e.message : 'Session could not be restored.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    restoreSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!session) return;
    setElapsed(formatElapsed(session.startedAt));
    const timer = window.setInterval(() => setElapsed(formatElapsed(session.startedAt)), 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  const registrationValid = useMemo(() => {
    return Boolean(form.name.trim() && normalizePin(form.pin).length >= 4 && form.standard.trim() && form.coachingType && form.roomNumber.trim() && form.wingNumber.trim() && normalizeTabletId(form.tabletId));
  }, [form]);

  async function activate(cleanTabletId = tabletId, cleanPin = pin) {
    const normalizedTablet = normalizeTabletId(cleanTabletId);
    const normalizedPin = normalizePin(cleanPin);
    if (!normalizedTablet || !normalizedPin) throw new Error('Enter the tablet ID and student PIN.');

    const response = await fetch('/api/student/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ tabletId: normalizedTablet, pin: normalizedPin })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error || `Activation failed (${response.status}).`);
    if (!result?.session) throw new Error('Activation response is invalid.');

    window.localStorage.setItem(SESSION_KEY, result.session.sessionToken);
    setSession(result.session);
    setTabletId(normalizedTablet);
    setPin('');
    return result.session as ActiveSession;
  }

  async function login() {
    setError(''); setMessage(''); setLoading(true);
    try { await activate(); setMessage('Student signed in successfully.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Login failed.'); }
    finally { setLoading(false); }
  }

  async function register() {
    setError(''); setMessage(''); setLoading(true);
    const normalizedTablet = normalizeTabletId(form.tabletId);
    const normalizedPin = normalizePin(form.pin);
    try {
      const response = await fetch('/api/student/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...form, pin: normalizedPin, tabletId: normalizedTablet })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || `Registration failed (${response.status}).`);

      // Registration immediately starts the first session; the PIN is never persisted in the browser.
      await activate(normalizedTablet, normalizedPin);
      setForm({ name: '', pin: '', standard: '', coachingType: 'Coaching', roomNumber: '', wingNumber: '', tabletId: '' });
      setMessage('Student registered and signed in successfully.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed.');
    } finally { setLoading(false); }
  }

  async function returnTablet() {
    if (!session) return;
    setError(''); setMessage(''); setLoading(true);
    try {
      const response = await fetch('/api/student/return', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sessionToken: session.sessionToken })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not return the tablet.');
      window.localStorage.removeItem(SESSION_KEY);
      setSession(null); setElapsed('00:00:00'); setPin('');
      setMessage(`Tablet checked out. Session duration: ${result.durationMinutes} minute(s).`);
      setMode('login');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not return the tablet.'); }
    finally { setLoading(false); }
  }

  if (loading && !hasSession && !error) {
    return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-5 text-slate-900"><section className="w-full max-w-md rounded-3xl bg-white shadow-xl border border-slate-200 p-7 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white">TEB</div><p className="font-semibold">Checking student session...</p></section></main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-5 text-slate-900">
      <section className="w-full max-w-md rounded-3xl bg-white shadow-xl border border-slate-200 p-7">
        <div className="text-center mb-7">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white">TEB</div>
          <h1 className="text-2xl font-bold">Student Tablet</h1>
          <p className="mt-1 text-sm text-slate-500">Student registration, secure login and attendance</p>
        </div>

        {!session ? (
          <>
            <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button onClick={() => { setMode('login'); setError(''); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'login' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Existing Student</button>
              <button onClick={() => { setMode('register'); setError(''); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'register' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>First Time</button>
            </div>

            {mode === 'login' ? (
              <div className="space-y-4">
                <label className="block"><span className="mb-1.5 block text-sm font-medium">Tablet ID</span><input value={tabletId} onChange={(e) => setTabletId(e.target.value)} placeholder="e.g. TAB-001" autoCapitalize="characters" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500" /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-medium">Student PIN</span><input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" type="password" placeholder="Enter PIN" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500" /></label>
                <button disabled={loading} onClick={login} className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white disabled:opacity-60">{loading ? 'Signing in...' : 'Login & Start'}</button>
              </div>
            ) : (
              <div className="space-y-3">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Student Name" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
                <input value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 12) })} inputMode="numeric" type="password" placeholder="Student PIN Number" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
                <input value={form.standard} onChange={(e) => setForm({ ...form, standard: e.target.value })} placeholder="Standard" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
                <select value={form.coachingType} onChange={(e) => setForm({ ...form, coachingType: e.target.value })} className="w-full rounded-xl border border-slate-300 px-4 py-3"><option>Coaching</option><option>Non-Coaching</option></select>
                <div className="grid grid-cols-2 gap-3"><input value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} placeholder="Room Number" className="w-full rounded-xl border border-slate-300 px-4 py-3" /><input value={form.wingNumber} onChange={(e) => setForm({ ...form, wingNumber: e.target.value })} placeholder="Wing Number" className="w-full rounded-xl border border-slate-300 px-4 py-3" /></div>
                <input value={form.tabletId} onChange={(e) => setForm({ ...form, tabletId: e.target.value })} placeholder="Tablet ID e.g. TAB-001" autoCapitalize="characters" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
                <button disabled={loading || !registrationValid} onClick={register} className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white disabled:opacity-60">{loading ? 'Saving...' : 'Register & Start'}</button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl bg-emerald-50 p-5 text-center">
              <p className="text-sm font-medium text-emerald-700">Session Active • IN</p>
              <p className="mt-1 text-xl font-bold">{session.studentName}</p>
              <p className="mt-1 text-sm text-emerald-700">{session.tabletId}</p>
              <p className="mt-4 text-3xl font-mono font-bold text-emerald-900">{elapsed}</p>
            </div>
            {student && <div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Standard</span><p className="font-semibold">{student.standard}</p></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Type</span><p className="font-semibold">{student.coachingType}</p></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Room</span><p className="font-semibold">{student.roomNumber}</p></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Wing</span><p className="font-semibold">{student.wingNumber}</p></div></div>}
            <button disabled={loading} onClick={returnTablet} className="w-full rounded-xl bg-slate-900 px-4 py-3.5 font-semibold text-white disabled:opacity-60">{loading ? 'Checking out...' : 'CHECKOUT / RETURN TABLET'}</button>
          </div>
        )}

        {message && <p className="mt-5 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</p>}
        {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <p className="mt-6 text-center text-xs text-slate-400">TEB Management • Student access only</p>
      </section>
    </main>
  );
}
