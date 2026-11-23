// Separate progress window (used when "Progress display" is set to "Separate window",
// or when the browser can't open the toolbar popup by itself).
//   progress.html?kind=aria&id=<gid> | progress.html?kind=media&id=<id>
import { getSettings } from './rpc.js';
import { mountCard } from './progresscard.js';

const q = new URLSearchParams(location.search);
(async () => {
  const settings = await getSettings();
  mountCard(document.getElementById('card'), {
    kind: q.get('kind'), id: q.get('id'), settings,
    onClose: () => window.close(),
    onTitle: (t) => (document.title = t),
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.close(); });
})();
