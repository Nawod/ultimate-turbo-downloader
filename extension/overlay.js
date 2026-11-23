// "Download video" button that appears over videos on any page (like IDM's video panel).
(() => {
  if (window.__turboOverlay) return;
  window.__turboOverlay = true;

  const QUALITIES = [['best', 'Best quality'], ['1080', '1080p'], ['720', '720p'], ['480', '480p'], ['audio', 'Audio only (MP3)']];

  // Pages that are a single video: send the page itself.
  const SINGLE = [
    /youtube\.com\/(watch|shorts\/|live\/)/, /youtu\.be\//, /instagram\.com\/(reels?|p|tv|stories)\//,
    /tiktok\.com\/@[^/]+\/(video|photo)\//, /facebook\.com\/(watch\/?\?|reel\/|stories\/|[^/]+\/videos\/|share\/[rv]\/)/,
    /fb\.watch\//, /(x|twitter)\.com\/[^/]+\/status\//, /vimeo\.com\/\d+/, /dailymotion\.com\/video\//,
    /reddit\.com\/r\/[^/]+\/comments\//, /pornhub\.[a-z]+\/view_video/, /twitch\.tv\/(videos\/|[^/]+\/clip\/)/,
  ];
  // Links inside a feed post that point to that post's own page.
  const PERMALINK = /\/(reels?|p|tv|videos?|watch|shorts|stories|status|clip)\/|[?&]v=|\/@[^/]+\/video\//;

  let enabled = true;
  chrome.storage.local.get({ showOverlay: true }).then((s) => (enabled = s.showOverlay));
  chrome.storage.onChanged.addListener((c) => { if (c.showOverlay) enabled = c.showOverlay.newValue; });

  // ---- UI in a shadow root so page CSS can't break it ----
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;z-index:2147483647;top:0;left:0;display:none;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      .wrap { display:flex; font:600 13px/1 system-ui,"Segoe UI",sans-serif; filter:drop-shadow(0 2px 6px rgba(0,0,0,.35)); }
      button { all:unset; cursor:pointer; background:#2563eb; color:#fff; padding:8px 11px; }
      .main { border-radius:8px 0 0 8px; display:flex; gap:6px; align-items:center; }
      .more { border-radius:0 8px 8px 0; border-left:1px solid rgba(255,255,255,.3); padding:8px 8px; }
      button:hover { background:#1d4ed8; }
      .menu { position:absolute; top:36px; right:0; background:#111827; border-radius:8px; padding:4px; display:none; min-width:150px; }
      .menu.open { display:block; }
      .menu button { display:block; width:100%; box-sizing:border-box; background:transparent; padding:7px 10px; border-radius:6px; font-weight:500; }
      .menu button:hover { background:#1f2937; }
      .ok { background:#15803d !important; } .bad { background:#b91c1c !important; }
    </style>
    <div class="wrap">
      <button class="main" title="Ultimate Turbo Downloader"><span>⬇</span><span class="label">Download video</span></button>
      <button class="more" title="Choose quality">▾</button>
    </div>
    <div class="menu">${QUALITIES.map(([v, l]) => `<button data-q="${v}">${l}</button>`).join('')}</div>`;
  const main = root.querySelector('.main'), more = root.querySelector('.more'), menu = root.querySelector('.menu'), label = root.querySelector('.label');
  (document.body || document.documentElement).appendChild(host);

  let current = null, hideTimer = null, busy = false;

  function place(video) {
    const r = video.getBoundingClientRect();
    host.style.top = Math.max(4, r.top + 8) + 'px';
    host.style.left = Math.max(4, Math.min(window.innerWidth - 210, r.right - 200)) + 'px';
    host.style.display = 'block';
  }

  function videoAt(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el === host) return current;
      if (el.tagName === 'VIDEO') {
        const r = el.getBoundingClientRect();
        if (r.width >= 160 && r.height >= 90) return el;
      }
    }
    return null;
  }

  let raf = 0;
  document.addEventListener('mousemove', (e) => {
    if (!enabled || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const v = videoAt(e.clientX, e.clientY);
      if (v) {
        clearTimeout(hideTimer);
        if (v !== current && !busy) { current = v; label.textContent = 'Download video'; main.className = 'main'; }
        place(current);
      } else if (host.style.display === 'block' && !hideTimer) {
        hideTimer = setTimeout(() => { if (!menu.classList.contains('open')) host.style.display = 'none'; hideTimer = null; }, 1200);
      }
    });
  }, { passive: true });
  window.addEventListener('scroll', () => { if (current && host.style.display === 'block') place(current); }, { passive: true });

  function targetFor(video) {
    const here = location.href;
    if (SINGLE.some((re) => re.test(here))) return here;
    // In a feed: look for the post's own link near the video.
    let el = video;
    for (let i = 0; i < 25 && el; i++, el = el.parentElement) {
      for (const a of el.querySelectorAll ? el.querySelectorAll('a[href]') : []) {
        const href = a.href;
        if (href && PERMALINK.test(href) && new URL(href).hostname.replace(/^www\./, '') === location.hostname.replace(/^www\./, '')) return href;
      }
    }
    return here;
  }

  async function send(mode) {
    if (!current || busy) return;
    busy = true;
    menu.classList.remove('open');
    label.textContent = 'Sending…';
    const src = current.currentSrc || current.src || '';
    try {
      const r = await chrome.runtime.sendMessage({ type: 'grab-video', target: targetFor(current), pageUrl: location.href, src, mode });
      if (r && r.ok) { label.textContent = 'Downloading ✓'; main.className = 'main ok'; }
      else { label.textContent = (r && r.error) || 'Failed'; main.className = 'main bad'; }
    } catch (e) {
      label.textContent = 'Reload the page'; main.className = 'main bad';
    }
    setTimeout(() => { busy = false; label.textContent = 'Download video'; main.className = 'main'; }, 3500);
  }

  for (const b of [main, more, menu]) {
    b.addEventListener('mousedown', (e) => e.stopPropagation());
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
  }
  main.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); send(); });
  more.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); menu.classList.toggle('open'); });
  menu.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    const q = e.target.closest('button')?.dataset.q;
    if (q) send(q);
  });
})();
