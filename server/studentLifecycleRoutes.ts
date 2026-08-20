import express from 'express';
import { randomUUID, createHash } from 'node:crypto';

type Ctx = { supabaseUrl?: string; supabaseKey?: string };
function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
async function db(ctx: Ctx, pathname: string, options: RequestInit = {}) {
  if (!ctx.supabaseUrl || !ctx.supabaseKey) throw new Error('Supabase is not configured');
  return fetch(`${ctx.supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`, { ...options, headers: { apikey: ctx.supabaseKey, Authorization: `Bearer ${ctx.supabaseKey}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
}
async function rows(ctx: Ctx, collection: string) { const r = await db(ctx, `app_data?collection=eq.${encodeURIComponent(collection)}&select=data&order=updated_at.asc`); if (!r.ok) throw new Error(`Read ${collection} failed: ${r.status}`); return (await r.json()).map((x: any) => x.data); }
async function insert(ctx: Ctx, collection: string, id: string, data: any) { const r = await db(ctx, 'app_data', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ collection, id, data }) }); if (!r.ok) throw new Error(`Insert ${collection} failed: ${r.status} ${await r.text()}`); }
export function createStudentLifecycleRoutes(ctx: Ctx) {
  const router = express.Router();
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
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim(); if (!token) return res.status(401).json({ error: 'Student session required.' });
    try { const sessions = await rows(ctx, 'studentSessions'); const session = sessions.find((x: any) => x?.sessionTokenHash === hash(token)); if (!session) return res.status(401).json({ error: 'Invalid student session.' }); const logs = await rows(ctx, 'auditLogs'); return res.json({ activities: logs.filter((x: any) => String(x?.studentId) === String(session.studentId)).sort((a: any,b: any) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0,100) }); } catch { return res.status(500).json({ error: 'Could not load activity.' }); }
  });
  return router;
}
