import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

// Installable, and on Android it appears in the share sheet: share a video link → the site opens with it filled in.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} – Video Downloader`, short_name: 'Turbo DL', description: SITE.description,
    start_url: '/', display: 'standalone', background_color: '#f6f4ee', theme_color: '#2457f5',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
    share_target: { action: '/', method: 'GET', params: { url: 'url', text: 'url' } },
  } as MetadataRoute.Manifest;
}
