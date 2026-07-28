import React, { useState } from 'react';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  LogIn, 
  ShieldCheck, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle,
  UserPlus,
  ArrowRight,
  Sparkles,
  School
} from 'lucide-react';
import { AppUser, getUsers, saveUsers, setCurrentUser } from '../../utils/auth';
import { UserRole } from '../../types';

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: AppUser) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  
  // Login Form state
  const [usernameOrEmail, setUsernameOrEmail] = useState('meetdevani');
  const [password, setPassword] = useState('Meet@2003');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Register Form state
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('Admin');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!usernameOrEmail.trim() || !password.trim()) {
      setErrorMsg('Please enter both Username/Email and Password.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const allUsers = getUsers();
      const matched = allUsers.find(
        (u) =>
          (u.username.toLowerCase() === usernameOrEmail.trim().toLowerCase() ||
            u.email.toLowerCase() === usernameOrEmail.trim().toLowerCase()) &&
          u.status === 'Active'
      );

      if (matched) {
        setCurrentUser(matched);
        setLoading(false);
        onLoginSuccess(matched);
      } else {
        setLoading(false);
        setErrorMsg('Invalid credentials or account is inactive.');
      }
    }, 400);
  };

  const handleQuickDemoLogin = (role: UserRole) => {
    const allUsers = getUsers();
    const matched = allUsers.find((u) => u.role === role && u.status === 'Active') || allUsers[0];
    setCurrentUser(matched);
    onLoginSuccess(matched);
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSuccess(true);
    setTimeout(() => {
      setForgotSuccess(false);
      setMode('login');
      setForgotEmail('');
    }, 2500);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!regFullName.trim() || !regUsername.trim() || !regEmail.trim() || !regMobile.trim() || !regPassword) {
      setRegError('All fields are required.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match.');
      return;
    }

    const allUsers = getUsers();
    if (allUsers.some((u) => u.username.toLowerCase() === regUsername.trim().toLowerCase())) {
      setRegError('Username already taken. Please choose another.');
      return;
    }

    const newUser: AppUser = {
      id: `usr-${Date.now()}`,
      fullName: regFullName.trim(),
      username: regUsername.trim(),
      email: regEmail.trim(),
      mobileNumber: regMobile.trim(),
      role: regRole,
      status: 'Active',
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const updated = [...allUsers, newUser];
    saveUsers(updated);
    setRegSuccess(true);

    setTimeout(() => {
      setRegSuccess(false);
      setMode('login');
      setUsernameOrEmail(newUser.username);
      setPassword(regPassword);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Branding Banner */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <School className="w-32 h-32" />
          </div>
          
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md text-white font-extrabold text-xl mb-3 shadow-inner border border-white/20">
            STM
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">Student Tablet Management System</h2>
          <p className="text-xs text-blue-100 mt-1 font-medium">
            Enterprise Portal • Digital Attendance & Asset Control
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6">
          
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <LogIn className="w-4 h-4 text-blue-600" />
                  Account Authentication
                </h3>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Create Account
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Username Input */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Username or Email</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder="Enter username (e.g. meetdevani)"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 accent-blue-600 cursor-pointer"
                />
                <label htmlFor="rememberMe" className="text-xs font-semibold text-slate-600 cursor-pointer">
                  Remember me on this browser
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Secure Sign In</span>
                  </>
                )}
              </button>

              {/* Quick Demo Role Logins */}
              <div className="pt-3 border-t border-slate-100">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center mb-2">
                  One-Click Demo Account Login
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('Super Admin')}
                    className="px-2 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold border border-purple-200 transition cursor-pointer text-center"
                  >
                    Super Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('Teacher')}
                    className="px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold border border-emerald-200 transition cursor-pointer text-center"
                  >
                    Teacher
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('Operator')}
                    className="px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-bold border border-amber-200 transition cursor-pointer text-center"
                  >
                    Operator
                  </button>
                </div>
              </div>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-600" />
                Password Recovery
              </h3>
              <p className="text-xs text-slate-500">
                Enter your registered administrator email address below. We will send you instructions to reset your password.
              </p>

              {forgotSuccess && (
                <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Password reset instructions sent to your email address! Redirecting...</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Email Address</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="e.g. rajesh.sharma@institute.edu"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-200"
                >
                  Back to Login
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  Send Reset Link
                </button>
              </div>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  Register New System User
                </h3>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Already have an account? Sign In
                </button>
              </div>

              {regError && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200">
                  {regError}
                </div>
              )}

              {regSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>User registered successfully! Redirecting to login...</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700">Full Name</label>
                  <input
                    type="text"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700">Username</label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. rahul_admin"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-blue-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="rahul@school.edu"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700">Mobile Number</label>
                  <input
                    type="text"
                    value={regMobile}
                    onChange={(e) => setRegMobile(e.target.value)}
                    placeholder="+91 98765 00000"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-blue-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700">Password</label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700">Confirm Password</label>
                  <input
                    type="password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-blue-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700">Assign System Role</label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as UserRole)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-blue-600"
                >
                  <option value="Super Admin">Super Admin</option>
                  <option value="Admin">Admin</option>
                  <option value="Teacher">Teacher</option>
                  <option value="Operator">Operator</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  Register User
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};
