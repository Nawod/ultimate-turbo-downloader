import type { Metadata } from 'next';
import Link from 'next/link';
import Downloader from '@/components/Downloader';
import JsonLd from '@/components/JsonLd';
import { ExtensionPromo, Faq, SiteLinks, Steps } from '@/components/Sections';
import { ADULT_HUB as H } from '@/lib/content';
import { breadcrumbLd, faqLd, howToLd, webAppLd } from '@/lib/schema';
import { SITE } from '@/lib/site';

const path = '/adult';

export const metadata: Metadata = {
  title: { absolute: H.title },
  description: H.description,
  alternates: { canonical: path },
  openGraph: { url: path, title: H.title, description: H.description, type: 'website', siteName: SITE.name, images: [SITE.ogImage] },
  twitter: { card: 'summary_large_image', title: H.title, description: H.description, images: [SITE.ogImage.url] },
  other: { rating: 'adult' }, // Google's adult label: keeps SafeSearch filtering to this section
};

export default function AdultHub() {
  return (
    <>
      <section className="hero">
        <div className="wrap hero-in">
          <nav aria-label="Breadcrumb" className="crumbs rise" style={{ ['--d' as string]: 0 }}>
            <Link href="/">Video downloader</Link><span aria-hidden="true"> / </span><span aria-current="page">18+</span>
          </nav>
          <h1 className="h1 h1-sm rise" style={{ ['--d' as string]: 1 }}>{H.h1}</h1>
          <p className="lead rise" style={{ ['--d' as string]: 2 }}>{H.description}</p>
          <div className="rise" style={{ ['--d' as string]: 3 }}><Downloader placeholder="Paste a video link from any adult site" /></div>
        </div>
      </section>

      <section className="sec wrap answer" aria-labelledby="ans-h">
        <p className="mono-label">Quick answer</p>
        <h2 id="ans-h" className="h2">How do I download NSFW videos?</h2>
        <p className="answer-text">{H.answer}</p>
        <dl className="facts">
          <div><dt>Adults only</dt><dd>18+. Only download content you are allowed to keep, and never content shared without consent.</dd></div>
        </dl>
      </section>

      <SiteLinks adult />
      <Steps title="How to download an adult video in 3 steps" />
      <ExtensionPromo compact />
      <Faq items={H.faq} title="NSFW downloader questions" />
      <JsonLd data={[
        webAppLd(path, `${H.h1} – ${SITE.name}`),
        howToLd('How to download an NSFW video', path),
        faqLd(H.faq),
        breadcrumbLd([['Video downloader', '/'], ['18+', path]]),
      ]} />
    </>
  );
}
