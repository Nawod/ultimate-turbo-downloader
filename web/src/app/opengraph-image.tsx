// Social share image (1200×630), generated at build time.
import { ImageResponse } from 'next/og';

export const alt = 'Ultimate Turbo Downloader – paste a link, get the video';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OG() {
  const lanes = Array.from({ length: 16 }, (_, i) => i);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#0d0f14', padding: 72, color: '#eef0f5', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 14, background: '#2457f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: '#fff' }}>↓</div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>Ultimate Turbo Downloader</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>Paste a link.</div>
          <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -4, lineHeight: 1, color: '#7c9bff' }}>Get the video.</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ fontSize: 26, color: '#a9afbd' }}>YouTube · Instagram · TikTok · Facebook · X · 1,800+ sites · free</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: 220 }}>
            {lanes.map((i) => <div key={i} style={{ height: 3, borderRadius: 2, width: `${60 + ((i * 37) % 40)}%`, background: '#2457f5', opacity: 0.4 + (i % 3) * 0.2 }} />)}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
