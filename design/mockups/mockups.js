/* InvadersHunter — maquettes : données d'exemple + rendu des écrans pour chaque direction.
 * Une page appelle MOCK.mount(root, { screens }) ; la galerie gère les boutons écran / thème. */
(function () {
  'use strict';

  // ─── Données d'exemple (fictives) ──────────────────────────────────────────
  const USER = { name: 'artdrou', flashes: 412, points: 9840, cities: 7, rank: 1286 };
  const POPUP = {
    name: 'PA_1042', points: 30, state: 'Bon état', posed: 'déc. 2019', flashed: '3 mai 2025',
    comments: 4, by: 'mosaic_mia', updated: 'spotter',
    top: 'Au-dessus de la boulangerie, visible depuis le pont.', topBy: 'leo.flash',
  };
  const CITIES = [
    { code: 'PA', name: 'Paris', got: 412, total: 1489, open: true },
    { code: 'LDN', name: 'Londres', got: 37, total: 151 },
    { code: 'MARS', name: 'Marseille', got: 64, total: 123 },
    { code: 'RN', name: 'Rennes', got: 18, total: 42 },
    { code: 'NY', name: 'New York', got: 0, total: 178 },
  ];
  const ROWS = [
    { n: 'PA_1038', p: 20, c: true, s: 'Bon état' },
    { n: 'PA_1039', p: 30, c: false, s: 'Dégradé' },
    { n: 'PA_1040', p: 10, c: true, s: 'Bon état' },
    { n: 'PA_1041', p: 50, c: false, s: 'Bon état' },
    { n: 'PA_1042', p: 30, c: true, s: 'Bon état' },
    { n: 'PA_1043', p: 20, c: false, s: 'Détruit' },
    { n: 'PA_1044', p: 40, c: true, s: 'Bon état' },
  ];
  // Positions des marqueurs en % de la zone carte, avec points et statut flashé.
  const MARKERS = [
    [18, 22, 20, 1], [30, 30, 10, 0], [44, 19, 30, 1], [62, 27, 20, 0], [78, 21, 50, 0],
    [24, 41, 30, 0], [39, 45, 20, 1], [56, 39, 10, 1], [71, 44, 30, 0], [86, 36, 20, 1],
    [14, 56, 10, 1], [33, 60, 50, 0], [49, 54, 30, 1, 'sel'], [66, 58, 20, 0], [81, 62, 10, 1],
    [22, 72, 20, 0], [43, 74, 10, 1], [60, 70, 30, 0], [75, 77, 20, 1], [36, 85, 30, 1], [55, 88, 10, 0],
  ];

  // ─── Sprite invader (art pixel, réservé au logo et aux marqueurs) ──────────
  const CRAB = ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'];
  function sprite(color, w, eye) {
    const h = Math.round(w * 8 / 11);
    let r = '';
    CRAB.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'X') r += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`; }));
    const eyes = eye ? `<rect x="3" y="3" width="1" height="1" fill="${eye}"/><rect x="7" y="3" width="1" height="1" fill="${eye}"/>` : '';
    return `<svg class="spr" width="${w}" height="${h}" viewBox="0 0 11 8" style="fill:${color}" aria-hidden="true">${r}${eyes}</svg>`;
  }
  const ic = (n) => `<i data-lucide="${n}"></i>`;

  // ─── Carte procédurale (canvas) ────────────────────────────────────────────
  function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
  function drawMap(cv) {
    const box = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = box.width, H = box.height;
    if (!W || !H) return;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    const css = getComputedStyle(cv);
    const v = (k) => css.getPropertyValue(k).trim();
    const R = rng(42);
    g.fillStyle = v('--m-land'); g.fillRect(0, 0, W, H);
    g.fillStyle = v('--m-park');
    [[.08, .62, .2, .1], [.7, .1, .16, .12], [.52, .8, .22, .08]].forEach(([x, y, w, h]) => g.fillRect(x * W, y * H, w * W, h * H));
    // Petites rues : grille légèrement tournée
    g.save(); g.translate(W / 2, H / 2); g.rotate(-0.32);
    g.strokeStyle = v('--m-road2'); g.lineWidth = 2;
    for (let i = -W; i < W; i += 22 + R() * 14) { g.beginPath(); g.moveTo(i, -H); g.lineTo(i + R() * 20 - 10, H); g.stroke(); }
    for (let j = -H; j < H; j += 26 + R() * 16) { g.beginPath(); g.moveTo(-W, j); g.lineTo(W, j + R() * 24 - 12); g.stroke(); }
    g.restore();
    // Fleuve
    g.strokeStyle = v('--m-water'); g.lineWidth = 18; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-20, H * .5); g.bezierCurveTo(W * .3, H * .36, W * .55, H * .68, W + 20, H * .52); g.stroke();
    // Grands axes
    g.strokeStyle = v('--m-road'); g.lineWidth = 5;
    [[0, .18, 1, .32], [.15, 0, .38, 1], [.62, 0, .8, 1], [0, .82, 1, .7], [.05, 1, .95, .05]].forEach(([a, b, c, d]) => {
      g.beginPath(); g.moveTo(a * W, b * H); g.lineTo(c * W, d * H); g.stroke();
    });
  }

  // ─── Marqueurs par direction ───────────────────────────────────────────────
  const SIZE = { 10: 22, 20: 26, 30: 30, 40: 32, 50: 36 };
  function markers(dir, prefix) {
    return MARKERS.map(([x, y, p, c, sel]) => {
      const s = SIZE[p];
      let inner;
      if (dir === 'actuel') {
        inner = `<img src="${prefix}assets/marker-${p}pts-flash-${c ? 'captured' : 'uncaptured'}.png" width="${s + 6}" alt="">`;
      } else if (dir === 'neon') {
        const col = c ? 'var(--p-ok)' : 'var(--p-ko)';
        inner = `<div class="pin${sel ? ' sel' : ''}" style="--s:${s}px;--c:${col}">${sprite(c ? '#e8fbff' : '#ffe1ec', Math.round(s * .58))}</div>`;
      } else if (dir === 'arcade') {
        const col = c ? '#1cffb7' : '#ff0062';
        inner = `<div style="filter:drop-shadow(2px 2px 0 #000)">${sprite(col, s + 2, '#0b0820')}</div>`;
      } else {
        const col = c ? 'var(--p-accent)' : 'var(--p-ko)';
        inner = `<div class="tile${c ? '' : ' un'}${sel ? ' sel' : ''}" style="--s:${s - 4}px;--c:${col}">${sprite(c ? '#fff' : col, Math.round(s * .6))}</div>`;
      }
      return `<div class="marker${sel ? ' sel' : ''}" style="left:${x}%;top:${y}%">${inner}</div>`;
    }).join('');
  }

  // ─── Barre d'état + onglets ────────────────────────────────────────────────
  const SB = '<div class="sb"><span>12:47</span><span class="ic"><s></s><i></i></span></div>';
  function tabs(dir, active) {
    const invColor = 'currentColor';
    const t = [
      ['map', ic('map'), 'Carte'],
      ['inv', sprite(invColor, 22), 'Invaders'],
      ['soc', ic('users'), 'Social'],
      ['set', dir === 'neon' || dir === 'mosaique' ? ic('user') : ic('settings'), dir === 'neon' || dir === 'mosaique' ? 'Moi' : 'Réglages'],
    ];
    return `<nav class="tabs">${t.map(([k, i, l]) => `<div class="tab${k === active ? ' on' : ''}">${i}<span>${l}</span></div>`).join('')}</nav>`;
  }

  // ─── Écran Carte ───────────────────────────────────────────────────────────
  const MAP = {
    actuel: (pfx) => `
      <div class="scr on-map">${SB}
        <div class="body"><canvas class="map"></canvas>${markers('actuel', pfx)}
          <div class="mfilter"><span class="on">toutes</span><span>flashés</span><span>non flashés</span><span>flashables</span></div>
          <div class="fab hot" style="top:78px">${ic('newspaper')}<span class="badge">3</span></div>
          <div class="fab" style="top:128px">${ic('users')}</div>
          <div class="fab" style="top:178px">${ic('crosshair')}</div>
          <div class="fab" style="top:228px">${ic('compass')}</div>
          <div class="popup">
            <div class="hd"><span class="nm">${POPUP.name}</span><span class="x">✕</span></div>
            <div class="ph">${sprite('#1cffb7', 96)}</div>
            <hr>
            <div class="kv"><b>Points</b><span>${POPUP.points}</span></div>
            <div class="kv"><b>État</b><span>Bon</span></div>
            <div class="kv"><b>Posé</b><span>12/2019</span></div>
            <div class="kv"><b>Flashé</b><span class="ok">03/05/2025</span></div>
            <div class="cm">💬 ${POPUP.top}</div>
            <div class="by">Découvert par <em>${POPUP.by}</em></div>
            <hr>
            <div class="links">${ic('navigation')}${ic('instagram')}${ic('globe')}${ic('message-circle')}</div>
            <div class="flash">Déflasher</div>
            <div class="mod">Modifier</div>
          </div>
        </div>${tabs('actuel', 'map')}
      </div>`,

    neon: (pfx) => `
      <div class="scr on-map">${SB}
        <div class="body"><canvas class="map"></canvas><div class="loc"></div>${markers('neon', pfx)}
          <div class="chips"><span class="chip on">Tous<b>1489</b></span><span class="chip">À flasher<b>1077</b></span><span class="chip">Flashés<b>412</b></span></div>
          <div class="fabs">
            <div class="fab">${ic('newspaper')}<span class="dot">3</span></div>
            <div class="fab">${ic('users')}</div>
            <div class="fab">${ic('route')}</div>
            <div class="fab">${ic('locate-fixed')}</div>
          </div>
          <div class="sheet" style="bottom:72px">
            <div class="grab"></div>
            <div class="sh-hd">
              <div class="thumb">${sprite('#1cf0ff', 54)}</div>
              <div style="min-width:0">
                <h3>${POPUP.name}</h3>
                <div class="tags"><span class="tag pts">+${POPUP.points} pts</span><span class="tag ok">● ${POPUP.state}</span><span class="tag">350 m</span></div>
              </div>
            </div>
            <div class="stats">
              <div class="stat"><small>Posé</small><span>12/2019</span></div>
              <div class="stat"><small>Flashé</small><span>03/05/25</span></div>
              <div class="stat"><small>Flashs</small><span>2 318</span></div>
            </div>
            <div class="quote">${ic('message-circle')}<span>${POPUP.top} <em>— ${POPUP.topBy}</em></span></div>
            <div class="acts">
              <span class="ib">${ic('instagram')}</span>
              <span class="ib">${ic('message-circle')}<span class="n">${POPUP.comments}</span></span>
              <span class="ib">${ic('navigation')}</span>
              <span class="cta">${ic('check')} Flashé</span>
            </div>
            <div class="sh-ft"><span>Découvert par <u>${POPUP.by}</u></span><u>Proposer une modification</u></div>
          </div>
          ${tabs('neon', 'map')}
        </div>
      </div>`,

    arcade: (pfx) => `
      <div class="scr on-map">${SB}
        <div class="body"><canvas class="map"></canvas>${markers('arcade', pfx)}
          <div class="hud">
            <div class="box">SCORE<b>09840</b></div>
            <div class="box">FLASH<b>412</b></div>
            <div class="grow"></div>
            <div class="box">PARIS<b>28%</b></div>
          </div>
          <div class="afilter"><span class="on">TOUS</span><span>À FLASHER</span><span>FLASHÉS</span></div>
          <div class="afab hot" style="top:124px">${ic('newspaper')}<em>3</em></div>
          <div class="afab" style="top:172px">${ic('users')}</div>
          <div class="afab" style="top:220px">${ic('crosshair')}</div>
          <div class="dlg">
            <div class="tt"><span>${POPUP.name}</span><span>✕</span></div>
            <div class="in">
              <div class="ph">${sprite('#1cffb7', 66, '#0b0820')}</div>
              <div class="kv">
                <div><b>POINTS</b><span class="big">+${POPUP.points}</span></div>
                <div><b>ÉTAT</b><span class="ok">BON</span></div>
                <div><b>POSÉ</b><span>12/2019</span></div>
                <div><b>FLASHÉ</b><span class="ok">03/05/25</span></div>
              </div>
            </div>
            <div class="say"><span>${POPUP.topBy}&gt;</span> ${POPUP.top}</div>
            <div class="bt">
              <span class="sqb">${ic('navigation')}</span>
              <span class="sqb">${ic('message-circle')}<em>${POPUP.comments}</em></span>
              <span class="sqb">${ic('pencil')}</span>
              <span class="go">FLASHÉ ✓</span>
            </div>
          </div>
        </div>${tabs('arcade', 'map')}
      </div>`,

    mosaique: (pfx) => `
      <div class="scr on-map">${SB}
        <div class="body"><canvas class="map"></canvas>${markers('mosaique', pfx)}
          <div class="mtop">
            <div class="plaque"><div>11<sup>e</sup> arrt<b>Paris</b></div></div>
            <div class="segm"><span class="on">Tous</span><span>À flasher</span><span>Flashés</span></div>
          </div>
          <div class="mfab" style="top:96px">${ic('newspaper')}<em>3</em></div>
          <div class="mfab" style="top:146px">${ic('users')}</div>
          <div class="mfab" style="top:196px">${ic('locate-fixed')}</div>
          <div class="cartel">
            <div class="top">
              <div class="ph">${sprite('#1b3f94', 78)}</div>
              <div class="tx">
                <div class="ey">Mosaïque · 30 points</div>
                <h3>${POPUP.name}</h3>
                <dl><dt>État</dt><dd>${POPUP.state}</dd><dt>Posé</dt><dd>Déc. 2019</dd><dt>Flashé</dt><dd>3 mai 2025</dd></dl>
              </div>
            </div>
            <div class="note">« ${POPUP.top} » <b>${POPUP.topBy}</b></div>
            <div class="ft">
              <span class="ib">${ic('navigation')}</span>
              <span class="ib">${ic('message-circle')}<em>${POPUP.comments}</em></span>
              <span class="ib">${ic('pencil')}</span>
              <span class="go">Flashé ✓</span>
            </div>
          </div>
        </div>${tabs('mosaique', 'map')}
      </div>`,
  };

  // ─── Écran Invaders (liste) ────────────────────────────────────────────────
  const pct = (c) => Math.round(c.got / c.total * 100);
  const LIST = {
    actuel: () => `
      <div class="scr">${SB}
        <div class="tbar"><span class="sq on">${ic('list')}</span><span class="sq">${ic('layout-grid')}</span><span class="sq">${ic('sliders-horizontal')}</span><span class="grow"></span><span class="sq">${ic('newspaper')}</span></div>
        <div class="body">
          ${CITIES.map((c, i) => `
            <div class="city"><span class="cn">${c.code}</span><span class="cc">${c.got}/${c.total}</span><span class="chev">${c.open ? '▲' : '▼'}</span></div>
            ${c.open ? ROWS.map((r) => `<div class="irow${r.c ? ' cap' : ''}"><span class="in">${r.n}</span><span class="pt">${r.p}pts</span>${r.c ? '<span class="ck">✓</span>' : ''}<span class="chev">▼</span></div>`).join('') : ''}`).join('')}
        </div>${tabs('actuel', 'inv')}
      </div>`,

    neon: () => `
      <div class="scr">${SB}
        <div class="head">
          <h2>Invaders <small>412 / 4 210</small></h2>
          <div class="search"><div>${ic('search')} PA_, ville, état…</div><span class="sq">${ic('layout-grid')}</span><span class="sq">${ic('sliders-horizontal')}</span></div>
        </div>
        <div class="body"><div class="list">
          ${CITIES.slice(0, 4).map((c) => `
            <div class="ccard">
              <div class="chd"><span class="code">${c.code}</span>
                <div class="nm">${c.name}<small>${c.got} / ${c.total} flashés</small><div class="bar"><i style="width:${pct(c)}%"></i></div></div>
                <span class="pct">${pct(c)}%</span></div>
              ${c.open ? ROWS.slice(0, 5).map((r) => `
                <div class="irow"><span class="ico">${sprite(r.c ? 'var(--p-ok)' : 'var(--p-muted)', 20)}</span>
                  <span style="flex:1;min-width:0"><span class="in">${r.n}</span><br><span class="st">${r.s}</span></span>
                  <span class="pt">${r.p}</span>${r.c ? `<span class="ck">${ic('check')}</span>` : '<span class="no"></span>'}</div>`).join('') : ''}
            </div>`).join('')}
        </div></div>${tabs('neon', 'inv')}
      </div>`,

    arcade: () => `
      <div class="scr">${SB}
        <div class="atitle">HIGH SCORE<small>412 FLASHS · 7 VILLES · RANG #${USER.rank}</small></div>
        <div class="body">
          ${CITIES.slice(0, 4).map((c) => `
            <div class="ablk">
              <div class="ach"><span class="cd">${c.code}</span><span class="nm">${c.name.toUpperCase()}</span><span class="sc">${c.got}/${c.total}</span></div>
              <div class="pbar">${Array.from({ length: 20 }, (_, i) => `<i class="${i < Math.round(pct(c) / 5) ? 'f' : ''}"></i>`).join('')}</div>
              ${c.open ? ROWS.slice(0, 6).map((r, i) => `<div class="arow${r.c ? ' cap' : ''}"><span class="rk">${r.c ? '✓' : '·'}</span><span class="in">${r.n}</span><span class="pt">${r.p}</span></div>`).join('') : ''}
            </div>`).join('')}
        </div>${tabs('arcade', 'inv')}
      </div>`,

    mosaique: () => `
      <div class="scr">${SB}
        <div class="mhead"><h2>Invaders</h2><span><b>412 / 4 210</b>flashés dans 7 villes</span></div>
        <div class="mtabs"><span class="on">Par ville</span><span>Par points</span><span>À proximité</span></div>
        <div class="body">
          <div class="csec">
            <div class="plaque"><div>Paris <small>PA</small></div></div>
            <div class="meta"><span><b>412</b> / 1 489 flashés</span><span>28 %</span></div>
            <div class="grid">${Array.from({ length: 60 }, (_, i) => `<i class="${[0, 2, 4, 6, 7, 11, 13, 17, 18, 22, 25, 29, 30, 33, 38, 41, 44, 47, 52, 58].includes(i) ? 'c' : (i % 13 === 5 ? 'd' : '')}"></i>`).join('')}</div>
          </div>
          <div style="height:8px"></div>
          ${ROWS.slice(0, 5).map((r) => `
            <div class="mrow"><span class="tile${r.c ? '' : ' un'}" style="--c:${r.c ? 'var(--p-accent)' : 'var(--p-border)'}">${sprite(r.c ? '#fff' : 'var(--p-muted)', 16)}</span>
              <span class="in">${r.n}<small>${r.s}${r.c ? ' · flashé' : ''}</small></span><span class="pt">${r.p} <small>pts</small></span></div>`).join('')}
          <div class="csec"><div class="plaque"><div>Marseille <small>MARS</small></div></div>
            <div class="meta"><span><b>64</b> / 123 flashés</span><span>52 %</span></div></div>
        </div>${tabs('mosaique', 'inv')}
      </div>`,
  };

  // ─── Écran Réglages / Profil ───────────────────────────────────────────────
  const SET = [
    ['Compte', [['user', 'Profil', "Nom d'utilisateur, statistiques"], ['lock', 'Sécurité', 'Email, mot de passe']]],
    ['Personnalisation', [['palette', 'Apparence', 'Thème et couleur'], ['shapes', 'Markers', 'Formes, couleurs et lueur'], ['languages', 'Langue', null, 'lang'], ['vibrate', 'Vibrations', null, 'on'], ['bell', 'Notifications', 'Alertes de nouveaux invaders', 'on']]],
    ['Données', [['refresh-cw', 'Synchronisation', 'Données et flashes'], ['download', 'Importer mes flashs', 'Depuis FlashInvaders, via un PC']]],
    ['À propos', [['info', 'À propos', 'Version, crédits'], ['mail', 'Contact', 'Joindre le développeur'], ['coffee', 'Soutenir', 'Offrir un café au dev']]],
  ];
  const SETTINGS = {
    actuel: () => `
      <div class="scr">${SB}
        <div class="stitle">Réglages</div>
        <div class="body">
          ${SET.slice(0, 3).map(([h, rows]) => `<div class="sec">${h}</div>${rows.map(([i, l, s, k]) => `
            <div class="srow">${ic(i)}<span class="t">${l}${s ? `<small>${s}</small>` : ''}</span>${
              k === 'lang' ? '<span class="pill on">FR</span><span class="pill">EN</span>' : k === 'on' ? '<span class="sw on"></span>' : '<span class="cv">›</span>'}</div>`).join('')}`).join('')}
        </div>${tabs('actuel', 'set')}
      </div>`,

    neon: () => `
      <div class="scr">${SB}
        <div class="head"><h2>Moi</h2></div>
        <div class="body">
          <div class="pcard">
            <div class="who"><span class="avatar">${sprite('var(--p-accent)', 34)}</span><div><b>${USER.name}</b><small>Chasseur depuis mars 2024 · rang #${USER.rank}</small></div></div>
            <div class="pstats"><div><span>${USER.flashes}</span><small>Flashs</small></div><div><span>9,8k</span><small>Points</small></div><div><span>${USER.cities}</span><small>Villes</small></div></div>
          </div>
          ${SET.slice(1, 3).map(([h, rows]) => `<div class="group"><h4>${h}</h4><div class="glist">${rows.map(([i, l, s, k]) => `
            <div class="srow"><span class="sic">${ic(i)}</span><span class="t">${l}${s ? `<small>${s}</small>` : ''}</span>${
              k === 'lang' ? '<span class="seg2"><span class="on">FR</span><span>EN</span></span>' : k === 'on' ? '<span class="sw on"></span>' : `<span class="cv">${ic('chevron-right')}</span>`}</div>`).join('')}</div></div>`).join('')}
        </div>${tabs('neon', 'set')}
      </div>`,

    arcade: () => `
      <div class="scr">${SB}
        <div class="atitle">OPTIONS</div>
        <div class="body">
          <div class="p1"><span>${sprite('#ffd000', 44, '#160f38')}</span>
            <div class="who">PLAYER 1<small>${USER.name.toUpperCase()} · RANG #${USER.rank}</small></div>
            <div class="sc"><span>SCORE<b>09840</b></span><span>FLASHS<b>412</b></span><span>VILLES<b>7</b></span></div>
          </div>
          <div class="amenu">
            <h4>// COMPTE</h4>
            <div class="aopt">${ic('user')}<span class="t">PROFIL</span></div>
            <div class="aopt">${ic('lock')}<span class="t">SÉCURITÉ</span></div>
            <h4>// JEU</h4>
            <div class="aopt cur">${ic('palette')}<span class="t">APPARENCE</span><span class="v">NÉON</span></div>
            <div class="aopt">${ic('shapes')}<span class="t">MARKERS</span></div>
            <div class="aopt">${ic('languages')}<span class="t">LANGUE</span><span class="v">◀ FR ▶</span></div>
            <div class="aopt">${ic('vibrate')}<span class="t">VIBRATIONS</span><span class="v on">ON</span></div>
            <div class="aopt">${ic('bell')}<span class="t">NOTIFICATIONS</span><span class="v on">ON</span></div>
            <h4>// DONNÉES</h4>
            <div class="aopt">${ic('refresh-cw')}<span class="t">SYNCHRO</span></div>
          </div>
        </div>${tabs('arcade', 'set')}
      </div>`,

    mosaique: () => `
      <div class="scr">${SB}
        <div class="mhead"><h2>Moi</h2></div>
        <div class="body">
          <div class="idc"><span class="tile" style="--c:var(--p-accent)">${sprite('#fff', 34)}</span>
            <div><b>${USER.name}</b><small>Chasseur depuis mars 2024</small>
              <div class="nums"><span><b>${USER.flashes}</b> flashs</span><span><b>9 840</b> pts</span><span><b>7</b> villes</span></div></div>
          </div>
          ${SET.slice(1, 3).map(([h, rows]) => `<div class="mgroup"><h4>${h}</h4>${rows.map(([i, l, s, k]) => `
            <div class="msr">${ic(i)}<span class="t">${l}${s ? `<small>${s}</small>` : ''}</span>${
              k === 'lang' ? '<span class="lg"><b>FR</b> · EN</span>' : k === 'on' ? '<span class="sw on"></span>' : `<span class="cv">${ic('chevron-right')}</span>`}</div>`).join('')}</div>`).join('')}
        </div>${tabs('mosaique', 'set')}
      </div>`,
  };

  // ─── Directions et écrans ──────────────────────────────────────────────────
  const DIRS = [
    { id: 'actuel', tag: 'Actuel', name: "L'app aujourd'hui", modes: ['dark', 'light'],
      desc: 'Reproduction de la version 0.2.0 : police pixel partout, cadres carrés, popup en liste de champs.' },
    { id: 'neon', tag: 'A', name: 'Néon', modes: ['dark', 'light'],
      desc: 'Le style du site vitrine. Texte lisible, pixel réservé aux noms, chiffres et sprites. Feuille du bas, lueurs cyan / magenta, barre d’onglets flottante.' },
    { id: 'arcade', tag: 'B', name: 'Arcade', modes: ['dark'],
      desc: 'On assume le jeu : HUD de score, tout en pixel, ombres dures, boîte de dialogue façon RPG. Sombre uniquement.' },
    { id: 'mosaique', tag: 'C', name: 'Mosaïque', modes: ['light', 'dark'],
      desc: 'Le monde réel du street art : carreaux de céramique, plaques de rue émaillées, cartel de musée. Clair d’abord.' },
  ];
  const SCREENS = {
    carte: { title: 'Carte + popup', sub: 'Onglet Carte avec un invader sélectionné (PA_1042).', r: MAP },
    invaders: { title: 'Liste des invaders', sub: 'Onglet Invaders, Paris déplié.', r: LIST },
    reglages: { title: 'Réglages / profil', sub: 'Onglet Réglages. Les directions A et C le transforment en « Moi » avec les stats en tête.', r: SETTINGS },
  };

  function phone(dir, screen, mode, prefix) {
    const m = dir.modes.includes(mode) ? mode : dir.modes[0];
    return `<div class="phone" data-dir="${dir.id}" data-mode="${m}" role="img" aria-label="${SCREENS[screen].title}, direction ${dir.name}">${SCREENS[screen].r[dir.id](prefix)}</div>`;
  }

  function render(root, opts) {
    const { screens, mode, prefix = '' } = opts;
    root.innerHTML = screens.map((s) => `
      <section class="screen-block" id="${s}">
        <h2>${SCREENS[s].title}</h2><p>${SCREENS[s].sub}</p>
        <div class="row">${DIRS.map((d) => `
          <div class="col">${phone(d, s, mode, prefix)}
            <div class="cap"><b><i>${d.tag}</i>${d.name}${d.modes.includes(mode) ? '' : ` <i>(${d.modes[0] === 'dark' ? 'sombre' : 'clair'} seulement)</i>`}</b><span>${d.desc}</span></div>
          </div>`).join('')}</div>
      </section>`).join('');
    if (window.lucide) window.lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
    requestAnimationFrame(() => root.querySelectorAll('canvas.map').forEach(drawMap));
  }

  window.MOCK = { render, SCREENS, DIRS };
})();
