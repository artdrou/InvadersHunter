// InvadersHunter — web account space (issue #59).
//
// Login with the app account (POST /auth/login, JWT + refresh token), then:
// stats computed like the app's profile (GET /users/me + GET /invaders/ +
// GET /progress/user/{id}), flash sync link, and account settings
// (PUT / DELETE /users/{id}). The map tab comes in a later step.
import { STRINGS } from './account-i18n.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
// Always the backend serving this page: credentials never go anywhere else.
const API = location.origin;

// Same as the app (features/invaders/types.ts → NON_FLASHABLE_STATES).
const NON_FLASHABLE = ['destroyed', 'not visible'];
const CITIES_SHOWN = 12;

// ── i18n ───────────────────────────────────────────────────────────────────

const LANG_KEY = 'ih-site-lang';
let lang = readPref(localStorage, LANG_KEY) || ((navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v) => (typeof v === 'number' ? v.toLocaleString(lang) : v);

/** Translated string; {vars} are HTML-escaped (static strings may hold trusted markup). */
function t(key, vars = {}) {
  const s = STRINGS[lang][key] ?? STRINGS.fr[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? esc(fmt(vars[k])) : `{${k}}`));
}
const tt = (key, vars) => {
  const d = document.createElement('div');
  d.innerHTML = t(key, vars);
  return d.textContent;
};

function applyStatic() {
  document.documentElement.lang = lang;
  $$('[data-i18n]').forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
  $$('[data-i18n-placeholder]').forEach((el) => { el.placeholder = tt(el.dataset.i18nPlaceholder); });
  $('#lang').textContent = lang === 'fr' ? 'EN' : 'FR';
}

function readPref(store, k) { try { return store.getItem(k); } catch { return null; } }
function writePref(store, k, v) { try { store.setItem(k, v); } catch { /* private mode */ } }
function dropPref(store, k) { try { store.removeItem(k); } catch { /* private mode */ } }

// ── Session ────────────────────────────────────────────────────────────────
// "Stay logged in" keeps the tokens in localStorage, otherwise in sessionStorage
// (gone when the tab closes).

const SESSION_KEY = 'ih-account-session';

function loadSession() {
  const raw = readPref(localStorage, SESSION_KEY) || readPref(sessionStorage, SESSION_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveSession(s, remember) {
  clearSession();
  writePref(remember ? localStorage : sessionStorage, SESSION_KEY, JSON.stringify({ ...s, remember }));
}
function clearSession() {
  dropPref(localStorage, SESSION_KEY);
  dropPref(sessionStorage, SESSION_KEY);
}

/** JWT payload: { sub, username, is_admin, exp }. */
function claims(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch { return null; }
}

const state = {
  session: null,   // { access, refresh, remember }
  userId: null,
  profile: null,   // GET /users/me
  invaders: null,  // GET /invaders/
  progress: null,  // GET /progress/user/{id}
  citiesExpanded: false,
};

class HttpError extends Error {
  constructor(status, detail) { super(detail); this.status = status; this.detail = detail; }
}

async function rawFetch(path, { method = 'GET', body, token } = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new HttpError(0, tt('err.network'));
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : JSON.stringify(data?.detail ?? res.statusText);
    throw new HttpError(res.status, detail);
  }
  return data;
}

/** Authenticated call; refreshes the access token once on 401. */
async function api(path, opts = {}) {
  try {
    return await rawFetch(path, { ...opts, token: state.session.access });
  } catch (e) {
    if (e.status !== 401) throw e;
    try {
      const tok = await rawFetch('/auth/refresh', { method: 'POST', body: { refresh_token: state.session.refresh } });
      state.session = { access: tok.access_token, refresh: tok.refresh_token, remember: state.session.remember };
      saveSession(state.session, state.session.remember);
    } catch {
      expire();
      throw new HttpError(401, tt('err.session'));
    }
    return rawFetch(path, { ...opts, token: state.session.access });
  }
}

function expire() {
  clearSession();
  state.session = null;
  showLogin(tt('err.session'));
}

// ── Views ──────────────────────────────────────────────────────────────────

function showLogin(message) {
  $('#dash-view').hidden = true;
  $('#login-view').hidden = false;
  $('#logout').hidden = true;
  const err = $('#login-error');
  err.hidden = !message;
  err.textContent = message || '';
  $('#login-username').focus();
}

function showDashboard() {
  $('#login-view').hidden = true;
  $('#dash-view').hidden = false;
  $('#logout').hidden = false;
  const c = claims(state.session.access) || {};
  state.userId = Number(c.sub);
  $('#admin-badge').hidden = !c.is_admin;
  renderHeader(c.username);
  selectTab((location.hash || '#stats').slice(1));
  loadStats();
}

function renderHeader(username) {
  const name = state.profile?.username || username || '';
  $('#dash-hello').innerHTML = t('dash.hello', { name });
  const since = state.profile?.created_at;
  $('#dash-since').textContent = since ? tt('dash.since', { date: fmtDate(since) }) : '';
}

const fmtDate = (iso) => new Date(iso.endsWith('Z') ? iso : `${iso}Z`).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });

function selectTab(name) {
  const tabs = $$('.tabs [data-tab]');
  if (!tabs.some((b) => b.dataset.tab === name)) name = 'stats';
  tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  history.replaceState(null, '', `#${name}`);
  if (name === 'settings') fillSettings();
}

// ── Login / logout ─────────────────────────────────────────────────────────

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = $('#login-username').value.trim();
  const password = $('#login-password').value;
  const err = $('#login-error');
  if (!username || !password) { err.hidden = false; err.textContent = tt('login.missing'); return; }
  const btn = e.submitter || $('#login-form button[type=submit]');
  btn.disabled = true;
  try {
    const tok = await rawFetch('/auth/login', { method: 'POST', body: { username, password } });
    state.session = { access: tok.access_token, refresh: tok.refresh_token, remember: $('#login-remember').checked };
    saveSession(state.session, state.session.remember);
    $('#login-password').value = '';
    showDashboard();
  } catch (ex) {
    err.hidden = false;
    err.textContent = ex.status === 401 ? tt('login.bad') : ex.message;
  } finally {
    btn.disabled = false;
  }
});

$('#logout').addEventListener('click', async () => {
  const refresh = state.session?.refresh;
  clearSession();
  state.session = null;
  state.profile = state.invaders = state.progress = null;
  showLogin();
  if (refresh) rawFetch('/auth/logout', { method: 'POST', body: { refresh_token: refresh } }).catch(() => {});
});

// ── Stats ──────────────────────────────────────────────────────────────────

async function loadStats() {
  $('#stats-loading').hidden = false;
  $('#stats-loading').innerHTML = t('stats.loading');
  $('#stats-body').hidden = true;
  try {
    const [profile, invaders, progress] = await Promise.all([
      api('/users/me'),
      state.invaders ? Promise.resolve(state.invaders) : rawFetch('/invaders/'),
      api(`/progress/user/${state.userId}`),
    ]);
    state.profile = profile;
    state.invaders = invaders;
    state.progress = progress;
    renderHeader();
    renderStats();
    fillSettings();
    $('#stats-loading').hidden = true;
    $('#stats-body').hidden = false;
  } catch (e) {
    if (e.status === 401) return;
    $('#stats-loading').textContent = tt('stats.error');
  }
}

/** Same rules as the app's computeCollectionStats(), plus points and per-city rows. */
function computeStats(invaders, flashedIds) {
  const byCity = new Map();
  let flashed = 0, points = 0, destroyedFlashed = 0, remaining = 0;
  for (const inv of invaders) {
    const city = (inv.name.split('_')[0] || inv.name).toUpperCase();
    const row = byCity.get(city) ?? { city, captured: 0, total: 0 };
    row.total++;
    const st = (inv.state ?? '').toLowerCase();
    if (flashedIds.has(inv.id)) {
      row.captured++;
      flashed++;
      points += inv.points || 0;
      if (st === 'destroyed') destroyedFlashed++;
    } else if (!NON_FLASHABLE.includes(st)) {
      remaining++;
    }
    byCity.set(city, row);
  }
  const cities = [...byCity.values()];
  return {
    flashed, points, destroyedFlashed, remaining,
    total: invaders.length,
    started: cities.filter((c) => c.captured > 0).length,
    complete: cities.filter((c) => c.total > 0 && c.captured === c.total).length,
    cities: cities.sort((a, b) => b.captured - a.captured || b.captured / b.total - a.captured / a.total || a.city.localeCompare(b.city)),
  };
}

function tile(value, labelKey, sub = '') {
  return `<div class="stat"><b>${esc(fmt(value))}</b><span>${t(labelKey)}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
}

function renderStats() {
  const s = computeStats(state.invaders, new Set(state.profile.flashed_invader_ids));
  state.stats = s;
  $('#tiles').innerHTML = [
    tile(s.flashed, 'tile.flashed', t('tile.ofTotal', { total: s.total })),
    tile(s.points, 'tile.points'),
    tile(s.started, 'tile.started'),
    tile(s.complete, 'tile.complete'),
    tile(s.destroyedFlashed, 'tile.destroyed'),
    tile(s.remaining, 'tile.remaining'),
  ].join('');
  const p = state.profile;
  $('#contrib').innerHTML = [
    tile(p.requests_sent, 'contrib.sent'),
    tile(p.requests_accepted, 'contrib.accepted'),
    tile(p.requests_rejected, 'contrib.rejected'),
    tile(p.requests_pending, 'contrib.pending'),
    tile(p.comments, 'contrib.comments'),
  ].join('');
  renderMonths();
  renderCities();
}

// Column chart: flashes per month, last 12 months (single series → no legend).
function renderMonths() {
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, date: d, count: 0 });
  }
  const index = new Map(months.map((m) => [m.key, m]));
  for (const f of state.progress) {
    const m = index.get((f.found_at || '').slice(0, 7));
    if (m) m.count++;
  }
  const max = Math.max(...months.map((m) => m.count));
  const chart = $('#months-chart');
  if (max === 0) {
    chart.innerHTML = `<p class="muted empty">${t('chart.months.empty')}</p>`;
  } else {
    const top = niceMax(max);
    const ticks = [top, top / 2, 0];
    const peak = months.reduce((a, b) => (b.count > a.count ? b : a));
    chart.innerHTML = `
      <div class="m-axis">${ticks.map((v) => `<span>${esc(compact(v))}</span>`).join('')}</div>
      <div class="m-plot">
        ${ticks.map((v) => `<i class="m-grid" style="bottom:${(v / top) * 100}%"></i>`).join('')}
        ${months.map((m) => `
          <div class="m-col" data-tip="${esc(monthLabel(m.date, true))}: ${esc(tt('chart.months.tip', { count: m.count }))}">
            <div class="m-bar" style="height:${(m.count / top) * 100}%">${m === peak ? `<em>${esc(fmt(m.count))}</em>` : ''}</div>
          </div>`).join('')}
      </div>
      <div class="m-labels">${months.map((m) => `<span>${esc(monthLabel(m.date))}</span>`).join('')}</div>`;
  }
  $('#months-table').innerHTML = `<thead><tr><th>${t('chart.month')}</th><th>${t('chart.count')}</th></tr></thead><tbody>${
    months.map((m) => `<tr><td>${esc(monthLabel(m.date, true))}</td><td>${esc(fmt(m.count))}</td></tr>`).join('')}</tbody>`;
}

const monthLabel = (d, long = false) => d.toLocaleDateString(lang, long ? { month: 'long', year: 'numeric' } : { month: 'short' });
const compact = (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(Math.round(v)));
function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((n) => n >= v);
}

// Progress per city: one bar per city on a track (magnitude, single series).
function renderCities() {
  const q = $('#city-search').value.trim().toUpperCase();
  const rows = state.stats.cities.filter((c) => (q ? c.city.includes(q) : c.captured > 0));
  const shown = q || state.citiesExpanded ? rows : rows.slice(0, CITIES_SHOWN);
  $('#cities').innerHTML = shown.length ? shown.map((c) => {
    const pct = c.total ? Math.round((c.captured / c.total) * 100) : 0;
    return `<li data-tip="${esc(c.city)}: ${esc(fmt(c.captured))} / ${esc(fmt(c.total))} (${pct} %)">
      <span class="c-name">${esc(c.city)}</span>
      <span class="c-track"><span class="c-fill${c.captured === c.total ? ' done' : ''}" style="width:${pct}%"></span></span>
      <span class="c-val">${esc(fmt(c.captured))}<small> / ${esc(fmt(c.total))}</small></span>
      <span class="c-pct">${pct} %</span>
    </li>`;
  }).join('') : `<li class="muted empty">${t('chart.cities.none')}</li>`;
  const more = $('#cities-more');
  const hiddenCount = rows.length - CITIES_SHOWN;
  more.hidden = !!q || hiddenCount <= 0;
  more.innerHTML = state.citiesExpanded ? t('chart.cities.less') : t('chart.cities.more', { count: hiddenCount });
}

$('#city-search').addEventListener('input', renderCities);
$('#cities-more').addEventListener('click', () => { state.citiesExpanded = !state.citiesExpanded; renderCities(); });

$$('[data-table-toggle]').forEach((btn) => btn.addEventListener('click', () => {
  const table = document.getElementById(btn.dataset.tableToggle);
  table.hidden = !table.hidden;
  btn.innerHTML = t(table.hidden ? 'chart.showTable' : 'chart.hideTable');
}));

// Hover tooltip for chart marks (whole column / row is the hit target).
const tip = $('#tooltip');
document.addEventListener('pointermove', (e) => {
  const el = e.target.closest?.('[data-tip]');
  if (!el) { tip.hidden = true; return; }
  tip.textContent = el.dataset.tip;
  tip.hidden = false;
  const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
  tip.style.transform = `translate(${x}px, ${e.clientY + 16}px)`;
});

// ── Account settings ───────────────────────────────────────────────────────

function fillSettings() {
  const p = state.profile;
  if (!p) return;
  $('form[data-field="username"] input').value = p.username;
  $('form[data-field="email"] input').value = p.email;
  $('#delete-label').innerHTML = t('set.delete.label', { name: p.username });
}

function formMsg(form, text, ok = false) {
  const el = $('.form-msg', form);
  el.hidden = !text;
  el.textContent = text || '';
  el.classList.toggle('ok', ok);
}

function serverMessage(e) {
  if (e.detail === 'Username already exists') return tt('set.usernameTaken');
  if (e.detail === 'Email already exists') return tt('set.emailTaken');
  return e.status ? tt('err.generic', { detail: e.detail }) : e.message;
}

$$('form[data-field]').forEach((form) => form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const field = form.dataset.field;
  const input = $('input', form);
  const value = field === 'password' ? input.value : input.value.trim();
  if (field === 'password') {
    if (value.length < 4) return formMsg(form, tt('set.tooShort', { min: 4 }));
    if (value !== $('input[name=confirm]', form).value) return formMsg(form, tt('set.mismatch'));
  }
  if (field === 'username' && value.length < 3) return formMsg(form, tt('set.tooShort', { min: 3 }));
  if (field === 'email' && !input.checkValidity()) return formMsg(form, tt('set.invalidEmail'));
  const btn = $('button[type=submit]', form);
  btn.disabled = true;
  try {
    const user = await api(`/users/${state.userId}`, { method: 'PUT', body: { [field]: value } });
    state.profile = { ...state.profile, username: user.username, email: user.email };
    if (field === 'password') form.reset();
    fillSettings();
    renderHeader();
    formMsg(form, tt('set.saved'), true);
  } catch (ex) {
    if (ex.status !== 401) formMsg(form, serverMessage(ex));
  } finally {
    btn.disabled = false;
  }
}));

$('#delete-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const name = state.profile?.username;
  if ($('input', form).value.trim() !== name) return formMsg(form, tt('set.delete.mismatch'));
  if (!confirm(tt('set.delete.confirm', { name }))) return;
  try {
    await api(`/users/${state.userId}`, { method: 'DELETE' });
    clearSession();
    location.href = 'index.html';
  } catch (ex) {
    if (ex.status !== 401) formMsg(form, serverMessage(ex));
  }
});

// ── Boot ───────────────────────────────────────────────────────────────────

$$('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));

$('#lang').addEventListener('click', () => {
  lang = lang === 'fr' ? 'en' : 'fr';
  writePref(localStorage, LANG_KEY, lang);
  applyStatic();
  if (state.session) {
    renderHeader();
    if (state.stats) renderStats();
    fillSettings();
  }
});

applyStatic();
state.session = loadSession();
if (state.session?.access) showDashboard();
else showLogin();
