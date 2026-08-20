import express from 'express';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';

type Ctx = { supabaseUrl?: string; supabaseKey?: string };
const SUPER_ADMIN_EMAIL = 'meetdevani2003@gmail.com';
const otpAttempts = new Map<string, { count: number; resetAt: number }>();
const otpSendAttempts = new Map<string, { count: number; resetAt: number }>();
const adminSessions = new Map<string, { email: string; expiresAt: number }>();

function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function configured(ctx: Ctx) { return Boolean(ctx.supabaseUrl && ctx.supabaseKey); }
async function db(ctx: Ctx, pathname: string, options: RequestInit = {}) {
  if (!configured(ctx)) throw new Error('Supabase is not configured');
  return fetch(`${ctx.supabaseUrl!.replace(/\/$/, '')}/rest/v1/${pathname}`, { ...options, headers: { apikey: ctx.supabaseKey!, Authorization: `Bearer ${ctx.supabaseKey!}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
}
async function rows(ctx: Ctx, collection: string) {
  const r = await db(ctx, `app_data?collection=eq.${encodeURIComponent(collection)}&select=data&order=updated_at.asc`);
  if (!r.ok) throw new Error(`Read ${collection} failed: ${r.status}`);
  return (await r.json()).map((x: any) => x.data);
}
async function insert(ctx: Ctx, collection: string, id: string, data: any) {
  const r = await db(ctx, 'app_data', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ collection, id, data }) });
  if (!r.ok) throw new Error(`Insert ${collection} failed: ${r.status} ${await r.text()}`);
}
async function patch(ctx: Ctx, collection: string, id: string, data: any) {
  const r = await db(ctx, `app_data?collection=eq.${encodeURIComponent(collection)}&id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ data, updated_at: new Date().toISOString() }) });
  if (!r.ok) throw new Error(`Update ${collection} failed: ${r.status} ${await r.text()}`);
}
function limiter(map: Map<string, { count: number; resetAt: number }>, key: string, max: number, windowMs: number) {
  const now = Date.now(); const old = map.get(key);
  if (!old || old.resetAt <= now) { map.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (old.count >= max) return false; old.count++; return true;
}
function sessionFrom(req: express.Request) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const item = adminSessions.get(token);
  if (!token || !item || item.expiresAt <= Date.now() || item.email !== SUPER_ADMIN_EMAIL) return null;
  return { token, email: item.email };
}
export function requireAdminSession(ctx: Ctx) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!configured(ctx)) return res.status(503).json({ error: 'Admin authentication service is not configured.' });
    if (!sessionFrom(req)) return res.status(401).json({ error: 'Admin session required.' });
    return next();
  };
}

export function createAdminRoutes(ctx: Ctx) {
  const router = express.Router();
  router.post('/otp/request', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (email !== SUPER_ADMIN_EMAIL) return res.status(403).json({ error: 'This email is not authorized as Super Admin.' });
    if (!limiter(otpSendAttempts, req.ip || 'unknown', 3, 10 * 60_000)) return res.status(429).json({ error: 'Too many OTP requests. Try again later.' });
    if (!configured(ctx)) return res.status(503).json({ error: 'Admin authentication service is not configured.' });
    try {
      const smtpUrl = process.env.SMTP_URL;
      if (!smtpUrl) return res.status(503).json({ error: 'SMTP email service is not configured.' });
      const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const otpId = randomUUID(); const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
      await insert(ctx, 'adminOtps', otpId, { id: otpId, email, otpHash: hash(otp), expiresAt, used: false, attempts: 0, createdAt: new Date().toISOString() });
      const transporter = nodemailer.createTransport(smtpUrl);
      await transporter.sendMail({ from: process.env.SMTP_FROM || email, to: email, subject: 'Tablet Management Super Admin OTP', text: `Your Super Admin OTP is ${otp}. It expires in 10 minutes.`, html: `<p>Your Super Admin OTP is <strong>${otp}</strong>.</p><p>It expires in 10 minutes and can only be used once.</p>` });
      return res.json({ ok: true, message: 'OTP sent to the authorized Super Admin email.' });
    } catch (e) { console.error('OTP send failed', e); return res.status(500).json({ error: 'Unable to send OTP.' }); }
  });
  router.post('/otp/verify', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase(); const otp = String(req.body?.otp || '').replace(/\D/g, '');
    if (email !== SUPER_ADMIN_EMAIL || !/^\d{6}$/.test(otp)) return res.status(401).json({ error: 'Invalid OTP.' });
    if (!limiter(otpAttempts, req.ip || 'unknown', 10, 10 * 60_000)) return res.status(429).json({ error: 'Too many OTP attempts. Try again later.' });
    try {
      const records = await rows(ctx, 'adminOtps');
      const record = records.filter((x: any) => x?.email === email && !x?.used).sort((a: any,b: any) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
      if (!record || new Date(record.expiresAt).getTime() <= Date.now() || record.otpHash !== hash(otp)) return res.status(401).json({ error: 'Invalid or expired OTP.' });
      record.used = true; await patch(ctx, 'adminOtps', String(record.id), record);
      const token = randomUUID(); const expiresAt = new Date(Date.now() + 8 * 60 * 60_000).toISOString(); adminSessions.set(token, { email, expiresAt: Date.now() + 8 * 60 * 60_000 });
      await insert(ctx, 'adminSessions', token, { id: token, tokenHash: hash(token), email, expiresAt, createdAt: new Date().toISOString() });
      return res.json({ ok: true, sessionToken: token, user: { id: 'super-admin', fullName: 'Super Admin', username: 'superadmin', email, role: 'SuperAdmin', status: 'Active' } });
    } catch (e) { console.error('OTP verify failed', e); return res.status(500).json({ error: 'OTP verification failed.' }); }
  });
  router.post('/logout', async (req, res) => { const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim(); if (token) adminSessions.delete(token); return res.json({ ok: true }); });

  router.get('/students/pending', requireAdminSession(ctx), async (_req, res) => { try { return res.json({ students: (await rows(ctx, 'students')).filter((s: any) => String(s?.status || '').toLowerCase() === 'pending') }); } catch { return res.status(500).json({ error: 'Could not load pending students.' }); } });
  router.post('/students/:id/approve', requireAdminSession(ctx), async (req, res) => {
    const studentId = String(req.params.id);
    try {
      const students = await rows(ctx, 'students'); const tablets = await rows(ctx, 'tablets');
      const student = students.find((s: any) => String(s?.id) === studentId); if (!student) return res.status(404).json({ error: 'Student not found.' });
      if (String(student.status).toLowerCase() !== 'pending') return res.status(409).json({ error: 'Student is not pending approval.' });
      const occupied = new Set(students.filter((s: any) => s?.assignedTabletId && ['approved','active','present'].includes(String(s?.status || '').toLowerCase())).map((s: any) => String(s.assignedTabletId).toUpperCase()));
      const tablet = tablets.find((t: any) => { const id = String(t?.id ?? t?.tabletId ?? t?.tabletNumber ?? '').trim(); const status = String(t?.status ?? 'Available').toLowerCase(); return id && ['available','free'].includes(status) && !occupied.has(id.toUpperCase()); });
      if (!tablet) return res.status(409).json({ error: 'No available tablet is currently available. Student remains pending.' });
      const tabletId = String(tablet.id ?? tablet.tabletId ?? tablet.tabletNumber);
      const approved = { ...student, status: 'Approved', isActive: true, assignedTabletId: tabletId, approvedAt: new Date().toISOString(), approvedBy: SUPER_ADMIN_EMAIL };
      const assignedTablet = { ...tablet, status: 'Assigned', assignedStudentId: studentId, assignedStudentName: student.name };
      await patch(ctx, 'students', studentId, approved);
      await patch(ctx, 'tablets', String(tablet.id ?? tablet.tabletId ?? tablet.tabletNumber), assignedTablet);
      const logId = randomUUID(); await insert(ctx, 'auditLogs', logId, { id: logId, action: 'STUDENT_APPROVED_AUTO_TABLET', studentId, tabletId, by: SUPER_ADMIN_EMAIL, timestamp: new Date().toISOString() });
      return res.json({ ok: true, student: approved, tablet: assignedTablet });
    } catch (e) { console.error('Approval failed', e); return res.status(500).json({ error: 'Student approval failed.' }); }
  });

  router.get('/checkout-requests', requireAdminSession(ctx), async (_req, res) => { try { return res.json({ requests: (await rows(ctx, 'checkoutRequests')).filter((x: any) => x?.status === 'pending') }); } catch { return res.status(500).json({ error: 'Could not load checkout requests.' }); } });
  router.post('/checkout-requests/:id/decision', requireAdminSession(ctx), async (req, res) => {
    const id = String(req.params.id); const decision = String(req.body?.decision || '').toLowerCase(); if (!['approved','rejected'].includes(decision)) return res.status(400).json({ error: 'Decision must be approved or rejected.' });
    try {
      const requests = await rows(ctx, 'checkoutRequests'); const request = requests.find((x: any) => String(x?.id) === id); if (!request || request.status !== 'pending') return res.status(404).json({ error: 'Pending checkout request not found.' });
      if (decision === 'rejected') { const updated = { ...request, status: 'rejected', decidedAt: new Date().toISOString(), decidedBy: SUPER_ADMIN_EMAIL }; await patch(ctx, 'checkoutRequests', id, updated); return res.json({ ok: true, request: updated }); }
      const sessions = await rows(ctx, 'studentSessions'); const session = sessions.find((x: any) => x?.status === 'active' && String(x.studentId) === String(request.studentId)); if (!session) return res.status(409).json({ error: 'Active student session not found.' });
      const returnedAt = new Date().toISOString(); const durationMinutes = Math.max(0, Math.round((new Date(returnedAt).getTime() - new Date(session.startedAt).getTime()) / 60000));
      const updatedSession = { ...session, returnedAt, durationMinutes, status: 'returned', checkoutApprovedAt: returnedAt, checkoutApprovedBy: SUPER_ADMIN_EMAIL }; await patch(ctx, 'studentSessions', String(session.id), updatedSession);
      const attendanceId = randomUUID(); await insert(ctx, 'attendance', attendanceId, { id: attendanceId, sessionId: session.id, studentId: session.studentId, studentName: session.studentName, tabletId: session.tabletId, startedAt: session.startedAt, returnedAt, durationMinutes, status: 'OUT', date: returnedAt.slice(0,10) });
      const tablets = await rows(ctx, 'tablets'); const tablet = tablets.find((t: any) => String(t?.id ?? t?.tabletId ?? t?.tabletNumber) === String(session.tabletId)); if (tablet) await patch(ctx, 'tablets', String(tablet.id ?? tablet.tabletId ?? tablet.tabletNumber), { ...tablet, status: 'Available', assignedStudentId: null, assignedStudentName: null });
      const students = await rows(ctx, 'students'); const student = students.find((s: any) => String(s?.id) === String(session.studentId)); if (student) await patch(ctx, 'students', String(student.id), { ...student, assignedTabletId: null, status: 'Approved' });
      const updatedRequest = { ...request, status: 'approved', decidedAt: returnedAt, decidedBy: SUPER_ADMIN_EMAIL }; await patch(ctx, 'checkoutRequests', id, updatedRequest);
      return res.json({ ok: true, request: updatedRequest });
    } catch (e) { console.error('Checkout decision failed', e); return res.status(500).json({ error: 'Checkout decision failed.' }); }
  });
  return router;
}
