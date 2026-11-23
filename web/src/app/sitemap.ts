import type { MetadataRoute } from 'next';
import { ADULT_PLATFORMS, PLATFORMS } from '@/lib/content';
import { SITE, abs } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(SITE.updated);
  return [
    { url: abs('/'), lastModified, changeFrequency: 'weekly', priority: 1 },
    ...PLATFORMS.map((p) => ({ url: abs(`/${p.slug}`), lastModified, changeFrequency: 'monthly' as const, priority: 0.9 })),
    { url: abs('/adult'), lastModified, changeFrequency: 'monthly', priority: 0.7 },
    ...ADULT_PLATFORMS.map((p) => ({ url: abs(`/adult/${p.slug}`), lastModified, changeFrequency: 'monthly' as const, priority: 0.6 })),
    { url: abs('/browser-extension'), lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: abs('/privacy'), lastModified, changeFrequency: 'yearly', priority: 0.2 },
    { url: abs('/terms'), lastModified, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
