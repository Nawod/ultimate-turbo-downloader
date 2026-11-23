# Ultimate Turbo Downloader — website

The online companion to the browser extension: paste a video link, download it as MP4 or audio.
It also promotes the free extension (for 4K and 16-connection speed), linking to
<https://www.nawodmadhuwantha.com/tools/turbo-downloader/>.

Next.js 16 (App Router), React 19, plain CSS, and no client libraries. Every page except the two API routes
is static HTML.

## How it works

- `POST /api/info` runs `yt-dlp -J` on the pasted link and returns the title, thumbnail and
  **single-file** formats (video+audio in one file, usually up to 720p on YouTube, plus the
  best audio). Each option carries a signed, 30-minute download token.
- `GET /api/download?t=…` checks the token and streams `yt-dlp -o -` straight to the visitor.
  Nothing is written to disk.
- Higher qualities (1080p/4K) are separate video and audio streams that need merging, so the
  site sends those visitors to the extension, which merges them on their own PC.

## Safety built in

- **No SSRF:** yt-dlp runs with `--use-extractors default,-generic`, so only known video-site
  extractors are used and arbitrary URLs aren't fetched. IP-address hosts, `localhost`, single-label
  hosts and links with credentials are refused before yt-dlp runs.
- **Not an open proxy:** downloads only work with an HMAC-signed token issued by `/api/info` for
  one exact link and format.
- **Abuse limits:** 20 lookups and 12 downloads per IP per 10 minutes; at most `MAX_JOBS`
  downloads at once (default 4); 30 s lookup and 15 min download timeouts; the process is killed when the visitor
  cancels. IPs live in memory only and are swept after 10 minutes.
- Programs are run with argument arrays (never a shell), with the link always after `--`.

## SEO, GEO and AEO

- **Pages:** a home page plus a landing page per site (YouTube, Instagram, TikTok, Facebook, X,
  Vimeo, Reddit), each with a direct "quick answer", steps, notes and its own FAQ, plus an
  extension page, privacy and terms. All copy lives in `src/lib/content.ts`.
- **Structured data** (JSON-LD): WebSite, Person, WebApplication, HowTo, FAQPage, BreadcrumbList,
  and SoftwareApplication for the extension. It's generated from the same copy people see, so it never
  disagrees with the page.
- **Crawling:** `/sitemap.xml` and `/robots.txt` (AI crawlers such as GPTBot, ClaudeBot and
  PerplexityBot are explicitly allowed; `/api/` is disallowed), canonical URLs, Open Graph and
  Twitter cards with a generated share image.
- **GEO:** `/llms.txt` is a plain-text brief of the facts for AI assistants. Answers are written
  as short, quotable statements with real numbers.
- **Performance:** fonts are self-hosted at build time (no Google requests), there's one small
  client component, the content is visible without waiting for animations, and the layout works at
  phone width with no sideways scroll.
- **PWA share target:** on Android, sharing a video link to the installed site opens it with the
  link filled in.

## Run locally

Needs Node 20+, yt-dlp (with `yt-dlp[default]` for YouTube) and ffmpeg on the PATH.

```powershell
npm install
npm run build
npm start
```

Then open http://localhost:3060.

## Deploy

It needs a **real server**, because it runs yt-dlp. Vercel and other serverless hosts won't work. The
Dockerfile bundles yt-dlp and ffmpeg and runs on Render, Railway, Fly.io or any VPS:

```bash
docker build -t utd-web --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain.com .
docker run -d -p 3060:3060 -e TOKEN_SECRET=$(openssl rand -hex 32) --restart unless-stopped utd-web
```

| Variable | When | What |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | build | The live URL (no trailing slash). Used for canonical URLs, the sitemap, structured data and llms.txt. |
| `TOKEN_SECRET` | run | Signs download tokens. Set it so tokens survive restarts and work across instances. |
| `MAX_JOBS` | run | Simultaneous downloads (default 4). |
| `YTDLP_PATH`, `FFMPEG_DIR` | run | Only if they aren't on the PATH. |

**After deploying:**
1. Put it behind HTTPS. The host or a reverse proxy must set `X-Forwarded-For`, so rate limits apply per
   visitor.
2. Add the site to Google Search Console and Bing Webmaster Tools, and submit `/sitemap.xml`.
3. **Keep yt-dlp current:** sites change often. Rebuild the image weekly, or run
   `pip install -U "yt-dlp[default]"` in the container.
4. Watch bandwidth: every download streams through your server. Raise or lower `MAX_JOBS` to suit
   your plan.

## Legal

Downloaders are used for legitimate reasons (your own uploads, Creative Commons works, offline
viewing where allowed), but some platforms' terms prohibit downloading. The site includes a terms
page with a copyright-complaint contact, never stores files, and doesn't bypass DRM, logins or
paywalls. Running a public instance is your responsibility.
