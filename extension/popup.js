import { getSettings, rpc, fmtBytes, fmtEta, nameOf } from './rpc.js';
import { media, QUALITIES } from './media.js';
import { mountCard } from './progresscard.js';

const $ = (id) => document.getElementById(id);
const KEYS = ['gid', 'status', 'totalLength', 'completedLength', 'downloadSpeed', 'connections', 'files', 'errorMessage', 'dir'];
let settings, tab;
let ariaOk = false, mediaOk = false;

function eta(t) {
  const left = Number(t.totalLength) - Number(t.completedLength);
  const sp = Number(t.downloadSpeed);
  if (!sp || left <= 0) return '';
  let s = Math.round(left / sp);
  if (s < 60) return s + 's left';
  if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's left';
  return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm left';
}

function flash(msg) {
  const s = $('status');
  s.textContent = msg;
  s.className = 'status bad';
}

// Which row is asking "delete this file?" (kept across the 1-second redraws).
let confirming = null;

function makeRow({ key, name, title, pct, cls, meta, tag, buttons, onDelete }) {
  const li = document.createElement('li');
  li.className = 'item ' + cls;
  const n = document.createElement('div');
  n.className = 'name';
  if (tag) { const b = document.createElement('span'); b.className = 'tag'; b.textContent = tag; n.append(b); }
  n.append(document.createTextNode(name));
  n.title = title || '';
  const bar = document.createElement('div');
  bar.className = 'bar';
  bar.innerHTML = '<i></i>';
  bar.firstChild.style.width = pct + '%';
  const m = document.createElement('div');
  m.className = 'meta';
  m.textContent = meta.filter(Boolean).join(' · ');
  const actions = document.createElement('div');
  actions.className = 'actions';
  const button = (label, fn, cls = 'ghost small') => {
    const b = document.createElement('button');
    b.className = cls;
    b.textContent = label;
    b.onclick = async () => { try { await fn(); } catch (e) { flash(e.message); } refresh(); };
    actions.append(b);
  };
  if (confirming === key && onDelete) {
    // finished file: ask before deleting it from the computer
    li.classList.add('confirming');
    const q = document.createElement('div');
    q.className = 'confirm';
    q.textContent = 'Remove it and delete the file from your computer? It goes to the Recycle Bin.';
    li.append(n, bar, m, q, actions);
    button('Delete file', async () => { confirming = null; const r = await onDelete(); if (r && r.recycled) flash2('Moved to the Recycle Bin: ' + r.recycled.split(/[\\/]/).pop()); }, 'danger small');
    button('Keep it', async () => { confirming = null; });
    return li;
  }
  for (const [label, fn] of buttons) button(label, fn);
  if (onDelete) button('Remove', async () => { confirming = key; });
  li.append(n, bar, m, actions);
  return li;
}

function flash2(msg) {
  const s = $('status');
  s.textContent = msg;
  s.className = 'status ok';
  statusHold = Date.now() + 4000;
}
let statusHold = 0;

// ---- aria2 file downloads ----
function ariaRow(t) {
  const total = Number(t.totalLength), done = Number(t.completedLength);
  const pct = total ? Math.floor((done / total) * 100) : 0;
  const meta = [];
  if (t.status === 'active') meta.push(`${pct}%`, `${fmtBytes(done)} / ${total ? fmtBytes(total) : '?'}`, `${fmtBytes(t.downloadSpeed)}/s`, `${t.connections} conn`, eta(t));
  else if (t.status === 'complete') meta.push('Done', fmtBytes(total));
  else if (t.status === 'error') meta.push('Failed: ' + (t.errorMessage || 'error'));
  else meta.push(t.status === 'paused' ? 'Paused' : 'Waiting', `${pct}%`, total ? fmtBytes(total) : '');
  const buttons = [];
  // Cancel / Remove of an unfinished download: delete its pieces from the hidden temp folder
  const drop = () => media('/delete', { gid: t.gid }, settings).catch(() => rpc('remove', [t.gid], settings).catch(() => rpc('removeDownloadResult', [t.gid], settings)));
  if (t.status === 'active' || t.status === 'waiting') buttons.push(['Pause', () => rpc('pause', [t.gid], settings)]);
  if (t.status === 'paused') buttons.push(['Resume', () => rpc('unpause', [t.gid], settings)]);
  if (['active', 'waiting', 'paused'].includes(t.status)) buttons.push(['Cancel', drop]);
  if (t.status === 'complete') buttons.push(['Show in folder', () => media('/reveal', { gid: t.gid }, settings)]);
  if (t.status === 'error' || t.status === 'removed') buttons.push(['Remove', drop]);
  return makeRow({
    key: 'a:' + t.gid,
    name: nameOf(t), title: (t.files && t.files[0] && t.files[0].path) || '',
    pct: t.status === 'complete' ? 100 : pct, cls: t.status, meta, buttons,
    onDelete: t.status === 'complete' ? () => media('/delete', { gid: t.gid }, settings) : null,
  });
}

// ---- yt-dlp video jobs ----
function mediaRow(j) {
  const cls = { running: 'active', queued: 'waiting', paused: 'paused', done: 'complete', error: 'error', cancelled: 'error' }[j.status] || '';
  const meta = [];
  if (j.status === 'running') meta.push(
    j.percent ? j.percent.toFixed(1) + '%' : 'Starting…',
    j.totalBytes ? `${fmtBytes(j.doneBytes)} / ${fmtBytes(j.totalBytes)}` : '',
    j.speedBps ? fmtBytes(j.speedBps) + '/s' : '',
    j.part ? j.part + ' stream' : '',
    fmtEta(j.etaSec));
  else if (j.status === 'queued') meta.push('Waiting');
  else if (j.status === 'paused') meta.push('Paused', j.percent ? j.percent.toFixed(1) + '%' : '', j.totalBytes ? `${fmtBytes(j.doneBytes)} / ${fmtBytes(j.totalBytes)}` : '');
  else if (j.status === 'done') meta.push('Done', j.totalBytes ? fmtBytes(j.totalBytes) : j.size);
  else if (j.status === 'cancelled') meta.push('Cancelled');
  else meta.push('Failed: ' + (j.error || 'error'));
  if (j.tryIndex > 0 && j.status !== 'done') meta.push('using the video file the page played');
  const buttons = [];
  if (j.status === 'running' || j.status === 'queued') buttons.push(['Pause', () => media('/pause', { id: j.id }, settings)]);
  if (j.status === 'paused') buttons.push(['Resume', () => media('/resume', { id: j.id }, settings)]);
  if (['running', 'queued', 'paused'].includes(j.status)) buttons.push(['Cancel', () => media('/cancel', { id: j.id }, settings)]);
  if (j.status === 'done' && j.file) buttons.push(['Show in folder', () => media('/open', { id: j.id }, settings)]);
  if (j.status === 'error' || j.status === 'cancelled') {
    buttons.push(['Retry', () => media('/retry', { id: j.id }, settings)]);
    buttons.push(['Remove', () => media('/delete', { id: j.id }, settings)]); // only leftover pieces to clean up
  }
  const fname = j.file ? j.file.split(/[\\/]/).pop() : '';
  return makeRow({
    key: 'm:' + j.id,
    name: j.title || fname || j.currentUrl || j.tryUrls[0],
    title: j.file || j.currentUrl || '',
    pct: j.status === 'done' ? 100 : j.percent || 0,
    cls, meta, buttons, tag: j.mode === 'audio' ? 'AUDIO' : 'VIDEO',
    onDelete: j.status === 'done' ? () => media('/delete', { id: j.id }, settings) : null,
  });
}

async function refresh() {
  const [aria, med] = await Promise.allSettled([
    Promise.all([
      rpc('tellActive', [KEYS], settings),
      rpc('tellWaiting', [0, 100, KEYS], settings),
      rpc('tellStopped', [0, 100, KEYS], settings),
      rpc('getGlobalStat', [], settings),
    ]),
    media('/jobs', undefined, settings, 2000),
  ]);
  ariaOk = aria.status === 'fulfilled';
  mediaOk = med.status === 'fulfilled';

  const rows = [];
  let activeN = 0, speed = 0;
  if (mediaOk) {
    const jobs = med.value.slice().reverse();
    const running = jobs.filter((j) => j.status === 'running' || j.status === 'queued');
    activeN += running.length;
    speed += running.reduce((sum, j) => sum + (j.speedBps || 0), 0); // videos count toward the total too
    rows.push(...jobs.map(mediaRow));
  }
  if (ariaOk) {
    const [active, waiting, stopped, stat] = aria.value;
    if (stopped.some((t) => t.status === 'error')) chrome.runtime.sendMessage({ type: 'poll' }).catch(() => {});
    activeN += active.length + waiting.length;
    speed += Number(stat.downloadSpeed) || 0;
    rows.push(...[...active, ...waiting, ...stopped.reverse()].map(ariaRow));
  }
  $('speed').textContent = ariaOk || mediaOk ? '↓ ' + fmtBytes(speed) + '/s' : '↓ —';
  $('list').replaceChildren(...rows);
  $('empty').hidden = rows.length > 0;
  $('activeCount').textContent = activeN ? `(${activeN})` : '';

  const s = $('status');
  if (Date.now() < statusHold) return; // keep a just-shown message on screen for a moment
  if (ariaOk && mediaOk) {
    s.textContent = settings.enabled ? 'Ready · browser downloads are caught' : 'Ready · catching browser downloads is off';
    s.className = 'status ok';
  } else {
    const parts = [];
    if (!ariaOk) parts.push('file downloader (aria2)');
    if (!mediaOk) parts.push('video helper (yt-dlp)');
    s.textContent = `Not running: ${parts.join(' and ')}. Double-click helper\\start-helpers.vbs, and check the secret in Settings.`;
    s.className = 'status bad';
  }
}

// ---- This page tab ----
async function refreshSniffed() {
  if (!tab) return;
  const list = await chrome.runtime.sendMessage({ type: 'sniffed', tabId: tab.id });
  const items = (list || []).map((m) => {
    const li = document.createElement('li');
    li.className = 'sn';
    const kind = document.createElement('span');
    kind.className = 'tag';
    kind.textContent = { hls: 'STREAM', dash: 'STREAM', video: 'VIDEO', audio: 'AUDIO' }[m.kind] || m.kind;
    const name = document.createElement('span');
    name.className = 'snname';
    let label = m.url;
    try { const u = new URL(m.url); label = u.hostname + ' · ' + (decodeURIComponent(u.pathname.split('/').pop()) || u.pathname); } catch {}
    name.textContent = label;
    name.title = m.url;
    const size = document.createElement('span');
    size.className = 'snsize';
    size.textContent = m.size ? fmtBytes(m.size) : '';
    const b = document.createElement('button');
    b.className = 'ghost small';
    b.textContent = 'Download';
    b.onclick = async () => {
      const r = await chrome.runtime.sendMessage({ type: 'grab-video', target: m.url, pageUrl: tab.url, tabId: tab.id, direct: true, quiet: true, mode: m.kind === 'audio' ? 'audio' : $('quality').value });
      b.textContent = r && r.ok ? 'Sent ✓' : 'Failed';
      if (r && r.ok) showNow('media', r.id); else flash(r ? r.error : 'Failed');
    };
    li.append(kind, name, size, b);
    return li;
  });
  $('sniffed').replaceChildren(...items);
  $('sniffEmpty').hidden = items.length > 0;
}

// ---- "Now downloading" card at the top of the popup ----
let nowCard = null;
function showNow(kind, id) {
  if (!id) return;
  if (nowCard) nowCard.stop();
  const box = $('now');
  box.hidden = false;
  nowCard = mountCard(box, {
    kind, id, settings,
    onClose: () => { nowCard && nowCard.stop(); nowCard = null; box.hidden = true; box.replaceChildren(); },
  });
}

// The background asks for the card by leaving a note, then opening this popup.
async function takeFocusJob() {
  const { focusJob } = await chrome.storage.session.get('focusJob').catch(() => ({}));
  if (focusJob && Date.now() - focusJob.t < 20000) {
    await chrome.storage.session.remove('focusJob');
    showNow(focusJob.kind, focusJob.id);
    return true;
  }
  return false;
}
chrome.storage.onChanged.addListener((c, area) => {
  if (area === 'session' && c.focusJob && c.focusJob.newValue) takeFocusJob();
});

function showTab(name) {
  for (const b of document.querySelectorAll('.tab')) b.classList.toggle('on', b.dataset.tab === name);
  $('tab-page').hidden = name !== 'page';
  $('tab-downloads').hidden = name !== 'downloads';
  chrome.storage.session.set({ popupTab: name }).catch(() => {});
}

// Unpacked extensions: the popup is read fresh from disk, but the background only updates on Reload.
// If they don't match, say so instead of failing silently.
async function checkBackgroundVersion() {
  const mine = chrome.runtime.getManifest().version;
  const r = await chrome.runtime.sendMessage({ type: 'ping' }).catch(() => null);
  if (!r || r.version !== mine) {
    const browser = navigator.userAgent.includes('Edg/') ? 'edge://extensions' : 'chrome://extensions';
    flash(`Ultimate Turbo Downloader was updated. Open ${browser} and click Reload on it, then refresh this page.`);
    return false;
  }
  return true;
}

async function init() {
  settings = await getSettings();
  const upToDate = await checkBackgroundVersion();
  const forced = Number(new URLSearchParams(location.search).get('tab')); // popup.html?tab=ID (testing)
  tab = forced ? await chrome.tabs.get(forced) : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  const webPage = tab && /^https?:/.test(tab.url || '');

  $('enabled').checked = settings.enabled;
  $('enabled').onchange = async (e) => {
    settings.enabled = e.target.checked;
    await chrome.storage.local.set({ enabled: settings.enabled });
    refresh();
  };

  for (const [v, l] of QUALITIES) $('quality').add(new Option(l, v, false, v === settings.videoQuality));
  $('quality').onchange = () => chrome.storage.local.set({ videoQuality: $('quality').value });

  $('pageHost').textContent = webPage ? (tab.title || new URL(tab.url).hostname) : 'Open a web page to download its video or images.';
  $('grabVideo').disabled = $('grabImages').disabled = !webPage;
  $('grabVideo').onclick = async () => {
    $('grabVideo').textContent = 'Sending…';
    const r = await chrome.runtime.sendMessage({ type: 'grab-video', target: tab.url, pageUrl: tab.url, tabId: tab.id, mode: $('quality').value, quiet: true });
    $('grabVideo').textContent = 'Download video';
    if (r && r.ok) { showNow('media', r.id); refresh(); } else flash(r ? r.error : 'Failed');
  };
  $('grabImages').onclick = async () => { await chrome.runtime.sendMessage({ type: 'images', tabId: tab.id }); window.close(); };

  $('addForm').onsubmit = async (e) => {
    e.preventDefault();
    const url = $('addUrl').value.trim();
    const video = $('addMode').value === 'video';
    const r = video
      ? await chrome.runtime.sendMessage({ type: 'grab-video', target: url, pageUrl: url, mode: settings.videoQuality, direct: false, quiet: true })
      : await chrome.runtime.sendMessage({ type: 'add', url, quiet: true });
    if (r && r.ok) { $('addUrl').value = ''; showNow(video ? 'media' : 'aria', video ? r.id : r.gid); }
    else flash('Could not add: ' + (r && r.error));
    refresh();
  };
  // Pause / resume everything: files (aria2) and videos (yt-dlp)
  const eachVideo = async (from, path) => {
    const jobs = await media('/jobs', undefined, settings).catch(() => []);
    await Promise.all(jobs.filter((j) => from.includes(j.status)).map((j) => media(path, { id: j.id }, settings).catch(() => {})));
  };
  $('pauseAll').onclick = () => Promise.allSettled([rpc('pauseAll', [], settings), eachVideo(['running', 'queued'], '/pause')]).then(refresh);
  $('resumeAll').onclick = () => Promise.allSettled([rpc('unpauseAll', [], settings), eachVideo(['paused'], '/resume')]).then(refresh);
  // Clears finished rows from the list only; downloaded files stay in the folder.
  $('clear').onclick = () => Promise.allSettled([rpc('purgeDownloadResult', [], settings), media('/clear', {}, settings)]).then(refresh);

  for (const b of document.querySelectorAll('.tab')) b.onclick = () => showTab(b.dataset.tab);
  const { popupTab } = await chrome.storage.session.get('popupTab').catch(() => ({}));
  showTab(popupTab || (webPage ? 'page' : 'downloads'));

  if (!upToDate) return; // keep the reload message on screen
  if (await takeFocusJob()) showTab('downloads');
  refresh();
  refreshSniffed();
  setInterval(refresh, 1000);
  setInterval(refreshSniffed, 2000);
}

init();
