// HD qualities (720p, 1080p…) come as separate video + audio streams, so the server merges them first.
// POST /api/prepare { t }      → { id }   starts preparing (needs a signed token from /api/info)
// GET  /api/prepare?id=<id>    → { state: running|ready|error, pct, error? }
// When ready, the file is fetched once from GET /api/download?j=<id> and then deleted.
import { NextResponse } from 'next/server';
import { clientIp, freeSlot, limited, readToken, takeSlot } from '@/lib/server/guard';
import { jobStatus, startJob, validJobId } from '@/lib/server/jobs';
import { MAX_HEIGHT } from '@/lib/server/ytdlp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  const t = readToken(body?.t);
  if (!t) return json({ error: 'This link has expired. Paste the video link again.' }, 410);
  const m = /^m(\d{3,4})$/.exec(t.f);
  const height = m ? Number(m[1]) : 0;
  if (!height || height > MAX_HEIGHT) return json({ error: 'Bad quality.' }, 400);
  if (limited(`dl:${clientIp(req)}`, 12, 10 * 60 * 1000)) return json({ error: 'Too many downloads. Please wait a few minutes, or get the free browser extension for unlimited downloads.' }, 429);
  if (!takeSlot()) return json({ error: 'The server is busy right now. Try again in a minute, or use the free browser extension, which downloads on your own PC.' }, 503);
  try {
    return json({ id: startJob(t.u, height, t.n) });
  } catch (e) {
    freeSlot();
    console.error('[prepare]', e);
    return json({ error: 'Something went wrong on our side. Please try again.' }, 500);
  }
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!validJobId(id)) return json({ error: 'Bad request.' }, 400);
  const s = jobStatus(id);
  if (!s) return json({ state: 'error', error: 'This download has expired. Paste the video link again.' }, 404);
  return json(s);
}
