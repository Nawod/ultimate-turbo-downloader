// Image picker: collects every image on a tab (img/srcset/picture, CSS backgrounds, og:image,
// links to image files, video posters), shows them in a grid, downloads the chosen ones via aria2.
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const tabId = Number(params.get('tab'));
const pageUrl = params.get('page') || '';
let items = [];            // { url, w, h, ext, el }
const selected = new Set();

$('page').textContent = pageUrl;

// Runs inside the page.
function collect() {
  const out = new Map();
  const add = (u, w = 0, h = 0) => {
    if (!u) return;
    try { u = new URL(u, location.href).href; } catch { return; }
    if (!/^(https?:|data:image\/)/.test(u)) return;
    if (u.startsWith('data:') && u.length < 3000) return; // tracking pixels / tiny icons
    const prev = out.get(u);
    if (!prev || w > prev.w) out.set(u, { url: u, w, h });
  };
  const biggestFromSrcset = (ss) => {
    let best = null, bestW = -1;
    for (const part of (ss || '').split(',')) {
      const [u, d] = part.trim().split(/\s+/);
      const w = d ? parseFloat(d) * (d.endsWith('x') ? 1000 : 1) : 0;
      if (u && w > bestW) { best = u; bestW = w; }
    }
    return best;
  };
  for (const img of document.images) {
    add(biggestFromSrcset(img.srcset) || img.currentSrc || img.src, img.naturalWidth, img.naturalHeight);
    if (img.currentSrc && img.currentSrc !== img.src) add(img.src);
  }
  for (const s of document.querySelectorAll('picture source[srcset]')) add(biggestFromSrcset(s.srcset));
  for (const m of document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"], meta[property="og:image:url"]')) add(m.content);
  for (const a of document.querySelectorAll('a[href]')) if (/\.(jpe?g|png|webp|gif|avif|bmp|svg)(\?|#|$)/i.test(a.href)) add(a.href);
  for (const v of document.querySelectorAll('video[poster]')) add(v.poster);
  for (const el of document.querySelectorAll('*')) {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg.startsWith('url(')) for (const m of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) add(m[1]);
  }
  return [...out.values()];
}

function extOf(u) {
  if (u.startsWith('data:image/')) return u.slice(11, u.indexOf(';')).replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const m = /\.(jpe?g|png|webp|gif|avif|bmp|svg)(\?|#|$)/i.exec(new URL(u).pathname + ' ');
  const fm = /[?&](format|fm)=(jpe?g|png|webp|gif)/i.exec(u); // CDNs like Twitter: ?format=jpg
  return ((m && m[1]) || (fm && fm[2]) || '').toLowerCase().replace('jpeg', 'jpg');
}

function updateCount() {
  const n = [...selected].filter((u) => visible(items.find((i) => i.url === u))).length;
  $('go').textContent = `Download ${n}`;
  $('go').disabled = n === 0;
}

function visible(it) {
  if (!it) return false;
  const min = Number($('minSize').value);
  const type = $('type').value;
  const big = Math.max(it.w, it.h);
  // size unknown until the thumbnail loads: keep it visible (a hidden lazy image would never load)
  if (min && it.loaded && big < min) return false;
  if (type && it.ext !== type) return false;
  return true;
}

function render() {
  let shown = 0;
  for (const it of items) {
    const v = visible(it);
    it.el.hidden = !v;
    if (v) shown++;
    it.el.classList.toggle('sel', selected.has(it.url));
    it.el.querySelector('input').checked = selected.has(it.url);
  }
  $('msg').textContent = items.length
    ? `${items.length} images found, ${shown} shown with these filters. Click to select.`
    : 'No images found on this page. Scroll the page to load more, then Rescan.';
  $('msg').className = 'status';
  updateCount();
}

function tile(it) {
  const el = document.createElement('div');
  el.className = 'tile';
  el.innerHTML = '<input type="checkbox"><div class="thumb"><img loading="lazy" referrerpolicy="no-referrer" alt=""></div><div class="info"><span class="name"></span><span class="dim"></span></div>';
  const img = el.querySelector('img');
  const name = decodeURIComponent((it.url.startsWith('data:') ? 'inline.' + it.ext : new URL(it.url).pathname.split('/').pop()) || 'image');
  el.querySelector('.name').textContent = name;
  el.title = it.url.startsWith('data:') ? 'inline image' : it.url;
  img.onload = () => {
    it.w = Math.max(it.w, img.naturalWidth); it.h = Math.max(it.h, img.naturalHeight); it.loaded = true;
    el.querySelector('.dim').textContent = `${it.w}×${it.h}`;
    render();
  };
  img.onerror = () => { it.loaded = true; el.classList.add('broken'); el.querySelector('.dim').textContent = 'no preview'; render(); };
  img.src = it.url;
  el.onclick = () => { selected.has(it.url) ? selected.delete(it.url) : selected.add(it.url); render(); };
  return el;
}

async function scan() {
  $('msg').textContent = 'Scanning the page…';
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: collect });
    const known = new Set(items.map((i) => i.url));
    for (const r of result) {
      if (known.has(r.url)) continue;
      const it = { ...r, ext: extOf(r.url), loaded: r.w > 0 };
      it.el = tile(it);
      items.push(it);
      $('grid').append(it.el);
    }
    render();
  } catch (e) {
    $('msg').textContent = 'Could not read that tab: ' + e.message;
    $('msg').className = 'status bad';
  }
}

$('minSize').onchange = render;
$('type').onchange = render;
$('rescan').onclick = scan;
$('all').onclick = () => { items.filter(visible).forEach((i) => selected.add(i.url)); render(); };
$('none').onclick = () => { selected.clear(); render(); };
$('go').onclick = async () => {
  const chosen = items.filter((i) => selected.has(i.url) && visible(i));
  let ok = 0, fail = 0;
  $('go').disabled = true;
  for (const it of chosen) {
    if (it.url.startsWith('data:')) {
      try { await chrome.downloads.download({ url: it.url, filename: `image-${Date.now()}-${ok}.${it.ext || 'png'}` }); ok++; } catch { fail++; }
      continue;
    }
    const r = await chrome.runtime.sendMessage({ type: 'add', url: it.url, referrer: pageUrl, quiet: true });
    r && r.ok ? ok++ : fail++;
  }
  $('msg').textContent = `Sent ${ok} image${ok === 1 ? '' : 's'} to the downloader${fail ? `, ${fail} failed (is aria2 running?)` : ''}.`;
  $('msg').className = 'status ' + (fail ? 'bad' : 'ok');
  updateCount();
};

scan();
