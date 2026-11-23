// One landing-page layout for every site (/youtube-video-downloader, /adult/pornhub-video-downloader…).
import type { Metadata } from 'next';
import Link from 'next/link';
import Downloader from '@/components/Downloader';
import JsonLd from '@/components/JsonLd';
import { ExtensionPromo, Faq, SiteLinks, Steps } from '@/components/Sections';
import type { Platform } from '@/lib/content';
import { breadcrumbLd, faqLd, howToLd, webAppLd } from '@/lib/schema';
import { SITE } from '@/lib/site';

const ADULT_BASE = '/adult';

export function platformPath(p: Platform, adult = false) {
  return `${adult ? ADULT_BASE : ''}/${p.slug}`;
}

export function platformMetadata(p: Platform, adult = false): Metadata {
  const path = platformPath(p, adult);
  return {
    title: { absolute: p.title },
    description: p.description,
    alternates: { canonical: path },
    openGraph: { url: path, title: p.title, description: p.description, type: 'website', siteName: SITE.name, images: [SITE.ogImage] },
    twitter: { card: 'summary_large_image', title: p.title, description: p.description, images: [SITE.ogImage.url] },
    // Google: label adult pages so SafeSearch filters only these, not the whole site.
    ...(adult ? { other: { rating: 'adult' } } : {}),
  };
}

export default function PlatformView({ p, adult = false }: { p: Platform; adult?: boolean }) {
  const path = platformPath(p, adult);
  const crumbs: [string, string][] = adult
    ? [['Video downloader', '/'], ['18+', ADULT_BASE], [p.h1, path]]
    : [['Video downloader', '/'], [p.h1, path]];
  return (
    <>
      <section className="hero">
        <div className="wrap hero-in">
          <nav aria-label="Breadcrumb" className="crumbs rise" style={{ ['--d' as string]: 0 }}>
            {crumbs.slice(0, -1).map(([n, href]) => (
              <span key={href}><Link href={href}>{n}</Link><span aria-hidden="true"> / </span></span>
            ))}
            <span aria-current="page">{p.name}</span>
          </nav>
          <h1 className="h1 h1-sm rise" style={{ ['--d' as string]: 1 }}>{p.h1}</h1>
          <p className="lead rise" style={{ ['--d' as string]: 2 }}>{p.description}</p>
          <div className="rise" style={{ ['--d' as string]: 3 }}><Downloader placeholder={`Paste a ${p.name} link`} /></div>
        </div>
      </section>

      <section className="sec wrap answer" aria-labelledby="ans-h">
        <p className="mono-label">Quick answer</p>
        <h2 id="ans-h" className="h2">How do I download from {p.name}?</h2>
        <p className="answer-text">{p.answer}</p>
        <dl className="facts">
          <div><dt>Link looks like</dt><dd><code>{p.example}</code></dd></div>
          {p.notes.map((n, i) => <div key={i}><dt>{i === 0 ? 'Good to know' : ' '}</dt><dd>{n}</dd></div>)}
          {adult && <div><dt>Adults only</dt><dd>18+. Only download content you are allowed to keep, and never content shared without consent.</dd></div>}
        </dl>
      </section>

      <Steps title={`How to download a ${p.name} video in 3 steps`} />
      <ExtensionPromo compact />
      <Faq items={p.faq} title={`${p.name} downloader questions`} />
      <SiteLinks current={p.slug} adult={adult} />
      <JsonLd data={[
        webAppLd(path, `${p.h1} – ${SITE.name}`),
        howToLd(`How to download a ${p.name} video`, path),
        faqLd(p.faq),
        breadcrumbLd(crumbs),
      ]} />
    </>
  );
}
