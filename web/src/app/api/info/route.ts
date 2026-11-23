// POST /api/info  { url }  →  title, thumbnail and download options (each with a signed token)
import { NextResponse } from 'next/server';
import { checkUrl, getInfo, UserError } from '@/lib/server/ytdlp';
import { clientIp, limited, makeToken, safeName } from '@/lib/server/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (limited(`info:${ip}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429 });
  }
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Paste a video link.' }, { status: 400 }); }
  try {
    const url = checkUrl(body?.url);
    const info = await getInfo(url);
    const options = info.options.map((o) => ({
      ...o,
      token: makeToken({ u: info.url, f: o.id, n: safeName(info.title + (o.kind === 'video' ? ` (${o.label})` : ''), o.ext), x: o.ext }),
    }));
    return NextResponse.json({ ...info, options }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const msg = e instanceof UserError ? e.message : 'Something went wrong on our side. Please try again.';
    if (!(e instanceof UserError)) console.error('[info]', e);
    return NextResponse.json({ error: msg }, { status: e instanceof UserError ? 422 : 500 });
  }
}
