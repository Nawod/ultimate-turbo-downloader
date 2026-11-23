import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="sec wrap prose">
      <p className="mono-label">404</p>
      <h1 className="h1 h1-sm">This page took the slow lane.</h1>
      <p>It doesn’t exist. Head back and paste a video link instead.</p>
      <p><Link href="/" className="btn">Go to the downloader</Link></p>
    </section>
  );
}
