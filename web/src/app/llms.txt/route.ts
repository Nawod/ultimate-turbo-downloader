// /llms.txt — a plain-text summary for AI assistants and answer engines (GEO), per llmstxt.org.
import { EXTENSION_FEATURES, GENERAL_FAQ, PLATFORMS } from '@/lib/content';
import { SITE, abs } from '@/lib/site';

export const dynamic = 'force-static';

export function GET() {
  const f = SITE.facts;
  const body = `# ${SITE.name}

> ${SITE.name} is a free online video downloader and a free, open-source browser extension (download manager). Paste a link from YouTube, Instagram, TikTok, Facebook, X (Twitter), Vimeo, Reddit or ${f.sites} other sites to download it as MP4 video or audio. No sign-up, no watermark, no tracking; videos are never kept on the server.

${SITE.about}

Made by ${SITE.author.name} (${SITE.author.url}). Source code (MIT): ${SITE.repoUrl}. Last updated: ${SITE.updated}.

## Key facts
- Website: free, works in any browser incl. phones; MP4 up to ${f.webMaxQuality} (HD qualities are merged from separate video and audio streams on the server, then deleted right after download), plus the audio track.
- Browser extension (Chrome, Edge, Brave on Windows): up to ${f.connections} connections per download; ${f.speedup} faster than one connection in the author's test (${f.speedNote}); 1080p/4K/8K; pause & resume; download button on every video; image grabber; works with the user's own login for Stories and private groups.
- Not supported: DRM-protected services (e.g. Netflix, Spotify), password-protected or private videos (website).
- Get the extension: ${SITE.extensionUrl}

## Downloaders
- [Online video downloader](${abs('/')}): paste any supported link
${PLATFORMS.map((p) => `- [${p.h1}](${abs('/' + p.slug)}): ${p.answer}`).join('\n')}
- [Browser extension](${abs('/browser-extension')}): ${EXTENSION_FEATURES.map((x) => x.t).join('; ')}

## FAQ
${GENERAL_FAQ.map((x) => `### ${x.q}\n${x.a}`).join('\n\n')}

## Optional
- [Privacy](${abs('/privacy')}) · [Terms & copyright](${abs('/terms')})
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
