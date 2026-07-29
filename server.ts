import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';

dotenv.config();

const currentDir = process.cwd();

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_dev';

// Database setup (JSON based for simple deployment)
let db: { users: any[] } = { users: [] };
const dataDir = path.join(currentDir, 'data');
const dbFile = path.join(dataDir, 'auth.json');

async function setupDB() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(dbFile)) {
    const data = fs.readFileSync(dbFile, 'utf-8');
    try {
      db = JSON.parse(data);
    } catch (e) {
      db = { users: [] };
    }
  } else {
    fs.writeFileSync(dbFile, JSON.stringify(db));
  }

  // Seed default admin if not exists
  const adminExists = db.users.find(u => u.username === 'meetdevani');
  if (!adminExists) {
    const passwordHash = await bcrypt.hash('Meet@2003', 10);
    db.users.push({
      id: 'usr-admin-1',
      fullName: 'Meet Devani',
      username: 'meetdevani',
      email: 'meetdevani2003@gmail.com',
      mobileNumber: '+91 00000 00000',
      role: 'Super Admin',
      status: 'Active',
      passwordHash,
      isVerified: 1,
      createdAt: new Date().toISOString()
    });
    saveDB();
  }
}

function saveDB() {
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

// Email Setup
let transporter: nodemailer.Transporter;

async function setupEmail() {
  try {
    if (process.env.SMTP_URL && (process.env.SMTP_URL.startsWith('smtp://') || process.env.SMTP_URL.startsWith('smtps://'))) {
      transporter = nodemailer.createTransport(process.env.SMTP_URL);
      console.log('Using configured SMTP server.');
      return;
    }
  } catch (error) {
    console.warn('Failed to parse SMTP_URL, falling back to Ethereal:', error);
  }

  // Ethereal mock email fallback
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('Ethereal Email mock initialized. Ethereal is used for local email sending preview.');
  } catch (error) {
    console.error('Failed to initialize Ethereal email:', error);
  }
}

setupDB();
setupEmail();

async function sendMail(to: string, subject: string, text: string) {
  const info = await transporter.sendMail({
    from: '"Attendance System" <no-reply@attendancesystem.local>',
    to,
    subject,
    text,
  });
  console.log(`Email sent to ${to}`);
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`Email Preview URL: ${previewUrl}`);
  }
  return info;
}

// API Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, username, email, mobileNumber, password, role } = req.body;
    
    const existingUser = db.users.find(u => u.username === username || u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'Username or Email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = 'usr-' + crypto.randomBytes(4).toString('hex');
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24h
    const createdAt = new Date().toISOString();

    const newUser = {
      id, fullName, username, email, mobileNumber, role, status: 'Inactive', passwordHash, isVerified: 0, verificationToken, verificationTokenExpiry, createdAt
    };
    db.users.push(newUser);
    saveDB();

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const verifyUrl = `${protocol}://${host}?verify=${verificationToken}`;
    
    const emailBody = `Hello ${fullName},

Welcome to the Attendance Management System.

Your account has been created successfully.

Username:
${username}

Please verify your email by clicking the link below:
${verifyUrl}

Thank you.`;

    await sendMail(email, 'Welcome to Attendance Management System', emailBody);
    res.json({ message: 'Registration successful. Please verify your email.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    const userIndex = db.users.findIndex(u => u.verificationToken === token);

    if (userIndex === -1) {
      return res.status(400).json({ error: 'Invalid verification token.' });
    }

    const user = db.users[userIndex];

    if (Date.now() > user.verificationTokenExpiry) {
      return res.status(400).json({ error: 'Verification link expired.' });
    }

    db.users[userIndex].isVerified = 1;
    db.users[userIndex].status = 'Active';
    db.users[userIndex].verificationToken = null;
    db.users[userIndex].verificationTokenExpiry = null;
    saveDB();

    res.json({ message: 'Email verified successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    const userIndex = db.users.findIndex(u => u.email === email);

    if (userIndex === -1) {
      return res.status(400).json({ error: 'User not found.' });
    }

    const user = db.users[userIndex];

    if (user.isVerified) {
      return res.status(400).json({ error: 'Email already verified.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000;

    db.users[userIndex].verificationToken = verificationToken;
    db.users[userIndex].verificationTokenExpiry = verificationTokenExpiry;
    saveDB();

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const verifyUrl = `${protocol}://${host}?verify=${verificationToken}`;
    
    const emailBody = `Hello ${user.fullName},

Please verify your email by clicking the link below:
${verifyUrl}

Thank you.`;

    await sendMail(email, 'Verify your Email (Resend)', emailBody);
    res.json({ message: 'Verification email sent successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    const user = db.users.find(u => u.username === usernameOrEmail || u.email === usernameOrEmail);
    if (!user) {
      return res.status(400).json({ error: 'User not found. Please register first.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect password.' });
    }

    if (!user.isVerified) {
      return res.status(400).json({ error: 'Please verify your email before logging in.' });
    }
    
    if (user.status !== 'Active') {
      return res.status(400).json({ error: 'Account is inactive.' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    
    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        mobileNumber: user.mobileNumber,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const userIndex = db.users.findIndex(u => u.email === email);

    if (userIndex === -1) {
      return res.status(400).json({ error: 'User not found.' });
    }

    const user = db.users[userIndex];

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 30 * 60 * 1000;

    db.users[userIndex].resetToken = resetToken;
    db.users[userIndex].resetTokenExpiry = resetTokenExpiry;
    saveDB();

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const resetUrl = `${protocol}://${host}?reset=${resetToken}`;
    
    const emailBody = `Hello ${user.fullName},

You requested to reset your password.
Please click the link below to set a new password. This link is valid for 30 minutes.

${resetUrl}

If you did not request this, please ignore this email.`;

    await sendMail(email, 'Password Reset Request', emailBody);
    res.json({ message: 'Password reset email sent successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const userIndex = db.users.findIndex(u => u.resetToken === token);

    if (userIndex === -1) {
      return res.status(400).json({ error: 'Invalid reset token.' });
    }

    const user = db.users[userIndex];

    if (Date.now() > user.resetTokenExpiry) {
      return res.status(400).json({ error: 'Password reset link expired.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    db.users[userIndex].passwordHash = passwordHash;
    db.users[userIndex].resetToken = null;
    db.users[userIndex].resetTokenExpiry = null;
    saveDB();

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve frontend
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(currentDir, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
