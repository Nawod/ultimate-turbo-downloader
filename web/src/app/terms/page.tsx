import type { Metadata } from 'next';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms & copyright', description: 'Terms of use and copyright policy for Ultimate Turbo Downloader.',
  alternates: { canonical: '/terms' },
};

export default function Terms() {
  return (
    <article className="sec wrap prose">
      <p className="mono-label">Updated {SITE.updated}</p>
      <h1 className="h1 h1-sm">Terms &amp; copyright</h1>
      <h2>Use it responsibly</h2>
      <p>Ultimate Turbo Downloader is a tool. You are responsible for what you download with it. Download only content you have the right to: your own videos, public-domain or Creative Commons works, or content whose owner or platform allows downloading. Respect copyright and each website’s terms of service.</p>
      <h2>Adult content</h2>
      <p>The downloader works with adult (18+) sites. You must be an adult where you live to use it for that. Never download, keep or share content made or published without the consent of the people in it, or any content involving minors. Report such content to the site hosting it and, where it applies, to the authorities.</p>
      <h2>What isn’t supported</h2>
      <p>The service does not bypass DRM, paywalls, passwords or private-account protections, and it doesn’t download private videos. Abuse (automated scraping, overloading the service) is rate-limited and may be blocked.</p>
      <h2>No warranty</h2>
      <p>The service is provided free and “as is”, without warranty of any kind. Sites change often; some links may stop working temporarily.</p>
      <h2>Copyright complaints</h2>
      <p>We don’t host or keep any videos: files stream from the original site, and HD files that need joining exist only briefly in a temporary folder until they’re downloaded. If you believe the service is being used to infringe your rights, contact us through <a href={SITE.author.url}>{SITE.author.url.replace('https://', '')}</a> with the details, and we’ll review and act promptly (for example, by blocking a URL).</p>
      <h2>Independence</h2>
      <p>Ultimate Turbo Downloader is an independent open-source project. It is not affiliated with YouTube, Google, Meta, Instagram, Facebook, TikTok, X, Vimeo, Reddit or Internet Download Manager. All trademarks belong to their owners.</p>
    </article>
  );
}
