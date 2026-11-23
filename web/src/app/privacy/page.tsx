import type { Metadata } from 'next';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy', description: 'What Ultimate Turbo Downloader does and doesn’t collect: no accounts, no analytics cookies, no videos kept.',
  alternates: { canonical: '/privacy' },
};

export default function Privacy() {
  return (
    <article className="sec wrap prose">
      <p className="mono-label">Updated {SITE.updated}</p>
      <h1 className="h1 h1-sm">Privacy</h1>
      <p>Short version: we don’t want your data, and we don’t keep your videos.</p>
      <h2>What happens when you download</h2>
      <p>When you paste a link, our server asks the video site for that video’s details and download options, then streams the file you choose straight to your device, passing through the server’s memory only. HD qualities (720p and up) arrive from the site as separate video and sound, so the server joins them into one MP4 in a private temporary folder first. That file can only be fetched with a random one-time link and is <b>deleted as soon as you’ve downloaded it</b>, or after 20 minutes at the latest. We never keep copies.</p>
      <h2>What we collect</h2>
      <ul>
        <li><b>No accounts</b>, no sign-up, no email.</li>
        <li><b>No analytics or advertising cookies</b>, no tracking pixels and no fingerprinting.</li>
        <li>Your IP address is held <b>in memory for up to 10 minutes</b> to rate-limit abuse, then forgotten. It isn’t logged or shared.</li>
        <li>Our hosting provider may keep standard server access logs for security, as every website host does.</li>
      </ul>
      <h2>The browser extension</h2>
      <p>The extension runs entirely on your own PC and sends nothing to us. Its source code is public on <a href={SITE.repoUrl}>GitHub</a>.</p>
      <h2>Contact</h2>
      <p>Questions: <a href={SITE.author.url}>{SITE.author.url.replace('https://', '')}</a>.</p>
    </article>
  );
}
