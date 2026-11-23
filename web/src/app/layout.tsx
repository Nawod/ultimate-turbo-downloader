import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Figtree, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import { SITE, abs } from '@/lib/site';
import { PLATFORMS } from '@/lib/content';
import JsonLd from '@/components/JsonLd';
import { websiteLd, personRef } from '@/lib/schema';
import './globals.css';

// Self-hosted at build time: no requests to Google from visitors' browsers.
const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--f-display', display: 'swap' });
const body = Figtree({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--f-body', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--f-mono', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} – Free Online Video Downloader`, template: `%s | ${SITE.shortName}` },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.author.name, url: SITE.author.url }],
  creator: SITE.author.name,
  keywords: ['video downloader', 'online video downloader', 'youtube downloader', 'instagram reels downloader', 'tiktok downloader', 'facebook video downloader', 'twitter video downloader', 'download manager', 'browser extension'],
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: SITE.name, locale: SITE.locale, url: '/', title: `${SITE.name} – Free Online Video Downloader`, description: SITE.description },
  twitter: { card: 'summary_large_image', title: `${SITE.name} – Free Online Video Downloader`, description: SITE.description },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f6f4ee' }, { media: '(prefers-color-scheme: dark)', color: '#0d0f14' }],
  width: 'device-width', initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="top">
          <div className="wrap top-in">
            <Link href="/" className="brand" aria-label={`${SITE.name} home`}>
              <svg width="30" height="30" viewBox="0 0 16 16" aria-hidden="true"><rect width="16" height="16" rx="3.5" fill="var(--accent)" /><polygon points="5.6,2.8 10.4,2.8 10.4,7.2 13.2,7.2 8,12.4 2.8,7.2 5.6,7.2" fill="#fff" /><rect x="3.2" y="13.2" width="9.6" height="1.3" fill="#fff" /></svg>
              <span>Ultimate <b>Turbo</b> Downloader</span>
            </Link>
            <nav aria-label="Main" className="nav">
              <Link href="/#how">How it works</Link>
              <Link href="/#faq">FAQ</Link>
              <Link href="/browser-extension" className="nav-cta">Get the extension</Link>
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="foot">
          <div className="wrap foot-in">
            <div>
              <p className="foot-brand">Ultimate Turbo Downloader</p>
              <p className="muted">Free, open source and private. Videos go from the source to your device and are never kept on our server.</p>
              <p className="muted small"><a href={SITE.repoUrl} rel="noopener">Source on GitHub</a></p>
            </div>
            <nav aria-label="Downloaders" className="foot-col">
              <p className="mono-label">Downloaders</p>
              {PLATFORMS.map((p) => <Link key={p.slug} href={`/${p.slug}`}>{p.h1}</Link>)}
            </nav>
            <nav aria-label="More" className="foot-col">
              <p className="mono-label">More</p>
              <Link href="/browser-extension">Browser extension</Link>
              <Link href="/adult">NSFW downloader (18+)</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms &amp; copyright</Link>
              <a href={abs('/llms.txt')}>llms.txt</a>
            </nav>
          </div>
        </footer>
        <JsonLd data={[websiteLd(), { '@context': 'https://schema.org', ...personRef, sameAs: [SITE.author.url, 'https://github.com/Nawod'] }]} />
      </body>
    </html>
  );
}
