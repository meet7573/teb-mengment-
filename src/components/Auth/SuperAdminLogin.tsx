import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Lock, Mail } from 'lucide-react';
import { AppUser, setCurrentUser } from '../../utils/auth';

interface Props { isOpen: boolean; onLoginSuccess: (user: AppUser) => void; }
const SUPER_ADMIN_EMAIL = 'meetdevani2003@gmail.com';

export const SuperAdminLogin: React.FC<Props> = ({ isOpen, onLoginSuccess }) => {
  const [email, setEmail] = useState(SUPER_ADMIN_EMAIL);
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  if (!isOpen) return null;

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMessage('');
    if (email.trim().toLowerCase() !== SUPER_ADMIN_EMAIL) { setError('Only the authorized Super Admin email can access this dashboard.'); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/admin/otp/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data?.error || 'Could not send OTP.');
      setStep('otp'); setMessage('OTP sent to the authorized Super Admin email.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send OTP.'); } finally { setLoading(false); }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMessage('');
    if (!/^\d{6}$/.test(otp)) { setError('Enter the 6-digit OTP.'); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/admin/otp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, otp }) });
      const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data?.error || 'Invalid or expired OTP.');
      localStorage.setItem('stm_admin_session_token', String(data.sessionToken));
      const user: AppUser = { id: 'super-admin', fullName: 'Super Admin', username: 'superadmin', email: SUPER_ADMIN_EMAIL, mobileNumber: '', role: 'SuperAdmin' as any, status: 'Active', createdAt: new Date().toISOString() };
      setCurrentUser(user); onLoginSuccess(user);
    } catch (e) { setError(e instanceof Error ? e.message : 'OTP verification failed.'); } finally { setLoading(false); }
  };

  return <div className="fixed inset-0 z-50 bg-slate-100 flex items-center justify-center p-4"><div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-8"><div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5"><Lock className="w-7 h-7" /></div><h1 className="text-2xl font-extrabold text-slate-900">Super Admin Login</h1><p className="text-sm text-slate-500 mt-2">Secure OTP verification is required to access the Admin Dashboard.</p>{error && <div className="mt-5 p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-sm flex gap-2"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}{message && <div className="mt-5 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm flex gap-2"><CheckCircle2 className="w-5 h-5 shrink-0" />{message}</div>}{step === 'email' ? <form onSubmit={requestOtp} className="mt-6 space-y-4"><label className="text-sm font-bold text-slate-700">Super Admin Email</label><div className="relative"><Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" /><input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 font-semibold" required /></div><button disabled={loading} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50">{loading ? 'Sending OTP...' : 'Send OTP'}</button></form> : <form onSubmit={verifyOtp} className="mt-6 space-y-4"><label className="text-sm font-bold text-slate-700">6-Digit OTP</label><input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoFocus className="w-full text-center tracking-[0.5em] text-2xl font-mono py-4 rounded-xl border border-slate-300" placeholder="000000" required /><button disabled={loading} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50">{loading ? 'Verifying...' : 'Verify & Login'}</button><button type="button" onClick={() => { setStep('email'); setOtp(''); setError(''); setMessage(''); }} className="w-full py-2 text-sm font-semibold text-slate-500">Use email again</button></form>}<p className="text-xs text-slate-400 mt-6 text-center">Authorized account: {SUPER_ADMIN_EMAIL}</p></div></div>;
};
