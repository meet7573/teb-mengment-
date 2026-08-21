import express from 'express';
import { randomUUID, createHash } from 'node:crypto';

type Ctx = { supabaseUrl?: string; supabaseKey?: string };
function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function normalizePin(value: unknown) { return String(value ?? '').trim().replace(/^PIN[-\s:]*/i, '').replace(/\D/g, '').trim(); }
function validPin(pin: string) { return /^\d{4}$/.test(pin); }
function same(a: unknown, b: string) { return String(a ?? '').trim().toLowerCase() === b.trim().toLowerCase(); }
async function db(ctx: Ctx, pathname: string, options: RequestInit = {}) {
  if (!ctx.supabaseUrl || !ctx.supabaseKey) throw new Error('Supabase is not configured');
  return fetch(`${ctx.supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`, { ...options, headers: { apikey: ctx.supabaseKey, Authorization: `Bearer ${ctx.supabaseKey}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
}
async function rows(ctx: Ctx, collection: string) { const r = await db(ctx, `app_data?collection=eq.${encodeURIComponent(collection)}&select=data&order=updated_at.asc`); if (!r.ok) throw new Error(`Read ${collection} failed: ${r.status}`); return (await r.json()).map((x: any) => x.data); }
async function insert(ctx: Ctx, collection: string, id: string, data: any) { const r = await db(ctx, 'app_data', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ collection, id, data }) }); if (!r.ok) throw new Error(`Insert ${collection} failed: ${r.status} ${await r.text()}`); }
const attempts = new Map<string, { count: number; resetAt: number }>();
function allowed(ip: string) { const now = Date.now(); const current = attempts.get(ip); if (!current || current.resetAt <= now) { attempts.set(ip, { count: 1, resetAt: now + 60_000 }); return true; } if (current.count >= 5) return false; current.count += 1; return true; }

export function createStudentLifecycleRoutes(ctx: Ctx) {
  const router = express.Router();

  // This route is registered before the legacy /api/student/activate handler in server.ts.
  // It makes email + name + PIN + admin approval mandatory for every student login.
  router.post('/activate', async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!allowed(ip)) return res.status(429).json({ error: 'Too many login attempts. Try again in a minute.' });
    if (!ctx.supabaseUrl || !ctx.supabaseKey) return res.status(503).json({ error: 'Service unavailable' });

    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const name = String(req.body?.name ?? '').trim();
    const pin = normalizePin(req.body?.pin);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'A valid approved email ID is required.' });
    if (!name) return res.status(400).json({ error: 'Student Name is required.' });
    if (!validPin(pin)) return res.status(400).json({ error: 'Student PIN must be exactly 4 digits.' });

    try {
      const [students, sessions, attendance] = await Promise.all([rows(ctx, 'students'), rows(ctx, 'studentSessions'), rows(ctx, 'attendance')]);
      const student = students.find((item: any) => same(item?.email, email) && same(item?.name, name) && normalizePin(item?.pinNumber ?? item?.pin) === pin);
      if (!student) return res.status(401).json({ error: 'Student Name, Email ID or PIN is incorrect.' });
      if (student.emailApproved !== true) return res.status(403).json({ error: 'Your email ID is not authorized. Please contact the administrator.' });
      if (student.isActive === false || !['approved', 'active', 'present'].includes(String(student?.status ?? '').toLowerCase())) return res.status(401).json({ error: 'Your student account is pending approval or inactive.' });

      const assignedTabletId = String(student?.assignedTabletId ?? student?.assignedTabletNumber ?? student?.tabletId ?? '').trim().toUpperCase();
      if (!assignedTabletId) return res.status(409).json({ error: 'No tablet has been assigned to this student. Please contact Admin.' });
      const studentId = String(student?.id ?? student?.studentId ?? '').trim();
      if (!studentId) return res.status(500).json({ error: 'Student record is missing an ID.' });
      if (sessions.some((item: any) => item?.status === 'active' && (same(item?.studentId, studentId) || String(item?.tabletId ?? '').trim().toUpperCase() === assignedTabletId))) return res.status(409).json({ error: 'This student or assigned tablet already has an active session.' });
      if (attendance.some((item: any) => String(item?.studentId) === studentId && String(item?.status ?? '').toUpperCase() === 'IN' && !item?.returnedAt)) return res.status(409).json({ error: 'This student is already checked in.' });

      const sessionToken = randomUUID();
      const startedAt = new Date().toISOString();
      const studentName = String(student?.name ?? 'Student').trim() || 'Student';
      const session = { id: sessionToken, sessionTokenHash: hash(sessionToken), studentId, tabletId: assignedTabletId, studentName, startedAt, returnedAt: null, durationMinutes: null, status: 'active' };
      await insert(ctx, 'studentSessions', sessionToken, session);
      const attendanceId = randomUUID();
      await insert(ctx, 'attendance', attendanceId, { id: attendanceId, sessionId: sessionToken, studentId, studentName, tabletId: assignedTabletId, startedAt, returnedAt: null, durationMinutes: null, status: 'IN', date: startedAt.slice(0, 10) });
      const logId = randomUUID();
      await insert(ctx, 'auditLogs', logId, { id: logId, action: 'STUDENT_CHECK_IN', studentId, tabletId: assignedTabletId, sessionId: sessionToken, timestamp: startedAt });
      return res.json({ session: { sessionToken, studentId, studentName, tabletId: assignedTabletId, startedAt, student: { name: studentName, email, standard: String(student?.standard ?? ''), coachingType: String(student?.coachingType ?? ''), roomNumber: String(student?.roomNumber ?? ''), wingNumber: String(student?.wingNumber ?? ''), tabletId: assignedTabletId } } });
    } catch (error) { console.error('Student email login failed:', error); return res.status(500).json({ error: 'Student login could not be completed.' }); }
  });

  router.post('/checkout-request', async (req, res) => {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return res.status(401).json({ error: 'Student session required.' });
    try {
      const sessions = await rows(ctx, 'studentSessions');
      const session = sessions.find((x: any) => x?.status === 'active' && x?.sessionTokenHash === hash(token));
      if (!session) return res.status(401).json({ error: 'Active student session not found.' });
      const requests = await rows(ctx, 'checkoutRequests');
      const existing = requests.find((x: any) => String(x?.studentId) === String(session.studentId) && String(x?.status || '').toLowerCase() === 'pending');
      if (existing) return res.status(409).json({ error: 'A checkout request is already pending.', request: existing });
      const id = randomUUID(); const now = new Date().toISOString();
      const request = { id, studentId: String(session.studentId), studentName: String(session.studentName || 'Student'), sessionId: String(session.id), tabletId: String(session.tabletId), status: 'pending', requestedAt: now };
      await insert(ctx, 'checkoutRequests', id, request);
      const verify = await rows(ctx, 'checkoutRequests');
      const saved = verify.find((x: any) => String(x?.id) === id);
      if (!saved) throw new Error('Checkout request was not persisted in database.');
      const logId = randomUUID();
      await insert(ctx, 'auditLogs', logId, { id: logId, action: 'CHECKOUT_REQUESTED', studentId: String(session.studentId), tabletId: String(session.tabletId), timestamp: now });
      return res.status(201).json({ ok: true, request: saved });
    } catch (e) { console.error('Checkout request failed', e); return res.status(500).json({ error: 'Checkout request could not be created.' }); }
  });

  router.get('/activity', async (req, res) => {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return res.status(401).json({ error: 'Student session required.' });
    try { const sessions = await rows(ctx, 'studentSessions'); const session = sessions.find((x: any) => x?.sessionTokenHash === hash(token)); if (!session) return res.status(401).json({ error: 'Invalid student session.' }); const logs = await rows(ctx, 'auditLogs'); return res.json({ activities: logs.filter((x: any) => String(x?.studentId) === String(session.studentId)).sort((a: any,b: any) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0,100) }); } catch { return res.status(500).json({ error: 'Could not load activity.' }); }
  });
  return router;
}
