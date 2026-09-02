import express from 'express';
import path from 'path';
import { randomUUID, createHash } from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import { createPhotoRouter } from './server/photoRoutes';
import { createAdminRoutes, requireAdminSession } from './server/adminRoutes';
import { createStudentLifecycleRoutes } from './server/studentLifecycleRoutes';

const currentDir = process.cwd();
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));

const COLLECTIONS = new Set(['students', 'tablets', 'boxes', 'assignments', 'attendance', 'movements', 'auditLogs', 'studentSessions', 'checkoutRequests', 'adminOtps', 'adminSessions']);
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
function databaseConfigured() { return Boolean(supabaseUrl && supabaseKey); }
async function supabaseRequest(pathname: string, options: RequestInit = {}) {
  if (!databaseConfigured()) throw new Error('Supabase is not configured');
  return fetch(`${supabaseUrl}/rest/v1/${pathname}`, { ...options, headers: { apikey: supabaseKey!, Authorization: `Bearer ${supabaseKey!}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
}
app.use('/api/photos', createPhotoRouter({ supabaseUrl, supabaseKey }));
app.use('/api/admin', createAdminRoutes({ supabaseUrl, supabaseKey }));
app.use('/api/student', createStudentLifecycleRoutes({ supabaseUrl, supabaseKey }));
function normalizeTabletId(value: unknown) { return String(value ?? '').trim().toUpperCase(); }
function normalizePin(value: unknown) { return String(value ?? '').trim().replace(/^PIN[-\s:]*/i, '').replace(/\D/g, '').trim(); }
function isValidPin(pin: string) { return /^\d{4}$/.test(pin); }
function pinHash(pin: string) { return createHash('sha256').update(normalizePin(pin)).digest('hex'); }
function valueMatches(value: unknown, target: string) { return String(value ?? '').trim().toLowerCase() === target.trim().toLowerCase(); }
function containsPin(value: unknown, target: string, depth = 0): boolean {
  if (depth > 6 || value == null) return false;
  if (Array.isArray(value)) return value.some((item) => containsPin(item, target, depth + 1));
  if (typeof value !== 'object') return false;
  const targetPin = normalizePin(target);
  const targetHash = pinHash(targetPin);
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const childPin = normalizePin(child);
    if (['pin', 'pinno', 'studentpin'].includes(normalizedKey) && childPin === targetPin) return true;
    if (normalizedKey === 'pinnumber' && ((childPin === targetPin) || (childPin.length === 6 && childPin.slice(0, 4) === targetPin))) return true;
    if (normalizedKey === 'pinhash' && String(child ?? '') === targetHash) return true;
    if (typeof child === 'object' && containsPin(child, targetPin, depth + 1)) return true;
  }
  return false;
}
async function readCollectionServerSide(collection: string): Promise<any[]> {
  const response = await supabaseRequest(`app_data?collection=eq.${encodeURIComponent(collection)}&select=data&order=updated_at.asc`);
  if (!response.ok) { const body = await response.text().catch(() => ''); console.error(`Supabase ${collection} read failed:`, response.status, body); throw new Error(`Supabase returned ${response.status}`); }
  const rows = await response.json(); return rows.map((row: { data: unknown }) => row.data);
}
async function findStudentById(studentId: string) { const students = await readCollectionServerSide('students'); return students.find((item) => valueMatches(item?.id ?? item?.studentId ?? item?.studentID, studentId)); }
function hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }
const activationAttempts = new Map<string, { count: number; resetAt: number }>();
function activationAllowed(ip: string) { const now = Date.now(); const current = activationAttempts.get(ip); if (!current || current.resetAt <= now) { activationAttempts.set(ip, { count: 1, resetAt: now + 60_000 }); return true; } if (current.count >= 5) return false; current.count += 1; return true; }

app.get('/api/health', async (_req, res) => { try { if (!databaseConfigured()) return res.json({ status: 'ok', database: false, provider: 'supabase' }); const response = await supabaseRequest('app_data?select=id&limit=1'); if (!response.ok) throw new Error(`Supabase returned ${response.status}`); return res.json({ status: 'ok', database: true, provider: 'supabase' }); } catch (error) { console.error('Database health check failed:', error); return res.status(503).json({ status: 'error', database: false, provider: 'supabase' }); } });

app.post('/api/student/register', async (req, res) => {
  if (!databaseConfigured()) return res.status(503).json({ error: 'Service unavailable' });
  const name = String(req.body?.name ?? '').trim(); const pin = normalizePin(req.body?.pin); const standard = String(req.body?.standard ?? '').trim(); const coachingType = String(req.body?.coachingType ?? '').trim(); const roomNumber = String(req.body?.roomNumber ?? '').trim(); const wingNumber = String(req.body?.wingNumber ?? '').trim();
  if (!name || !isValidPin(pin) || !standard || !roomNumber || !wingNumber) return res.status(400).json({ error: 'Name, a unique 4-digit App PIN, standard, coaching type, room and wing are required.' });
  if (!['Coaching', 'Non-Coaching'].includes(coachingType)) return res.status(400).json({ error: 'Coaching type must be Coaching or Non-Coaching.' });
  try {
    const students = await readCollectionServerSide('students');
    if (students.some((item) => containsPin(item, pin))) return res.status(409).json({ error: 'This PIN is already registered. Please choose another 4-digit PIN.' });
    const studentId = randomUUID(); const now = new Date().toISOString();
    const student = { id: studentId, name, pinHash: pinHash(pin), pinNumber: `PIN-${pin}`, standard, coachingType, roomNumber, wingNumber, assignedTabletId: null, isActive: true, status: 'Pending', createdAt: now, updatedAt: now };
    const response = await supabaseRequest('app_data', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ collection: 'students', id: studentId, data: student }) });
    if (!response.ok) { const body = await response.text(); console.error('Student registration insert failed:', response.status, body); throw new Error(`Student insert returned ${response.status}`); }
    const logId = randomUUID(); await supabaseRequest('app_data', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ collection: 'auditLogs', id: logId, data: { id: logId, action: 'STUDENT_REGISTERED', studentId, timestamp: now } }) });
    return res.status(201).json({ student: { id: studentId, name, standard, coachingType, roomNumber, wingNumber, tabletId: null, pinNumber: `PIN-${pin}`, status: 'Pending' }, appPin: pin });
  } catch (error) { console.error('Student registration failed:', error); return res.status(500).json({ error: 'Student registration could not be completed.' }); }
});

app.post('/api/student/activate', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'; if (!activationAllowed(ip)) return res.status(429).json({ error: 'Too many login attempts. Try again in a minute.' });
  if (!databaseConfigured()) return res.status(503).json({ error: 'Service unavailable' }); const pin = normalizePin(req.body?.pin); if (!isValidPin(pin)) return res.status(400).json({ error: 'Student PIN must be exactly 4 digits.' });
  try {
    const [students, sessions, attendance] = await Promise.all([readCollectionServerSide('students'), readCollectionServerSide('studentSessions'), readCollectionServerSide('attendance')]); const student = students.find((item) => containsPin(item, pin));
    if (!student || student?.isActive === false || !['approved','active','present'].includes(String(student?.status ?? '').toLowerCase())) return res.status(401).json({ error: 'Student PIN is incorrect, pending approval, or inactive.' });
    const assignedTabletId = normalizeTabletId(student?.assignedTabletId ?? student?.assignedTabletNumber ?? student?.tabletId ?? ''); if (!assignedTabletId) return res.status(409).json({ error: 'No tablet has been assigned to this student. Please contact Admin.' });
    const studentId = String(student?.id ?? student?.studentId ?? student?.studentID ?? '').trim(); if (!studentId) return res.status(500).json({ error: 'Student record is missing an ID.' });
    if (sessions.some((item) => item?.status === 'active' && (valueMatches(item?.studentId, studentId) || normalizeTabletId(item?.tabletId) === assignedTabletId))) return res.status(409).json({ error: 'This student or assigned tablet already has an active session.' });
    if (attendance.some((item) => String(item?.studentId) === studentId && String(item?.status ?? '').toUpperCase() === 'IN' && !item?.returnedAt)) return res.status(409).json({ error: 'This student is already checked in.' });
    const sessionToken = randomUUID(); const startedAt = new Date().toISOString(); const studentName = String(student?.name ?? student?.studentName ?? 'Student').trim() || 'Student';
    const session = { id: sessionToken, sessionTokenHash: hashToken(sessionToken), studentId, tabletId: assignedTabletId, studentName, startedAt, returnedAt: null, durationMinutes: null, status: 'active' };
    const insertResponse = await supabaseRequest('app_data', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ collection: 'studentSessions', id: sessionToken, data: session }) });
    if (!insertResponse.ok) throw new Error(`Session insert returned ${insertResponse.status}`);
    const attendanceId = randomUUID();
    const attendanceRecord = { id: attendanceId, sessionId: sessionToken, studentId, studentName, tabletId: assignedTabletId, startedAt, returnedAt: null, durationMinutes: null, status: 'IN', date: startedAt.slice(0, 10) };
    const attendanceResponse = await supabaseRequest('app_data', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ collection: 'attendance', id: attendanceId, data: attendanceRecord }) });
    if (!attendanceResponse.ok) { const body = await attendanceResponse.text().catch(() => ''); console.error('Attendance check-in insert failed:', attendanceResponse.status, body); return res.status(500).json({ error: 'Student session started but attendance check-in could not be saved.' }); }
    const logId = randomUUID(); await supabaseRequest('app_data', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ collection: 'auditLogs', id: logId, data: { id: logId, action: 'STUDENT_CHECK_IN', studentId, tabletId: assignedTabletId, sessionId: sessionToken, timestamp: startedAt } }) });
    return res.json({ session: { sessionToken, studentId, studentName, tabletId: assignedTabletId, startedAt, student: { name: String(student?.name ?? ''), standard: String(student?.standard ?? ''), coachingType: String(student?.coachingType ?? ''), roomNumber: String(student?.roomNumber ?? ''), wingNumber: String(student?.wingNumber ?? ''), tabletId: assignedTabletId } } });
  } catch (error) { console.error('Student activation failed:', error); return res.status(500).json({ error: 'Student login could not be completed.' }); }
});

app.get('/api/student/session', async (req, res) => { if (!databaseConfigured()) return res.status(503).json({ error: 'Service unavailable' }); const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim(); if (!token || token.length > 100) return res.status(401).json({ error: 'Session required.' }); try { const response = await supabaseRequest(`app_data?collection=eq.studentSessions&id=eq.${encodeURIComponent(token)}&select=data&limit=1`); if (!response.ok) throw new Error(`Session lookup returned ${response.status}`); const rows = await response.json(); const session = rows[0]?.data; if (!session || session.status !== 'active' || session.sessionTokenHash !== hashToken(token)) return res.status(401).json({ error: 'Session is no longer active.' }); const student = await findStudentById(String(session.studentId)); if (!student || student.isActive === false) return res.status(401).json({ error: 'Student is no longer active.' }); return res.json({ session: { sessionToken: token, studentId: String(session.studentId), studentName: String(student.name ?? session.studentName ?? 'Student'), tabletId: String(session.tabletId), startedAt: String(session.startedAt), student: { name: String(student.name ?? ''), standard: String(student.standard ?? ''), coachingType: String(student.coachingType ?? ''), roomNumber: String(student.roomNumber ?? ''), wingNumber: String(student.wingNumber ?? ''), tabletId: String(student.assignedTabletId ?? session.tabletId) } } }); } catch (error) { console.error('Student session restore failed:', error); return res.status(500).json({ error: 'Could not restore session.' }); } });

app.post('/api/student/return', async (req, res) => { if (!databaseConfigured()) return res.status(503).json({ error: 'Service unavailable' }); const sessionToken = String(req.body?.sessionToken ?? '').trim(); if (!sessionToken || sessionToken.length > 100) return res.status(400).json({ error: 'Invalid session.' }); try { const response = await supabaseRequest(`app_data?collection=eq.studentSessions&id=eq.${encodeURIComponent(sessionToken)}&select=data&limit=1`); if (!response.ok) throw new Error(`Session lookup returned ${response.status}`); const rows = await response.json(); const session = rows[0]?.data; if (!session || session.status !== 'active' || session.sessionTokenHash !== hashToken(sessionToken)) return res.status(404).json({ error: 'Active session not found.' }); return res.status(403).json({ error: 'Direct checkout is disabled. Submit a checkout request and wait for Admin approval.' }); } catch (error) { console.error('Student return validation failed:', error); return res.status(500).json({ error: 'Could not process checkout.' }); } });

app.get('/api/admin/tablet-usage', requireAdminSession({ supabaseUrl, supabaseKey }), async (_req, res) => { if (!databaseConfigured()) return res.status(503).json({ error: 'Service unavailable' }); try { const sessions = await readCollectionServerSide('studentSessions'); const normalized = sessions.filter((item) => item && item.id && item.startedAt).map((item) => ({ id: String(item.id), studentId: String(item.studentId ?? ''), studentName: String(item.studentName ?? 'Student'), tabletId: String(item.tabletId ?? ''), startedAt: String(item.startedAt), returnedAt: item.returnedAt ? String(item.returnedAt) : null, durationMinutes: item.durationMinutes == null ? null : Number(item.durationMinutes), status: item.status === 'active' ? 'active' : 'returned' })).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()); return res.json({ sessions: normalized }); } catch (error) { console.error('Tablet usage read failed:', error); return res.status(500).json({ error: 'Could not load tablet usage.' }); } });

app.get('/api/db/:collection', requireAdminSession({ supabaseUrl, supabaseKey }), async (req, res) => { const { collection } = req.params; if (!COLLECTIONS.has(collection)) return res.status(400).json({ error: 'Invalid collection' }); if (!databaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured' }); try { return res.json(await readCollectionServerSide(collection)); } catch (error) { console.error(`Failed to read ${collection}:`, error); return res.status(500).json({ error: 'Failed to read data' }); } });
app.put('/api/db/:collection', requireAdminSession({ supabaseUrl, supabaseKey }), async (req, res) => { const { collection } = req.params; if (!COLLECTIONS.has(collection)) return res.status(400).json({ error: 'Invalid collection' }); if (!databaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured' }); const items = req.body; if (!Array.isArray(items)) return res.status(400).json({ error: 'Request body must be an array' }); try { for (const item of items) { const id = String(item?.id ?? '').trim(); if (!id) continue; const response = await supabaseRequest(`app_data?collection=eq.${encodeURIComponent(collection)}&id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ data: item, updated_at: new Date().toISOString() }) }); if (!response.ok) { const body = await response.text(); console.error(`Supabase ${collection} update failed:`, response.status, body); throw new Error(`Supabase returned ${response.status}`); } } return res.json({ ok: true }); } catch (error) { console.error(`Failed to update ${collection}:`, error); return res.status(500).json({ error: 'Failed to update data' }); } });

async function startServer() { const isProd = process.env.NODE_ENV === 'production'; const port = Number(process.env.PORT || 3000); if (!isProd) { const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' }); app.use(vite.middlewares); } else { app.use(express.static(path.join(currentDir, 'dist'))); app.get('*', (_req, res) => res.sendFile(path.join(currentDir, 'dist', 'index.html'))); } app.listen(port, '0.0.0.0', () => console.log(`Server listening on http://0.0.0.0:${port}`)); }
startServer().catch((error) => { console.error(error); process.exit(1); });