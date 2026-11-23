// Server-only: runs yt-dlp for the website.
// Safety: only yt-dlp's site extractors (never the "generic" one, so no arbitrary URLs / SSRF),
// arguments as an array (never a shell), the URL always after "--", hard timeouts.
import 'server-only';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';
const COMMON = [
  '--no-playlist', '--no-warnings', '--no-progress', '--no-cache-dir',
  '--use-extractors', 'default,-generic',
  '--socket-timeout', '15',
  '--js-runtimes', `node:${process.execPath}`, // YouTube needs a JS runtime; reuse this Node
];
if (process.env.FFMPEG_DIR) COMMON.push('--ffmpeg-location', process.env.FFMPEG_DIR);

/**
 * Optional: a Netscape cookies.txt from a dedicated adult account (YTDLP_COOKIES=/path/cookies.txt)
 * unlocks age-restricted videos on sites that require sign-in (e.g. YouTube). Each yt-dlp run gets its
 * own copy, because yt-dlp writes cookies back and parallel runs would corrupt a shared file.
 */
const COOKIES = process.env.YTDLP_COOKIES && fs.existsSync(/*turbopackIgnore: true*/ process.env.YTDLP_COOKIES) ? process.env.YTDLP_COOKIES : '';
function cookieArgs(): { args: string[]; cleanup: () => void } {
  if (!COOKIES) return { args: [], cleanup: () => {} };
  const copy = path.join(/*turbopackIgnore: true*/ os.tmpdir(), `utd-ck-${randomBytes(8).toString('hex')}.txt`);
  try { fs.copyFileSync(/*turbopackIgnore: true*/ COOKIES, copy); } catch { return { args: [], cleanup: () => {} }; }
  return { args: ['--cookies', copy], cleanup: () => fs.rm(/*turbopackIgnore: true*/ copy, { force: true }, () => {}) };
}
/** spawn yt-dlp with the common flags (+ cookies when configured); temp cookie copy removed on exit. */
function ytdlp(args: string[], common = COMMON) {
  const ck = cookieArgs();
  const p = spawn(/*turbopackIgnore: true*/ YTDLP, [...common, ...ck.args, ...args], { windowsHide: true, env: { ...process.env, PYTHONUTF8: '1' } });
  p.on('close', ck.cleanup); p.on('error', ck.cleanup);
  return p;
}

export class UserError extends Error {}

/** Accept only plain public http(s) links. */
export function checkUrl(raw: unknown): string {
  if (typeof raw !== 'string') throw new UserError('Paste a video link.');
  const s = raw.trim();
  if (!s || s.length > 2048) throw new UserError('Paste a video link.');
  let u: URL;
  try { u = new URL(s); } catch { throw new UserError('That doesn’t look like a link. Copy the full address, starting with https://'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new UserError('Only http(s) links are supported.');
  if (u.username || u.password) throw new UserError('Links with a username or password aren’t supported.');
  const host = u.hostname.toLowerCase();
  if (net.isIP(host.replace(/^\[|\]$/g, '')) || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.'))
    throw new UserError('Paste a link from a video site, like youtube.com or tiktok.com.');
  return u.toString();
}

function run(args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = ytdlp(args);
    let out = '', err = '';
    const t = setTimeout(() => { p.kill('SIGKILL'); reject(new UserError('That site took too long to answer. Try again in a moment.')); }, timeoutMs);
    p.stdout.on('data', (d) => { out += d; if (out.length > 30e6) p.kill('SIGKILL'); });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', () => { clearTimeout(t); reject(new Error('yt-dlp is not installed on the server')); });
    p.on('close', (code) => {
      clearTimeout(t);
      if (code === 0) return resolve(out);
      reject(new UserError(friendly(err)));
    });
  });
}

function friendly(err: string): string {
  // Only the last ERROR line matters; match whole phrases (an earlier version matched "age" inside "webpage").
  const line = (err.split(/\r?\n/).reverse().find((l) => l.startsWith('ERROR')) || err).toLowerCase();
  const has = (re: RegExp) => re.test(line);
  if (has(/unsupported url|no suitable extractor/)) return 'That site isn’t supported, or the link isn’t a video page.';
  if (has(/drm/)) return 'That video is DRM-protected, so it can’t be downloaded.';
  if (has(/confirm your age|age[- ]restricted|age[- ]gate|inappropriate for some users|age verification/))
    return COOKIES
      ? 'That video is age-restricted and couldn’t be unlocked. The browser extension can download it using your own login.'
      : 'That video is age-restricted, so the site only shows it to signed-in adults. The browser extension downloads it using your own login.';
  if (has(/not a bot|captcha|too many requests|http error 429/)) return 'That site is limiting our server right now. Try again in a few minutes, or use the browser extension.';
  if (has(/not available in your country|geo[- ]?restrict|this video is not available in your|blocked in your/)) return 'That video is blocked in our server’s region. The browser extension downloads it from your own connection.';
  if (has(/private video|members[- ]only|join this channel|this video is private|login required|requires? (a )?login|sign in to view|use --cookies|--cookies-from-browser/))
    return 'That video is private or needs a login. The browser extension can download it using your own login.';
  if (has(/http error 40[13]|http error 410|unable to download webpage|forbidden/)) return 'That site refused our server. Try again in a moment, or use the browser extension, which downloads from your own connection.';
  if (has(/unavailable|not available|has been removed|does not exist|http error 404|not found/)) return 'That video isn’t available (removed, private or region-locked).';
  return 'We couldn’t read that video. Check the link, or try the browser extension.';
}

export type Option = { id: string; label: string; kind: 'video' | 'audio'; ext: string; height?: number; size?: number; merge?: boolean };
export type Info = { url: string; title: string; site: string; thumbnail?: string; duration?: number; uploader?: string; options: Option[]; needsExtension: boolean };

type F = { format_id: string; ext: string; vcodec?: string; acodec?: string; height?: number; width?: number; filesize?: number; filesize_approx?: number; tbr?: number; abr?: number; protocol?: string; format_note?: string };

/** Highest quality the website prepares (merging is done on the server). Above this → the extension. */
export const MAX_HEIGHT = Number(process.env.MAX_HEIGHT || 1080);
const LADDER = [2160, 1440, 1080, 720, 480, 360, 240, 144];

/**
 * Two kinds of options:
 *  - single-file (video+audio in one file): streamed straight through, starts instantly;
 *  - merged ("m720", "m1080"…): separate video + audio streams that the server downloads, merges
 *    into one MP4 in a temp folder, sends, and deletes. This is how YouTube serves 720p and up.
 */
function pickOptions(formats: F[]): { options: Option[]; hasBetter: boolean } {
  const okProto = (f: F) => !f.protocol || /^(https?|m3u8_native|m3u8|http_dash_segments)$/.test(f.protocol);
  const size = (f: F) => f.filesize || f.filesize_approx || undefined;
  const has = (c?: string) => !!c && c !== 'none';
  // "p" is the short side, so vertical Shorts (1080×1920) count as 1080p
  const p = (f: F) => (f.width && f.height ? Math.min(f.width, f.height) : f.height || 0);
  const tier = (f: F) => LADDER.find((h) => p(f) >= h * 0.9) || p(f);

  const audios = formats.filter((f) => !has(f.vcodec) && has(f.acodec) && okProto(f));
  const drc = (f: F) => /drc/i.test(f.format_id + (f.format_note || '')); // YouTube's volume-squashed copy
  const bestAudio = audios.sort((a, b) => Number(drc(a)) - Number(drc(b)) || Number(b.ext === 'm4a') - Number(a.ext === 'm4a') || (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0))[0];

  const progressive = new Map<number, F>();
  // Codecs null/undefined = "unknown" in yt-dlp (many sites' direct MP4s): a video file with a height and
  // unknown codecs is a normal single file with sound. 'none' means the stream is really absent.
  const unknown = (f: F) => f.vcodec == null && f.acodec == null && !!f.height && /^(mp4|webm|mov)$/.test(f.ext);
  // Prefer a direct file over HLS segments (faster, and a real MP4 instead of transport-stream bytes).
  const score = (f: F) => (f.ext === 'mp4' ? 4 : 0) + (/^https?$/.test(f.protocol || 'https') ? 2 : 0);
  for (const f of formats.filter((f) => ((has(f.vcodec) && has(f.acodec)) || unknown(f)) && okProto(f) && p(f))) {
    const h = tier(f), cur = progressive.get(h);
    if (!cur || score(f) > score(cur) || (score(f) === score(cur) && (f.tbr || 0) > (cur.tbr || 0))) progressive.set(h, f);
  }
  // video-only streams per tier, preferring H.264 (plays everywhere) for the size estimate
  const videoOnly = new Map<number, F>();
  if (bestAudio) for (const f of formats.filter((f) => has(f.vcodec) && !has(f.acodec) && okProto(f) && p(f))) {
    const h = tier(f), cur = videoOnly.get(h);
    // rank like the merge will choose: H.264 first, then a plain https stream that reports its size
    const rank = (x: F) => (/^(avc|h264)/.test(x.vcodec || '') ? 4 : 0) + (/^https?$/.test(x.protocol || 'https') ? 2 : 0) + (size(x) ? 1 : 0);
    if (!cur || rank(f) > rank(cur) || (rank(f) === rank(cur) && (f.tbr || 0) > (cur.tbr || 0))) videoOnly.set(h, f);
  }

  const tiers = [...new Set([...progressive.keys(), ...videoOnly.keys()])].filter((h) => h <= MAX_HEIGHT).sort((a, b) => b - a).slice(0, 4);
  const videos: Option[] = tiers.map((h) => {
    const single = progressive.get(h), v = videoOnly.get(h);
    // a merged option is worth it only when it beats the single file at that tier
    if (single && (!v || p(single) >= p(v))) return { id: single.format_id, label: `${h}p`, kind: 'video', ext: single.ext, height: h, size: size(single) };
    const total = v && size(v) && bestAudio && size(bestAudio) ? size(v)! + size(bestAudio)! : undefined;
    return { id: `m${h}`, label: `${h}p`, kind: 'video', ext: 'mp4', height: h, size: total, merge: true };
  });

  const options = [...videos];
  if (bestAudio) options.push({ id: bestAudio.format_id, label: 'Audio', kind: 'audio', ext: bestAudio.ext, size: size(bestAudio) });
  const topAny = Math.max(0, ...formats.filter((f) => has(f.vcodec)).map(tier));
  return { options, hasBetter: topAny > (videos[0]?.height || 0) };
}

export async function getInfo(url: string): Promise<Info> {
  const raw = await run(['-J', '--', url], 30000);
  let j: any;
  try { j = JSON.parse(raw); } catch { throw new UserError('We couldn’t read that video. Try again.'); }
  if (j._type === 'playlist') throw new UserError('That’s a playlist. Paste the link of a single video.');
  const { options, hasBetter } = pickOptions(Array.isArray(j.formats) ? j.formats : []);
  // some sites expose only one direct file with no format list
  if (!options.length && j.url && j.ext) options.push({ id: String(j.format_id || 'best'), label: j.height ? `${j.height}p` : 'Video', kind: 'video', ext: j.ext });
  return {
    url,
    title: String(j.title || 'Video').slice(0, 200),
    site: String(j.extractor_key || j.extractor || '').replace(/IE$/, ''),
    thumbnail: typeof j.thumbnail === 'string' && /^https:\/\//.test(j.thumbnail) ? j.thumbnail : undefined,
    duration: typeof j.duration === 'number' ? j.duration : undefined,
    uploader: j.uploader ? String(j.uploader).slice(0, 100) : undefined,
    options,
    needsExtension: hasBetter || !options.some((o) => o.kind === 'video'),
  };
}

/** Downloads separate video + audio for one quality and merges them into dir/video.mp4 (with progress on stdout). */
export function spawnMerge(url: string, height: number, dir: string) {
  const args = COMMON.filter((a) => a !== '--no-progress');
  return ytdlp([
    '-f', 'bv*+ba/b', '-S', `res:${height},vcodec:h264,acodec:aac`, // ≤ height, H.264 + AAC so it plays everywhere
    '--merge-output-format', 'mp4', '-N', '4', '--max-filesize', '4G',
    '-P', dir, '-o', 'video.%(ext)s',
    '--newline', '--progress-template', 'download:UTDP %(info.format_id)s %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s',
    '--', url,
  ], args);
}

export { friendly };

/** Streams one format to stdout. Returns the child process; caller pipes and kills it. */
export function streamFormat(url: string, formatId: string) {
  if (!/^[\w.\-+]{1,40}$/.test(formatId)) throw new UserError('Bad format.');
  return ytdlp(['-f', formatId, '-o', '-', '--no-part', '--', url]);
}
