// Server-only: HD "prepare" jobs. yt-dlp downloads the separate video + audio streams into a private
// temp folder and merges them into one MP4; the visitor then downloads that file once and it's deleted.
// Nothing is kept: files are removed right after sending, and any leftovers after 20 minutes.
import 'server-only';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { freeSlot } from './guard';
import { friendly, spawnMerge } from './ytdlp';

export type JobState = 'running' | 'ready' | 'error';
type Job = {
  id: string; dir: string; name: string; state: JobState; pct: number; error?: string;
  file?: string; size?: number; created: number; finished?: number; kill?: () => void;
};

const ROOT = path.join(/*turbopackIgnore: true*/ os.tmpdir(), 'utd-web');
const MAX_AGE = 20 * 60 * 1000;       // any job folder older than this is deleted
const READY_TTL = 10 * 60 * 1000;     // a finished file waits this long for its download
const RUN_LIMIT = 15 * 60 * 1000;     // hard cap on preparing

// One shared registry per process (route bundles may each load this module).
const g = globalThis as typeof globalThis & { __utdJobs?: Map<string, Job> };
const first = !g.__utdJobs;
const jobs: Map<string, Job> = (g.__utdJobs ??= new Map());

// start clean: remove anything left from a previous run
if (first) try { fs.rmSync(/*turbopackIgnore: true*/ ROOT, { recursive: true, force: true }); } catch {}

function remove(job: Job) {
  job.kill?.();
  jobs.delete(job.id);
  fs.rm(/*turbopackIgnore: true*/ job.dir, { recursive: true, force: true }, () => {});
}

if (first) setInterval(() => {
  const now = Date.now();
  for (const j of jobs.values()) {
    if (now - j.created > MAX_AGE || (j.finished && now - j.finished > READY_TTL)) remove(j);
  }
}, 60 * 1000).unref?.();

/** Caller must already hold a slot (takeSlot); it is freed when preparing ends. */
export function startJob(url: string, height: number, name: string): string {
  const id = randomBytes(18).toString('base64url');
  const dir = path.join(/*turbopackIgnore: true*/ ROOT, id);
  fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
  const job: Job = { id, dir, name, state: 'running', pct: 0, created: Date.now() };
  jobs.set(id, job);

  const child = spawnMerge(url, height, dir);
  let released = false;
  const release = () => { if (!released) { released = true; freeSlot(); } };
  const timer = setTimeout(() => fail('This video is too long to prepare here. The browser extension can download it.'), RUN_LIMIT);
  job.kill = () => { try { child.kill('SIGKILL'); } catch {} release(); clearTimeout(timer); };

  function fail(msg: string) {
    if (job.state !== 'running') return;
    job.state = 'error'; job.error = msg; job.finished = Date.now();
    job.kill?.();
    fs.rm(/*turbopackIgnore: true*/ dir, { recursive: true, force: true }, () => {});
  }

  // Progress: the first stream (video) is ~90 % of the work, the second (audio) ~8 %, merging the rest.
  const order: string[] = [];
  let err = '', buf = '';
  const onLine = (line: string) => {
    const m = line.match(/^UTDP (\S+) (\d+|NA) (\d+|NA) ([\d.]+|NA)/);
    if (m) {
      if (!order.includes(m[1])) order.push(m[1]);
      const done = Number(m[2]) || 0, total = Number(m[3]) || Number(m[4]) || 0;
      const frac = total ? Math.min(1, done / total) : 0;
      const phase = order.indexOf(m[1]);
      job.pct = Math.max(job.pct, phase === 0 ? (order.length > 1 ? 0.9 : 0.98) * frac : 0.9 + 0.08 * frac);
    } else if (/^\[(Merger|VideoRemuxer|FixupM3u8)\]/.test(line)) job.pct = Math.max(job.pct, 0.98);
  };
  child.stdout.on('data', (d: Buffer) => {
    buf += d.toString();
    const lines = buf.split(/\r?\n/); buf = lines.pop() || '';
    lines.forEach(onLine);
  });
  child.stderr.on('data', (d: Buffer) => { err = (err + d.toString()).slice(-8000); });
  child.on('error', () => fail('The server can’t prepare videos right now. Try again later.'));
  child.on('close', (code) => {
    clearTimeout(timer); release();
    if (job.state !== 'running') return;
    if (code !== 0) return fail(friendly(err));
    const out = fs.readdirSync(/*turbopackIgnore: true*/ dir).filter((f) => !/\.(part|ytdl|temp)$/.test(f) && !/\.f\d+\./.test(f));
    const file = out.find((f) => f.startsWith('video.'));
    if (!file) return fail('We couldn’t prepare that video. Try a lower quality.');
    job.file = path.join(/*turbopackIgnore: true*/ dir, file);
    job.size = fs.statSync(/*turbopackIgnore: true*/ job.file).size;
    job.state = 'ready'; job.pct = 1; job.finished = Date.now();
  });
  return id;
}

export function jobStatus(id: string) {
  const j = jobs.get(id);
  if (!j) return null;
  return { state: j.state, pct: Math.round(j.pct * 1000) / 10, error: j.error, size: j.size };
}

/** The finished file, once. The caller deletes it with finishJob() after sending. */
export function takeFile(id: string) {
  const j = jobs.get(id);
  if (!j || j.state !== 'ready' || !j.file) return null;
  return { path: j.file, size: j.size!, name: j.name, done: () => remove(j) };
}

export function validJobId(id: unknown): id is string {
  return typeof id === 'string' && /^[\w-]{20,40}$/.test(id);
}
