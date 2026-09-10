import express from 'express';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';

type Ctx = { supabaseUrl?: string; supabaseKey?: string };

const SUPER_ADMIN_USERNAME = 'superadmin';
const SUPER_ADMIN_EMAIL = 'meetdevani2003@gmail.com';
const OTP_EXPIRY_MS = 5 * 60_000;
const OTP_RESEND_COOLDOWN_MS = 45_000;
const OTP_REQUEST_WINDOW_MS = 10 * 60_000;
const MAX_OTP_REQUESTS = 3;
const MAX_OTP_ATTEMPTS = 5;
const SESSION_EXPIRY_MS = 8 * 60 * 60_000;

function configured(ctx: Ctx) { return Boolean(ctx.supabaseUrl && ctx.supabaseKey); }
function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function safeEqualHash(leftValue: unknown, rightValue: unknown) {
  const left = Buffer.from(String(leftValue ?? ''), 'hex');
  const right = Buffer.from(String(rightValue ?? ''), 'hex');
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}
async function db(ctx: Ctx, pathname: string, options: RequestInit = {}) {
  if (!configured(ctx)) throw new Error('Supabase is not configured');
  return fetch(`${ctx.supabaseUrl!.replace(/\/$/, '')}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: ctx.supabaseKey!,
      Authorization: `Bearer ${ctx.supabaseKey!}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}
async function rows(ctx: Ctx, collection: string) {
  const response = await db(ctx, `app_data?collection=eq.${encodeURIComponent(collection)}&select=data&order=updated_at.asc`);
  if (!response.ok) throw new Error(`Read ${collection} failed: ${response.status}`);
  return (await response.json()).map((row: any) => row.data);
}
async function insert(ctx: Ctx, collection: string, id: string, data: unknown) {
  const response = await db(ctx, 'app_data', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ collection, id, data })
  });
  if (!response.ok) throw new Error(`Insert ${collection} failed: ${response.status} ${await response.text()}`);
}
async function patch(ctx: Ctx, collection: string, id: string, data: unknown) {
  const response = await db(ctx, `app_data?collection=eq.${encodeURIComponent(collection)}&id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ data, updated_at: new Date().toISOString() })
  });
  if (!response.ok) throw new Error(`Update ${collection} failed: ${response.status} ${await response.text()}`);
}
function getSmtpTransporter() {
  const smtpUrl = String(process.env.SMTP_URL || '').trim();
  if (smtpUrl) return nodemailer.createTransport(smtpUrl);
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465,
    auth: { user, pass }
  });
}
function getEmailRecords(records: any[], email: string) {
  return records.filter((record) => String(record?.email || '').trim().toLowerCase() === email);
}
function otpEmailHtml(otp: string) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a"><h2 style="margin-bottom:8px">Tablet Management Admin Verification</h2><p>Your one-time verification code is:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;margin:20px 0">${otp}</div><p>This OTP expires in 5 minutes and can only be used once.</p><p>If you did not request this code, you can safely ignore this email.</p></div>`;
}

export function createAdminAuthRoutes(ctx: Ctx) {
  const router = express.Router();

  router.post('/request-otp', async (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (username !== SUPER_ADMIN_USERNAME) return res.status(403).json({ error: 'The user name is not authorized to access the Admin Dashboard.' });
    if (email !== SUPER_ADMIN_EMAIL) return res.status(403).json({ error: 'The email ID is not authorized to access the Admin Dashboard.' });
    if (!configured(ctx)) return res.status(503).json({ error: 'Admin authentication service is not configured.' });

    try {
      const records = await rows(ctx, 'adminOtps');
      const recent = getEmailRecords(records, email).filter((record) => {
        const createdAt = new Date(record?.createdAt || 0).getTime();
        return Number.isFinite(createdAt) && createdAt > Date.now() - OTP_REQUEST_WINDOW_MS;
      });
      if (recent.length >= MAX_OTP_REQUESTS) return res.status(429).json({ error: 'Too many OTP requests. Please try again later.' });

      const latest = recent.sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))[0];
      if (latest) {
        const latestCreatedAt = new Date(latest.createdAt).getTime();
        const remaining = OTP_RESEND_COOLDOWN_MS - (Date.now() - latestCreatedAt);
        if (remaining > 0) return res.status(429).json({ error: `Please wait ${Math.ceil(remaining / 1000)} seconds before requesting another OTP.` });
      }

      const transporter = getSmtpTransporter();
      if (!transporter) return res.status(503).json({ error: 'Email service is not configured. Set SMTP_URL or SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS on the server.' });

      const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const otpId = randomUUID();
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();

      await insert(ctx, 'adminOtps', otpId, {
        id: otpId,
        username: SUPER_ADMIN_USERNAME,
        email,
        otpHash: hash(otp),
        createdAt,
        expiresAt,
        attempts: 0,
        maxAttempts: MAX_OTP_ATTEMPTS,
        used: false
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || SUPER_ADMIN_EMAIL,
        to: SUPER_ADMIN_EMAIL,
        subject: 'Tablet Management Admin Login OTP',
        text: `Your Tablet Management Admin Login OTP is ${otp}. It expires in 5 minutes and can only be used once.`,
        html: otpEmailHtml(otp)
      });

      return res.json({ ok: true, message: 'OTP sent successfully.', expiresInSeconds: OTP_EXPIRY_MS / 1000, resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000 });
    } catch (error) {
      console.error('Admin OTP request failed:', error);
      return res.status(500).json({ error: 'Unable to send OTP. Please check the server email configuration.' });
    }
  });

  router.post('/verify-otp', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').replace(/\D/g, '');

    if (email !== SUPER_ADMIN_EMAIL || !/^\d{6}$/.test(otp)) return res.status(401).json({ error: 'Invalid or expired OTP.' });
    if (!configured(ctx)) return res.status(503).json({ error: 'Admin authentication service is not configured.' });

    try {
      const records = await rows(ctx, 'adminOtps');
      const record = getEmailRecords(records, email)
        .filter((item) => !item?.used)
        .sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))[0];

      if (!record) return res.status(401).json({ error: 'Invalid or expired OTP.' });
      const expiresAt = new Date(record.expiresAt || 0).getTime();
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return res.status(401).json({ error: 'Invalid or expired OTP.' });

      const attempts = Number(record.attempts || 0);
      if (attempts >= MAX_OTP_ATTEMPTS) {
        await patch(ctx, 'adminOtps', String(record.id), { ...record, used: true, invalidatedAt: new Date().toISOString() });
        return res.status(401).json({ error: 'Invalid or expired OTP.' });
      }

      if (!safeEqualHash(record.otpHash, hash(otp))) {
        const nextAttempts = attempts + 1;
        await patch(ctx, 'adminOtps', String(record.id), {
          ...record,
          attempts: nextAttempts,
          used: nextAttempts >= MAX_OTP_ATTEMPTS,
          invalidatedAt: nextAttempts >= MAX_OTP_ATTEMPTS ? new Date().toISOString() : record.invalidatedAt
        });
        return res.status(401).json({ error: 'Invalid or expired OTP.' });
      }

      await patch(ctx, 'adminOtps', String(record.id), { ...record, used: true, verifiedAt: new Date().toISOString() });

      const sessionToken = randomUUID();
      const sessionTokenHash = hash(sessionToken);
      const sessionExpiresAt = new Date(Date.now() + SESSION_EXPIRY_MS).toISOString();
      await insert(ctx, 'adminSessions', sessionTokenHash, {
        id: sessionTokenHash,
        tokenHash: sessionTokenHash,
        username: SUPER_ADMIN_USERNAME,
        email: SUPER_ADMIN_EMAIL,
        expiresAt: sessionExpiresAt,
        createdAt: new Date().toISOString()
      });

      return res.json({
        ok: true,
        sessionToken,
        user: {
          id: 'super-admin',
          fullName: 'Super Admin',
          username: SUPER_ADMIN_USERNAME,
          email: SUPER_ADMIN_EMAIL,
          role: 'SuperAdmin',
          status: 'Active'
        }
      });
    } catch (error) {
      console.error('Admin OTP verification failed:', error);
      return res.status(500).json({ error: 'OTP verification failed.' });
    }
  });

  return router;
}
