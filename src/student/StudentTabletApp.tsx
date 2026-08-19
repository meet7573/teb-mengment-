import { useEffect, useState } from 'react';

interface ActiveSession {
  sessionToken: string;
  studentName: string;
  tabletId: string;
  startedAt: string;
}

export function StudentTabletApp() {
  const [tabletId, setTabletId] = useState('');
  const [pin, setPin] = useState('');
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [elapsed, setElapsed] = useState('00:00:00');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000));
      const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
      const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
      const s = String(seconds % 60).padStart(2, '0');
      setElapsed(`${h}:${m}:${s}`);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  async function activate() {
    setError('');
    setMessage('');
    const cleanTabletId = tabletId.trim();
    const cleanPin = pin.trim();

    if (!cleanTabletId || !cleanPin) {
      setError('Enter the tablet ID and student PIN.');
      return;
    }

    setLoading(true);
    try {
      // Student records use the canonical PIN format PIN-1234, while the
      // student tablet UI accepts only numeric input. Send the same canonical
      // format used by StudentManagement to avoid false 401 responses.
      const canonicalPin = /^PIN-/i.test(cleanPin) ? cleanPin.toUpperCase() : `PIN-${cleanPin}`;

      const response = await fetch('/api/student/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabletId: cleanTabletId, pin: canonicalPin }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Activation failed.');
      setSession(result.session);
      setPin('');
      setMessage('Tablet activated successfully.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Activation failed.');
    } finally {
      setLoading(false);
    }
  }

  async function returnTablet() {
    if (!session) return;
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await fetch('/api/student/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: session.sessionToken }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not return the tablet.');
      setSession(null);
      setElapsed('00:00:00');
      setMessage(`Tablet returned. Session duration: ${result.durationMinutes} minute(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not return the tablet.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-5 text-slate-900">
      <section className="w-full max-w-md rounded-3xl bg-white shadow-xl border border-slate-200 p-7">
        <div className="text-center mb-7">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white">TEB</div>
          <h1 className="text-2xl font-bold">Student Tablet</h1>
          <p className="mt-1 text-sm text-slate-500">Secure tablet activation</p>
        </div>

        {!session ? (
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Tablet ID</span>
              <input value={tabletId} onChange={(e) => setTabletId(e.target.value)} placeholder="e.g. TAB-001" autoCapitalize="characters" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Student PIN</span>
              <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" type="password" placeholder="Enter PIN" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500" />
            </label>
            <button disabled={loading} onClick={activate} className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white disabled:opacity-60">
              {loading ? 'Activating...' : 'Activate Tablet'}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl bg-emerald-50 p-5 text-center">
              <p className="text-sm font-medium text-emerald-700">Session Active</p>
              <p className="mt-1 text-xl font-bold">{session.studentName}</p>
              <p className="mt-1 text-sm text-emerald-700">{session.tabletId}</p>
              <p className="mt-4 text-3xl font-mono font-bold text-emerald-900">{elapsed}</p>
            </div>
            <button disabled={loading} onClick={returnTablet} className="w-full rounded-xl bg-slate-900 px-4 py-3.5 font-semibold text-white disabled:opacity-60">
              {loading ? 'Returning...' : 'Return Tablet'}
            </button>
          </div>
        )}

        {message && <p className="mt-5 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</p>}
        {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <p className="mt-6 text-center text-xs text-slate-400">TEB Management • Student access only</p>
      </section>
    </main>
  );
}
