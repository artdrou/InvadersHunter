/* InvadersHunter — petit moteur commun des maquettes.
 * À charger après lucide : <script src="https://unpkg.com/lucide@0.344.0/dist/umd/lucide.min.js"></script>
 *
 * Ce qu'il fait au chargement de la page :
 *  - thème : bouton dans <div class="theme-switch"></div>, ?theme=light dans l'URL, mémorisé entre les pages
 *  - ?embed : cache tout sauf le téléphone (utilisé par la galerie index.html)
 *  - <nav class="tabs" data-active="map"></nav> vide → remplie avec les onglets de l'app
 *      options : data-admin="1" (onglet Admin), data-social-badge="2"
 *  - <i class="spr" data-w="24" data-color="var(--success)"></i> → sprite d'invader en pixels
 *  - <img class="mk" data-pts="20" data-state="captured"> → marqueur de l'app
 *      états : captured, uncaptured, mine, friend, grey ; points : 10 20 30 40 50 100
 *  - <canvas class="map"></canvas> → fond de carte dessiné aux couleurs du thème
 *  - <i data-lucide="nom"></i> → icône Lucide (lucide.dev/icons) */
(function () {
  'use strict';
  const BASE = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '');
  const THEMES = [['dark', 'Sombre'], ['light', 'Clair'], ['amber', 'Ambre'], ['matrix', 'Matrix']];
  const params = new URLSearchParams(location.search);

  function storedTheme() {
    try { return localStorage.getItem('ih-mock-theme'); } catch (e) { return null; }
  }
  function setTheme(name) {
    document.querySelectorAll('.phone').forEach((p) => p.setAttribute('data-theme', name));
    document.querySelectorAll('.theme-switch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === name)));
    try { localStorage.setItem('ih-mock-theme', name); } catch (e) {}
    requestAnimationFrame(() => document.querySelectorAll('canvas.map').forEach(drawMap));
  }

  // ─── Sprite invader (crabe 11 × 8) ────────────────────────────────────────
  const CRAB = ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'];
  function sprite(color, w) {
    const h = Math.round(w * 8 / 11);
    let r = '';
    CRAB.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'X') r += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`; }));
    return `<svg class="spr" width="${w}" height="${h}" viewBox="0 0 11 8" style="fill:${color}" aria-hidden="true">${r}</svg>`;
  }

  // ─── Onglets ──────────────────────────────────────────────────────────────
  function fillTabs(nav) {
    const tabs = [
      ['map', '<i data-lucide="map"></i>', 'Carte'],
      ['invaders', sprite('currentColor', 26), 'Invaders'],
      ['social', '<i data-lucide="users"></i>', 'Social'],
      ['settings', '<i data-lucide="settings"></i>', 'Reglages'],
    ];
    if (nav.dataset.admin) tabs.push(['admin', '<i data-lucide="shield-check"></i>', 'Admin']);
    nav.innerHTML = tabs.map(([k, icon, label]) => {
      const badge = k === 'social' && nav.dataset.socialBadge ? `<span class="tab-badge">${nav.dataset.socialBadge}</span>` : '';
      return `<div class="tab${k === nav.dataset.active ? ' active' : ''}">${icon}${badge}<span>${label}</span></div>`;
    }).join('');
  }

  // ─── Fond de carte ────────────────────────────────────────────────────────
  function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
  function drawMap(cv) {
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    const css = getComputedStyle(cv);
    const v = (k) => css.getPropertyValue(k).trim();
    const R = rng(Number(cv.dataset.seed) || 42);
    g.fillStyle = v('--map-land'); g.fillRect(0, 0, W, H);
    g.fillStyle = v('--map-park');
    [[.08, .62, .2, .1], [.7, .1, .16, .12], [.52, .8, .22, .08]].forEach(([x, y, w, h]) => g.fillRect(x * W, y * H, w * W, h * H));
    g.save(); g.translate(W / 2, H / 2); g.rotate(-0.32);
    g.strokeStyle = v('--map-street'); g.lineWidth = 2;
    for (let i = -W; i < W; i += 22 + R() * 14) { g.beginPath(); g.moveTo(i, -H); g.lineTo(i + R() * 20 - 10, H); g.stroke(); }
    for (let j = -H; j < H; j += 26 + R() * 16) { g.beginPath(); g.moveTo(-W, j); g.lineTo(W, j + R() * 24 - 12); g.stroke(); }
    g.restore();
    g.strokeStyle = v('--map-water'); g.lineWidth = 18; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-20, H * .5); g.bezierCurveTo(W * .3, H * .36, W * .55, H * .68, W + 20, H * .52); g.stroke();
    g.strokeStyle = v('--map-road'); g.lineWidth = 5;
    [[0, .18, 1, .32], [.15, 0, .38, 1], [.62, 0, .8, 1], [0, .82, 1, .7], [.05, 1, .95, .05]].forEach(([a, b, c, d]) => {
      g.beginPath(); g.moveTo(a * W, b * H); g.lineTo(c * W, d * H); g.stroke();
    });
  }

  // ─── Démarrage ────────────────────────────────────────────────────────────
  function init() {
    if (params.has('embed')) document.body.classList.add('embed');

    document.querySelectorAll('.theme-switch').forEach((box) => {
      box.innerHTML = THEMES.map(([k, l]) => `<button type="button" data-theme="${k}">${l}</button>`).join('');
      box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTheme(b.dataset.theme); });
    });
    document.querySelectorAll('nav.tabs:empty').forEach(fillTabs);
    document.querySelectorAll('i.spr').forEach((el) => { el.outerHTML = sprite(el.dataset.color || 'var(--success)', Number(el.dataset.w) || 22); });
    document.querySelectorAll('img.mk').forEach((img) => {
      const pts = img.dataset.pts || '20';
      const state = img.dataset.state === 'grey' ? 'grey' : `flash-${img.dataset.state || 'uncaptured'}`;
      img.src = `${BASE}assets/marker-${pts}pts-${state}.png`;
      img.alt = '';
      if (!img.getAttribute('width')) img.width = { 10: 26, 20: 30, 30: 34, 40: 36, 50: 40, 100: 46 }[pts] || 30;
    });
    if (window.lucide) window.lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });

    setTheme(params.get('theme') || storedTheme() || 'dark');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  if (document.fonts) document.fonts.ready.then(() => document.querySelectorAll('canvas.map').forEach(drawMap));

  window.IH = { sprite, drawMap, setTheme };
})();
