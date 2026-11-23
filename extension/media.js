// Client for the local media server (helper/media-server.mjs, runs yt-dlp).
import { getSettings } from './rpc.js';

export async function media(path, body, settings, timeoutMs = 5000) {
  const s = settings || (await getSettings());
  const res = await fetch(s.mediaUrl.replace(/\/$/, '') + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Turbo-Secret': s.secret },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'media server error ' + res.status);
  return json;
}

// YouTube can flag accounts whose cookies are used by downloaders, so we don't send those.
const NO_COOKIES = /(^|\.)(youtube\.com|youtu\.be|google\.com|googlevideo\.com)$/i;

// Cookies the browser would send to `url`, in the Netscape cookies.txt format yt-dlp reads.
export async function cookiesTxt(url) {
  let host;
  try { host = new URL(url).hostname; } catch { return ''; }
  if (NO_COOKIES.test(host)) return '';
  const list = await chrome.cookies.getAll({ url });
  if (!list.length) return '';
  const lines = ['# Netscape HTTP Cookie File'];
  for (const c of list) {
    const domain = c.hostOnly ? c.domain : c.domain.startsWith('.') ? c.domain : '.' + c.domain;
    lines.push([
      (c.httpOnly ? '#HttpOnly_' : '') + domain,
      c.hostOnly ? 'FALSE' : 'TRUE',
      c.path, c.secure ? 'TRUE' : 'FALSE',
      c.session ? '0' : String(Math.floor(c.expirationDate || 0)),
      c.name, c.value,
    ].join('\t'));
  }
  return lines.join('\n') + '\n';
}

export const QUALITIES = [
  ['best', 'Best quality'],
  ['2160', '4K (2160p)'],
  ['1080', '1080p'],
  ['720', '720p'],
  ['480', '480p'],
  ['audio', 'Audio only (MP3)'],
];
