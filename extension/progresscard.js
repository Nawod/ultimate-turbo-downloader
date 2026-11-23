// One download's live progress card. Used by the extension popup and by the separate progress window.
//   mountCard(root, { kind: 'aria' | 'media', id, settings, onClose })
import { rpc, fmtBytes, fmtEta, nameOf } from './rpc.js';
import { media } from './media.js';

const HTML = `
  <div class="top">
    <img src="icons/32.png" alt="">
    <div class="titles">
      <div class="pname">Starting…</div>
      <div class="psub"></div>
    </div>
    <span class="tag" hidden></span>
  </div>
  <div class="pbar"><i></i></div>
  <div class="prow">
    <span class="pct">0%</span>
    <span class="pstats"></span>
  </div>
  <div class="perr" hidden></div>
  <div class="pactions">
    <label class="auto"><input type="checkbox" class="autoClose"> Close when done</label>
    <span class="spacer"></span>
    <button data-a="pause" class="ghost" hidden>Pause</button>
    <button data-a="resume" class="ghost" hidden>Resume</button>
    <button data-a="cancel" class="ghost">Cancel</button>
    <button data-a="retry" class="ghost" hidden>Retry</button>
    <button data-a="folder" class="ghost" hidden>Show in folder</button>
    <button data-a="open" hidden>Open</button>
    <button data-a="close" class="ghost" hidden>Close</button>
  </div>`;

export function mountCard(root, { kind, id, settings, onClose = () => {}, onTitle = () => {} }) {
  root.classList.add('pcard');
  root.innerHTML = HTML;
  const $ = (sel) => root.querySelector(sel);
  const btn = (a) => root.querySelector(`[data-a="${a}"]`);
  let finished = false, stopped = false;

  function setState(state) {
    root.classList.toggle('done', state === 'done');
    root.classList.toggle('failed', state === 'failed');
    const active = state === 'active' || state === 'waiting';
    btn('cancel').hidden = !(active || state === 'paused');
    btn('pause').hidden = !active;
    btn('resume').hidden = state !== 'paused';
    btn('retry').hidden = !(kind === 'media' && state === 'failed');
    btn('open').hidden = btn('folder').hidden = state !== 'done';
    btn('close').hidden = !(state === 'done' || state === 'failed');
    if ((state === 'done' || state === 'failed') && !finished) {
      finished = true;
      onTitle(state === 'done' ? 'Download complete' : 'Download failed');
      if (state === 'done' && $('.autoClose').checked) setTimeout(onClose, 2500);
    }
  }

  function paint({ name, sub, pct, indeterminate, stats, state, error, tag }) {
    $('.pname').textContent = name || 'Starting…';
    $('.pname').title = name || '';
    $('.psub').textContent = sub || '';
    $('.psub').title = sub || '';
    $('.pbar i').style.width = Math.max(0, Math.min(100, pct || 0)) + '%';
    $('.pbar').classList.toggle('indet', !!indeterminate && state === 'active');
    $('.pct').textContent = state === 'done' ? 'Done' : state === 'failed' ? 'Failed' : state === 'paused' ? 'Paused'
      : state === 'waiting' ? 'Waiting' : indeterminate ? '…' : Math.floor(pct || 0) + '%';
    if (state === 'paused' && pct) $('.pct').textContent = `Paused · ${Math.floor(pct)}%`;
    $('.pstats').textContent = stats.filter(Boolean).join(' · ');
    $('.perr').textContent = error || '';
    $('.perr').hidden = !error;
    if (tag) { $('.tag').textContent = tag; $('.tag').hidden = false; }
    if (state === 'active') onTitle(`${Math.floor(pct || 0)}% ${name || 'Downloading'}`);
    setState(state);
  }

  // A failed file download may be re-added with fewer connections (new gid): follow it.
  async function followRetry(oldGid) {
    const { jobs = {} } = await chrome.storage.local.get('jobs');
    const old = jobs[oldGid];
    if (!old) return null;
    const newer = Object.entries(jobs).filter(([g, j]) => g !== oldGid && j.url === old.url && j.t > old.t).sort((a, b) => b[1].t - a[1].t)[0];
    return newer ? newer[0] : null;
  }

  async function tickAria() {
    let t;
    try {
      t = await rpc('tellStatus', [id, ['status', 'totalLength', 'completedLength', 'downloadSpeed', 'connections', 'files', 'errorMessage']], settings, 2500);
    } catch (e) {
      const next = await followRetry(id);
      if (next) { id = next; return; }
      return paint({ name: 'Download', stats: [], state: 'failed', error: /not found/i.test(e.message) ? 'This download was removed.' : 'Cannot reach aria2: ' + e.message });
    }
    if (t.status === 'error' || t.status === 'removed') {
      const next = await followRetry(id);
      if (next) { id = next; $('.psub').textContent = 'Retrying with fewer connections…'; return; }
    }
    const total = Number(t.totalLength), done = Number(t.completedLength), speed = Number(t.downloadSpeed);
    // unfinished files live in the hidden ".utd-temp" folder; show the folder they'll end up in
    const path = t.files[0] && t.files[0].path.replace(/[\\/]\.utd-temp(?=[\\/][^\\/]*$)/i, '');
    const state = { active: 'active', waiting: 'waiting', paused: 'paused', complete: 'done', error: 'failed', removed: 'failed' }[t.status];
    paint({
      name: nameOf(t),
      sub: path ? path.replace(/[\\/][^\\/]*$/, '') : (t.files[0]?.uris?.[0]?.uri || ''),
      pct: state === 'done' ? 100 : total ? (done / total) * 100 : 0,
      indeterminate: !total,
      stats: state === 'done' ? [fmtBytes(total)] : [
        `${fmtBytes(done)} / ${total ? fmtBytes(total) : '?'}`,
        ...(state === 'active' ? [speed ? fmtBytes(speed) + '/s' : '', `${t.connections} conn`, speed && total ? fmtEta((total - done) / speed) : ''] : []),
      ],
      state,
      error: t.status === 'error' ? t.errorMessage : t.status === 'removed' ? 'Cancelled' : '',
      tag: 'FILE',
    });
  }

  async function tickMedia() {
    let j;
    try {
      j = (await media('/jobs', undefined, settings, 2500)).find((x) => x.id === id);
    } catch (e) {
      return paint({ name: 'Video', stats: [], state: 'failed', error: 'Cannot reach the video helper: ' + e.message });
    }
    if (!j) return paint({ name: 'Video', stats: [], state: 'failed', error: 'This download was removed.' });
    const state = { queued: 'waiting', running: 'active', paused: 'paused', done: 'done', error: 'failed', cancelled: 'failed' }[j.status];
    let host = '';
    try { host = new URL(j.pageUrl || j.currentUrl).hostname.replace(/^www\./, ''); } catch {}
    const fname = j.file ? j.file.split(/[\\/]/).pop() : '';
    const partLabel = j.part === 'video' ? 'Downloading video stream' : j.part === 'audio' ? 'Downloading audio stream' : '';
    paint({
      name: j.title || fname || (state === 'active' ? 'Getting video info…' : host || 'Video'),
      sub: state === 'done' ? (j.file || '') : state === 'waiting' ? 'Waiting for a free slot…' : [host, partLabel].filter(Boolean).join(' · '),
      pct: state === 'done' ? 100 : j.percent,
      indeterminate: state === 'active' && !j.percent,
      stats: state === 'done' ? [j.totalBytes ? fmtBytes(j.totalBytes) : j.size] : [
        j.totalBytes ? `${fmtBytes(j.doneBytes)} / ${fmtBytes(j.totalBytes)}` : '',
        j.speedBps ? fmtBytes(j.speedBps) + '/s' : '',
        j.conns ? `${j.conns} conn` : '',
        fmtEta(j.etaSec),
        j.tryIndex > 0 ? 'using the file the page played' : '',
      ],
      state,
      error: j.status === 'error' ? j.error : j.status === 'cancelled' ? 'Cancelled' : '',
      tag: j.mode === 'audio' ? 'AUDIO' : 'VIDEO',
    });
  }

  const tick = () => (kind === 'aria' ? tickAria() : tickMedia()).catch((e) => console.warn(e));

  async function reveal(open) {
    try {
      await media('/reveal', kind === 'aria' ? { gid: id, open } : { id, open }, settings);
      if (open) setTimeout(onClose, 400);
    } catch (e) {
      $('.perr').textContent = /fetch/i.test(e.message) ? 'The video helper must be running to open files.' : e.message;
      $('.perr').hidden = false;
    }
  }

  $('.autoClose').checked = !!settings.progressAutoClose;
  $('.autoClose').onchange = (e) => chrome.storage.local.set({ progressAutoClose: e.target.checked });
  btn('pause').onclick = () => (kind === 'aria' ? rpc('pause', [id], settings) : media('/pause', { id }, settings)).then(tick, tick);
  btn('resume').onclick = () => (kind === 'aria' ? rpc('unpause', [id], settings) : media('/resume', { id }, settings)).then(tick, tick);
  btn('cancel').onclick = async () => {
    // stop and delete the unfinished pieces from the hidden temp folder
    if (kind === 'aria') await media('/discard', { gid: id }, settings).catch(() => rpc('remove', [id], settings).catch(() => {}));
    else await media('/cancel', { id }, settings).catch(() => {});
    tick();
  };
  btn('retry').onclick = () => { finished = false; media('/retry', { id }, settings).then(tick); };
  btn('open').onclick = () => reveal(true);
  btn('folder').onclick = () => reveal(false);
  btn('close').onclick = () => onClose();

  tick();
  const timer = setInterval(() => { if (!stopped) tick(); }, 700);
  return { stop() { stopped = true; clearInterval(timer); } };
}
