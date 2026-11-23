// Shared settings + aria2 JSON-RPC client.
export const DEFAULTS = {
  enabled: true,
  rpcUrl: 'http://127.0.0.1:6800/jsonrpc',
  secret: '',
  connections: 16,    // starting connections; halves automatically if a server refuses them
  dir: '',            // empty = aria2's own dir from aria2.conf
  skipExt: '',        // comma list, e.g. "torrent,ics"
  minSizeMB: 0,       // only take downloads at least this big (0 = all; unknown size is always taken)
  mediaUrl: 'http://127.0.0.1:6801', // media server (yt-dlp)
  videoQuality: 'best',
  showOverlay: true,  // "Download video" button over videos on pages
  progressUi: 'popup',      // where a new download's progress shows: 'popup' (toolbar popup), 'window', 'off'
  progressAutoClose: false, // close it by itself when the download finishes
};

export async function getSettings() {
  const s = await chrome.storage.local.get({ ...DEFAULTS, progressWindow: true });
  if (s.progressWindow === false && !(await chrome.storage.local.get('progressUi')).progressUi) s.progressUi = 'off'; // v1.2 setting
  delete s.progressWindow;
  return { ...DEFAULTS, ...s };
}

let nextId = 1;
export async function rpc(method, params = [], settings, timeoutMs = 4000) {
  const s = settings || (await getSettings());
  const body = {
    jsonrpc: '2.0',
    id: String(nextId++),
    method: method.startsWith('system.') ? method : 'aria2.' + method,
    params: s.secret ? ['token:' + s.secret, ...params] : params,
  };
  const res = await fetch(s.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'aria2 error');
  return json.result;
}

export async function isAlive(settings) {
  try {
    await rpc('getVersion', [], settings, 1500);
    return true;
  } catch {
    return false;
  }
}

// Decimal units everywhere (1 MB = 1,000,000 bytes), the same as internet speeds are sold in.
export function fmtBytes(n) {
  n = Number(n) || 0;
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (i ? n.toFixed(n < 10 ? 2 : 1) : Math.round(n)) + ' ' + u[i];
}

export function fmtEta(sec) {
  sec = Math.round(Number(sec));
  if (!isFinite(sec) || sec <= 0) return '';
  if (sec < 60) return sec + 's left';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s left`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m left`;
}

export function nameOf(task) {
  const f = task.files && task.files[0];
  if (f && f.path) return f.path.split(/[\\/]/).pop();
  const uri = f && f.uris && f.uris[0] && f.uris[0].uri;
  if (uri) {
    try { return decodeURIComponent(new URL(uri).pathname.split('/').pop()) || uri; } catch { return uri; }
  }
  return task.gid;
}
