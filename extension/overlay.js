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

  // After the extension is reloaded or updated, this copy of the script stays on already-open pages but
  // loses access to chrome.* ("Extension context invalidated"). Detect that and switch off quietly.
  const alive = () => { try { return !!chrome.runtime?.id; } catch { return false; } };

  let enabled = true;
  try {
    chrome.storage.local.get({ showOverlay: true }).then((s) => (enabled = s.showOverlay), () => {});
    chrome.storage.onChanged.addListener((c) => { if (c.showOverlay) enabled = c.showOverlay.newValue; });
  } catch { /* context already gone */ }

  // ---- UI in a shadow root so page CSS can't break it ----
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;z-index:2147483647;top:0;left:0;display:none;';
  const root = host.attachShadow({ mode: 'closed' });
  // Built with DOM calls, not innerHTML: sites that enforce Trusted Types (YouTube, Google…) throw a
  // TypeError on innerHTML assignments.
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v);
    }
    n.append(...kids);
    return n;
  };
  const style = el('style', { text: `
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
      .close { margin-left:4px; border-radius:50%; width:30px; height:30px; padding:0; display:flex; align-items:center; justify-content:center; background:rgba(17,24,39,.85); font-size:15px; line-height:1; }
      .close:hover { background:#111827; }
  ` });
  const label = el('span', { class: 'label', text: 'Download video' });
  const main = el('button', { class: 'main', title: 'Ultimate Turbo Downloader' }, el('span', { text: '⬇' }), label);
  const more = el('button', { class: 'more', title: 'Choose quality', text: '▾' });
  const close = el('button', { class: 'close', title: 'Hide for this video', 'aria-label': 'Hide for this video', text: '✕' });
  const menu = el('div', { class: 'menu' }, ...QUALITIES.map(([v, l]) => el('button', { 'data-q': v, text: l })));
  root.append(style, el('div', { class: 'wrap' }, main, more, close), menu);
  (document.body || document.documentElement).appendChild(host);

  let current = null, hideTimer = null, busy = false;
  const dismissed = new WeakSet(); // videos the user closed the button on (until the page reloads)

  function hide() { menu.classList.remove('open'); host.style.display = 'none'; clearTimeout(hideTimer); hideTimer = null; }

  function place(video) {
    const r = video.getBoundingClientRect();
    host.style.top = Math.max(4, r.top + 8) + 'px';
    host.style.left = Math.max(4, Math.min(window.innerWidth - 244, r.right - 234)) + 'px';
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
  // The extension was reloaded: remove this orphaned copy (the page gets a fresh one on its next load).
  function teardown() {
    document.removeEventListener('mousemove', onMove);
    window.removeEventListener('scroll', onScroll);
    host.remove();
    window.__turboOverlay = false;
  }
  const onScroll = () => { if (current && host.style.display === 'block') place(current); };
  function onMove(e) {
    if (!enabled || raf) return;
    if (!alive()) return teardown();
    raf = requestAnimationFrame(() => {
      raf = 0;
      const found = videoAt(e.clientX, e.clientY);
      const v = found && !dismissed.has(found) ? found : null;
      if (v) {
        clearTimeout(hideTimer);
        if (v !== current && !busy) { current = v; label.textContent = 'Download video'; main.className = 'main'; }
        place(current);
      } else if (host.style.display === 'block' && !hideTimer) {
        hideTimer = setTimeout(() => { if (!menu.classList.contains('open')) host.style.display = 'none'; hideTimer = null; }, 1200);
      }
    });
  }
  document.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });

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

  for (const b of [main, more, menu, close]) {
    b.addEventListener('mousedown', (e) => e.stopPropagation());
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
  }
  main.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); send(); });
  close.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (current) dismissed.add(current);
    hide();
  });
  more.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); menu.classList.toggle('open'); });
  menu.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    const q = e.target instanceof Element ? e.target.closest('button')?.dataset.q : undefined;
    if (q) send(q);
  });
})();
