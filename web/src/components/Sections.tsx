// Server-rendered page sections: steps, extension promo, FAQ, site links.
import Link from 'next/link';
import { SITE } from '@/lib/site';
import { EXTENSION_FEATURES, PLATFORMS, ADULT_PLATFORMS, QA, STEPS } from '@/lib/content';

export function Steps({ title = 'How to download a video' }: { title?: string }) {
  return (
    <section id="how" className="sec wrap" aria-labelledby="how-h">
      <p className="mono-label">How it works</p>
      <h2 id="how-h" className="h2">{title}</h2>
      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s.name} id={`step-${i + 1}`}>
            <span className="step-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <h3>{s.name}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ExtensionPromo({ compact = false }: { compact?: boolean }) {
  const f = SITE.facts;
  return (
    <section className="promo" aria-labelledby="promo-h">
      <div className="wrap promo-in">
        <div className="promo-copy">
          <p className="mono-label on-dark">Free browser extension</p>
          <h2 id="promo-h" className="h2 on-dark">Sixteen lanes.<br /><span className="accent-text">One click.</span></h2>
          <p className="promo-lead">The website downloads one file at a time. The extension downloads on your own PC with up to {f.connections} connections, in up to 4K, from any video on any site, with pause and resume.</p>
          <div className="promo-stat"><b>{f.speedup}</b><span>faster in our test<br /><small>{f.speedNote}</small></span></div>
          <a className="btn-light" href={SITE.extensionUrl} rel="noopener">Get the extension, free</a>
          <p className="promo-note">Chrome, Edge and Brave on Windows · open source (MIT)</p>
        </div>
        {!compact && (
          <ul className="promo-grid">
            {EXTENSION_FEATURES.map((x) => (<li key={x.t}><h3>{x.t}</h3><p>{x.d}</p></li>))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function Compare() {
  const rows: [string, string, string][] = [
    ['Price', 'Free', 'Free'],
    ['Install', 'Nothing', 'Browser extension + small helper'],
    ['Max video quality', `Up to ${SITE.facts.webMaxQuality}`, 'Up to 4K and 8K'],
    ['HD downloads start', 'After a short prepare step', 'Instantly, on your own PC'],
    ['Download speed', '1 connection', `Up to ${SITE.facts.connections} connections`],
    ['Private / Stories / members-only', 'No', 'Yes, with your own login'],
    ['Pause & resume', 'No', 'Yes'],
    ['Works on phones', 'Yes', 'No (desktop)'],
  ];
  return (
    <section className="sec wrap" aria-labelledby="cmp-h">
      <p className="mono-label">Website or extension?</p>
      <h2 id="cmp-h" className="h2">Pick what fits</h2>
      <div className="table-wrap">
        <table className="cmp">
          <thead><tr><th scope="col"></th><th scope="col">Website</th><th scope="col">Extension</th></tr></thead>
          <tbody>{rows.map(([a, b, c]) => <tr key={a}><th scope="row">{a}</th><td>{b}</td><td>{c}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

export function Faq({ items, title = 'Questions & answers' }: { items: QA[]; title?: string }) {
  return (
    <section id="faq" className="sec wrap" aria-labelledby="faq-h">
      <p className="mono-label">FAQ</p>
      <h2 id="faq-h" className="h2">{title}</h2>
      <div className="faq">
        {items.map((x, i) => (
          <details key={x.q} open={i === 0}>
            <summary><h3>{x.q}</h3></summary>
            <p>{x.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function SiteLinks({ current, adult = false }: { current?: string; adult?: boolean }) {
  const list = adult ? ADULT_PLATFORMS : PLATFORMS;
  const base = adult ? '/adult' : '';
  return (
    <section className="sec wrap" aria-labelledby="sites-h">
      <p className="mono-label">{adult ? 'Adult sites (18+)' : 'Downloaders'}</p>
      <h2 id="sites-h" className="h2">{adult ? 'Works with these adult sites' : 'Works with the sites you use'}</h2>
      <ul className="sites">
        {list.filter((p) => p.slug !== current).map((p) => (
          <li key={p.slug}><Link href={`${base}/${p.slug}`}><b>{p.name}</b><span>{p.h1} →</span></Link></li>
        ))}
        {adult && current && <li><Link href="/adult"><b>All adult sites</b><span>NSFW video downloader →</span></Link></li>}
        <li><span className="sites-more"><b>{SITE.facts.sites}</b><span>more sites via yt-dlp</span></span></li>
      </ul>
    </section>
  );
}
