import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle,
  School
} from 'lucide-react';
import { AppUser, setCurrentUser } from '../../utils/auth';
import { UserRole } from '../../types';

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: AppUser) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset' | 'verify'>('login');
  
  // Login Form state
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot/Reset state
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Register Form state
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('Admin');



  
  
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!usernameOrEmail.trim() || !password.trim()) {
      setErrorMsg('Please enter both Email and Password.');
      return;
    }
    
    // Basic email validation if it looks like an email
    if (usernameOrEmail.includes('@') && !/^[^s@]+@[^s@]+.[^s@]+$/.test(usernameOrEmail)) {
      setErrorMsg('Please enter a valid email.');
      return;
    }

    try {
      setLoading(true);
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const users: AppUser[] = JSON.parse(localStorage.getItem('db_users') || '[]');
      const user = users.find(u => (u.email === usernameOrEmail || u.username === usernameOrEmail) && u.password === password);
      
      setLoading(false);
      if (user) {
        if (user.status === 'Inactive') {
          setErrorMsg('Account is disabled.');
        } else {
          setCurrentUser(user);
          onLoginSuccess(user);
        }
      } else {
        setErrorMsg('Invalid email or password.');
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Login failed.');
    }
  };

const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      setLoading(true);
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 800));

      const users: AppUser[] = JSON.parse(localStorage.getItem('db_users') || '[]');
      const user = users.find(u => u.email === forgotEmail);

      setLoading(false);
      if (!user) {
        setErrorMsg('No account found with that email.');
        return;
      }
      setSuccessMsg('Reset link sent to your email.');
      setTimeout(() => setMode('login'), 3000);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Failed to send reset link.');
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleResendVerify = async () => {
    setErrorMsg('');
    setSuccessMsg('Verification email sent. Please check your inbox.');
  };

  
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!regEmail.trim() || !regPassword.trim() || !regFullName.trim() || !regUsername.trim()) {
      setErrorMsg('All fields are required.');
      return;
    }
    
    if (!/^[^s@]+@[^s@]+.[^s@]+$/.test(regEmail)) {
      setErrorMsg('Please enter a valid email.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    
    try {
      setLoading(true);
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const users: AppUser[] = JSON.parse(localStorage.getItem('db_users') || '[]');
      if (users.find(u => u.email === regEmail)) {
        setLoading(false);
        setErrorMsg('Email is already registered.');
        return;
      }
      
      if (users.find(u => u.username === regUsername)) {
        setLoading(false);
        setErrorMsg('Username is already taken.');
        return;
      }
      
      const newUser: AppUser = {
        id: 'user-' + Date.now(),
        fullName: regFullName,
        username: regUsername,
        email: regEmail,
        mobileNumber: regMobile,
        role: regRole,
        status: 'Active',
        createdAt: new Date().toISOString(),
        password: regPassword
      };
      
      users.push(newUser);
      localStorage.setItem('db_users', JSON.stringify(users));
      
      setLoading(false);
      setSuccessMsg('Registration successful! Please login.');
      setTimeout(() => setMode('login'), 2000);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Registration failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col md:flex-row animate-in fade-in duration-300">
      
      {/* Left Side Background */}
      <div className="hidden md:flex flex-col justify-center items-center w-[60%] lg:w-[65%] bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-slate-900/60 z-10" />
        <img 
          src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=2000&q=80" 
          alt="Login Background" 
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
        <div className="relative z-20 text-center px-12 text-white flex flex-col items-center animate-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md mb-6 shadow-inner border border-white/20 overflow-hidden">
            <img src="/src/assets/images/school_management_logo_1785906402051.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-4 drop-shadow-md">
            Attendance Management
          </h1>
          <p className="text-lg text-blue-100 font-medium max-w-lg drop-shadow-sm">
            Secure • Fast • Professional
          </p>
        </div>
      </div>

      {/* Right Side Login Area */}
      <div className="w-full md:w-[40%] lg:w-[35%] flex flex-col justify-center p-6 sm:p-12 h-full overflow-y-auto bg-white shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.1)] z-20 relative">
        <div className="w-full max-w-md mx-auto">
          
          {/* Mobile Header Branding */}
          <div className="md:hidden flex flex-col items-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl overflow-hidden mb-4 shadow-lg border border-slate-200">
              <img src="/src/assets/images/school_management_logo_1785906402051.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 text-center">Attendance Management</h2>
          </div>
          
          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-slate-900">
              {mode === 'login' ? 'Welcome Back' 
                : mode === 'forgot' ? 'Password Recovery' 
                : mode === 'reset' ? 'Reset Password' 
                : mode === 'verify' ? 'Email Verification' 
                : 'Create Account'}
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              {mode === 'login' 
                ? 'Please enter your credentials to access your account.' 
                : mode === 'forgot' 
                  ? 'Enter your registered email address below to reset your password.'
                  : mode === 'reset'
                  ? 'Enter your new password below.'
                  : mode === 'verify'
                  ? 'Please wait while we verify your email address...'
                  : 'Register a new system user for access.'}
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium border border-rose-200 flex items-start gap-2 animate-in fade-in zoom-in-95 duration-200">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
              <div className="flex flex-col gap-1 w-full">
                <span>{errorMsg}</span>
                {errorMsg.includes('verify your email') && (
                  <button onClick={handleResendVerify} className="text-left text-rose-800 font-bold hover:underline text-xs">
                    Resend Verification Email
                  </button>
                )}
              </div>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-4 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-semibold border border-emerald-200 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'verify' && (
            <div className="text-center pb-8">
              {loading && <div className="text-slate-600 font-medium">Verifying...</div>}
              {!loading && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    window.history.replaceState({}, document.title, window.location.pathname);
                  }}
                  className="mt-4 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/20 transition cursor-pointer"
                >
                  Return to Login
                </button>
              )}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-700">Username or Email</label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder="Enter your username or email"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:bg-white transition shadow-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-700">Password</label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:bg-white transition shadow-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3 text-slate-400 hover:text-slate-600 cursor-pointer transition"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 accent-blue-600 cursor-pointer"
                  />
                  <label htmlFor="rememberMe" className="text-sm font-medium text-slate-600 cursor-pointer">
                    Remember me
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
              >
                {loading ? (
                  <span>Authenticating...</span>
                ) : (
                  <span>Login to Account</span>
                )}
              </button>

              

              <div className="text-center mt-6">
                <span className="text-sm text-slate-500">Don't have an account? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="text-sm font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                >
                  Register Here
                </button>
              </div>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-5 animate-in slide-in-from-right-4 duration-300">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-700">Email Address</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Enter registered email"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:bg-white transition shadow-sm"
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm cursor-pointer hover:bg-slate-200 transition"
                >
                  Back to Login
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/20 transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleResetSubmit} className="space-y-5 animate-in slide-in-from-right-4 duration-300">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-700">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:bg-white transition shadow-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-700">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:bg-white transition shadow-sm"
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/20 transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Full Name</label>
                  <input
                    type="text"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-blue-600 focus:bg-white transition"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Username</label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="johndoe"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-blue-600 focus:bg-white transition"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Email</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-blue-600 focus:bg-white transition"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Mobile</label>
                  <input
                    type="text"
                    value={regMobile}
                    onChange={(e) => setRegMobile(e.target.value)}
                    placeholder="+1 234 567 890"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-blue-600 focus:bg-white transition"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Password</label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-blue-600 focus:bg-white transition"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Confirm Password</label>
                  <input
                    type="password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-blue-600 focus:bg-white transition"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Role</label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as UserRole)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-blue-600 focus:bg-white transition"
                >
                  <option value="Super Admin">Super Admin</option>
                  <option value="Admin">Admin</option>
                  <option value="Teacher">Teacher</option>
                  <option value="Operator">Operator</option>
                </select>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm cursor-pointer hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/20 transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Create Account'}
                </button>
              </div>
              
              <div className="text-center mt-4">
                <span className="text-sm text-slate-500">Already have an account? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="text-sm font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

