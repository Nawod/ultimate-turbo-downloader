// One place for everything the pages, metadata and structured data say about the site.
export const SITE = {
  name: 'Ultimate Turbo Downloader',
  shortName: 'Turbo Downloader',
  // Set NEXT_PUBLIC_SITE_URL to the live domain (no trailing slash): canonical URLs, sitemap and schema use it.
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3060').replace(/\/$/, ''),
  tagline: 'Free online video downloader',
  // meta description: ≤ 160 characters so search results show it whole
  description: 'Free online video downloader. Paste a link from YouTube, Instagram, TikTok, Facebook, X or 1,800+ sites and save it as MP4 or audio. No sign-up.',
  about:
    'Paste a video link from YouTube, Instagram, TikTok, Facebook, X and 1,800+ other sites and download it as MP4 or audio. Free, no sign-up, no tracking. For 4K and 16-connection speed, get the free browser extension.',
  ogImage: { url: '/opengraph-image', width: 1200, height: 630, alt: 'Ultimate Turbo Downloader – paste a link, get the video' },
  extensionUrl: 'https://www.nawodmadhuwantha.com/tools/turbo-downloader/',
  repoUrl: 'https://github.com/Nawod/ultimate-turbo-downloader',
  author: { name: 'Nawod Madhuwantha', url: 'https://www.nawodmadhuwantha.com' },
  locale: 'en_US',
  updated: '2026-11-23',
  // facts used in copy and structured data (all measured or documented in the project)
  facts: {
    sites: '1,800+',
    connections: 16,
    speedup: '2.3×',
    speedNote: '35.6 vs 15.6 MB/s on the same server, in our test',
    webMaxQuality: '1080p',
  },
} as const;

export const abs = (path = '/') => `${SITE.url}${path === '/' ? '' : path}`;
