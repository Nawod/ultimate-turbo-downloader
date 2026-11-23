import { DEFAULTS, getSettings, rpc } from './rpc.js';
import { media, QUALITIES } from './media.js';

const $ = (id) => document.getElementById(id);
const fields = Object.keys(DEFAULTS);
for (const [v, l] of QUALITIES) $('videoQuality').add(new Option(l, v));
$('ver').textContent = 'v' + chrome.runtime.getManifest().version;

function read() {
  const out = {};
  for (const k of fields) {
    const el = $(k);
    if (!el) continue;
    out[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value.trim();
  }
  return out;
}

function msg(text, ok) {
  $('msg').textContent = text;
  $('msg').className = 'status ' + (ok ? 'ok' : 'bad');
}

async function test(s) {
  const [a, m] = await Promise.allSettled([rpc('getVersion', [], s, 2500), media('/status', undefined, s, 4000)]);
  const parts = [];
  parts.push(a.status === 'fulfilled' ? `aria2 ${a.value.version}: connected` : `aria2: not reachable (${a.reason.message})`);
  parts.push(m.status === 'fulfilled' ? `yt-dlp ${m.value.ytdlp}: connected` : `video helper: not reachable (${m.reason.message})`);
  msg(parts.join(' · ') + (a.status === 'fulfilled' && m.status === 'fulfilled' ? '' : '. Is helper\\start-helpers.vbs running, and is the secret right?'),
    a.status === 'fulfilled' && m.status === 'fulfilled');
}

(async () => {
  const s = await getSettings();
  for (const k of fields) {
    const el = $(k);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!s[k];
    else el.value = s[k];
  }
  $('form').onsubmit = async (e) => {
    e.preventDefault();
    const v = read();
    await chrome.storage.local.set(v);
    msg('Saved.', true);
    test({ ...DEFAULTS, ...v });
  };
  $('test').onclick = () => test({ ...DEFAULTS, ...read() });
  $('update').onclick = async () => {
    $('update').disabled = true;
    msg('Updating yt-dlp… (sites change often; update when a site stops working)', true);
    try {
      const r = await media('/update', {}, { ...DEFAULTS, ...read() }, 300000);
      $('updateOut').hidden = false;
      $('updateOut').textContent = r.output;
      await test({ ...DEFAULTS, ...read() });
    } catch (e) {
      msg('Update failed: ' + e.message, false);
    }
    $('update').disabled = false;
  };
})();
