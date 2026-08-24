import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Lock, Mail, ShieldCheck, Loader2, User } from 'lucide-react';
import { AppUser, setCurrentUser } from '../../utils/auth';

interface Props { isOpen: boolean; onLoginSuccess: (user: AppUser) => void; }
const SUPER_ADMIN_USERNAME = 'superadmin';
const SUPER_ADMIN_EMAIL = 'meetdevani2003@gmail.com';

export const SuperAdminLogin: React.FC<Props> = ({ isOpen, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  if (!isOpen) return null;

  const login = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMessage('');
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedUsername) return setError('Please enter your user name.');
    if (!normalizedEmail) return setError('Please enter your email address.');
    if (normalizedUsername !== SUPER_ADMIN_USERNAME || normalizedEmail !== SUPER_ADMIN_EMAIL) return setError('The user name or email ID is not authorized to access the Admin Dashboard.');
    setLoading(true);
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: normalizedUsername, email: normalizedEmail }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || 'Admin login failed.');
      const sessionToken = String(data.sessionToken || '');
      if (!sessionToken) throw new Error('Login succeeded but no secure session was created.');
      localStorage.setItem('stm_admin_session_token', sessionToken);
      const user: AppUser = data.user ? { ...data.user, role: data.user.role || 'Super Admin', status: data.user.status || 'Active', fullName: data.user.fullName || 'Super Admin', username: data.user.username || normalizedUsername, email: data.user.email || normalizedEmail, mobileNumber: '', createdAt: data.user.createdAt || new Date().toISOString() } : { id: 'super-admin', fullName: 'Super Admin', username: normalizedUsername, email: normalizedEmail, mobileNumber: '', role: 'Super Admin', status: 'Active', createdAt: new Date().toISOString() };
      setCurrentUser(user); setMessage('Login successful.'); onLoginSuccess(user);
    } catch (e) { setError(e instanceof Error ? e.message : 'Admin login failed.'); }
    finally { setLoading(false); }
  };

  return <div className="fixed inset-0 z-50 min-h-screen bg-slate-950/10 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
    <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl border border-slate-200 grid lg:grid-cols-[1.05fr_.95fr]">
      <div className="hidden lg:flex bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 p-10 text-white flex-col justify-between min-h-[580px]">
        <div><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center"><ShieldCheck className="w-7 h-7" /></div><div><p className="font-black text-lg">Tablet Management</p><p className="text-xs text-indigo-100">Admin Control Center</p></div></div><div className="mt-20"><p className="text-sm font-semibold text-indigo-100">SECURE ADMIN ACCESS</p><h2 className="mt-3 text-4xl font-black tracking-tight leading-tight">Manage students, tablets and attendance from one place.</h2><p className="mt-5 max-w-md text-indigo-100 leading-7">Only the authorized administrator can open this dashboard. Your server-side session expires automatically.</p></div></div>
        <div className="flex items-center gap-3 text-sm text-indigo-100"><Lock className="w-4 h-4" /> Protected administrative area</div>
      </div>
      <div className="p-6 sm:p-10 lg:p-12">
        <div className="lg:hidden w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6"><ShieldCheck className="w-7 h-7" /></div>
        <p className="text-sm font-bold text-indigo-600">WELCOME BACK</p><h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-slate-950">Admin Login</h1><p className="mt-2 text-sm text-slate-500">Enter your authorized user name and email ID to continue.</p>
        {error && <div role="alert" className="mt-6 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 p-4 text-sm flex gap-3"><AlertCircle className="w-5 h-5 shrink-0" /> <span>{error}</span></div>}
        {message && <div role="status" className="mt-6 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 text-sm flex gap-3"><CheckCircle2 className="w-5 h-5 shrink-0" /> <span>{message}</span></div>}
        <form onSubmit={login} className="mt-7 space-y-5">
          <div><label htmlFor="admin-username" className="block text-sm font-bold text-slate-700 mb-2">User Name</label><div className="relative"><User aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input id="admin-username" value={username} onChange={e => setUsername(e.target.value)} type="text" autoComplete="username" placeholder="Enter authorized user name" className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-300 bg-slate-50/50 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" required /></div></div>
          <div><label htmlFor="admin-email" className="block text-sm font-bold text-slate-700 mb-2">Email ID</label><div className="relative"><Mail aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input id="admin-email" value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="Enter authorized email ID" className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-300 bg-slate-50/50 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" required /></div></div>
          <button type="submit" disabled={loading} className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">{loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Signing in...</> : 'Continue securely'}</button>
        </form>
      </div>
    </div>
  </div>;
};
