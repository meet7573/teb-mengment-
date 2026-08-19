import express from 'express';
import path from 'path';
import { randomUUID, createHash } from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import { createPhotoRouter } from './server/photoRoutes';

const currentDir = process.cwd();
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));

const COLLECTIONS = new Set(['students', 'tablets', 'boxes', 'assignments', 'attendance', 'auditLogs', 'studentSessions']);
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
function databaseConfigured() { return Boolean(supabaseUrl && supabaseKey); }
async function supabaseRequest(pathname: string, options: RequestInit = {}) {
  if (!databaseConfigured()) throw new Error('Supabase is not configured');
  return fetch(`${supabaseUrl}/rest/v1/${pathname}`, { ...options, headers: { apikey: supabaseKey!, Authorization: `Bearer ${supabaseKey!}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
}
app.use('/api/photos', createPhotoRouter({ supabaseUrl, supabaseKey }));
function normalizeTabletId(value: unknown) { return String(value ?? '').trim().toUpperCase(); }
function normalizePin(value: unknown) { return String(value ?? '').trim().replace(/^PIN[-\s:]*/i, '').replace(/\D/g, '').trim(); }
function isValidPin(pin: string) { return /^\d{4}$/.test(pin); }
function pinHash(pin: string) { return createHash('sha256').update(normalizePin(pin)).digest('hex'); }
function valueMatches(value: unknown, target: string) { return String(value ?? '').trim().toLowerCase() === target.trim().toLowerCase(); }
function containsPin(value: unknown, target: string, depth = 0): boolean {
  if (depth > 6 || value == null) return false;
  if (Array.isArray(value)) return value.some((item) => containsPin(item, target, depth + 1));
  if (typeof value !== 'object') return false;
  const targetHash = pinHash(target);
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['pin', 'pinno', 'pinnumber', 'studentpin'].includes(normalizedKey) && normalizePin(child) === normalizePin(target)) return true;
    if (normalizedKey === 'pinhash' && String(child ?? '') === targetHash) return true;
    if (typeof child === 'object' && containsPin(child, target, depth + 1)) return true;
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

// Student registration never accepts or creates a tablet assignment. Tablet assignment is Admin-only.
app.post('/api/student/register', async (req, res) => {
  if (!databaseConfigured()) return res.status(503).json({ error: 'Service unavailable' });
  const name = String(req.body?.name ?? '').trim();
  const pin = normalizePin(req.body?.pin);
  const standard = String(req.body?.standard ?? '').trim();
  const coachingType = String(req.body?.coachingType ?? '').trim();
  const roomNumber = String(req.body?.roomNumber ?? '').trim();
  const wingNumber = String(req.body?.wingNumber ?? '').trim();
  if (!name || !isValidPin(pin) || !standard || !roomNumber || !wingNumber) return res.status(400).json({ error: 'Name, a unique 4-digit PIN, standard, coaching type, room and wing are required.' });
  if (!['Coaching', 'Non-Coaching'].includes(coachingType)) return res.status(400).json({ error: 'Coaching type must be Coaching or Non-Coaching.' });
  try {
    const students = await readCollectionServerSide('students');
    if (students.some((item) => containsPin(item, pin))) return res.status(409).json({ error: 'This PIN is already registered. Please choose another 4-digit PIN.' });
    const studentId = randomUUID();
    const student = { id: studentId, name, pinHash: pinHash(pin), standard, coachingType, roomNumber, wingNumber, assignedTabletId: null, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const response = await supabaseRequest('app_data', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ collection: 'students', id: studentId, data: student }) });
    if (!response.ok) { const body = await response.text(); console.error('Student registration insert failed:', response.status, body); throw new Error(`Student insert returned ${response.status}`); }
    return res.status(201).json({ student: { id: studentId, name, standard, coachingType, roomNumber, wingNumber, tabletId: null } });
  } catch (error) { console.error('Student registration failed:', error); return res.status(500).json({ error: 'Student registration could not be completed.' }); }
});

// Student logs in only with PIN. The tablet comes exclusively from Admin assignment.
app.post('/api/student/activate', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!activationAllowed(ip)) return res.status(429).json({ error: 'Too many login attempts. Try again in a minute.' });
  if (!databaseConfigured()) return res.status(503).json({ error: 'Service unavailable' });
  const pin = normalizePin(req.body?.pin);
  if (!isValidPin(pin)) return res.status(400).json({ error: 'Student PIN must be exactly 4 digits.' });
  try {
    const [students, sessions] = await Promise.all([readCollectionServerSide('students'), readCollectionServerSide('studentSessions')]);
    const student = students.find((item) => containsPin(item, pin));
    if (!student || student?.isActive === false) return res.status(401).json({ error: 'Student PIN is incorrect or inactive.' });
    const assignedTabletId = normalizeTabletId(student?.assignedTabletId ?? student?.assignedTabletNumber ?? student?.tabletId ?? '');
    if (!assignedTabletId) return res.status(409).json({ error: 'No tablet has been assigned to this student. Please contact Admin.' });
    const studentId = String(student?.id ?? student?.studentId ?? student?.studentID ?? '').trim();
    if (!studentId) return res.status(500).json({ error: 'Student record is missing an ID.' });
    const activeForStudent = sessions.some((item) => item?.status === 'active' && valueMatches(item?.studentId, studentId));
    const activeForTablet = sessions.some((item) => item?.status === 'active' && normalizeTabletId(item?.tabletId) === assignedTabletId);
    if (activeForStudent || activeForTablet) return res.status(409).json({ error: 'This student or assigned tablet already has an active session.' });
    const sessionToken = randomUUID();
    const startedAt = new Date().toISOString();
    const session = { id: sessionToken, sessionTokenHash: hashToken(sessionToken), studentId, tabletId: assignedTabletId, studentName: String(student?.name ?? student?.studentName ?? 'Student').trim() || 'Student', startedAt, returnedAt: null, durationMinutes: null, status: 'active' };
    const insertResponse = await supabaseRequest('app_data', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ collection: 'studentSessions', id: sessionToken, data: session }) });
    if (!insertResponse.ok) { const errorBody = await insertResponse.text(); console.error('Session insert failed:', insertResponse.status, errorBody); throw new Error(`Session insert returned ${insertResponse.status}`); }
    return res.json({ session: { sessionToken, studentId, studentName: session.studentName, tabletId: assignedTabletId, startedAt, student: { name: String(student?.name ?? ''), standard: String(student?.standard ?? ''), coachingType: String(student?.coachingType ?? ''), roomNumber: String(student?.roomNumber ?? ''), wingNumber: String(student?.wingNumber ?? ''), tabletId: assignedTabletId } } });
  } catch (error) { console.error('Student activation failed:', error); return res.status(500).json({ error: 'Student login could not be completed.' }); }
});

app.get('/api/student/session', async (req, res) => {
  if (!databaseConfigured()) return res.status(503).json({ error: 'Service unavailable' });
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token.length > 100) return res.status(401).json({ error: 'Session required.' });
  try {
    const response = await supabaseRequest(`app_data?collection=eq.studentSessions&id=eq.${encodeURIComponent(token)}&select=data&limit=1`);
    if (!response.ok) throw new Error(`Session lookup returned ${response.status}`);
    const rows = await response.json(); const session = rows[0]?.data;
    if (!session || session.status !== 'active' || session.sessionTokenHash !== hashToken(token)) return res.status(401).json({ error: 'Session is no longer active.' });
    const student = await findStudentById(String(session.studentId));
    if (!student || student.isActive === false) return res.status(401).json({ error: 'Student is no longer active.' });
    return res.json({ session: { sessionToken: token, studentId: String(session.studentId), studentName: String(student.name ?? session.studentName ?? 'Student'), tabletId: String(session.tabletId), startedAt: String(session.startedAt), student: { name: String(student.name ?? ''), standard: String(student.standard ?? ''), coachingType: String(student.coachingType ?? ''), roomNumber: String(student.roomNumber ?? ''), wingNumber: String(student.wingNumber ?? ''), tabletId: String(student.assignedTabletId ?? session.tabletId) } } });
  } catch (error) { console.error('Student session restore failed:', error); return res.status(500).json({ error: 'Could not restore session.' }); }
});

app.post('/api/student/return', async (req, res) => {
  if (!databaseConfigured()) return res.status(503).json({ error: 'Service unavailable' });
  const sessionToken = String(req.body?.sessionToken ?? '').trim();
  if (!sessionToken || sessionToken.length > 100) return res.status(400).json({ error: 'Invalid session.' });
  try {
    const response = await supabaseRequest(`app_data?collection=eq.studentSessions&id=eq.${encodeURIComponent(sessionToken)}&select=data&limit=1`);
    if (!response.ok) throw new Error(`Session lookup returned ${response.status}`);
    const rows = await response.json(); const session = rows[0]?.data;
    if (!session || session.status !== 'active' || session.sessionTokenHash !== hashToken(sessionToken)) return res.status(404).json({ error: 'Active session not found.' });
    const returnedAt = new Date().toISOString();
    const durationMinutes = Math.max(0, Math.round((new Date(returnedAt).getTime() - new Date(session.startedAt).getTime()) / 60000));
    const updatedSession = { ...session, returnedAt, durationMinutes, status: 'returned' };
    const updateResponse = await supabaseRequest(`app_data?collection=eq.studentSessions&id=eq.${encodeURIComponent(sessionToken)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ data: updatedSession }) });
    if (!updateResponse.ok) throw new Error(`Session update returned ${updateResponse.status}`);
    const attendanceId = randomUUID();
    const attendance = { id: attendanceId, sessionId: session.id, studentId: session.studentId, studentName: session.studentName, tabletId: session.tabletId, startedAt: session.startedAt, returnedAt, durationMinutes, status: 'OUT', date: returnedAt.slice(0, 10) };
    const attendanceResponse = await supabaseRequest('app_data', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ collection: 'attendance', id: attendanceId, data: attendance }) });
    if (!attendanceResponse.ok) { const body = await attendanceResponse.text(); console.error('Attendance insert failed:', attendanceResponse.status, body); throw new Error(`Attendance insert returned ${attendanceResponse.status}`); }
    return res.json({ ok: true, durationMinutes, returnedAt });
  } catch (error) { console.error('Student return failed:', error); return res.status(500).json({ error: 'Tablet return could not be completed.' }); }
});

app.get('/api/admin/tablet-usage', async (_req, res) => {
  if (!databaseConfigured()) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const sessions = await readCollectionServerSide('studentSessions');
    const normalized = sessions.filter((item) => item && item.id && item.startedAt).map((item) => ({ id: String(item.id), studentId: String(item.studentId ?? ''), studentName: String(item.studentName ?? 'Student'), tabletId: String(item.tabletId ?? ''), startedAt: String(item.startedAt), returnedAt: item.returnedAt ? String(item.returnedAt) : null, durationMinutes: item.durationMinutes == null ? null : Number(item.durationMinutes), status: item.status === 'active' ? 'active' : 'returned' })).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return res.json({ sessions: normalized });
  } catch (error) { console.error('Tablet usage read failed:', error); return res.status(500).json({ error: 'Could not load tablet usage.' }); }
});

app.get('/api/db/:collection', async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS.has(collection)) return res.status(400).json({ error: 'Invalid collection' });
  if (!databaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured' });
  try { return res.json(await readCollectionServerSide(collection)); }
  catch (error) { console.error(`Failed to read ${collection}:`, error); return res.status(500).json({ error: 'Failed to read data' }); }
});
app.put('/api/db/:collection', async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS.has(collection)) return res.status(400).json({ error: 'Invalid collection' });
  if (!databaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured' });
  const items = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Request body must be an array' });
  if (items.some((item) => !item || typeof item.id !== 'string')) return res.status(400).json({ error: 'Every item must contain a string id' });
  try {
    const deleteResponse = await supabaseRequest(`app_data?collection=eq.${encodeURIComponent(collection)}`, { method: 'DELETE' });
    if (!deleteResponse.ok) throw new Error(`Delete returned ${deleteResponse.status}`);
    if (items.length > 0) { const rows = items.map((item) => ({ collection, id: item.id, data: item })); const insertResponse = await supabaseRequest('app_data', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) }); if (!insertResponse.ok) throw new Error(`Insert returned ${insertResponse.status}`); }
    return res.json({ ok: true, count: items.length });
  } catch (error) { console.error(`Failed to save ${collection}:`, error); return res.status(500).json({ error: 'Failed to save data' }); }
});
app.delete('/api/db', async (_req, res) => {
  if (!databaseConfigured()) return res.status(503).json({ error: 'Service unavailable' });
  try { const response = await supabaseRequest('app_data?id=not.is.null', { method: 'DELETE' }); if (!response.ok) throw new Error(`Supabase returned ${response.status}`); return res.json({ ok: true }); }
  catch (error) { console.error('Failed to reset database:', error); return res.status(500).json({ error: 'Failed to reset data' }); }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') { const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' }); app.use(vite.middlewares); }
  else { const distPath = path.join(currentDir, 'dist'); app.use(express.static(distPath)); app.get('*all', (_req, res) => res.sendFile(path.join(distPath, 'index.html'))); }
  const PORT = Number(process.env.PORT) || 3000; app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}
startServer().catch((error) => { console.error('Failed to start server:', error); process.exit(1); });
