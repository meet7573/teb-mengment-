import express from 'express';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

type Ctx = { supabaseUrl?: string; supabaseKey?: string };
const SUPER_ADMIN_USERNAME = 'superadmin';
const SUPER_ADMIN_EMAIL = 'meetdevani2003@gmail.com';
const OTP_EXPIRY_MS = 5 * 60_000;
const OTP_RESEND_COOLDOWN_MS = 45_000;
const OTP_REQUEST_WINDOW_MS = 10 * 60_000;
const MAX_OTP_REQUESTS = 3;
const MAX_OTP_ATTEMPTS = 5;
const adminSessions = new Map<string, { email: string; expiresAt: number }>();
function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function configured(ctx: Ctx) { return Boolean(ctx.supabaseUrl && ctx.supabaseKey); }
async function db(ctx: Ctx, pathname: string, options: RequestInit = {}) { if (!configured(ctx)) throw new Error('Supabase is not configured'); return fetch(`${ctx.supabaseUrl!.replace(/\/$/, '')}/rest/v1/${pathname}`, { ...options, headers: { apikey: ctx.supabaseKey!, Authorization: `Bearer ${ctx.supabaseKey!}`, 'Content-Type': 'application/json', ...(options.headers || {}) } }); }
async function rows(ctx: Ctx, collection: string) { const r = await db(ctx, `app_data?collection=eq.${encodeURIComponent(collection)}&select=data&order=updated_at.asc`); if (!r.ok) throw new Error(`Read ${collection} failed: ${r.status}`); return (await r.json()).map((x: any) => x.data); }
async function insert(ctx: Ctx, collection: string, id: string, data: any) { const r = await db(ctx, 'app_data', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ collection, id, data }) }); if (!r.ok) throw new Error(`Insert ${collection} failed: ${r.status} ${await r.text()}`); }
async function patch(ctx: Ctx, collection: string, id: string, data: any) { const r = await db(ctx, `app_data?collection=eq.${encodeURIComponent(collection)}&id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ data, updated_at: new Date().toISOString() }) }); if (!r.ok) throw new Error(`Update ${collection} failed: ${r.status} ${await r.text()}`); }
function safeEqualHex(a: unknown, b: unknown) { const left = Buffer.from(String(a ?? ''), 'hex'); const right = Buffer.from(String(b ?? ''), 'hex'); return left.length > 0 && left.length === right.length && timingSafeEqual(left, right); }
async function sessionFrom(ctx: Ctx, req: express.Request) { const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim(); if (!token || token.length > 200) return null; const tokenHash = hash(token); const memory = adminSessions.get(token); if (memory && memory.expiresAt > Date.now() && memory.email === SUPER_ADMIN_EMAIL) return { token, email: memory.email }; try { const records = await rows(ctx, 'adminSessions'); const record = records.find((x: any) => String(x?.id) === tokenHash && String(x?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL && !x?.revokedAt && new Date(x?.expiresAt || 0).getTime() > Date.now() && safeEqualHex(x?.tokenHash, tokenHash)); if (!record) return null; adminSessions.set(token, { email: SUPER_ADMIN_EMAIL, expiresAt: new Date(record.expiresAt).getTime() }); return { token, email: SUPER_ADMIN_EMAIL }; } catch { return null; } }
export function requireAdminSession(ctx: Ctx) { return async (req: express.Request, res: express.Response, next: express.NextFunction) => { if (!configured(ctx)) return res.status(503).json({ error: 'Admin authentication service is not configured.' }); const session = await sessionFrom(ctx, req); if (!session) return res.status(401).json({ error: 'Admin session required. Please login again.' }); return next(); }; }

function getEmailApiConfig() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim() || 'onboarding@resend.dev';
  if (!apiKey) return null;
  return { apiKey, from };
}

async function sendEmail(to: string, subject: string, text: string, html: string) {
  const config = getEmailApiConfig();
  if (!config) throw new Error('RESEND_API_KEY is not configured');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.from, to: [to], subject, text, html })
  });
  const bodyText = await response.text();
  if (!response.ok) {
    const error = new Error(`Resend email API failed: ${response.status} ${bodyText}`) as Error & { code?: string; response?: string };
    error.code = `HTTP_${response.status}`;
    error.response = bodyText;
    throw error;
  }
  return bodyText;
}

function emailConfiguredMessage() {
  return 'Email service is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL on the server.';
}

function logMailerError(context: string, error: unknown) {
  const err = error as { message?: string; code?: string; response?: string };
  console.error(`${context}:`, {
    message: err?.message || String(error),
    code: err?.code || null,
    response: err?.response || null
  });
}

function otpHashMatches(storedHash: unknown, otp: string) { const left = Buffer.from(String(storedHash ?? ''), 'hex'); const right = Buffer.from(hash(otp), 'hex'); return left.length > 0 && left.length === right.length && timingSafeEqual(left, right); }

export function createAdminRoutes(ctx: Ctx) {
  const router = express.Router();

  router.post('/otp/request', async (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (username !== SUPER_ADMIN_USERNAME) return res.status(403).json({ error: 'The user name is not authorized to access the Admin Dashboard.' });
    if (email !== SUPER_ADMIN_EMAIL) return res.status(403).json({ error: 'The email ID is not authorized to access the Admin Dashboard.' });
    if (!configured(ctx)) return res.status(503).json({ error: 'Admin authentication service is not configured.' });
    try {
      const records = await rows(ctx, 'adminOtps');
      const recent = records.filter((record: any) => String(record?.email || '').toLowerCase() === email && Number(new Date(record?.createdAt || 0)) > Date.now() - OTP_REQUEST_WINDOW_MS);
      if (recent.length >= MAX_OTP_REQUESTS) return res.status(429).json({ error: 'Too many OTP requests. Please try again later.' });
      const latest = recent.sort((a: any, b: any) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))[0];
      if (latest) {
        const remaining = OTP_RESEND_COOLDOWN_MS - (Date.now() - new Date(latest.createdAt).getTime());
        if (remaining > 0) return res.status(429).json({ error: `Please wait ${Math.ceil(remaining / 1000)} seconds before requesting another OTP.` });
      }
      const emailConfig = getEmailApiConfig();
      if (!emailConfig) return res.status(503).json({ error: emailConfiguredMessage() });
      const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const otpId = randomUUID(); const createdAt = new Date().toISOString(); const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
      await insert(ctx, 'adminOtps', otpId, { id: otpId, username: SUPER_ADMIN_USERNAME, email, otpHash: hash(otp), createdAt, expiresAt, attempts: 0, maxAttempts: MAX_OTP_ATTEMPTS, used: false });
      try {
        await sendEmail(SUPER_ADMIN_EMAIL, 'Tablet Management Admin Login OTP', `Your Tablet Management Admin Login OTP is ${otp}. It expires in 5 minutes and can only be used once.`, `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a"><h2>Tablet Management Admin Verification</h2><p>Your one-time verification code is:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;margin:20px 0">${otp}</div><p>This OTP expires in 5 minutes and can only be used once.</p><p>If you did not request this code, you can safely ignore this email.</p></div>`);
      } catch (error) {
        logMailerError('OTP email send failed', error);
        return res.status(502).json({ error: 'Failed to send OTP, please try again.' });
      }
      return res.json({ ok: true, message: 'OTP sent successfully.', expiresInSeconds: 300, resendAfterSeconds: 45 });
    } catch (e) { console.error('OTP request failed', e); return res.status(500).json({ error: 'OTP request could not be completed. Please try again.' }); }
  });

  router.post('/otp/verify', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').replace(/\D/g, '');
    if (email !== SUPER_ADMIN_EMAIL || !/^\d{6}$/.test(otp)) return res.status(401).json({ error: 'Invalid OTP.' });
    if (!configured(ctx)) return res.status(503).json({ error: 'Admin authentication service is not configured.' });
    try {
      const records = await rows(ctx, 'adminOtps');
      const record = records.filter((x: any) => String(x?.email || '').toLowerCase() === email && !x?.used).sort((a: any, b: any) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))[0];
      if (!record) return res.status(401).json({ error: 'OTP expired.' });
      if (new Date(record.expiresAt || 0).getTime() <= Date.now()) return res.status(401).json({ error: 'OTP expired.' });
      const attempts = Number(record.attempts || 0);
      if (attempts >= MAX_OTP_ATTEMPTS) { await patch(ctx, 'adminOtps', String(record.id), { ...record, used: true, invalidatedAt: new Date().toISOString() }); return res.status(401).json({ error: 'Invalid OTP.' }); }
      if (!otpHashMatches(record.otpHash, otp)) {
        const nextAttempts = attempts + 1;
        await patch(ctx, 'adminOtps', String(record.id), { ...record, attempts: nextAttempts, used: nextAttempts >= MAX_OTP_ATTEMPTS, invalidatedAt: nextAttempts >= MAX_OTP_ATTEMPTS ? new Date().toISOString() : record.invalidatedAt });
        return res.status(401).json({ error: 'Invalid OTP.' });
      }
      await patch(ctx, 'adminOtps', String(record.id), { ...record, used: true, verifiedAt: new Date().toISOString() });
      const token = randomUUID(); const tokenHash = hash(token); const expiresAt = new Date(Date.now() + 8 * 60 * 60_000).toISOString();
      adminSessions.set(token, { email: SUPER_ADMIN_EMAIL, expiresAt: Date.now() + 8 * 60 * 60_000 });
      await insert(ctx, 'adminSessions', tokenHash, { id: tokenHash, tokenHash, username: SUPER_ADMIN_USERNAME, email: SUPER_ADMIN_EMAIL, expiresAt, createdAt: new Date().toISOString() });
      return res.json({ ok: true, sessionToken: token, user: { id: 'super-admin', fullName: 'Super Admin', username: SUPER_ADMIN_USERNAME, email: SUPER_ADMIN_EMAIL, role: 'SuperAdmin', status: 'Active' } });
    } catch (e) { console.error('OTP verification failed', e); return res.status(500).json({ error: 'OTP verification failed.' }); }
  });

  router.get('/test-email', async (req, res) => {
    const configuredSecret = String(process.env.EMAIL_TEST_SECRET || '').trim();
    const providedSecret = String(req.query.secret || '').trim();
    const to = String(req.query.to || '').trim().toLowerCase();
    if (!configuredSecret || providedSecret !== configuredSecret) return res.status(404).json({ error: 'Not found.' });
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ error: 'A valid to email address is required.' });
    if (!getEmailApiConfig()) return res.status(503).json({ ok: false, error: emailConfiguredMessage() });
    try {
      await sendEmail(to, 'Tablet Management Email Test', 'Email API test email sent successfully from the Tablet Management Admin server.', '<p>Email API test email sent successfully from the Tablet Management Admin server.</p>');
      return res.json({ ok: true, message: 'Test email sent successfully.' });
    } catch (error) {
      logMailerError('Email API test failed', error);
      const err = error as { message?: string; code?: string; response?: string };
      return res.status(502).json({ ok: false, error: err?.message || String(error), code: err?.code || null, response: err?.response || null });
    }
  });

  // Direct credential-only login is intentionally disabled. OTP verification is now required.
  router.post('/login', async (_req, res) => res.status(410).json({ error: 'Direct admin login is disabled. Request and verify an OTP first.' }));
  router.post('/logout', async (req, res) => { const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim(); if (token) { adminSessions.delete(token); const tokenHash = hash(token); try { const records = await rows(ctx, 'adminSessions'); const record = records.find((x: any) => String(x?.id) === tokenHash && safeEqualHex(x?.tokenHash, tokenHash)); if (record) await patch(ctx, 'adminSessions', tokenHash, { ...record, revokedAt: new Date().toISOString(), expiresAt: new Date(0).toISOString() }); } catch {} } return res.json({ ok: true }); });
  router.get('/students/pending', requireAdminSession(ctx), async (_req, res) => { try { return res.json({ students: (await rows(ctx, 'students')).filter((s: any) => String(s?.status || '').toLowerCase() === 'pending') }); } catch { return res.status(500).json({ error: 'Could not load pending students.' }); } });
  router.post('/students/:id/approve', requireAdminSession(ctx), async (req, res) => {
    const studentId = String(req.params.id);
    try {
      const students = await rows(ctx, 'students');
      const student = students.find((s: any) => String(s?.id) === studentId);
      if (!student) return res.status(404).json({ error: 'Student not found.' });
      if (String(student.status).trim().toLowerCase() !== 'pending') return res.status(409).json({ error: 'Student is not pending approval.' });
      const email = String(student.email || '').trim().toLowerCase();
      if (!email) return res.status(409).json({ error: 'Student email ID is required before approval.' });
      const approvedAt = new Date().toISOString();
      const assignedTabletId = String(student.assignedTabletId ?? '').trim();
      const approved = { ...student, status: 'Approved', isActive: true, emailApproved: true, assignedTabletId: assignedTabletId || null, approvedAt, approvedBy: SUPER_ADMIN_EMAIL };
      await patch(ctx, 'students', studentId, approved);
      const logId = randomUUID();
      await insert(ctx, 'auditLogs', logId, { id: logId, action: 'STUDENT_APPROVED', studentId, email, by: SUPER_ADMIN_EMAIL, timestamp: approvedAt, tabletId: assignedTabletId || null });
      return res.json({ ok: true, student: approved, tablet: null, message: assignedTabletId ? 'Student approved and existing tablet assignment retained.' : 'Student approved successfully. Assign an available tablet when ready.' });
    } catch (e) { console.error('Approval failed', e); return res.status(500).json({ error: 'Student approval failed.' }); }
  });
  router.get('/checkout-requests', requireAdminSession(ctx), async (_req, res) => { try { const all = await rows(ctx, 'checkoutRequests'); const requests = all.filter((x: any) => String(x?.status || '').trim().toLowerCase() === 'pending').sort((a: any, b: any) => String(b?.requestedAt || '').localeCompare(String(a?.requestedAt || ''))); res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); return res.json({ requests, count: requests.length }); } catch { return res.status(500).json({ error: 'Could not load checkout requests.' }); } });
  router.post('/checkout-requests/:id/decision', requireAdminSession(ctx), async (req, res) => { const id = String(req.params.id); const decision = String(req.body?.decision || '').toLowerCase(); if (!['approved','rejected'].includes(decision)) return res.status(400).json({ error: 'Decision must be approved or rejected.' }); try { const requests = await rows(ctx, 'checkoutRequests'); const request = requests.find((x: any) => String(x?.id) === id); if (!request || String(request.status || '').toLowerCase() !== 'pending') return res.status(404).json({ error: 'Pending checkout request not found.' }); if (decision === 'rejected') { const updated = { ...request, status: 'rejected', decidedAt: new Date().toISOString(), decidedBy: SUPER_ADMIN_EMAIL }; await patch(ctx, 'checkoutRequests', id, updated); return res.json({ ok: true, request: updated }); } const sessions = await rows(ctx, 'studentSessions'); const session = sessions.find((x: any) => x?.status === 'active' && String(x.studentId) === String(request.studentId)); if (!session) return res.status(409).json({ error: 'Active student session not found.' }); const returnedAt = new Date().toISOString(); const durationMinutes = Math.max(0, Math.round((new Date(returnedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)); await patch(ctx, 'studentSessions', String(session.id), { ...session, returnedAt, durationMinutes, status: 'returned', checkoutApprovedAt: returnedAt, checkoutApprovedBy: SUPER_ADMIN_EMAIL }); const attendanceRows = await rows(ctx, 'attendance'); const existingAttendance = attendanceRows.find((x: any) => String(x?.sessionId) === String(session.id) && String(x?.studentId) === String(session.studentId)); if (existingAttendance) await patch(ctx, 'attendance', String(existingAttendance.id), { ...existingAttendance, returnedAt, durationMinutes, status: 'OUT' }); else { const attendanceId = randomUUID(); await insert(ctx, 'attendance', attendanceId, { id: attendanceId, sessionId: session.id, studentId: session.studentId, studentName: session.studentName, tabletId: session.tabletId, startedAt: session.startedAt, returnedAt, durationMinutes, status: 'OUT', date: returnedAt.slice(0,10) }); } const tablets = await rows(ctx, 'tablets'); const tablet = tablets.find((t: any) => String(t?.id ?? t?.tabletId ?? t?.tabletNumber) === String(session.tabletId)); if (tablet) await patch(ctx, 'tablets', String(tablet.id ?? tablet.tabletId ?? tablet.tabletNumber), { ...tablet, status: 'Available', assignedStudentId: null, assignedStudentName: null, assignedToStudentId: null, assignedToStudentName: null }); const students = await rows(ctx, 'students'); const student = students.find((s: any) => String(s?.id) === String(session.studentId)); if (student) await patch(ctx, 'students', String(student.id), { ...student, assignedTabletId: null, status: 'Approved' }); const updatedRequest = { ...request, status: 'approved', decidedAt: returnedAt, decidedBy: SUPER_ADMIN_EMAIL }; await patch(ctx, 'checkoutRequests', id, updatedRequest); return res.json({ ok: true, request: updatedRequest }); } catch (e) { console.error('Checkout decision failed', e); return res.status(500).json({ error: 'Checkout decision failed.' }); } });
  return router;
}
