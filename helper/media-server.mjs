// Ultimate Turbo Downloader helper: runs yt-dlp jobs for the extension, moves finished aria2
// downloads out of the hidden temp folder, and opens/deletes downloaded files on request.
// Listens on 127.0.0.1 only; every request needs the same secret as aria2 (helper/secret.txt).
// No npm dependencies. Started hidden at login by start-helpers.vbs.
import http from 'node:http';
import { spawn, execFile } from 'node:child_process';
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync, renameSync, copyFileSync, readdirSync,
} from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const SECRET = readFileSync(join(HERE, 'secret.txt'), 'utf8').trim();
// (PowerShell 5 writes UTF-8 with a BOM, which JSON.parse rejects)
const readJson = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch { return d; } };
const CFG = readJson(join(HERE, 'media.json'), {});
const PORT = CFG.port || 6801;
const ARIA2 = `127.0.0.1:${CFG.aria2Port || 6800}`;
const YTDLP = CFG.ytdlp || 'yt-dlp';
const MAX_RUNNING = CFG.maxRunning || 3;
const TMP = join(HERE, 'tmp');
const JOBS_FILE = join(HERE, 'media-jobs.json');
const MOVED_FILE = join(HERE, 'moved.json');
const TEMP_NAME = '.utd-temp';
mkdirSync(TMP, { recursive: true });

// ---------------- folders ----------------
const isTempDir = (d) => basename(d || '').toLowerCase() === TEMP_NAME;
// The user's download folder (aria2.conf points aria2 at <folder>\.utd-temp).
function finalDir() {
  try {
    const m = /^dir=(.+)$/m.exec(readFileSync(join(HERE, 'aria2.conf'), 'utf8'));
    if (m) { const d = m[1].trim(); return isTempDir(d) ? dirname(d) : d; }
  } catch {}
  return join(process.env.USERPROFILE || HERE, 'Downloads');
}
const hidden = new Set();
function tempDirFor(dir) {
  const t = join(dir, TEMP_NAME);
  mkdirSync(t, { recursive: true });
  if (!hidden.has(t)) { hidden.add(t); execFile('attrib', ['+h', t], { windowsHide: true }, () => {}); }
  return t;
}
const norm = (p) => (p || '').replace(/\//g, '\\');
// "video.mp4" -> "video (1).mp4" if taken
function uniquePath(p) {
  if (!existsSync(p)) return p;
  const ext = extname(p), stem = p.slice(0, p.length - ext.length);
  for (let i = 1; i < 1000; i++) { const c = `${stem} (${i})${ext}`; if (!existsSync(c)) return c; }
  return `${stem} (${Date.now()})${ext}`;
}
function moveFile(from, to) {
  try { renameSync(from, to); } catch { copyFileSync(from, to); unlinkSync(from); } // copy if on another drive
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function unlinkRetry(f) {
  for (let i = 0; i < 6; i++) {
    try { if (existsSync(f)) unlinkSync(f); return true; } catch { await sleep(300); } // file may still be closing
  }
  return false;
}
// Finished files go to the Recycle Bin (recoverable), never straight to permanent deletion.
function recycle(file) {
  return new Promise((resolve, reject) => {
    const cmd = "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($env:UTD_PATH, 'OnlyErrorDialogs', 'SendToRecycleBin')";
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd],
      { windowsHide: true, env: { ...process.env, UTD_PATH: file } },
      (err) => (err || existsSync(file) ? reject(new Error('Could not move the file to the Recycle Bin')) : resolve()));
  });
}

// ---------------- aria2: move finished files out of the temp folder ----------------
async function aria(method, params = []) {
  const r = await fetch(`http://${ARIA2}/jsonrpc`, {
    method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'aria2.' + method, params: ['token:' + SECRET, ...params] }),
  }).then((x) => x.json());
  if (r.error) throw new Error(r.error.message);
  return r.result;
}
const moved = readJson(MOVED_FILE, {}); // gid -> final path
const saveMoved = () => {
  const keys = Object.keys(moved);
  for (const k of keys.slice(0, Math.max(0, keys.length - 500))) delete moved[k];
  try { writeFileSync(MOVED_FILE, JSON.stringify(moved)); } catch {}
};
async function finishAria(gid) {
  if (moved[gid]) return;
  let t;
  try { t = await aria('tellStatus', [gid, ['status', 'files']]); } catch { return; }
  if (t.status !== 'complete') return;
  const from = norm(t.files[0] && t.files[0].path);
  if (!from || !isTempDir(dirname(from)) || !existsSync(from)) return;
  const to = uniquePath(join(dirname(dirname(from)), basename(from)));
  try { moveFile(from, to); moved[gid] = to; saveMoved(); }
  catch (e) { console.warn('move failed', from, e.message); }
}
async function sweepAria() {
  try { for (const t of await aria('tellStopped', [0, 100, ['gid', 'status']])) if (t.status === 'complete') await finishAria(t.gid); } catch {}
}
function watchAria() {
  let ws;
  try { ws = new WebSocket(`ws://${ARIA2}/jsonrpc`); } catch { return setTimeout(watchAria, 5000); }
  ws.onopen = () => sweepAria();
  ws.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      if (m.method === 'aria2.onDownloadComplete') for (const p of m.params) finishAria(p.gid);
    } catch {}
  };
  ws.onclose = () => setTimeout(watchAria, 3000);
  ws.onerror = () => {};
}
watchAria();
setInterval(sweepAria, 10000); // safety net if a notification is missed

// ---------------- yt-dlp jobs ----------------
let jobs = readJson(JOBS_FILE, []);
for (const j of jobs) {
  j.log = []; // logs aren't saved to disk
  // finished: trust the real file on disk; jobs saved by v1.2 only had a text size ("1.55GiB")
  if (j.status === 'done' && j.file) { try { j.totalBytes = j.doneBytes = statSync(j.file).size; } catch {} }
  if (!j.totalBytes && typeof j.size === 'string') j.totalBytes = j.doneBytes = bytes(j.size);
  delete j.size; delete j.speed; delete j.eta;
  if (j.status === 'running' || j.status === 'queued') { j.status = 'paused'; j.speedBps = 0; } // resume later
}
const procs = new Map();
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const slim = jobs.slice(-200).map(({ log, ...j }) => j);
    try { writeFileSync(JOBS_FILE, JSON.stringify(slim)); } catch {}
  }, 500);
}

const QUALITY = {
  best: [],
  2160: ['-f', 'bv*[height<=2160]+ba/b[height<=2160]/b'],
  1080: ['-f', 'bv*[height<=1080]+ba/b[height<=1080]/b'],
  720: ['-f', 'bv*[height<=720]+ba/b[height<=720]/b'],
  480: ['-f', 'bv*[height<=480]+ba/b[height<=480]/b'],
};

function buildArgs(job, url) {
  const home = job.dir || finalDir();
  const a = [
    '--newline', '--color', 'no_color', '--no-playlist', '--no-mtime', '--windows-filenames',
    '--no-simulate', '--progress',
    // raw numbers (bytes, bytes/s, seconds) so the extension can show everything in MB/s
    '--progress-template', 'download:PROG|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s|%(info.vcodec)s|%(info.acodec)s',
    '--print', 'before_dl:INFO|%(id)s|%(title)s',
    '--print', 'after_move:FILE|%(filepath)s',
    // pieces (.part, separate video/audio streams) stay in the hidden temp folder; only the finished file lands in `home`
    '-P', 'home:' + home, '-P', 'temp:' + tempDirFor(home),
    '-o', '%(title).150B [%(id)s].%(ext)s',
    '-N', String(CFG.fragments || 16), // parallel fragments for HLS/DASH streams (Facebook, Instagram, TikTok, …)
    '--buffer-size', '1M',
    '--retries', '10', '--fragment-retries', '10',
  ];
  if (CFG.node) a.push('--js-runtimes', 'node:' + CFG.node);
  if (CFG.ffmpeg) a.push('--ffmpeg-location', CFG.ffmpeg);
  if (job.mode === 'audio') {
    a.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else {
    a.push(...(QUALITY[job.mode] || []), '-S', 'res,fps,vcodec:h264,acodec:m4a', '--merge-output-format', 'mp4/mkv');
  }
  // plain files on ordinary hosts: let aria2 fetch them with several connections
  const host = safeHost(url);
  if (CFG.aria2c && !/(^|\.)(youtube\.com|youtu\.be|googlevideo\.com)$/.test(host)) {
    const n = CFG.connections || 16;
    a.push('--downloader', 'http:' + CFG.aria2c, '--downloader-args',
      `aria2c:-x ${n} -s ${n} -k 1M --socket-recv-buffer-size=16M --file-allocation=none --disk-cache=32M --uri-selector=adaptive --console-log-level=warn --summary-interval=1`);
  }
  if (job.cookieFile) a.push('--cookies', job.cookieFile);
  if (job.direct) {
    if (job.pageUrl) a.push('--referer', job.pageUrl);
    if (job.ua) a.push('--user-agent', job.ua);
  }
  a.push('--', url);
  return a;
}

// "5.1MiB" -> bytes; "1h2m3s" -> seconds (aria2c output)
function bytes(s) {
  const m = /([\d.]+)\s*([KMGT]?)i?B/i.exec(s || '');
  if (!m) return 0;
  return Math.round(parseFloat(m[1]) * 1024 ** ' KMGT'.indexOf(m[2].toUpperCase() || ' '));
}
function seconds(s) {
  let t = 0;
  for (const [, n, u] of (s || '').matchAll(/(\d+)([hms])/g)) t += +n * { h: 3600, m: 60, s: 1 }[u];
  return t;
}

function safeHost(u) { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } }

function pump() {
  let running = jobs.filter((j) => j.status === 'running').length;
  for (const j of jobs) {
    if (running >= MAX_RUNNING) break;
    if (j.status === 'queued') { run(j); running++; }
  }
}

function run(job) {
  const url = job.tryUrls[job.tryIndex];
  job.status = 'running'; job.error = '';
  job.speedBps = 0; job.etaSec = 0; job.part = '';
  job.currentUrl = url;
  const args = buildArgs(job, url);
  const p = spawn(YTDLP, args, { windowsHide: true, env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' } });
  procs.set(job.id, p);
  let lastErr = '';
  const onLine = (line) => {
    line = line.trim();
    if (!line) return;
    job.log.push(line); if (job.log.length > 30) job.log.shift();
    if (line.startsWith('PROG|')) {
      const [, done, total, est, speed, eta, vcodec, acodec] = line.split('|');
      const num = (x) => (x && x !== 'NA' && x !== 'None' ? Number(x) : 0);
      job.doneBytes = num(done);
      job.totalBytes = num(total) || num(est) || job.totalBytes;
      job.speedBps = num(speed);
      job.etaSec = num(eta);
      if (job.totalBytes) job.percent = Math.min(100, (job.doneBytes / job.totalBytes) * 100);
      // best quality = separate video and audio streams, downloaded one after the other
      job.part = vcodec === 'none' ? 'audio' : acodec === 'none' ? 'video' : '';
    } else if (line.startsWith('INFO|')) {
      const [, vid, ...title] = line.split('|');
      job.vid = vid; job.title = title.join('|');
    } else if (line.startsWith('FILE|')) {
      job.file = line.slice(5);
    } else if (/^\[#\w+ /.test(line)) {
      // aria2c summary: [#a1b2c3 12MiB/100MiB(12%) CN:8 DL:5.1MiB ETA:17s]
      const m = /([\d.]+\w*B)\/([\d.]+\w*B)\(([\d.]+)%\)(?:.*?CN:(\d+))?(?:.*?DL:([\d.]+\w*B))?(?:.*?ETA:(\w+))?/.exec(line);
      if (m) {
        job.doneBytes = bytes(m[1]); job.totalBytes = bytes(m[2]); job.percent = +m[3];
        if (m[4]) job.conns = +m[4];
        job.speedBps = m[5] ? bytes(m[5]) : 0;
        job.etaSec = m[6] ? seconds(m[6]) : 0;
      }
    } else if (/^ERROR:/.test(line)) {
      lastErr = line.replace(/^ERROR:\s*/, '');
    }
    save();
  };
  let buf = { out: '', err: '' };
  const feed = (k) => (d) => { buf[k] += d.toString('utf8'); const parts = buf[k].split(/\r?\n|\r/); buf[k] = parts.pop(); parts.forEach(onLine); };
  p.stdout.on('data', feed('out'));
  p.stderr.on('data', feed('err'));
  p.on('error', (e) => { lastErr = 'Could not start yt-dlp: ' + e.message; });
  p.on('close', (code) => {
    procs.delete(job.id);
    job.speedBps = 0; job.etaSec = 0;
    if (job.status === 'paused') { save(); return pump(); }       // stopped on purpose; pieces kept for resume
    if (job.status === 'cancelled') { cleanup(job); return pump(); }
    if (code === 0) {
      job.status = 'done'; job.percent = 100; job.part = '';
      try { if (job.file) job.totalBytes = job.doneBytes = statSync(job.file).size; } catch {}
      cleanup(job);
    } else if (job.tryIndex + 1 < job.tryUrls.length) {
      // page not supported by yt-dlp: try the next candidate (e.g. a video file the browser played)
      job.log.push(`Falling back from ${url}: ${lastErr}`);
      job.tryIndex++;
      job.direct = true;
      job.status = 'queued';
    } else {
      job.status = 'error'; job.error = lastErr || `yt-dlp exited with code ${code}`;
      cleanup(job);
    }
    save(); pump();
  });
  save();
}

function cleanup(job) {
  if (job.cookieFile) { try { unlinkSync(job.cookieFile); } catch {} delete job.cookieFile; }
}

// Unfinished pieces of a video job: files in its temp folder named "... [<video id>]..."
async function deletePieces(job) {
  if (!job.vid) return;
  const t = join(job.dir || finalDir(), TEMP_NAME);
  let names = [];
  try { names = readdirSync(t); } catch { return; }
  for (const n of names) if (n.includes(`[${job.vid}]`)) await unlinkRetry(join(t, n));
}

function killTree(pid) {
  return new Promise((r) => execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }, () => r()));
}
async function stopJob(j, status) {
  const p = procs.get(j.id);
  j.status = status; save();
  if (p) {
    await killTree(p.pid);
    for (let i = 0; i < 20 && procs.has(j.id); i++) await sleep(100);
  }
}

// aria2 download: its file path (moved out of temp if finished) and status
async function ariaInfo(gid) {
  if (!/^[0-9a-f]{16}$/i.test(gid || '')) throw new Error('bad gid');
  const t = await aria('tellStatus', [gid, ['status', 'files']]);
  return { status: t.status, path: norm(t.files[0] && t.files[0].path), final: moved[gid] };
}

// ---------------- HTTP API ----------------
function isHttpUrl(u) { try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; } catch { return false; } }
const publicJob = ({ log, cookieFile, ...j }) => ({ ...j, lastLog: (log || []).slice(-3) });

const routes = {
  'GET /status': async () => ({ ok: true, ytdlp: await ytdlpVersion(), running: jobs.filter((j) => j.status === 'running').length }),
  'GET /jobs': async () => jobs.map(publicJob),
  'GET /moved': async () => moved,
  'POST /add': async (b) => {
    const urls = [b.url, ...(Array.isArray(b.fallbacks) ? b.fallbacks : [])].filter(isHttpUrl);
    const uniq = [...new Set(urls)];
    if (!uniq.length) throw new Error('No http(s) URL to download');
    const job = {
      id: randomBytes(6).toString('hex'), added: Date.now(), status: 'queued',
      pageUrl: isHttpUrl(b.pageUrl) ? b.pageUrl : '', mode: String(b.mode || 'best'),
      title: b.title ? String(b.title).slice(0, 200) : '', dir: typeof b.dir === 'string' ? b.dir : '',
      direct: !!b.direct, ua: typeof b.ua === 'string' ? b.ua.slice(0, 300) : '',
      tryUrls: uniq, tryIndex: 0, percent: 0, log: [],
    };
    if (typeof b.cookies === 'string' && b.cookies.includes('\t')) {
      job.cookieFile = join(TMP, `cookies-${job.id}.txt`);
      writeFileSync(job.cookieFile, b.cookies);
    }
    jobs.push(job); save(); pump();
    return { id: job.id };
  },
  // Pause = stop yt-dlp but keep its pieces; Resume = start it again, it continues from the pieces.
  'POST /pause': async (b) => {
    const j = jobs.find((x) => x.id === b.id); if (!j) throw new Error('no such job');
    if (j.status === 'running' || j.status === 'queued') await stopJob(j, 'paused');
    return { ok: true };
  },
  'POST /resume': async (b) => {
    const j = jobs.find((x) => x.id === b.id); if (!j) throw new Error('no such job');
    if (j.status === 'paused') { j.status = 'queued'; save(); pump(); }
    return { ok: true };
  },
  // Cancel = stop and delete the unfinished pieces (the row stays, marked Cancelled).
  'POST /cancel': async (b) => {
    const j = jobs.find((x) => x.id === b.id); if (!j) throw new Error('no such job');
    if (['running', 'queued', 'paused'].includes(j.status)) await stopJob(j, 'cancelled');
    cleanup(j);
    await deletePieces(j);
    return { ok: true };
  },
  'POST /retry': async (b) => {
    const j = jobs.find((x) => x.id === b.id); if (!j) throw new Error('no such job');
    if (j.status === 'running') return { ok: true };
    j.status = 'queued'; j.tryIndex = 0; j.direct = false; j.error = ''; save(); pump();
    return { ok: true };
  },
  // Remove from the list only (used for rows with nothing on disk).
  'POST /remove': async (b) => {
    const j = jobs.find((x) => x.id === b.id);
    if (j && ['running', 'queued', 'paused'].includes(j.status)) await routes['POST /cancel'](b);
    jobs = jobs.filter((x) => x.id !== b.id); save();
    return { ok: true };
  },
  // Remove from the list AND from disk: the finished file goes to the Recycle Bin,
  // unfinished pieces are deleted. The extension always asks the user first.
  'POST /delete': async (b) => {
    const out = { ok: true, recycled: '', piecesDeleted: 0 };
    if (b.id) {
      const j = jobs.find((x) => x.id === b.id); if (!j) throw new Error('no such job');
      if (['running', 'queued', 'paused'].includes(j.status)) await stopJob(j, 'cancelled');
      cleanup(j);
      await deletePieces(j);
      if (j.status === 'done' && j.file && existsSync(j.file)) { await recycle(j.file); out.recycled = j.file; }
      jobs = jobs.filter((x) => x.id !== b.id); save();
      return out;
    }
    const info = await ariaInfo(b.gid);
    if (['active', 'waiting', 'paused'].includes(info.status)) { await aria('forceRemove', [b.gid]); await sleep(500); }
    if (info.status === 'complete') {
      const file = info.final || info.path;
      if (file && existsSync(file)) { await recycle(file); out.recycled = file; }
    } else if (info.path && isTempDir(dirname(info.path))) {
      // unfinished: only ever delete inside the hidden temp folder
      for (const f of [info.path, info.path + '.aria2']) if (existsSync(f) && (await unlinkRetry(f))) out.piecesDeleted++;
    }
    try { await aria('removeDownloadResult', [b.gid]); } catch {}
    delete moved[b.gid]; saveMoved();
    return out;
  },
  // aria2 download cancelled from a progress card: delete its pieces from the temp folder.
  'POST /discard': async (b) => {
    const info = await ariaInfo(b.gid);
    if (['active', 'waiting', 'paused'].includes(info.status)) { await aria('forceRemove', [b.gid]); await sleep(500); }
    let n = 0;
    if (info.status !== 'complete' && info.path && isTempDir(dirname(info.path))) {
      for (const f of [info.path, info.path + '.aria2']) if (existsSync(f) && (await unlinkRetry(f))) n++;
    }
    return { ok: true, piecesDeleted: n };
  },
  'POST /clear': async () => { jobs = jobs.filter((j) => ['running', 'queued', 'paused'].includes(j.status)); save(); return { ok: true }; },
  'POST /open': async (b) => routes['POST /reveal']({ id: b.id, open: false }),
  // Show a finished file in Explorer, or open it with its default app.
  // Only paths of our own jobs (or aria2's own downloads, asked from aria2 itself) are accepted.
  'POST /reveal': async (b) => {
    let file = '';
    if (b.id) {
      const j = jobs.find((x) => x.id === b.id);
      file = j && j.file;
    } else if (b.gid) {
      await finishAria(b.gid); // in case the move hasn't happened yet
      const info = await ariaInfo(b.gid);
      if (info.status === 'complete') file = info.final || info.path;
    }
    if (!file || !existsSync(file)) throw new Error('file not found');
    const args = b.open ? [file] : ['/select,', file];
    spawn('explorer.exe', args, { detached: true, stdio: 'ignore' }).unref();
    return { ok: true };
  },
  'POST /update': async () => new Promise((resolve) => {
    const [cmd, ...args] = CFG.updateCmd || [YTDLP, '-U'];
    execFile(cmd, args, { windowsHide: true, timeout: 300000 }, (err, out, errOut) => {
      cachedVersion = null;
      resolve({ ok: !err, output: String(out + errOut).trim().split(/\r?\n/).slice(-4).join('\n') });
    });
  }),
};

let cachedVersion = null;
function ytdlpVersion() {
  if (cachedVersion) return Promise.resolve(cachedVersion);
  return new Promise((r) => execFile(YTDLP, ['--version'], { windowsHide: true }, (e, out) => r((cachedVersion = e ? 'not found' : out.trim()))));
}

tempDirFor(finalDir()); // make sure the default temp folder exists and is hidden

http.createServer(async (req, res) => {
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  // Only the extension (or a local tool with no Origin) with the secret may talk to us.
  const origin = req.headers.origin || '';
  if (origin && !/^(chrome|moz)-extension:\/\//.test(origin)) return send(403, { error: 'forbidden origin' });
  if (req.headers['x-turbo-secret'] !== SECRET) return send(401, { error: 'bad secret' });
  const route = routes[`${req.method} ${req.url.split('?')[0]}`];
  if (!route) return send(404, { error: 'not found' });
  let body = '';
  req.on('data', (d) => { body += d; if (body.length > 2e6) req.destroy(); });
  req.on('end', async () => {
    try { send(200, await route(body ? JSON.parse(body) : {})); }
    catch (e) { send(400, { error: e.message }); }
  });
}).listen(PORT, '127.0.0.1', () => console.log(`helper on 127.0.0.1:${PORT}, yt-dlp=${YTDLP}, folder=${finalDir()}`));
