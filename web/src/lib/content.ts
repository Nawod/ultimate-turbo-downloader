// Page copy: one source for the visible text, the FAQ/HowTo structured data and llms.txt,
// so what search engines and AI assistants read always matches what people see.
import { SITE } from './site';

export type QA = { q: string; a: string };
export type Platform = {
  slug: string; name: string; h1: string; title: string; description: string;
  answer: string; // the direct answer shown first (AEO): one short paragraph
  example: string; // example link shape
  notes: string[];
  faq: QA[];
};

const F = SITE.facts;

export const STEPS = [
  { name: 'Copy the link', text: 'Open the video in its app or website, tap Share or the ⋯ menu, and choose Copy link.' },
  { name: 'Paste it here', text: 'Paste the link into the box at the top of this page and press Get video.' },
  { name: 'Pick a quality and download', text: 'Choose a video quality or Audio, and the file downloads to your device.' },
];

export const GENERAL_FAQ: QA[] = [
  { q: 'Is Ultimate Turbo Downloader free?', a: 'Yes. The website and the browser extension are both free, with no sign-up, no watermark and no limits on file size. The project is open source under the MIT licence.' },
  { q: 'Which sites can I download videos from?', a: `Most public video sites: YouTube, Instagram, TikTok, Facebook, X (Twitter), Vimeo, Reddit, Dailymotion, Twitch clips and ${F.sites} others supported by the open-source yt-dlp project.` },
  { q: 'What is the highest quality I can download on the website?', a: `Up to ${F.webMaxQuality} MP4, plus the best audio track. For 720p and above, YouTube keeps video and sound separate, so the website joins them into one MP4 first, which takes a short moment. For 1440p, 4K and 8K, use the free browser extension.` },
  { q: 'Why is the browser extension faster?', a: `The extension downloads on your own PC with up to ${F.connections} connections at once instead of one. In our test it was ${F.speedup} faster (${F.speedNote}). It also adds pause and resume, a download button on every video, and an image grabber.` },
  { q: 'Do you keep my videos or track me?', a: 'No. Most videos stream straight from the source to your device. HD videos that need joining are held in a private temporary folder only while they are prepared, and deleted as soon as you have downloaded them (at the latest after 20 minutes). There are no accounts, no ad trackers and no analytics cookies.' },
  { q: 'Can I download private or DRM-protected videos?', a: 'No. The website only reads public videos. Private, login-only or DRM-protected content (such as Netflix or Spotify) is not supported. The extension can download videos you can see while logged in, but never breaks DRM.' },
  { q: 'Is it legal to download videos?', a: 'Downloading is legal for your own videos, public-domain or Creative Commons content, and where the site or the creator allows it. Respect copyright and each site’s terms, and download only what you have the right to.' },
  { q: 'Does it work on iPhone and Android?', a: 'Yes. The website works in any modern mobile or desktop browser. On iPhone, the file saves to the Files app (Downloads folder). The extension is for desktop Chrome, Edge and Brave.' },
];

const common = (name: string): QA[] => [
  { q: `Is the ${name} downloader free?`, a: 'Yes, free with no sign-up, no watermark and no app to install.' },
  { q: `What format are ${name} downloads?`, a: 'Video downloads as MP4 (or WebM when that is all the site offers). Audio downloads as M4A or WebM audio, which plays on phones, computers and in music apps.' },
];

export const PLATFORMS: Platform[] = [
  {
    slug: 'youtube-video-downloader', name: 'YouTube', h1: 'YouTube Video Downloader',
    title: 'YouTube Video Downloader – Free, No Sign-up (MP4 & Audio)',
    description: 'Download YouTube videos and Shorts as MP4 or audio, free. Paste the link and pick a quality, up to 1080p. For 4K, use the free extension.',
    answer: 'To download a YouTube video, copy its link (Share → Copy link), paste it into the box above and press Get video, then choose a quality. The website gives you MP4 up to 1080p and the audio track. For 1440p, 4K or 8K, use the free browser extension.',
    example: 'https://www.youtube.com/watch?v=…  or  https://youtu.be/…  or  youtube.com/shorts/…',
    notes: ['Works for normal videos, Shorts and public live replays.', 'Age-restricted or members-only videos need the browser extension, which uses your own login.', 'Playlists: paste one video at a time.'],
    faq: [
      { q: 'How do I download YouTube Shorts?', a: 'Copy the Short’s link (Share → Copy link) and paste it into the box. Shorts download as vertical MP4.' },
      { q: 'Can I download YouTube videos in 1080p or 4K?', a: '1080p, yes: pick 1080p and the website joins YouTube’s separate video and sound into one MP4, which takes a short moment, then the download starts by itself. For 1440p, 4K and 8K, use the free browser extension, which does the merge on your PC.' },
      { q: 'Can I download only the audio from a YouTube video?', a: 'Yes. Choose Audio to download the best audio track as M4A.' },
      ...common('YouTube'),
    ],
  },
  {
    slug: 'instagram-reels-downloader', name: 'Instagram', h1: 'Instagram Reels & Video Downloader',
    title: 'Instagram Reels Downloader – Download Reels & Videos Free',
    description: 'Download Instagram Reels and video posts as MP4, free and without login. Paste the Reel link and save it. Stories work with the free browser extension.',
    answer: 'To download an Instagram Reel, open it, tap ⋯ or the paper-plane icon, choose Copy link, paste it into the box above and press Get video. Public Reels and video posts download as MP4. Stories and private accounts need you to be logged in, which the free browser extension handles with your own login.',
    example: 'https://www.instagram.com/reel/…  or  https://www.instagram.com/p/…',
    notes: ['Public Reels and video posts work on the website.', 'Stories, highlights and private accounts: use the browser extension.', 'Photo-only posts: use the extension’s image grabber.'],
    faq: [
      { q: 'Can I download Instagram Stories?', a: 'Stories are only visible when logged in, so the website can’t read them. The free browser extension downloads Stories you can see, using your own login.' },
      { q: 'Does the Reel download include music?', a: 'Yes. Reels download with their original sound.' },
      ...common('Instagram'),
    ],
  },
  {
    slug: 'tiktok-video-downloader', name: 'TikTok', h1: 'TikTok Video Downloader',
    title: 'TikTok Video Downloader – Save TikToks as MP4 Free',
    description: 'Download TikTok videos as MP4 for free. Paste the TikTok link, pick a quality and save it. No app, no sign-up.',
    answer: 'To download a TikTok video, tap Share → Copy link in the TikTok app, paste the link into the box above and press Get video, then pick a quality. The video downloads as MP4.',
    example: 'https://www.tiktok.com/@user/video/…  or  https://vm.tiktok.com/…',
    notes: ['Short share links (vm.tiktok.com) work too.', 'Private TikToks can’t be downloaded.'],
    faq: [
      { q: 'Can I download TikTok audio only?', a: 'Yes, when TikTok provides a separate audio track. Choose Audio.' },
      ...common('TikTok'),
    ],
  },
  {
    slug: 'facebook-video-downloader', name: 'Facebook', h1: 'Facebook Video Downloader',
    title: 'Facebook Video Downloader – Download FB Videos & Reels Free',
    description: 'Download public Facebook videos and Reels as MP4 for free. Paste the link and save. Private, group and story videos work with the free browser extension.',
    answer: 'To download a Facebook video, click the ⋯ or Share button on the video, choose Copy link, paste it into the box above and press Get video. Public videos and Reels download as MP4. Videos from private groups, friends-only posts and Stories need your login, so use the free browser extension.',
    example: 'https://www.facebook.com/…/videos/…  or  https://fb.watch/…  or  facebook.com/reel/…',
    notes: ['Public pages’ videos and Reels work on the website.', 'Group, friends-only and Story videos: use the browser extension.'],
    faq: [
      { q: 'Can I download Facebook Stories?', a: 'Not on the website. The browser extension can download Stories you can see while logged in.' },
      ...common('Facebook'),
    ],
  },
  {
    slug: 'twitter-x-video-downloader', name: 'X (Twitter)', h1: 'X (Twitter) Video Downloader',
    title: 'Twitter / X Video Downloader – Download X Videos Free',
    description: 'Download videos and GIFs from X (Twitter) posts as MP4 for free. Paste the post link and save the video in the best available quality.',
    answer: 'To download a video from X (Twitter), click Share on the post, choose Copy link, paste it into the box above and press Get video. The video downloads as MP4 in the qualities X provides.',
    example: 'https://x.com/user/status/…  or  https://twitter.com/user/status/…',
    notes: ['GIFs on X are short MP4 videos, and download the same way.', 'Protected accounts can’t be downloaded.'],
    faq: [
      { q: 'Does it work with x.com and twitter.com links?', a: 'Yes, both link styles work.' },
      ...common('X (Twitter)'),
    ],
  },
  {
    slug: 'vimeo-video-downloader', name: 'Vimeo', h1: 'Vimeo Video Downloader',
    title: 'Vimeo Video Downloader – Download Vimeo Videos Free',
    description: 'Download public Vimeo videos as MP4 for free. Paste the Vimeo link and choose a quality.',
    answer: 'To download a Vimeo video, copy its address from the browser or the Share button, paste it into the box above and press Get video, then choose a quality.',
    example: 'https://vimeo.com/123456789',
    notes: ['Password-protected and private Vimeo videos aren’t supported.'],
    faq: [...common('Vimeo')],
  },
  {
    slug: 'reddit-video-downloader', name: 'Reddit', h1: 'Reddit Video Downloader',
    title: 'Reddit Video Downloader – Download Reddit Videos with Sound',
    description: 'Download Reddit videos as MP4 for free. Paste the post link to save the video. For merged video+sound at the highest quality, use the free browser extension.',
    answer: 'To download a Reddit video, copy the post’s link (Share → Copy link), paste it into the box above and press Get video. Reddit stores sound separately for many videos; when only silent single files are available, the free browser extension downloads the full video with sound.',
    example: 'https://www.reddit.com/r/…/comments/…',
    notes: ['Reddit often keeps video and sound in separate files; the extension merges them.'],
    faq: [...common('Reddit')],
  },
];

export const EXTENSION_FEATURES = [
  { t: `${F.connections} connections per download`, d: `Splits every file into ${F.connections} parts and downloads them at once. ${F.speedup} faster in our test (${F.speedNote}).` },
  { t: '4K and 8K video', d: 'Merges YouTube’s separate high-quality video and audio streams on your PC, at any resolution.' },
  { t: 'A download button on every video', d: 'Hover any video on any site and click ⬇ Download video. Pick a quality or MP3.' },
  { t: 'Pause and resume anything', d: 'Even after a restart. Unfinished pieces stay hidden until the file is complete.' },
  { t: 'Uses your own login', d: 'Download Stories, private groups and members-only videos you can already see.' },
  { t: 'Image grabber', d: 'Every image on a page at full size, filtered by size and type.' },
];
