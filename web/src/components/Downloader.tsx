'use client';
// The paste box → video card → download options. The only client-side script on the page.
import { useEffect, useRef, useState } from 'react';

type Option = { id: string; label: string; kind: 'video' | 'audio'; ext: string; height?: number; size?: number; merge?: boolean; token: string };
type Prep = { token: string; pct: number; error?: string };
type Info = { title: string; site: string; thumbnail?: string; duration?: number; uploader?: string; options: Option[]; needsExtension: boolean };

const EXT_URL = 'https://www.nawodmadhuwantha.com/tools/turbo-downloader/';
const mb = (n?: number) => (n ? (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${Math.max(0.1, n / 1e6).toFixed(n < 1e7 ? 1 : 0)} MB`) : '');
const time = (s?: number) => {
  if (!s) return '';
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};

export default function Downloader({ placeholder = 'Paste a video link — YouTube, Instagram, TikTok, Facebook, X…' }: { placeholder?: string }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState<Info | null>(null);
  const [canPaste, setCanPaste] = useState(false);
  const [prep, setPrep] = useState<Prep | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const run = useRef(0); // cancels an older prepare loop when a new one starts

  // HD (720p+): the server downloads the separate video + audio and merges them, then we fetch the file.
  async function prepare(o: Option) {
    const my = ++run.current;
    setPrep({ token: o.token, pct: 0 });
    const stop = (error: string) => { if (run.current === my) setPrep({ token: o.token, pct: 0, error }); };
    try {
      const r = await fetch('/api/prepare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: o.token }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.id) return stop(j.error || 'Something went wrong. Please try again.');
      for (let misses = 0; run.current === my;) {
        await new Promise((res) => setTimeout(res, 1000));
        const s = await fetch(`/api/prepare?id=${encodeURIComponent(j.id)}`, { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
        if (run.current !== my) return;
        if (!s) { if (++misses > 5) return stop('Lost connection to the server. Please try again.'); continue; }
        if (s.state === 'error') return stop(s.error || 'We couldn’t prepare that video.');
        if (s.state === 'ready') {
          const a = document.createElement('a');
          a.href = `/api/download?j=${encodeURIComponent(j.id)}`; a.download = ''; a.rel = 'nofollow';
          document.body.appendChild(a); a.click(); a.remove();
          setPrep({ token: o.token, pct: 100 });
          setTimeout(() => { if (run.current === my) setPrep(null); }, 4000);
          return;
        }
        setPrep({ token: o.token, pct: s.pct || 0 });
      }
    } catch { stop('Something went wrong. Please try again.'); }
  }

  useEffect(() => {
    setCanPaste(typeof navigator !== 'undefined' && !!navigator.clipboard?.readText);
    const shared = new URLSearchParams(location.search).get('url'); // share-target / deep link: ?url=
    if (shared) setUrl(shared);
  }, []);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const link = url.trim();
    if (!link) { input.current?.focus(); setError('Paste a video link first.'); return; }
    setBusy(true); setError(''); setInfo(null); run.current++; setPrep(null);
    try {
      const r = await fetch('/api/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: link }) });
      const j = await r.json().catch(() => ({ error: 'Something went wrong. Please try again.' }));
      if (!r.ok) throw new Error(j.error || 'Something went wrong.');
      setInfo(j);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function paste() {
    try { const t = await navigator.clipboard.readText(); if (t) { setUrl(t.trim()); setError(''); } } catch { input.current?.focus(); }
  }

  const videos = info?.options.filter((o) => o.kind === 'video') || [];
  const audio = info?.options.find((o) => o.kind === 'audio');

  return (
    <div className="dl" data-busy={busy || undefined}>
      <div className="lanes" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ ['--i' as string]: i }} />)}</div>
      <form className="dl-form" onSubmit={submit} role="search" aria-label="Download a video">
        <label htmlFor="video-url" className="sr-only">Video link</label>
        <input
          id="video-url" ref={input} type="url" inputMode="url" autoComplete="off" spellCheck={false}
          placeholder={placeholder} value={url} onChange={(e) => setUrl(e.target.value)} required
          aria-invalid={!!error || undefined} aria-describedby={error ? 'dl-error' : undefined}
        />
        {canPaste && !url && <button type="button" className="dl-paste" onClick={paste}>Paste</button>}
        {url && !busy && <button type="button" className="dl-clear" aria-label="Clear" onClick={() => { setUrl(''); setInfo(null); setError(''); input.current?.focus(); }}>×</button>}
        <button type="submit" className="dl-go" disabled={busy}>{busy ? <span className="spin" aria-label="Loading" /> : 'Get video'}</button>
      </form>

      <p className="dl-hint">Free · up to 1080p · no sign-up · no watermark · nothing kept on our server</p>

      <div aria-live="polite">
        {error && <p id="dl-error" className="dl-error" role="alert">{error}</p>}
        {info && (
          <article className="card">
            <div className="card-media">
              {info.thumbnail ? <img src={info.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="card-noimg" />}
              {info.duration ? <span className="card-time">{time(info.duration)}</span> : null}
            </div>
            <div className="card-body">
              <p className="mono-label">{info.site || 'Video'}{info.uploader ? ` · ${info.uploader}` : ''}</p>
              <h2 className="card-title">{info.title}</h2>
              <div className="opts">
                {videos.map((o) => {
                  const cls = `opt${o === videos[0] ? ' opt-main' : ''}`;
                  const meta = <span className="opt-m">{o.ext.toUpperCase()}{o.size ? ` · ${mb(o.size)}` : ''}{o.merge ? ' · HD' : ''}</span>;
                  if (!o.merge) return (
                    <a key={o.token} className={cls} href={`/api/download?t=${encodeURIComponent(o.token)}`} download rel="nofollow">
                      <span className="opt-q">{o.label}</span>{meta}
                    </a>
                  );
                  const mine = prep?.token === o.token && !prep.error;
                  return (
                    <button key={o.token} type="button" className={cls} onClick={() => prepare(o)} disabled={mine} aria-busy={mine || undefined}
                      style={mine ? { ['--p' as string]: `${prep!.pct}%` } : undefined} data-prep={mine || undefined}>
                      <span className="opt-q">{o.label}</span>
                      {mine ? <span className="opt-m">{prep!.pct >= 100 ? 'Downloading…' : prep!.pct >= 98 ? 'Merging…' : `Preparing ${Math.floor(prep!.pct)}%`}</span> : meta}
                    </button>
                  );
                })}
                {audio && (
                  <a className="opt" href={`/api/download?t=${encodeURIComponent(audio.token)}`} download rel="nofollow">
                    <span className="opt-q">Audio</span><span className="opt-m">{audio.ext.toUpperCase()}{audio.size ? ` · ${mb(audio.size)}` : ''}</span>
                  </a>
                )}
              </div>
              {prep?.error && <p className="dl-error" role="alert">{prep.error}</p>}
              {prep && !prep.error && prep.pct < 100 && <p className="muted small">HD video and sound come separately, so we’re joining them into one MP4. Your download starts by itself. Keep this tab open.</p>}
              {!videos.length && !audio && <p className="muted">This video can’t be downloaded on the website. The browser extension can save it.</p>}
              {info.needsExtension && (
                <a className="upsell" href={EXT_URL} rel="noopener">
                  <b>Want 4K or faster downloads?</b>
                  <span>This video has qualities above 1080p. The free browser extension gets them, with 16 connections. →</span>
                </a>
              )}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
