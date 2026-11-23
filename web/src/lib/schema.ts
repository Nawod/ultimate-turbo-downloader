// schema.org JSON-LD builders (structured data for search engines and AI answer engines).
import { SITE, abs } from './site';
import { QA, STEPS } from './content';

export const personRef = { '@type': 'Person', name: SITE.author.name, url: SITE.author.url };

export const websiteLd = () => ({
  '@context': 'https://schema.org', '@type': 'WebSite', '@id': abs('/#website'),
  name: SITE.name, alternateName: SITE.shortName, url: abs('/'), inLanguage: 'en', publisher: personRef,
});

export const webAppLd = (path = '/', name = `${SITE.name} – Online Video Downloader`) => ({
  '@context': 'https://schema.org', '@type': 'WebApplication', '@id': abs(path) + '#app',
  name, url: abs(path), applicationCategory: 'MultimediaApplication', operatingSystem: 'Any (web browser)',
  browserRequirements: 'Requires JavaScript and a modern browser.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  isAccessibleForFree: true, author: personRef, dateModified: SITE.updated,
  description: SITE.description,
  featureList: ['Download videos from YouTube, Instagram, TikTok, Facebook, X, Vimeo, Reddit and 1,800+ sites', 'MP4 video up to 1080p and audio downloads', 'No sign-up, no watermark', 'Files are deleted right after download'],
});

export const extensionLd = () => ({
  '@context': 'https://schema.org', '@type': 'SoftwareApplication', '@id': abs('/browser-extension') + '#ext',
  name: `${SITE.name} browser extension`, applicationCategory: 'BrowserApplication', applicationSubCategory: 'Download manager',
  operatingSystem: 'Windows 10, Windows 11 (Chrome, Edge, Brave)', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  downloadUrl: SITE.extensionUrl, installUrl: SITE.extensionUrl, url: abs('/browser-extension'), softwareHelp: SITE.repoUrl,
  license: 'https://opensource.org/licenses/MIT', author: personRef, isAccessibleForFree: true,
  featureList: [`${SITE.facts.connections} connections per download`, '1080p, 4K and 8K video', 'Pause and resume', 'Download button on every video', 'Image grabber', 'Works with your own login'],
});

export const faqLd = (qa: QA[]) => ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: qa.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
});

export const howToLd = (name: string, path: string) => ({
  '@context': 'https://schema.org', '@type': 'HowTo', name, totalTime: 'PT1M',
  tool: [{ '@type': 'HowToTool', name: 'A web browser' }],
  step: STEPS.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text, url: `${abs(path)}#step-${i + 1}` })),
});

export const breadcrumbLd = (items: [string, string][]) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })),
});
