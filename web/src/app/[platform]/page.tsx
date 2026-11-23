import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Downloader from '@/components/Downloader';
import JsonLd from '@/components/JsonLd';
import { ExtensionPromo, Faq, SiteLinks, Steps } from '@/components/Sections';
import { PLATFORMS } from '@/lib/content';
import { breadcrumbLd, faqLd, howToLd, webAppLd } from '@/lib/schema';
import { SITE } from '@/lib/site';

type Props = { params: Promise<{ platform: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return PLATFORMS.map((p) => ({ platform: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { platform } = await params;
  const p = PLATFORMS.find((x) => x.slug === platform);
  if (!p) return {};
  const path = `/${p.slug}`;
  return {
    title: { absolute: p.title },
    description: p.description,
    alternates: { canonical: path },
    openGraph: { url: path, title: p.title, description: p.description, type: 'website', siteName: SITE.name, images: [SITE.ogImage] },
    twitter: { card: 'summary_large_image', title: p.title, description: p.description, images: [SITE.ogImage.url] },
  };
}

export default async function PlatformPage({ params }: Props) {
  const { platform } = await params;
  const p = PLATFORMS.find((x) => x.slug === platform);
  if (!p) notFound();
  const path = `/${p.slug}`;
  return (
    <>
      <section className="hero">
        <div className="wrap hero-in">
          <nav aria-label="Breadcrumb" className="crumbs rise" style={{ ['--d' as string]: 0 }}>
            <Link href="/">Video downloader</Link><span aria-hidden="true">/</span><span aria-current="page">{p.name}</span>
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
          {p.notes.map((n, i) => <div key={i}><dt>{i === 0 ? 'Good to know' : ' '}</dt><dd>{n}</dd></div>)}
        </dl>
      </section>

      <Steps title={`How to download a ${p.name} video in 3 steps`} />
      <ExtensionPromo compact />
      <Faq items={p.faq} title={`${p.name} downloader questions`} />
      <SiteLinks current={p.slug} />
      <JsonLd data={[
        webAppLd(path, `${p.h1} – ${SITE.name}`),
        howToLd(`How to download a ${p.name} video`, path),
        faqLd(p.faq),
        breadcrumbLd([['Video downloader', '/'], [p.h1, path]]),
      ]} />
    </>
  );
}
