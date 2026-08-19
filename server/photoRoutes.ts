import { Router } from 'express';
import { randomUUID } from 'node:crypto';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BUCKETS = { student: 'student-photos', tablet: 'tablet-photos' } as const;
type PhotoKind = keyof typeof BUCKETS;
type PhotoConfig = { supabaseUrl?: string; supabaseKey?: string };

const isAdminRole = (role: string | undefined) => role === 'Admin' || role === 'Super Admin';
const getBucket = (kind: unknown): PhotoKind | null => kind === 'student' || kind === 'tablet' ? kind : null;
function extension(type: string) { return type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : 'webp'; }
function decode(dataUrl: string) { const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl); if (!match) throw new Error('Invalid image data.'); const buffer = Buffer.from(match[2], 'base64'); if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw new Error('Image must be 5 MB or less.'); return { type: match[1], buffer }; }
async function storage(url: string, key: string, pathname: string, options: RequestInit = {}) { return fetch(`${url}/storage/v1/${pathname}`, { ...options, headers: { Authorization: `Bearer ${key}`, apikey: key, ...(options.headers || {}) } }); }

// Student App PINs are 4 digits. Keep legacy 6-digit PINs readable so existing records are not broken.
function normalizePin(value: unknown) {
  const raw = String(value ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 4) return `PIN-${digits}`;
  if (digits.length === 6) return `PIN-${digits}`;
  return null;
}
function nextTabletId(used: Set<string>) { for (let n = 1; n <= 9999; n += 1) { const id = `TAB-${String(n).padStart(3, '0')}`; if (!used.has(id)) return id; } return `TAB-${randomUUID().slice(0, 8).toUpperCase()}`; }
function nextPin(used: Set<string>) { for (let attempt = 0; attempt < 10000; attempt += 1) { const pin = `PIN-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`; if (!used.has(pin)) return pin; } return `PIN-${String(Date.now()).slice(-4)}`; }

export function createPhotoRouter(config: PhotoConfig) {
  const router = Router(); const url = config.supabaseUrl?.replace(/\/$/, ''); const key = config.supabaseKey; const ready = () => Boolean(url && key);
  async function db(pathname: string, options: RequestInit = {}) { return fetch(`${url}/rest/v1/${pathname}`, { ...options, headers: { apikey: key!, Authorization: `Bearer ${key!}`, 'Content-Type': 'application/json', ...(options.headers || {}) } }); }

  router.post('/upload', async (req, res) => { if (!isAdminRole(String(req.headers['x-admin-role'] || ''))) return res.status(403).json({ error: 'Admin access required.' }); if (!ready()) return res.status(503).json({ error: 'Photo storage is not configured.' }); try { const kind = getBucket(req.body?.kind); const itemId = String(req.body?.itemId || '').trim(); const contentType = String(req.body?.contentType || ''); if (!kind || !itemId || !ALLOWED_TYPES.has(contentType)) return res.status(400).json({ error: 'Valid photo type and item are required.' }); const decoded = decode(String(req.body?.dataUrl || '')); const path = `${itemId}/${randomUUID()}.${extension(decoded.type)}`; const uploaded = await storage(url!, key!, `object/${BUCKETS[kind]}/${path}`, { method: 'POST', headers: { 'Content-Type': decoded.type, 'x-upsert': 'false' }, body: decoded.buffer }); if (!uploaded.ok) return res.status(502).json({ error: 'Photo storage upload failed.' }); const signed = await storage(url!, key!, `object/sign/${BUCKETS[kind]}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }) }); if (!signed.ok) return res.status(502).json({ error: 'Photo uploaded but preview URL failed.' }); const data = await signed.json(); return res.json({ path, url: data.signedURL || data.signedUrl }); } catch (error) { console.error('Photo upload failed:', error); return res.status(400).json({ error: error instanceof Error ? error.message : 'Photo upload failed.' }); } });
  router.get('/signed-url', async (req, res) => { if (!isAdminRole(String(req.headers['x-admin-role'] || ''))) return res.status(403).json({ error: 'Admin access required.' }); if (!ready()) return res.status(503).json({ error: 'Photo storage is not configured.' }); try { const kind = getBucket(req.query.kind); const path = String(req.query.path || '').trim(); if (!kind || !path || path.includes('..') || path.startsWith('/')) return res.status(400).json({ error: 'Invalid photo path.' }); const response = await storage(url!, key!, `object/sign/${BUCKETS[kind]}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }) }); if (!response.ok) return res.status(404).json({ error: 'Photo not found.' }); const data = await response.json(); return res.json({ url: data.signedURL || data.signedUrl }); } catch { return res.status(500).json({ error: 'Could not create photo URL.' }); } });
  router.post('/delete', async (req, res) => { if (!isAdminRole(String(req.headers['x-admin-role'] || ''))) return res.status(403).json({ error: 'Admin access required.' }); if (!ready()) return res.status(503).json({ error: 'Photo storage is not configured.' }); try { const kind = getBucket(req.body?.kind); const path = String(req.body?.path || '').trim(); if (!kind || !path || path.includes('..') || path.startsWith('/')) return res.status(400).json({ error: 'Invalid photo path.' }); const response = await storage(url!, key!, `object/${BUCKETS[kind]}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }) }); if (!response.ok) return res.status(502).json({ error: 'Photo deletion failed.' }); return res.json({ ok: true }); } catch { return res.status(500).json({ error: 'Photo deletion failed.' }); } });

  router.post('/student/credentials', async (req, res) => {
    if (!isAdminRole(String(req.headers['x-admin-role'] || ''))) return res.status(403).json({ error: 'Admin access required.' });
    if (!ready()) return res.status(503).json({ error: 'Database is not configured.' });
    try {
      const response = await db('app_data?collection=eq.students&select=id,data&order=updated_at.asc');
      if (!response.ok) throw new Error(`Student lookup returned ${response.status}`);
      const rows = await response.json();
      const students = rows.map((row: any) => ({ id: String(row.id), data: row.data || {} }));
      const usedPins = new Set<string>(students.map((s: any) => String(s.data.pinNumber || '').toUpperCase()).filter(Boolean));
      const usedTabletIds = new Set<string>(students.map((s: any) => String(s.data.assignedTabletId || s.data.assignedTabletNumber || '').toUpperCase()).filter(Boolean));
      const normalized: any[] = [];
      for (const row of students) {
        const data = { ...row.data };
        const existingPin = normalizePin(data.pinNumber);
        const pin = existingPin || nextPin(usedPins);
        usedPins.add(pin);
        data.pinNumber = pin;
        let tabletId = String(data.assignedTabletId || data.assignedTabletNumber || '').trim().toUpperCase();
        if (!tabletId || !/^TAB-\d{3,}$/.test(tabletId)) tabletId = nextTabletId(usedTabletIds);
        usedTabletIds.add(tabletId);
        data.assignedTabletId = tabletId;
        data.assignedTabletNumber = tabletId;
        normalized.push({ id: row.id, data });
      }
      for (const row of normalized) {
        const update = await db(`app_data?collection=eq.students&id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ data: row.data }) });
        if (!update.ok) throw new Error(`Credential update returned ${update.status}`);
      }
      return res.json({ students: normalized.map((row) => row.data) });
    } catch (error) { console.error('Student credential provisioning failed:', error); return res.status(500).json({ error: 'Could not provision student credentials.' }); }
  });

  router.post('/student/activate', async (req, res) => {
    if (!ready()) return res.status(503).json({ error: 'Service unavailable.' });
    const inputPin = String(req.body?.pin || '').trim(); const pin = normalizePin(inputPin);
    if (!pin) return res.status(400).json({ error: 'Enter your 4-digit PIN.' });
    try {
      const response = await db('app_data?collection=eq.students&select=id,data&order=updated_at.asc'); if (!response.ok) throw new Error(`Student lookup returned ${response.status}`); const rows = await response.json();
      const row = rows.find((item: any) => String(item.data?.pinNumber || '').toUpperCase() === pin.toUpperCase()); if (!row) return res.status(401).json({ error: 'Invalid PIN.' });
      const student = row.data || {}; if (String(student.status || 'Active') !== 'Active') return res.status(403).json({ error: 'This student account is inactive.' });
      const tabletId = String(student.assignedTabletId || student.assignedTabletNumber || '').trim(); if (!tabletId) return res.status(409).json({ error: 'No tablet has been generated for this student.' });
      const sessionsResponse = await db('app_data?collection=eq.studentSessions&select=data'); if (!sessionsResponse.ok) throw new Error(`Session lookup returned ${sessionsResponse.status}`); const sessions = await sessionsResponse.json();
      if (sessions.some((item: any) => item.data?.status === 'active' && (String(item.data?.studentId) === String(row.id) || String(item.data?.tabletId) === tabletId))) return res.status(409).json({ error: 'You already have an active tablet session.' });
      const sessionToken = randomUUID(); const startedAt = new Date().toISOString(); const session = { id: sessionToken, sessionToken, studentId: String(row.id), studentName: String(student.name || 'Student'), tabletId, startedAt, returnedAt: null, durationMinutes: null, status: 'active' };
      const insert = await db('app_data', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ collection: 'studentSessions', id: sessionToken, data: session }) }); if (!insert.ok) throw new Error(`Session insert returned ${insert.status}`);
      return res.json({ session: { sessionToken, studentName: session.studentName, tabletId, startedAt } });
    } catch (error) { console.error('Student activation failed:', error); return res.status(500).json({ error: 'Activation could not be completed.' }); }
  });

  router.post('/student/return', async (req, res) => {
    if (!ready()) return res.status(503).json({ error: 'Service unavailable.' }); const sessionToken = String(req.body?.sessionToken || '').trim(); if (!sessionToken) return res.status(400).json({ error: 'Invalid session.' });
    try { const response = await db(`app_data?collection=eq.studentSessions&id=eq.${encodeURIComponent(sessionToken)}&select=data&limit=1`); if (!response.ok) throw new Error(`Session lookup returned ${response.status}`); const rows = await response.json(); const session = rows[0]?.data; if (!session || session.status !== 'active') return res.status(404).json({ error: 'Active session not found.' }); const returnedAt = new Date().toISOString(); const durationMinutes = Math.max(0, Math.round((new Date(returnedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)); const update = await db(`app_data?collection=eq.studentSessions&id=eq.${encodeURIComponent(sessionToken)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ data: { ...session, returnedAt, durationMinutes, status: 'returned' } }) }); if (!update.ok) throw new Error(`Session update returned ${update.status}`); return res.json({ ok: true, durationMinutes }); } catch (error) { console.error('Student return failed:', error); return res.status(500).json({ error: 'Tablet return could not be completed.' }); }
  });

  return router;
}