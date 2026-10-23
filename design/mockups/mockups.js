/* InvadersHunter — maquettes : données d'exemple + rendu des écrans en 3 versions
 * (actuel, retouche, évolution). Une page appelle MOCK.render(root, { screens, mode }). */
(function () {
  'use strict';

  // ─── Données d'exemple (fictives) ──────────────────────────────────────────
  const USER = { name: 'artdrou', flashes: 412, points: 9840, cities: 7, rank: 1286 };
  const POPUP = {
    name: 'PA_1042', points: 30, comments: 4, by: 'mosaic_mia',
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
    { n: 'PA_1038', p: 20, c: true },
    { n: 'PA_1039', p: 30, c: false },
    { n: 'PA_1040', p: 10, c: true },
    { n: 'PA_1041', p: 50, c: false },
    { n: 'PA_1042', p: 30, c: true },
    { n: 'PA_1043', p: 20, c: false, dead: true },
    { n: 'PA_1044', p: 40, c: true },
  ];
  // Positions des marqueurs en % de la zone carte : x, y, points, flashé, sélectionné
  const MARKERS = [
    [18, 22, 20, 1], [30, 30, 10, 0], [44, 19, 30, 1], [62, 27, 20, 0], [78, 21, 50, 0],
    [24, 41, 30, 0], [39, 45, 20, 1], [56, 39, 10, 1], [71, 44, 30, 0], [86, 36, 20, 1],
    [14, 56, 10, 1], [33, 60, 50, 0], [49, 54, 30, 1, 'sel'], [66, 58, 20, 0], [81, 62, 10, 1],
    [22, 72, 20, 0], [43, 74, 10, 1], [60, 70, 30, 0], [75, 77, 20, 1], [36, 85, 30, 1], [55, 88, 10, 0],
  ];
  const pct = (c) => Math.round(c.got / c.total * 100);

  // ─── Petits helpers de rendu ───────────────────────────────────────────────
  const CRAB = ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'];
  function sprite(color, w) {
    const h = Math.round(w * 8 / 11);
    let r = '';
    CRAB.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'X') r += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`; }));
    return `<svg class="spr" width="${w}" height="${h}" viewBox="0 0 11 8" style="fill:${color}" aria-hidden="true">${r}</svg>`;
  }
  const ic = (n) => `<i data-lucide="${n}"></i>`;
  const px = (inner, cls = '', style = '') => `<div class="pxb ${cls}" style="${style}"><div class="in">${inner}</div></div>`;
  const ann = (n, top, left) => `<span class="ann" style="top:${top}px;left:${left}px">${n}</span>`;
  const segbar = (p, n = 20) => `<div class="segbar">${Array.from({ length: n }, (_, i) => `<i class="${i < Math.round(p / (100 / n)) ? 'f' : ''}"></i>`).join('')}</div>`;

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
    g.save(); g.translate(W / 2, H / 2); g.rotate(-0.32);
    g.strokeStyle = v('--m-road2'); g.lineWidth = 2;
    for (let i = -W; i < W; i += 22 + R() * 14) { g.beginPath(); g.moveTo(i, -H); g.lineTo(i + R() * 20 - 10, H); g.stroke(); }
    for (let j = -H; j < H; j += 26 + R() * 16) { g.beginPath(); g.moveTo(-W, j); g.lineTo(W, j + R() * 24 - 12); g.stroke(); }
    g.restore();
    g.strokeStyle = v('--m-water'); g.lineWidth = 18; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-20, H * .5); g.bezierCurveTo(W * .3, H * .36, W * .55, H * .68, W + 20, H * .52); g.stroke();
    g.strokeStyle = v('--m-road'); g.lineWidth = 5;
    [[0, .18, 1, .32], [.15, 0, .38, 1], [.62, 0, .8, 1], [0, .82, 1, .7], [.05, 1, .95, .05]].forEach(([a, b, c, d]) => {
      g.beginPath(); g.moveTo(a * W, b * H); g.lineTo(c * W, d * H); g.stroke();
    });
  }

  // Marqueurs : les vrais sprites de l'app, identiques dans les 3 versions
  const SIZE = { 10: 22, 20: 26, 30: 30, 50: 36 };
  function markers(prefix, withSel) {
    return MARKERS.map(([x, y, p, c, sel]) => {
      const img = `<div class="marker" style="left:${x}%;top:${y}%"><img src="${prefix}assets/marker-${p}pts-flash-${c ? 'captured' : 'uncaptured'}.png" width="${SIZE[p] + 6}" alt=""></div>`;
      return sel && withSel ? `<div class="mk-sel" style="left:${x}%;top:${y}%"></div>${img}` : img;
    }).join('');
  }

  const SB = '<div class="sb"><span>12:47</span><span class="ic"><s></s><i></i></span></div>';
  function tabs(active) {
    const t = [['map', ic('map'), 'Carte'], ['inv', sprite('currentColor', 22), 'Invaders'], ['soc', ic('users'), 'Social'], ['set', ic('settings'), 'Réglages']];
    return `<nav class="tabs">${t.map(([k, i, l]) => `<div class="tab${k === active ? ' on' : ''}">${i}<span>${l}</span></div>`).join('')}</nav>`;
  }

  // ─── Carte ─────────────────────────────────────────────────────────────────
  const MAP = {
    actuel: (pfx) => `
      <div class="scr on-map">${SB}
        <div class="body"><canvas class="map"></canvas>${markers(pfx)}
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
        </div>${tabs('map')}
      </div>`,

    retouche: (pfx) => `
      <div class="scr on-map">${SB}
        <div class="body"><canvas class="map"></canvas>${markers(pfx)}
          <div class="mfilter">
            ${px('toutes<small>1489</small>', 'on')}${px('flashés<small>412</small>')}${px('non flashés<small>1077</small>')}${px('flashables<small>930</small>')}
          </div>
          ${px(ic('newspaper'), 'fab hot', 'top:80px')}<span class="sqbadge" style="top:76px;right:6px">3</span>
          ${px(ic('users'), 'fab', 'top:130px')}
          ${px(ic('crosshair'), 'fab', 'top:180px')}
          ${px(ic('compass'), 'fab', 'top:230px')}
          <div class="popup">${px(`
            <div class="hd"><span class="nm">${POPUP.name}</span><span class="ptc">${POPUP.points} pts</span><span class="x">✕</span></div>
            <div class="ph">${sprite('#1cffb7', 84)}</div>
            <div class="cells">
              <div class="cell"><small>État</small><span>Bon</span></div>
              <div class="cell"><small>Posé</small><span>12/2019</span></div>
              <div class="cell"><small>Flashé</small><span class="ok">03/05/2025</span></div>
              <div class="cell"><small>Découvert par</small><span>${POPUP.by}</span></div>
            </div>
            <div class="quote">${POPUP.top} <em>${POPUP.topBy}</em></div>
            <div class="links">
              ${px(`${ic('navigation')}<span>Y aller</span>`, 'lk')}${px(`${ic('instagram')}<span>Insta</span>`, 'lk')}
              ${px(`${ic('globe')}<span>Spotter</span>`, 'lk')}${px(`${ic('message-circle')}<span>Avis</span><em>${POPUP.comments}</em>`, 'lk')}
            </div>
            ${px(`${ic('check')} Flashé le 03/05/2025`, 'done')}
            <div class="sub"><u>Modifier</u><u class="dg">Déflasher</u></div>`)}
          </div>
          ${ann(1, 32, 2)}${ann(2, 76, 252)}${ann(3, 206, 2)}${ann(4, 338, 2)}${ann(5, 440, 2)}${ann(6, 488, 2)}${ann(7, 543, 2)}
        </div>${tabs('map')}${ann(8, 620, 36)}
      </div>`,

    evolution: (pfx) => `
      <div class="scr on-map">${SB}
        <div class="body"><canvas class="map"></canvas>${markers(pfx, true)}
          <div class="hud">
            ${px('SCORE<b>9 840</b>')}${px('FLASHS<b>412</b>')}<span class="grow"></span>${px('PARIS<b>28 %</b>')}
          </div>
          ${px('<span class="on">Toutes<small>1489</small></span><span>À flasher<small>1077</small></span><span>Flashés<small>412</small></span>', 'fbar')}
          ${px(`<span class="hot">${ic('newspaper')}<em>3</em></span><span>${ic('users')}</span><span>${ic('crosshair')}</span><span>${ic('compass')}</span>`, 'stack')}
          <div class="dlg">${px(`
            <div class="tt"><span>${POPUP.name}</span><small>✕</small></div>
            <div class="row1">
              ${px(sprite('#1cffb7', 66), 'ph')}
              <div class="kv">
                <div><b>POINTS</b><span class="big">+${POPUP.points}</span></div>
                <div><b>ÉTAT</b><span class="ok">BON</span></div>
                <div><b>POSÉ</b><span>12/2019</span></div>
                <div><b>FLASHÉ</b><span class="ok">03/05/2025</span></div>
              </div>
            </div>
            <div class="say"><span>${POPUP.topBy}&gt;</span> ${POPUP.top}</div>
            <div class="acts">
              ${px(ic('navigation'), 'ib')}${px(ic('instagram'), 'ib')}${px(`${ic('message-circle')}<em>${POPUP.comments}</em>`, 'ib')}
              <div class="main hard">${px('FLASHÉ ✓')}</div>
            </div>
            <div class="foot"><span>Découvert par ${POPUP.by}</span><span>Modifier · <span class="dg">Déflasher</span></span></div>`)}
          </div>
          ${ann(1, 32, 2)}${ann(2, 86, 2)}${ann(3, 86, 250)}${ann(4, 300, 128)}${ann(5, 340, 2)}${ann(6, 476, 2)}${ann(7, 548, 162)}
        </div>${tabs('map')}${ann(8, 624, 22)}
      </div>`,
  };

  // ─── Liste des invaders ────────────────────────────────────────────────────
  const LIST = {
    actuel: () => `
      <div class="scr">${SB}
        <div class="tbar"><span class="sq on">${ic('list')}</span><span class="sq">${ic('layout-grid')}</span><span class="sq">${ic('sliders-horizontal')}</span><span class="grow"></span><span class="sq">${ic('newspaper')}</span></div>
        <div class="body">
          ${CITIES.map((c) => `
            <div class="city"><span class="cn">${c.code}</span><span class="cc">${c.got}/${c.total}</span><span class="chev">${c.open ? '▲' : '▼'}</span></div>
            ${c.open ? ROWS.map((r) => `<div class="irow${r.c ? ' cap' : ''}"><span class="in">${r.n}</span><span class="pt">${r.p}pts</span>${r.c ? '<span class="ck">✓</span>' : ''}<span class="chev">▼</span></div>`).join('') : ''}`).join('')}
        </div>${tabs('inv')}
      </div>`,

    retouche: () => `
      <div class="scr">${SB}
        <div class="tbar">${px(ic('list'), 'sq on')}${px(ic('layout-grid'), 'sq')}${px(`${ic('search')} PA_1042, Paris…`, 'srch')}${px(ic('sliders-horizontal'), 'sq')}</div>
        <div class="body">
          ${CITIES.map((c) => `
            <div class="city">
              <div class="l1"><span class="cn">${c.code}</span><span class="full">${c.name}</span><span class="cc"><b>${c.got}</b>/${c.total}</span><span class="chev">${c.open ? '▲' : '▼'}</span></div>
              <div class="l2">${segbar(pct(c))}<span>${pct(c)} %</span></div>
            </div>
            ${c.open ? ROWS.slice(0, 6).map((r) => `<div class="irow${r.c ? ' cap' : ''}${r.dead ? ' dead' : ''}">
              ${sprite(r.dead ? 'var(--p-div)' : r.c ? 'var(--p-ok)' : 'var(--p-muted)', 18)}
              <span class="in">${r.n}</span>${r.dead ? '<span class="tagd">détruit</span>' : ''}<span class="pt">${r.p} pts</span><span class="sqc${r.c ? ' on' : ''}"></span></div>`).join('') : ''}`).join('')}
          ${ann(2, 4, 140)}${ann(3, 40, 2)}${ann(4, 100, 290)}${ann(5, 100, 2)}
        </div>${tabs('inv')}${ann(1, 34, 150)}
      </div>`,

    evolution: () => `
      <div class="scr">${SB}
        <div class="ehead">
          <h2>Invaders</h2>
          <div class="sub"><b>412</b> flashs · <b>7</b> villes · rang <b>#${USER.rank}</b></div>
          <div class="r2">${px(`${ic('search')} PA_1042, Paris…`, 'srch')}${px(ic('layout-grid'), 'sq')}${px(ic('sliders-horizontal'), 'sq')}</div>
        </div>
        <div class="body">
          ${CITIES.slice(0, 4).map((c) => px(`
              <div class="chd"><span class="cd">${c.code}</span><span class="nm">${c.name}</span><span class="sc">${c.got}/${c.total}</span></div>
              ${segbar(pct(c))}
              ${c.open ? ROWS.slice(0, 6).map((r) => `<div class="erow${r.c ? ' cap' : ''}${r.dead ? ' dead' : ''}"><span class="sqc${r.c ? ' on' : ''}"></span><span class="nm">${r.n}</span><span class="pt">${r.p}</span></div>`).join('') : ''}`,
            `ccard${c.open ? ' open' : ''}`)).join('')}
          ${ann(4, 4, 2)}${ann(5, 30, 2)}${ann(6, 70, 2)}
        </div>${tabs('inv')}${ann(1, 36, 130)}${ann(2, 66, 2)}${ann(3, 92, 2)}
      </div>`,
  };

  // ─── Réglages ──────────────────────────────────────────────────────────────
  const SET = [
    ['Compte', [['user', 'Profil', "Nom d'utilisateur, statistiques"], ['lock', 'Sécurité', 'Email, mot de passe']]],
    ['Personnalisation', [['palette', 'Apparence', 'Thème et couleur', 'Sombre'], ['shapes', 'Markers', 'Formes, couleurs et lueur'], ['languages', 'Langue', null, 'lang'], ['vibrate', 'Vibrations', null, 'on'], ['bell', 'Notifications', 'Alertes de nouveaux invaders', 'on']]],
    ['Données', [['refresh-cw', 'Synchronisation', 'Données et flashes'], ['download', 'Importer mes flashs', 'Depuis FlashInvaders']]],
  ];
  const SETTINGS = {
    actuel: () => `
      <div class="scr">${SB}
        <div class="stitle">Réglages</div>
        <div class="body">
          ${SET.map(([h, rows]) => `<div class="sec">${h}</div>${rows.map(([i, l, s, k]) => `
            <div class="srow">${ic(i)}<span class="t">${l}${s ? `<small>${s}</small>` : ''}</span>${
              k === 'lang' ? '<span class="pill on">FR</span><span class="pill">EN</span>' : k === 'on' ? '<span class="sw on"></span>' : '<span class="cv">›</span>'}</div>`).join('')}`).join('')}
        </div>${tabs('set')}
      </div>`,

    retouche: () => `
      <div class="scr">${SB}
        <div class="stitle">Réglages</div>
        <div class="body">
          ${px(`<span class="av">${sprite('var(--p-accent)', 30)}</span><span class="t">${USER.name}<small><b>${USER.flashes}</b> flashs · <b>9 840</b> pts</small></span><span class="cv">▶</span>`, 'me')}
          ${SET.slice(1).map(([h, rows]) => `<div class="sec">${h}</div><div class="grp">${px(rows.map(([i, l, s, k]) => `
            <div class="srow"><span class="ti">${ic(i)}</span><span class="t">${l}${s ? `<small>${s}</small>` : ''}</span>${
              k === 'lang' ? '<span class="lseg"><span class="on">FR</span><span>EN</span></span>' : k === 'on' ? '<span class="pxsw on"></span>' : '<span class="cv">▶</span>'}</div>`).join(''))}</div>`).join('')}
          ${ann(1, 2, 4)}${ann(2, 88, 4)}${ann(3, 120, 4)}${ann(4, 108, 296)}${ann(5, 226, 222)}${ann(6, 272, 240)}
        </div>${tabs('set')}
      </div>`,

    evolution: () => `
      <div class="scr">${SB}
        <div class="ehead"><h2>Réglages</h2></div>
        <div class="body">
          <div class="p1 hard">${px(`
            <div class="who"><span class="av">${sprite('var(--p-accent)', 36)}</span><div><b>${USER.name}</b><small>Joueur depuis mars 2024 · rang #${USER.rank}</small></div></div>
            <div class="nums"><span>SCORE<b>9 840</b></span><span>FLASHS<b>412</b></span><span>VILLES<b>7</b></span></div>`)}
          </div>
          ${SET.slice(1).map(([h, rows]) => `<div class="esec">// ${h.toUpperCase()}</div><div class="egrp">${px(rows.map(([i, l, s, k]) => `
            <div class="srow">${ic(i)}<span class="t">${l}${s ? `<small>${s}</small>` : ''}</span>${
              k === 'lang' ? '<span class="v">◀ FR ▶</span>' : k === 'on' ? '<span class="v on">ON</span>' : k ? `<span class="v">${k}</span>` : '<span class="v">▶</span>'}</div>`).join(''))}</div>`).join('')}
          ${ann(1, 2, 4)}${ann(2, 160, 4)}${ann(3, 196, 228)}${ann(4, 332, 258)}
        </div>${tabs('set')}
      </div>`,
  };

  // ─── Versions, écrans et listes d'améliorations ────────────────────────────
  const DIRS = [
    { id: 'actuel', tag: 'Actuel', name: "L'app aujourd'hui", desc: 'Version 0.2.0, pour comparer.' },
    { id: 'retouche', tag: '1', name: 'Retouche', desc: 'Même disposition, mêmes couleurs, même police. On corrige les finitions.' },
    { id: 'evolution', tag: '2', name: 'Évolution', desc: 'Même palette et même police, plus les bonnes idées de la version Arcade (score, barres en blocs, ombres dures, carte joueur).' },
  ];
  const SCREENS = {
    carte: {
      title: 'Carte + popup', sub: 'Onglet Carte avec un invader déjà flashé sélectionné (PA_1042).', r: MAP,
      changes: {
        retouche: [
          'Filtres avec le nombre d\'invaders, filtre actif plein (lime)',
          'Boutons et badges en cadre pixel (coins en escalier), badge carré',
          'Nom + points sur la même ligne, bouton fermer plus grand',
          'Infos en grille 2×2 : popup plus courte, plus lisible',
          'Commentaire mis en valeur avec son auteur',
          'Liens avec un libellé sous chaque icône',
          'Invader déjà flashé : un état « Flashé le … » au lieu d\'un gros bouton Déflasher (évite les clics par erreur)',
          'Onglet actif souligné par un bloc lime',
        ],
        evolution: [
          ['Barre de score : score, flashs, % de la ville', 'Arcade'],
          'Filtres regroupés dans une seule barre, avec compteurs',
          'Boutons de carte regroupés dans une seule colonne',
          ['Coins de visée autour de l\'invader sélectionné', 'Arcade'],
          ['Popup en boîte de dialogue : titre en bandeau, photo à gauche, infos à droite', 'Arcade'],
          ['Commentaire en bulle pointillée « auteur> texte »', 'Arcade'],
          ['Bouton principal avec ombre dure', 'Arcade'],
          'Onglet actif sur un bloc lime plein',
        ],
      },
    },
    invaders: {
      title: 'Liste des invaders', sub: 'Onglet Invaders, Paris déplié.', r: LIST,
      changes: {
        retouche: [
          'Recherche directement dans la barre d\'outils',
          'Nom complet de la ville à côté du code',
          'Barre de progression par ville + pourcentage',
          'Case pixel cochée / vide au lieu de ✓ et ▼ sur chaque ligne',
          'Mini sprite par invader, invader détruit barré avec une étiquette',
        ],
        evolution: [
          'Titre + résumé : flashs, villes, rang',
          'Recherche, vue mosaïque et filtres sur une ligne',
          'Ville dépliée encadrée en lime',
          ['Code ville en étiquette pleine, score x/y en lime', 'Arcade'],
          ['Barre de progression en 20 blocs', 'Arcade'],
          ['Lignes façon tableau des scores : nom ....... points', 'Arcade'],
        ],
      },
    },
    reglages: {
      title: 'Réglages', sub: 'Onglet Réglages (haut de l\'écran).', r: SETTINGS,
      changes: {
        retouche: [
          'Carte de profil en tête : pseudo, flashs, points',
          'Titres de section avec un carré lime',
          'Icônes dans une tuile carrée',
          'Sections regroupées dans un cadre pixel',
          'Langue en sélecteur FR | EN',
          'Interrupteurs carrés, dans le style pixel',
        ],
        evolution: [
          ['Carte joueur : avatar, rang, score / flashs / villes, ombre dure', 'Arcade'],
          ['Sections « // NOM » en rose', 'Arcade'],
          'Valeur actuelle affichée à droite (Sombre, ◀ FR ▶)',
          ['Interrupteurs remplacés par ON / OFF', 'Arcade'],
        ],
      },
    },
  };

  function phone(dir, screen, mode, prefix) {
    return `<div class="phone" data-dir="${dir.id}" data-mode="${mode}" role="img" aria-label="${SCREENS[screen].title}, ${dir.name}">${SCREENS[screen].r[dir.id](prefix)}</div>`;
  }
  function changeList(screen, dir) {
    const list = SCREENS[screen].changes[dir];
    if (!list) return '';
    return `<ol class="changes">${list.map((c, i) => {
      const [txt, tag] = Array.isArray(c) ? c : [c];
      return `<li><b>${i + 1}</b><span>${txt}${tag ? `<i>${tag}</i>` : ''}</span></li>`;
    }).join('')}</ol>`;
  }

  function render(root, opts) {
    const { screens, mode, prefix = '' } = opts;
    root.innerHTML = screens.map((s) => `
      <section class="screen-block" id="${s}">
        <h2>${SCREENS[s].title}</h2><p>${SCREENS[s].sub}</p>
        <div class="row">${DIRS.map((d) => `
          <div class="col">${phone(d, s, mode, prefix)}
            <div class="cap"><b><i>${d.tag}</i>${d.name}</b><span>${d.desc}</span></div>
            ${changeList(s, d.id)}
          </div>`).join('')}</div>
      </section>`).join('');
    if (window.lucide) window.lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
    requestAnimationFrame(() => root.querySelectorAll('canvas.map').forEach(drawMap));
  }

  window.MOCK = { render, SCREENS, DIRS };
})();
