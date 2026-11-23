// Server-only: signed download tokens, per-IP rate limits and a global job cap.
import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Tokens are signed with TOKEN_SECRET (set it in production so tokens survive restarts / multiple instances).
const SECRET = process.env.TOKEN_SECRET || randomBytes(32).toString('hex');
const TTL_MS = 30 * 60 * 1000;

export type TokenData = { u: string; f: string; n: string; x: string; e: number };

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sign = (s: string) => createHmac('sha256', SECRET).update(s).digest('base64url');

export function makeToken(d: Omit<TokenData, 'e'>): string {
  const body = b64(JSON.stringify({ ...d, e: Date.now() + TTL_MS }));
  return `${body}.${sign(body)}`;
}

export function readToken(t: unknown): TokenData | null {
  if (typeof t !== 'string' || t.length > 4096) return null;
  const [body, sig] = t.split('.');
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const d = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenData;
    return d.e > Date.now() ? d : null;
  } catch { return null; }
}

// --- rate limits (in memory: one server instance; use a shared store if you scale out) ---
const hits: Map<string, number[]> = ((globalThis as typeof globalThis & { __utdHits?: Map<string, number[]> }).__utdHits ??= new Map());
export function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) { hits.set(key, list); return true; }
  list.push(now); hits.set(key, list);
  return false;
}
// Forget IPs as soon as they're out of every window (the privacy page promises ≤ 10 minutes).
const WINDOW_MAX = 10 * 60 * 1000;
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MAX)) hits.delete(k);
}, 60 * 1000);
sweep.unref?.();

export function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for');
  return (xf ? xf.split(',')[0] : req.headers.get('x-real-ip') || 'local').trim().slice(0, 64);
}

// --- global cap on simultaneous downloads (each one is a yt-dlp process + bandwidth) ---
const MAX_JOBS = Number(process.env.MAX_JOBS || 4);
const slots = ((globalThis as typeof globalThis & { __utdSlots?: { n: number } }).__utdSlots ??= { n: 0 }); // shared across route bundles
export function takeSlot(): boolean { if (slots.n >= MAX_JOBS) return false; slots.n++; return true; }
export function freeSlot() { slots.n = Math.max(0, slots.n - 1); }

/** A filename safe for Content-Disposition on every OS. */
export function safeName(title: string, ext: string): string {
  const base = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'video';
  return `${base}.${ext.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'mp4'}`;
}
