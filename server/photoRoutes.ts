import { Router } from 'express';
import { randomUUID } from 'node:crypto';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BUCKETS = { student: 'student-photos', tablet: 'tablet-photos' } as const;
type PhotoKind = keyof typeof BUCKETS;
type PhotoConfig = { supabaseUrl?: string; supabaseKey?: string };

function isAllowedRole(role: string | undefined) { return role === 'Admin' || role === 'Super Admin'; }
function safeExtension(contentType: string) { if (contentType === 'image/jpeg') return 'jpg'; if (contentType === 'image/png') return 'png'; return 'webp'; }
function getBucket(kind: unknown): PhotoKind | null { return kind === 'student' || kind === 'tablet' ? kind : null; }
function decodeDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error('Invalid image data.');
  if (!ALLOWED_TYPES.has(match[1])) throw new Error('Unsupported image type.');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw new Error('Image must be between 1 byte and 5 MB.');
  return { contentType: match[1], buffer };
}
async function storageRequest(url: string, key: string, pathname: string, options: RequestInit = {}) {
  return fetch(`${url}/storage/v1/${pathname}`, { ...options, headers: { Authorization: `Bearer ${key}`, apikey: key, ...(options.headers || {}) } });
}

export function createPhotoRouter(config: PhotoConfig) {
  const router = Router();
  const supabaseUrl = config.supabaseUrl?.replace(/\/$/, '');
  const supabaseKey = config.supabaseKey;
  const configured = () => Boolean(supabaseUrl && supabaseKey);

  router.post('/upload', async (req, res) => {
    if (!isAllowedRole(String(req.headers['x-admin-role'] || ''))) return res.status(403).json({ error: 'Admin access required.' });
    if (!configured()) return res.status(503).json({ error: 'Photo storage is not configured.' });
    try {
      const kind = getBucket(req.body?.kind); const itemId = String(req.body?.itemId || '').trim(); const contentType = String(req.body?.contentType || ''); const dataUrl = String(req.body?.dataUrl || '');
      if (!kind || !itemId || !dataUrl) return res.status(400).json({ error: 'Photo type and item are required.' });
      if (!ALLOWED_TYPES.has(contentType)) return res.status(400).json({ error: 'Only JPG, PNG and WebP images are allowed.' });
      const decoded = decodeDataUrl(dataUrl); const path = `${itemId}/${randomUUID()}.${safeExtension(decoded.contentType)}`;
      const response = await storageRequest(supabaseUrl!, supabaseKey!, `object/${BUCKETS[kind]}/${path}`, { method: 'POST', headers: { 'Content-Type': decoded.contentType, 'x-upsert': 'false' }, body: decoded.buffer });
      if (!response.ok) { console.error('Supabase photo upload failed:', response.status, await response.text()); return res.status(502).json({ error: 'Photo storage upload failed.' }); }
      const signed = await storageRequest(supabaseUrl!, supabaseKey!, `object/sign/${BUCKETS[kind]}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }) });
      if (!signed.ok) return res.status(502).json({ error: 'Photo uploaded, but preview URL could not be created.' });
      const signedData = await signed.json();
      return res.json({ path, url: signedData.signedURL || signedData.signedUrl });
    } catch (error) { console.error('Photo upload failed:', error); return res.status(400).json({ error: error instanceof Error ? error.message : 'Photo upload failed.' }); }
  });

  router.get('/signed-url', async (req, res) => {
    if (!isAllowedRole(String(req.headers['x-admin-role'] || ''))) return res.status(403).json({ error: 'Admin access required.' });
    if (!configured()) return res.status(503).json({ error: 'Photo storage is not configured.' });
    try {
      const kind = getBucket(req.query.kind); const photoPath = String(req.query.path || '').trim();
      if (!kind || !photoPath || photoPath.includes('..') || photoPath.startsWith('/')) return res.status(400).json({ error: 'Invalid photo path.' });
      const response = await storageRequest(supabaseUrl!, supabaseKey!, `object/sign/${BUCKETS[kind]}/${photoPath}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }) });
      if (!response.ok) return res.status(404).json({ error: 'Photo not found.' });
      const data = await response.json(); return res.json({ url: data.signedURL || data.signedUrl });
    } catch (error) { console.error('Photo signed URL failed:', error); return res.status(500).json({ error: 'Could not create photo URL.' }); }
  });

  router.post('/delete', async (req, res) => {
    if (!isAllowedRole(String(req.headers['x-admin-role'] || ''))) return res.status(403).json({ error: 'Admin access required.' });
    if (!configured()) return res.status(503).json({ error: 'Photo storage is not configured.' });
    try {
      const kind = getBucket(req.body?.kind); const photoPath = String(req.body?.path || '').trim();
      if (!kind || !photoPath || photoPath.includes('..') || photoPath.startsWith('/')) return res.status(400).json({ error: 'Invalid photo path.' });
      const response = await storageRequest(supabaseUrl!, supabaseKey!, `object/${BUCKETS[kind]}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [photoPath] }) });
      if (!response.ok) return res.status(502).json({ error: 'Photo deletion failed.' });
      return res.json({ ok: true });
    } catch (error) { console.error('Photo deletion failed:', error); return res.status(500).json({ error: 'Photo deletion failed.' }); }
  });
  return router;
}
