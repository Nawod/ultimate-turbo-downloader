// GET /api/download?t=<signed token>  →  streams the file (attachment). Only links issued by /api/info work.
// GET /api/download?j=<job id>        →  a prepared HD file (Range requests supported).
import { clientIp, freeSlot, limited, readToken, takeSlot } from '@/lib/server/guard';
import { streamFormat } from '@/lib/server/ytdlp';
import { openFile, validJobId } from '@/lib/server/jobs';
import fs from 'node:fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', m4a: 'audio/mp4', mp3: 'audio/mpeg', opus: 'audio/ogg', ogg: 'audio/ogg', mov: 'video/quicktime' };
const page = (msg: string, status: number) => new Response(msg, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
const disposition = (name: string) => `attachment; filename="${name.replace(/[^ -~]/g, '_').replace(/"/g, "'")}"; filename*=UTF-8''${encodeURIComponent(name)}`;

/**
 * A prepared (merged) HD file. Supports Range requests so download managers (our extension's aria2,
 * IDM…) can fetch it over several connections and resume. Deleted once it has been fully sent.
 */
function sendPrepared(req: Request, id: string, headOnly = false) {
  const f = openFile(id);
  if (!f) return page('This download has expired. Go back and paste the video link again.', 410);
  const base = {
    'Content-Type': 'video/mp4',
    'Content-Disposition': disposition(f.name),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  let start = 0, end = f.size - 1, status = 200;
  const range = req.headers.get('range');
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m && (m[1] || m[2])) {
      if (m[1]) { start = Number(m[1]); if (m[2]) end = Math.min(end, Number(m[2])); }
      else start = Math.max(0, f.size - Number(m[2])); // suffix: last N bytes
      if (start > end || start >= f.size) {
        f.close();
        return new Response(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${f.size}` } });
      }
      status = 206;
    }
  }
  const headers: Record<string, string> = { ...base, 'Content-Length': String(end - start + 1) };
  if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${f.size}`;
  if (headOnly) { f.close(); return new Response(null, { status, headers }); }

  const rs = fs.createReadStream(/*turbopackIgnore: true*/ f.path, { start, end, highWaterMark: 1 << 20 });
  const finish = () => { rs.destroy(); f.close(); };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      rs.on('data', (chunk) => {
        const b = chunk as Buffer; f.sent(b.length);
        try { controller.enqueue(new Uint8Array(b)); } catch { finish(); }
        if ((controller.desiredSize ?? 1) <= 0) rs.pause();
      });
      rs.on('end', () => { try { controller.close(); } catch {} finish(); });
      rs.on('error', () => { try { controller.error(new Error('read failed')); } catch {} finish(); });
    },
    pull() { rs.resume(); },
    cancel() { finish(); }, // cancelled: the file stays for a retry until the sweep removes it
  });
  req.signal.addEventListener('abort', finish);
  return new Response(stream, { status, headers });
}

export async function HEAD(req: Request) {
  const j = new URL(req.url).searchParams.get('j');
  if (j !== null && validJobId(j)) return sendPrepared(req, j, true);
  return new Response(null, { status: 405 });
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const j = q.get('j');
  if (j !== null) return validJobId(j) ? sendPrepared(req, j) : page('Bad download link.', 400);
  const t = readToken(q.get('t'));
  if (!t) return page('This download link has expired. Go back and paste the video link again.', 410);
  if (/^m\d+$/.test(t.f)) return page('This quality needs preparing first. Go back and choose it again.', 400);
  if (limited(`dl:${clientIp(req)}`, 12, 10 * 60 * 1000)) return page('Too many downloads. Please wait a few minutes, or get the free browser extension for unlimited downloads.', 429);
  if (!takeSlot()) return page('The server is busy right now. Try again in a minute, or use the free browser extension, which downloads on your own PC.', 503);

  let child: ReturnType<typeof streamFormat>;
  try { child = streamFormat(t.u, t.f); } catch { freeSlot(); return page('Bad download link.', 400); }

  let freed = false;
  const done = () => { if (!freed) { freed = true; freeSlot(); } };
  const kill = () => { try { child.kill('SIGKILL'); } catch {} done(); };
  const idle = setTimeout(kill, 15 * 60 * 1000); // hard cap per download

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      child.stdout.on('data', (chunk: Buffer) => {
        try { controller.enqueue(new Uint8Array(chunk)); } catch { kill(); }
        if ((controller.desiredSize ?? 1) <= 0) child.stdout.pause(); // backpressure
      });
      child.stdout.on('end', () => { clearTimeout(idle); try { controller.close(); } catch {} done(); });
      child.on('error', () => { clearTimeout(idle); try { controller.error(new Error('failed')); } catch {} done(); });
      child.on('close', (code) => { if (code !== 0) { try { controller.error(new Error('yt-dlp ' + code)); } catch {} } clearTimeout(idle); done(); });
    },
    pull() { child.stdout.resume(); },
    cancel() { clearTimeout(idle); kill(); }, // visitor cancelled or closed the tab
  });
  req.signal.addEventListener('abort', () => { clearTimeout(idle); kill(); });

  return new Response(stream, {
    headers: {
      'Content-Type': TYPES[t.x] || 'application/octet-stream',
      'Content-Disposition': disposition(t.n),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
