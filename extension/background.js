import { getSettings, rpc, isAlive, nameOf } from './rpc.js';
import { media, cookiesTxt } from './media.js';

// ---- Hand a URL to aria2 with the browser's cookies, referrer and user agent ----
async function sendToAria2(url, { referrer = '', filename = '', connections = 0, dir = '' } = {}, settings) {
  const s = settings || (await getSettings());
  const conns = Math.min(16, Math.max(1, Number(connections || s.connections) || 8));
  const headers = [];
  try {
    const cookies = await chrome.cookies.getAll({ url });
    if (cookies.length) headers.push('Cookie: ' + cookies.map((c) => `${c.name}=${c.value}`).join('; '));
  } catch { /* no cookies for this URL */ }

  const opts = {
    split: String(conns),
    'max-connection-per-server': String(conns),
    'socket-recv-buffer-size': '16M',
    'min-split-size': '1M',
    'user-agent': navigator.userAgent,
    header: headers,
  };
  if (referrer) opts.referer = referrer;
  // Download into a hidden temp folder inside the destination; the helper moves the finished file out.
  // (No folder set: aria2's own default dir is already the temp folder.)
  const target = dir || s.dir;
  if (target) opts.dir = /[\\/]\.utd-temp[\\/]?$/i.test(target) ? target : target.replace(/[\\/]+$/, '') + '\\.utd-temp';
  if (filename) opts.out = filename;
  const gid = await rpc('addUri', [[url], opts], s);
  // Remember how it was added, so a failed download can be retried with fewer connections.
  const { jobs = {} } = await chrome.storage.local.get('jobs');
  jobs[gid] = { url, referrer, filename, connections: conns, dir: opts.dir || '', t: Date.now() };
  const keep = Object.entries(jobs).sort((a, b) => b[1].t - a[1].t).slice(0, 300);
  await chrome.storage.local.set({ jobs: Object.fromEntries(keep) });
  return gid;
}

// aria2 error codes that more retries can't fix: not found, disk/file problems, auth.
const NO_RETRY = new Set(['3', '9', '13', '15', '16', '17', '18', '24']);

function baseName(p) {
  return (p || '').split(/[\\/]/).pop();
}

function shouldSkip(item, s) {
  const url = item.finalUrl || item.url;
  if (!/^https?:/i.test(url)) return true;                 // blob:, data:, file: can't be fetched by aria2
  if (item.byExtensionId === chrome.runtime.id) return true; // our own fallback downloads
  const skip = s.skipExt.split(',').map((e) => e.trim().toLowerCase().replace(/^\./, '')).filter(Boolean);
  const ext = (baseName(item.filename) || new URL(url).pathname).split('.').pop().toLowerCase();
  if (skip.includes(ext)) return true;
  const min = Number(s.minSizeMB) * 1024 * 1024;
  if (min > 0 && item.totalBytes > 0 && item.totalBytes < min) return true;
  return false;
}

// onCreated fires before the server's reply arrives, so the name from Content-Disposition
// (e.g. "/api/download?j=…" → "My video (720p).mp4") isn't known yet. Wait briefly for it.
function waitForFilename(id, ms = 4000) {
  return new Promise((resolve) => {
    let t;
    const done = (name) => { chrome.downloads.onChanged.removeListener(on); clearTimeout(t); resolve(name || ''); };
    const on = (d) => { if (d.id === id && d.filename && d.filename.current) done(d.filename.current); };
    chrome.downloads.onChanged.addListener(on);
    t = setTimeout(() => done(''), ms);
    chrome.downloads.search({ id }).then(([it]) => { if (it && it.filename) done(it.filename); }).catch(() => {});
  });
}

// Last resort: ask the server (HEAD) for its Content-Disposition name, since aria2 would otherwise
// name the file after the URL path (e.g. "download").
async function nameFromServer(url) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(url, { method: 'HEAD', credentials: 'include', signal: ctl.signal });
    clearTimeout(t);
    const cd = r.headers.get('content-disposition') || '';
    const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(cd);
    if (star) return decodeURIComponent(star[1].trim());
    const plain = /filename\s*=\s*"?([^";]+)"?/.exec(cd);
    return plain ? plain[1].trim() : '';
  } catch { return ''; }
}
const safeFile = (n) => n.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim().slice(0, 200);

// ---- Intercept every new browser download ----
chrome.downloads.onCreated.addListener(async (item) => {
  const s = await getSettings();
  if (!s.enabled) return;
  if (!item.filename && item.state === 'in_progress') item = { ...item, filename: await waitForFilename(item.id) };
  if (shouldSkip(item, s)) return;
  if (!(await isAlive(s))) {
    setBadge('!', '#c0392b', 'aria2 is not running — Chrome is downloading this one itself');
    return; // leave the download with Chrome
  }

  const url = item.finalUrl || item.url;
  try { await chrome.downloads.cancel(item.id); } catch { /* already gone */ }
  const [after] = await chrome.downloads.search({ id: item.id });
  if (after && after.state === 'complete') return; // tiny file finished before we caught it

  try {
    let filename = baseName(item.filename);
    if (!filename) filename = safeFile(await nameFromServer(url));
    const gid = await sendToAria2(url, { referrer: item.referrer, filename }, s);
    try { await chrome.downloads.erase({ id: item.id }); } catch {}
    openProgress('aria', gid, s);
    refreshBadge();
  } catch (err) {
    // aria2 refused it: give it back to Chrome
    console.warn('aria2 addUri failed, falling back to Chrome', err);
    chrome.downloads.download({ url });
  }
});

// ---- Right-click "Download with Ultimate Turbo Downloader" ----
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'turbo-link', title: 'Download with Ultimate Turbo Downloader', contexts: ['link', 'video', 'audio', 'image'] });
  chrome.contextMenus.create({ id: 'turbo-video', title: 'Download video from this page', contexts: ['page', 'video', 'link', 'frame'] });
  chrome.contextMenus.create({ id: 'turbo-images', title: 'Grab images from this page', contexts: ['page', 'image'] });
  chrome.alarms.create('poll', { periodInMinutes: 0.5 });
});
chrome.runtime.onStartup.addListener(() => chrome.alarms.create('poll', { periodInMinutes: 0.5 }));

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'turbo-video') {
    const target = info.linkUrl && /^https?:/.test(info.linkUrl) ? info.linkUrl : info.pageUrl || (tab && tab.url);
    const r = await grabVideo({ target, pageUrl: info.pageUrl || (tab && tab.url), src: info.srcUrl, tabId: tab && tab.id });
    if (!r.ok) notify('Could not start video download', r.error);
    return;
  }
  if (info.menuItemId === 'turbo-images') {
    if (tab) openImagePicker(tab);
    return;
  }
  const url = info.linkUrl || info.srcUrl;
  if (!url) return;
  try {
    const gid = await sendToAria2(url, { referrer: info.pageUrl || (tab && tab.url) || '' });
    openProgress('aria', gid);
    refreshBadge();
  } catch (e) {
    notify('Could not send to aria2', String(e.message || e));
  }
});

// ---- Messages from the popup ----
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'ping') {
    reply({ version: chrome.runtime.getManifest().version });
    return;
  }
  if (msg.type === 'poll') {
    refreshBadge().then(() => reply({ ok: true }));
    return true;
  }
  if (msg.type === 'grab-video') {
    grabVideo({ ...msg, tabId: msg.tabId ?? _sender.tab?.id }).then(reply);
    return true;
  }
  if (msg.type === 'sniffed') {
    getSniffed(msg.tabId).then(reply);
    return true;
  }
  if (msg.type === 'images') {
    chrome.tabs.get(msg.tabId).then(openImagePicker).then(() => reply({ ok: true }));
    return true;
  }
  if (msg.type === 'add') {
    sendToAria2(msg.url, { referrer: msg.referrer || '' })
      .then((gid) => { if (!msg.quiet) openProgress('aria', gid); return gid; })
      .then((gid) => reply({ ok: true, gid }), (e) => reply({ ok: false, error: String(e.message || e) }));
    return true;
  }
});

// ---- Badge + "download finished" notifications (polled every 30 s) ----
function setBadge(text, color, title) {
  chrome.action.setBadgeText({ text });
  if (color) chrome.action.setBadgeBackgroundColor({ color });
  if (title) chrome.action.setTitle({ title });
}

async function refreshBadge() {
  const s = await getSettings();
  try {
    const stat = await rpc('getGlobalStat', [], s, 1500);
    const n = Number(stat.numActive);
    setBadge(n ? String(n) : '', '#2563eb', s.enabled ? 'Ultimate Turbo Downloader — connected to aria2' : 'Ultimate Turbo Downloader — paused');
    await checkFinished(s);
  } catch {
    setBadge('!', '#c0392b', 'Ultimate Turbo Downloader — aria2 is not running');
  }
}

let checking = null; // the alarm and the popup can both ask; run one check at a time
function checkFinished(s) {
  if (!checking) checking = doCheckFinished(s).finally(() => { checking = null; });
  return checking;
}

async function doCheckFinished(s) {
  const stopped = await rpc('tellStopped', [0, 50, ['gid', 'status', 'files', 'errorMessage', 'errorCode']], s);
  const { seen = [] } = await chrome.storage.session.get('seen');
  const { jobs = {} } = await chrome.storage.local.get('jobs');
  const seenSet = new Set(seen);
  const first = seen.length === 0;
  for (const t of stopped) {
    if (seenSet.has(t.gid)) continue;
    seenSet.add(t.gid);
    const job = jobs[t.gid];
    // Server refused or dropped the connections: retry with half as many (keeps the downloaded part).
    if (t.status === 'error' && job && job.connections > 1 && !NO_RETRY.has(String(t.errorCode))) {
      const fewer = Math.max(1, Math.floor(job.connections / 2));
      try {
        await rpc('removeDownloadResult', [t.gid], s);
        await sendToAria2(job.url, { ...job, connections: fewer }, s);
        continue;
      } catch (e) {
        console.warn('retry failed', e);
      }
    }
    if (first) continue; // don't spam notifications for old history on first run
    if (t.status === 'complete') notify('Download complete', nameOf(t));
    else if (t.status === 'error') notify('Download failed', `${nameOf(t)}: ${t.errorMessage || 'error'}`);
  }
  await chrome.storage.session.set({ seen: [...seenSet].slice(-500) });
}

function notify(title, message) {
  chrome.notifications.create({ type: 'basic', iconUrl: 'icons/128.png', title, message });
}

chrome.alarms.onAlarm.addListener((a) => a.name === 'poll' && (refreshBadge(), checkMediaJobs()));
refreshBadge();

// =====================================================================
// Video / audio: yt-dlp through the local media server
// =====================================================================

// Send a page (or a video file) to yt-dlp. Candidates are tried in order: the page/permalink first
// (yt-dlp knows 1800+ sites), then the video file the page was playing, then files sniffed on the tab.
async function grabVideo({ target, pageUrl, src, tabId, mode, direct = false, quiet = false }) {
  const s = await getSettings();
  target = target || pageUrl;
  const fallbacks = [];
  if (src && /^https?:/.test(src)) fallbacks.push(cleanMediaUrl(src));
  if (tabId != null && !direct) {
    const sniffed = await getSniffed(tabId);
    for (const m of sniffed) if (m.kind !== 'audio') fallbacks.push(m.url);
  }
  try {
    const { id } = await media('/add', {
      url: target, pageUrl: pageUrl || target, fallbacks, direct, dir: s.dir,
      mode: mode || s.videoQuality, ua: navigator.userAgent,
      cookies: await cookiesTxt(pageUrl || target),
    }, s);
    if (!quiet) openProgress('media', id, s);
    return { ok: true, id };
  } catch (e) {
    const msg = /fetch|network|abort|timed out/i.test(String(e.message || e))
      ? 'The media helper is not running. Start helper\\start-helpers.vbs.'
      : String(e.message || e);
    return { ok: false, error: msg };
  }
}

async function checkMediaJobs() {
  let list;
  try { list = await media('/jobs', undefined, undefined, 2000); } catch { return; }
  const { mediaSeen } = await chrome.storage.session.get('mediaSeen');
  const seen = new Set(mediaSeen || []);
  for (const j of list) {
    if (seen.has(j.id) || !['done', 'error'].includes(j.status)) continue;
    seen.add(j.id);
    if (!mediaSeen) continue; // first look after a restart: just record
    if (j.status === 'done') notify('Video downloaded', j.title || j.file || j.currentUrl);
    else notify('Video download failed', `${j.title || j.currentUrl}: ${j.error || 'error'}`);
  }
  await chrome.storage.session.set({ mediaSeen: [...seen].slice(-500) });
}

// ---- Sniffer: remember video/audio/stream URLs each tab loads (like IDM's "download this video") ----
const SEGMENT = /\.(ts|m4s|aac|vtt|webvtt|key)(\?|$)/i;
const EXT_KIND = [
  [/\.m3u8(\?|$)/i, 'hls'], [/\.mpd(\?|$)/i, 'dash'],
  [/\.(mp4|webm|mov|mkv|m4v|flv|3gp|ogv)(\?|$)/i, 'video'],
  [/\.(mp3|m4a|ogg|opus|wav|flac)(\?|$)/i, 'audio'],
];

function header(h, name) {
  const x = (h || []).find((v) => v.name.toLowerCase() === name);
  return x ? x.value : '';
}

// Facebook/Instagram serve videos in byte-range pieces; dropping the range params gives the whole file.
function cleanMediaUrl(u) {
  try {
    const url = new URL(u);
    if (/(fbcdn\.net|cdninstagram\.com)$/.test(url.hostname)) {
      url.searchParams.delete('bytestart');
      url.searchParams.delete('byteend');
    }
    return url.toString();
  } catch { return u; }
}

function mediaKind(url, ct) {
  ct = ct.toLowerCase();
  if (/mpegurl/.test(ct)) return 'hls';
  if (/dash\+xml/.test(ct)) return 'dash';
  if (/mp2t|iso\.segment/.test(ct)) return null;
  if (ct.startsWith('video/')) return 'video';
  if (ct.startsWith('audio/')) return 'audio';
  for (const [re, k] of EXT_KIND) if (re.test(url)) return k;
  return null;
}

chrome.webRequest.onHeadersReceived.addListener(
  (d) => {
    if (d.tabId < 0 || d.statusCode >= 400) return;
    if (/googlevideo\.com|\.youtube\.com\/api/.test(d.url)) return; // YouTube: use the page URL instead
    if (SEGMENT.test(d.url)) return;
    const ct = header(d.responseHeaders, 'content-type');
    const kind = mediaKind(d.url, ct);
    if (!kind) return;
    const range = /\/(\d+)$/.exec(header(d.responseHeaders, 'content-range'));
    const size = range ? Number(range[1]) : Number(header(d.responseHeaders, 'content-length')) || 0;
    if ((kind === 'video' || kind === 'audio') && size && size < 150 * 1024) return; // tiny clips / UI sounds
    addSniffed(d.tabId, { url: cleanMediaUrl(d.url), kind, size, t: Date.now() });
  },
  { urls: ['<all_urls>'], types: ['media', 'xmlhttprequest', 'object', 'other'] },
  ['responseHeaders'],
);

let sniffQueue = Promise.resolve();
function addSniffed(tabId, item) {
  sniffQueue = sniffQueue.then(async () => {
    const key = 'sniff_' + tabId;
    const list = (await chrome.storage.session.get(key))[key] || [];
    const i = list.findIndex((m) => m.url === item.url);
    if (i >= 0) { list[i].t = item.t; list[i].size = Math.max(list[i].size, item.size); }
    else list.push(item);
    list.sort((a, b) => b.t - a.t);
    await chrome.storage.session.set({ [key]: list.slice(0, 30) });
  }).catch(() => {});
}

async function getSniffed(tabId) {
  const key = 'sniff_' + tabId;
  return (await chrome.storage.session.get(key))[key] || [];
}

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading' && info.url) chrome.storage.session.remove('sniff_' + tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove('sniff_' + tabId));

// =====================================================================
// Small progress window per download, at the top right near the extension icon (like IDM)
// =====================================================================
const PW = { width: 440, height: 200 };
async function openProgress(kind, id, settings) {
  const s = settings || (await getSettings());
  if (!id || s.progressUi === 'off') return;
  if (s.progressUi === 'popup') {
    // Show it in the extension's own toolbar popup, under the icon.
    await chrome.storage.session.set({ focusJob: { kind, id, t: Date.now() } });
    try {
      await chrome.action.openPopup();
      return;
    } catch (e) {
      // e.g. no focused browser window, or a browser without openPopup: fall back to the small window
      await chrome.storage.session.remove('focusJob');
    }
  }
  return openProgressWindow(kind, id);
}

async function openProgressWindow(kind, id) {
  let left, top;
  try {
    const w = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
    left = Math.max(0, Math.round(w.left + w.width - PW.width - 16));
    top = Math.max(0, Math.round(w.top + 84)); // just under the toolbar
  } catch {}
  // a few downloads at once: cascade the windows instead of stacking them exactly
  const { pwCount = 0 } = await chrome.storage.session.get('pwCount');
  const shift = (pwCount % 5) * 28;
  chrome.storage.session.set({ pwCount: pwCount + 1 });
  try {
    await chrome.windows.create({
      url: chrome.runtime.getURL(`progress.html?kind=${kind}&id=${encodeURIComponent(id)}`),
      type: 'popup', focused: true, ...PW,
      ...(left !== undefined ? { left: Math.max(0, left - shift), top: top + shift } : {}),
    });
  } catch (e) {
    console.warn('progress window failed', e);
  }
}

// =====================================================================
// Images: picker page for every image on a tab
// =====================================================================
function openImagePicker(tab) {
  const u = chrome.runtime.getURL(`images.html?tab=${tab.id}&page=${encodeURIComponent(tab.url || '')}`);
  return chrome.tabs.create({ url: u, index: tab.index + 1 });
}
