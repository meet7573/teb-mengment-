import { useEffect, useState } from 'react';

interface StudentProfile { name: string; email?: string; standard: string; coachingType: string; roomNumber: string; wingNumber: string; tabletId?: string; }
interface ActiveSession { sessionToken: string; studentId: string; studentName: string; tabletId: string; startedAt: string; student?: StudentProfile; }
interface CheckoutRequest { id: string; status: 'pending' | 'approved' | 'rejected'; requestedAt: string; }
interface RegistrationForm { name: string; email: string; pin: string; standard: string; coachingType: string; roomNumber: string; wingNumber: string; }
const SESSION_KEY = 'teb_student_session_token';
function normalizePin(value: string) { return value.trim().replace(/^PIN-/i, '').replace(/\D/g, '').slice(0, 4); }
function formatElapsed(startedAt: string) { const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)); const h = String(Math.floor(seconds / 3600)).padStart(2, '0'); const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0'); const s = String(seconds % 60).padStart(2, '0'); return `${h}:${m}:${s}`; }

const emptyRegistration: RegistrationForm = { name: '', email: '', pin: '', standard: 'Std 8', coachingType: 'Coaching', roomNumber: '', wingNumber: '' };

export function StudentTabletApp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [checkoutRequest, setCheckoutRequest] = useState<CheckoutRequest | null>(null);
  const [elapsed, setElapsed] = useState('00:00:00');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [registration, setRegistration] = useState<RegistrationForm>(emptyRegistration);
  const student = session?.student;

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const token = localStorage.getItem(SESSION_KEY);
      if (!token) { if (!cancelled) setLoading(false); return; }
      try {
        const response = await fetch('/api/student/session', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result?.session) throw new Error(result?.error || 'Session expired. Please login again.');
        if (!cancelled) { setSession(result.session); setMessage('Active student session restored.'); }
      } catch (e) {
        localStorage.removeItem(SESSION_KEY);
        if (!cancelled) setError(e instanceof Error ? e.message : 'Session could not be restored.');
      } finally { if (!cancelled) setLoading(false); }
    }
    restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { if (!session) return; setElapsed(formatElapsed(session.startedAt)); const timer = window.setInterval(() => setElapsed(formatElapsed(session.startedAt)), 1000); return () => window.clearInterval(timer); }, [session]);

  async function login() {
    setError(''); setMessage('');
    const cleanName = name.trim(); const cleanEmail = email.trim().toLowerCase(); const cleanPin = normalizePin(pin);
    if (!cleanName) { setError('Please enter Student Name.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) { setError('Please enter a valid Email ID.'); return; }
    if (!/^\d{4}$/.test(cleanPin)) { setError('Student PIN must be exactly 4 digits.'); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/student/activate', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name: cleanName, email: cleanEmail, pin: cleanPin }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || `Login failed (${response.status}).`);
      localStorage.setItem(SESSION_KEY, result.session.sessionToken); setSession(result.session); setName(''); setEmail(''); setPin(''); setMessage('Student signed in successfully. Attendance is now IN.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Login failed.'); }
    finally { setLoading(false); }
  }

  async function submitRegistration(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    const clean = { ...registration, name: registration.name.trim(), email: registration.email.trim().toLowerCase(), pin: normalizePin(registration.pin), roomNumber: registration.roomNumber.trim(), wingNumber: registration.wingNumber.trim() };
    if (!clean.name) { setError('Please enter Student Name.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(clean.email)) { setError('Please enter a valid Email ID.'); return; }
    if (!/^\d{4}$/.test(clean.pin)) { setError('Student PIN must be exactly 4 digits.'); return; }
    if (!clean.standard || !clean.coachingType || !clean.roomNumber || !clean.wingNumber) { setError('Please complete all registration fields.'); return; }
    setRegistrationLoading(true);
    try {
      const response = await fetch('/api/student/request-registration', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(clean) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || `Registration failed (${response.status}).`);
      setShowRegistration(false); setRegistration(emptyRegistration); setMessage(result?.message || 'Registration request submitted. Please wait for Admin approval.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Registration request could not be submitted.'); }
    finally { setRegistrationLoading(false); }
  }

  async function requestCheckout() {
    if (!session) return;
    setError(''); setMessage(''); setLoading(true);
    try {
      const response = await fetch('/api/student/checkout-request', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.sessionToken}` }, body: '{}' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || 'Could not submit checkout request.');
      setCheckoutRequest(result.request); setMessage('Checkout request sent. Please wait for Admin approval.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not submit checkout request.'); }
    finally { setLoading(false); }
  }

  if (loading && !session && !error) return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-5 text-slate-900"><section className="w-full max-w-md rounded-3xl bg-white shadow-xl border border-slate-200 p-7 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white">TEB</div><p className="font-semibold">Checking student session...</p></section></main>;

  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-5 text-slate-900">
    <section className="w-full max-w-md rounded-3xl bg-white shadow-xl border border-slate-200 p-7">
      <div className="text-center mb-7"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white">TEB</div><h1 className="text-2xl font-bold">Student App</h1><p className="mt-1 text-sm text-slate-500">Secure student login with Admin-approved Email ID</p></div>

      {!session ? <>
        {!showRegistration ? <div className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-sm font-medium">Student Name</span><input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') login(); }} placeholder="Enter student name" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500" autoFocus /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium">Email ID</span><input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') login(); }} type="email" placeholder="Enter Admin-approved email" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium">Student PIN</span><input value={pin} maxLength={4} onChange={e => setPin(normalizePin(e.target.value))} onKeyDown={e => { if (e.key === 'Enter') login(); }} inputMode="numeric" pattern="[0-9]*" type="password" placeholder="Enter 4-digit PIN" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500" /></label>
          <button type="button" disabled={loading || !name.trim() || !email.trim() || !pin.trim()} onClick={login} className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white disabled:opacity-60">{loading ? 'Signing in...' : 'Login & Start'}</button>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">Only students whose Email ID has been approved by Admin can log in.</div>
          <div className="pt-1 text-center"><button type="button" onClick={() => { setShowRegistration(true); setError(''); setMessage(''); }} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">New student? Register here</button></div>
        </div> : <form onSubmit={submitRegistration} className="space-y-4">
          <div className="mb-1"><h2 className="text-lg font-bold">Student Registration</h2><p className="mt-1 text-xs text-slate-500">Submit your details for Admin approval. Registration does not give immediate portal access.</p></div>
          <label className="block"><span className="mb-1.5 block text-sm font-medium">Student Name</span><input value={registration.name} onChange={e => setRegistration({ ...registration, name: e.target.value })} placeholder="Enter student name" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500" autoFocus /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium">Email ID</span><input value={registration.email} onChange={e => setRegistration({ ...registration, email: e.target.value })} type="email" placeholder="Enter your email ID" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium">Student PIN</span><input value={registration.pin} maxLength={4} onChange={e => setRegistration({ ...registration, pin: normalizePin(e.target.value) })} inputMode="numeric" pattern="[0-9]*" type="password" placeholder="Create 4-digit PIN" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500" /></label>
          <div className="grid grid-cols-2 gap-3"><label className="block"><span className="mb-1.5 block text-sm font-medium">Standard</span><select value={registration.standard} onChange={e => setRegistration({ ...registration, standard: e.target.value })} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500"><option>Std 8</option><option>Std 9</option><option>Std 10</option><option>Std 11</option><option>Std 12</option></select></label><label className="block"><span className="mb-1.5 block text-sm font-medium">Type</span><select value={registration.coachingType} onChange={e => setRegistration({ ...registration, coachingType: e.target.value })} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500"><option>Coaching</option><option>Non-Coaching</option></select></label></div>
          <div className="grid grid-cols-2 gap-3"><label className="block"><span className="mb-1.5 block text-sm font-medium">Room Number</span><input value={registration.roomNumber} onChange={e => setRegistration({ ...registration, roomNumber: e.target.value })} placeholder="Room" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500" /></label><label className="block"><span className="mb-1.5 block text-sm font-medium">Wing Number</span><input value={registration.wingNumber} onChange={e => setRegistration({ ...registration, wingNumber: e.target.value })} placeholder="Wing" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500" /></label></div>
          <button type="submit" disabled={registrationLoading} className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white disabled:opacity-60">{registrationLoading ? 'Submitting...' : 'Submit Registration'}</button>
          <button type="button" onClick={() => { setShowRegistration(false); setError(''); }} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700">Back to Login</button>
        </form>}
      </> : <div className="space-y-5">
        <div className="rounded-2xl bg-emerald-50 p-5 text-center"><p className="text-sm font-medium text-emerald-700">Session Active • IN</p><p className="mt-1 text-xl font-bold">{session.studentName}</p><p className="mt-1 text-sm text-emerald-700">Assigned Tablet: {session.tabletId}</p><p className="mt-4 text-3xl font-mono font-bold text-emerald-900">{elapsed}</p></div>
        {student && <div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl bg-slate-50 p-3 col-span-2"><span className="text-slate-500">Email ID</span><p className="font-semibold break-all">{student.email || '—'}</p></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Standard</span><p className="font-semibold">{student.standard}</p></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Type</span><p className="font-semibold">{student.coachingType}</p></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Room</span><p className="font-semibold">{student.roomNumber}</p></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Wing</span><p className="font-semibold">{student.wingNumber}</p></div></div>}
        {checkoutRequest?.status === 'pending' ? <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-center text-sm font-semibold text-amber-800">Checkout request pending. Admin approval is required.</div> : <button type="button" disabled={loading} onClick={requestCheckout} className="w-full rounded-xl bg-slate-900 px-4 py-3.5 font-semibold text-white disabled:opacity-60">{loading ? 'Requesting...' : 'REQUEST CHECKOUT'}</button>}
      </div>}

      {message && <p className="mt-5 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</p>}
      {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <p className="mt-6 text-center text-xs text-slate-400">TEB Management • Student access only</p>
    </section>
  </main>;
}
