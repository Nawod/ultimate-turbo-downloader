import type { Metadata } from 'next';
import JsonLd from '@/components/JsonLd';
import { Compare, ExtensionPromo, Faq } from '@/components/Sections';
import { breadcrumbLd, extensionLd, faqLd } from '@/lib/schema';
import { SITE } from '@/lib/site';

const title = 'Free Download Manager Extension – 16 Connections, 4K';
const description = `Ultimate Turbo Downloader is a free, open-source download manager extension for Chrome, Edge and Brave: ${SITE.facts.connections} connections per file, 1080p–4K video from ${SITE.facts.sites} sites, pause and resume, and an image grabber.`;
const metaDescription = `Free, open-source download manager for Chrome, Edge & Brave: ${SITE.facts.connections} connections per file, 4K video from ${SITE.facts.sites} sites, pause & resume.`;

export const metadata: Metadata = {
  title: { absolute: title }, description: metaDescription,
  alternates: { canonical: '/browser-extension' },
  openGraph: { url: '/browser-extension', title, description: metaDescription, images: [SITE.ogImage] },
  twitter: { title, description: metaDescription, card: 'summary_large_image', images: [SITE.ogImage.url] },
};

const faq = [
  { q: 'What is the Ultimate Turbo Downloader extension?', a: description },
  { q: 'How much faster is it?', a: `It splits each file into up to ${SITE.facts.connections} parts and downloads them in parallel. In our test it was ${SITE.facts.speedup} faster than a single connection (${SITE.facts.speedNote}). The gain depends on the server: if your internet line is already full, nothing can make it faster.` },
  { q: 'Which browsers and systems does it support?', a: 'Chrome, Microsoft Edge, Brave and other Chromium browsers on Windows 10 and 11. A small helper (aria2 and yt-dlp) runs on your PC; the setup script installs it.' },
  { q: 'Is it safe?', a: 'It is open source (MIT), runs entirely on your own PC, sends no data anywhere and has no tracking. Its local helpers only accept requests from your own computer, protected by a secret.' },
  { q: 'Is it an alternative to IDM?', a: 'It works in a similar way (multi-connection downloads, a video download button, a progress window) but is free and open source. It is an independent project, not affiliated with Internet Download Manager.' },
];

export default function ExtensionPage() {
  return (
    <>
      <section className="hero">
        <div className="wrap hero-in">
          <p className="mono-label rise" style={{ ['--d' as string]: 0 }}>Chrome · Edge · Brave · free & open source</p>
          <h1 className="h1 h1-sm rise" style={{ ['--d' as string]: 1 }}>The download manager your browser was missing</h1>
          <p className="lead rise" style={{ ['--d' as string]: 2 }}>{description}</p>
          <div className="rise hero-ctas" style={{ ['--d' as string]: 3 }}>
            <a className="btn" href={SITE.extensionUrl} rel="noopener">Get the extension, free</a>
            <a className="btn-ghost" href={SITE.repoUrl} rel="noopener">View on GitHub</a>
          </div>
        </div>
      </section>
      <ExtensionPromo />
      <Compare />
      <Faq items={faq} title="About the extension" />
      <JsonLd data={[extensionLd(), faqLd(faq), breadcrumbLd([['Video downloader', '/'], ['Browser extension', '/browser-extension']])]} />
    </>
  );
}
