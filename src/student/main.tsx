import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './student.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://teb-mengment.onrender.com').replace(/\/$/, '');
const SESSION_KEY = 'teb_student_session';
type Session = { sessionToken: string; studentName: string; tabletId: string; startedAt: string };

function StudentApp() {
  const [pin, setPin] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) { try { setSession(JSON.parse(saved)); } catch { localStorage.removeItem(SESSION_KEY); } }
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  const elapsed = session ? Math.max(0, Math.floor((now - new Date(session.startedAt).getTime()) / 1000)) : 0;
  const elapsedText = `${String(Math.floor(elapsed / 3600)).padStart(2, '0')}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  async function activate() {
    const cleanPin = pin.replace(/\D/g, '');
    if (cleanPin.length !== 6) { setMessage('Enter your 6-digit PIN.'); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`${API_BASE}/api/photos/student/activate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: cleanPin }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Activation failed.');
      setSession(data.session); localStorage.setItem(SESSION_KEY, JSON.stringify(data.session)); setMessage('Tablet activated successfully.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Activation failed.'); }
    finally { setBusy(false); }
  }

  async function returnTablet() {
    if (!session) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`${API_BASE}/api/photos/student/return`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionToken: session.sessionToken }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Return failed.');
      localStorage.removeItem(SESSION_KEY); setSession(null); setPin(''); setMessage(`Tablet returned. Usage: ${data.durationMinutes ?? 0} minutes.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Return failed.'); }
    finally { setBusy(false); }
  }

  return <main className="student-shell"><section className="student-card">
    <div className="brand"><div className="brand-mark">TEB</div><div><h1>Student Tablet</h1><p>Secure tablet activation</p></div></div>
    {session ? <>
      <div className="active"><span className="dot" /> Active Session</div>
      <div className="info"><div><span>Student</span><strong>{session.studentName}</strong></div><div><span>Tablet</span><strong>{session.tabletId}</strong></div><div><span>Started</span><strong>{new Date(session.startedAt).toLocaleTimeString()}</strong></div></div>
      <div className="timer">{elapsedText}</div><p className="hint">Your tablet is active. Return it when finished.</p>
      <button className="return" onClick={returnTablet} disabled={busy}>{busy ? 'Returning…' : 'Return Tablet'}</button>
    </> : <>
      <label>Student PIN<input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter 6-digit PIN" inputMode="numeric" type="password" maxLength={6} autoFocus /></label>
      <button className="activate" onClick={activate} disabled={busy}>{busy ? 'Activating…' : 'Activate Tablet'}</button>
      <p className="hint">Your tablet is automatically identified from your PIN.</p>
    </>}
    {message && <div className="message" role="status">{message}</div>}
  </section></main>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><StudentApp /></React.StrictMode>);
