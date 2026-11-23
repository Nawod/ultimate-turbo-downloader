import Downloader from '@/components/Downloader';
import JsonLd from '@/components/JsonLd';
import { Compare, ExtensionPromo, Faq, SiteLinks, Steps } from '@/components/Sections';
import { GENERAL_FAQ } from '@/lib/content';
import { faqLd, howToLd, webAppLd } from '@/lib/schema';
import { SITE } from '@/lib/site';

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap hero-in">
          <p className="mono-label rise" style={{ ['--d' as string]: 0 }}>Online video downloader · free</p>
          <h1 className="h1 rise" style={{ ['--d' as string]: 1 }}>Paste a link.<br /><span className="accent-text">Get the video.</span></h1>
          {/* the one-sentence answer: what this is, for people and for answer engines */}
          <p className="lead rise" style={{ ['--d' as string]: 2 }}>
            Ultimate Turbo Downloader is a free online video downloader: paste a link from YouTube, Instagram, TikTok, Facebook, X or {SITE.facts.sites} other sites and download it as MP4 or audio, with no sign-up and no watermark.
          </p>
          <div className="rise" style={{ ['--d' as string]: 3 }}><Downloader /></div>
        </div>
      </section>
      <Steps />
      <SiteLinks />
      <ExtensionPromo />
      <Compare />
      <Faq items={GENERAL_FAQ} />
      <JsonLd data={[webAppLd('/'), howToLd('How to download a video online', '/'), faqLd(GENERAL_FAQ)]} />
    </>
  );
}
