const fs = require('fs');
let code = fs.readFileSync('src/components/Auth/LoginModal.tsx', 'utf8');

// Remove Firebase imports
code = code.replace(/import \{ signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider \} from 'firebase\/auth';\n/, '');
code = code.replace(/import \{ auth, db \} from '\.\.\/\.\.\/lib\/firebase';\n/, '');
code = code.replace(/import \{ doc, getDoc, setDoc \} from 'firebase\/firestore';\n/, '');

// Replace handleLoginSubmit
const handleLoginStart = code.indexOf('const handleLoginSubmit = async (e: React.FormEvent) => {');
const handleGoogleLoginStart = code.indexOf('const handleGoogleLogin = async () => {');

const loginReplacement = `
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!usernameOrEmail.trim() || !password.trim()) {
      setErrorMsg('Please enter both Email and Password.');
      return;
    }
    
    // Basic email validation if it looks like an email
    if (usernameOrEmail.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(usernameOrEmail)) {
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

`;

code = code.substring(0, handleLoginStart) + loginReplacement + code.substring(handleGoogleLoginStart);

// Remove handleGoogleLogin
const handleForgotSubmitStart = code.indexOf('const handleForgotSubmit = async (e: React.FormEvent) => {');
code = code.substring(0, code.indexOf('const handleGoogleLogin = async () => {')) + code.substring(handleForgotSubmitStart);

// Replace handleRegisterSubmit
const handleRegisterStart = code.indexOf('const handleRegisterSubmit = async (e: React.FormEvent) => {');
const handleRegisterEnd = code.indexOf('return (', handleRegisterStart);

const registerReplacement = `
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!regEmail.trim() || !regPassword.trim() || !regFullName.trim() || !regUsername.trim()) {
      setErrorMsg('All fields are required.');
      return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) {
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

  `;
  
code = code.substring(0, handleRegisterStart) + registerReplacement + code.substring(handleRegisterEnd);

// Remove Google Button UI
code = code.replace(/<div className="mt-4 pt-4 border-t border-slate-200">[\s\S]*?Continue with Google\n\s*<\/button>\n\s*<\/div>/, '');

fs.writeFileSync('src/components/Auth/LoginModal.tsx', code);
