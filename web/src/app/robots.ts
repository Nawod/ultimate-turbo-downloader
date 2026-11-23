import type { MetadataRoute } from 'next';
import { abs } from '@/lib/site';

// Search engines and AI answer engines (GEO) are welcome on every page; the API is not for crawling.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/'] },
      { userAgent: ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'Bingbot'], allow: '/', disallow: ['/api/'] },
    ],
    sitemap: abs('/sitemap.xml'),
    host: abs('/'),
  };
}
