// HintVaders — Flash Import web page.
//
// Flow: detect the phone (WebUSB adb, see phone.js) → log in → analyse (list the
// FlashInvaders folder, preview against the account) → sync. A sync is
// backup (GET /flash-import/snapshot) → write (POST /flash-import/) → verify
// (snapshot again). If the write fails or the account doesn't match the
// preview, the backup is put back (POST /flash-import/restore).
import { STRINGS } from './i18n.js';

const $ = (sel) => document.querySelector(sel);
// Always the backend serving this page: credentials never go anywhere else.
const API = location.origin;

// ── i18n ───────────────────────────────────────────────────────────────────

const LANG_KEY = 'ih-flash-import-lang';
let lang = readPref(LANG_KEY) || ((navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Translated string; {vars} are HTML-escaped (static strings may hold trusted markup). */
function t(key, vars = {}) {
  const s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? esc(fmt(vars[k])) : `{${k}}`));
}
const fmt = (v) => (typeof v === 'number' ? v.toLocaleString(lang) : v);
/** Plain-text version of t() for textContent / confirm(). */
const tt = (key, vars) => {
  const d = document.createElement('div');
  d.innerHTML = t(key, vars);
  return d.textContent;
};

function applyStatic() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18n);
    // Arcade titles draw their fill and shadow layers from a copy of the text (style.css)
    if (el.classList.contains('arcade')) el.dataset.text = el.textContent;
  });
  $('#lang').textContent = lang === 'fr' ? 'EN' : 'FR';
}

function readPref(k) { try { return localStorage.getItem(k); } catch { return null; } }
function writePref(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }

// ── State ──────────────────────────────────────────────────────────────────

const state = {
  phone: null,        // { model, manufacturer, android, serial }
  session: null,      // { access, refresh, username }
  files: null,        // raw file names read from the phone
  preview: null,      // POST /flash-import/ (mirror preview) response
  account: null,      // snapshot at analysis time
  backup: null,       // snapshot taken right before the sync
  busy: false,
};

let phoneApi = null;
async function phone() {
  // Test seam: window.__IH_FAKE_PHONE__ replaces the USB layer (see tests).
  if (window.__IH_FAKE_PHONE__) return (phoneApi ??= fakePhone(window.__IH_FAKE_PHONE__));
  return (phoneApi ??= await import('./phone.js'));
}

function fakePhone(f) {
  return {
    isSupported: () => true,
    connect: async ({ onWaitingForApproval } = {}) => {
      onWaitingForApproval?.();
      if (f.error) { const e = new Error(f.error); e.code = f.error; throw e; }
      return { model: f.model || 'Pixel 8', manufacturer: f.manufacturer || 'Google', android: f.android || '15', serial: 'FAKE' };
    },
    listFlashFiles: async ({ onPath } = {}) => {
      const path = '/sdcard/Android/data/com.ltu.flashInvader/files/Pictures';
      onPath?.(path, f.files.length);
      return { path, files: f.files };
    },
    disconnect: async () => {},
  };
}

// ── API ────────────────────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `HTTP ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const send = () => fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && state.session ? { Authorization: `Bearer ${state.session.access}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let res;
  try {
    res = await send();
    if (res.status === 401 && auth && state.session && await refreshSession()) res = await send();
  } catch (e) {
    throw new ApiError(0, 'network');
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      if (typeof j.detail === 'string') detail = j.detail;
    } catch { /* not JSON */ }
    throw new ApiError(res.status, detail);
  }
  return res.json();
}

async function refreshSession() {
  try {
    const r = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: state.session.refresh }),
    });
    if (!r.ok) return false;
    const j = await r.json();
    state.session.access = j.access_token;
    state.session.refresh = j.refresh_token;
    return true;
  } catch {
    return false;
  }
}

/** A user-facing message for any error thrown by the phone or the API. */
function errorText(e) {
  if (e?.code && STRINGS.en[`err.${e.code}`]) return t(`err.${e.code}`);
  if (e instanceof ApiError) {
    if (e.status === 0) return t('err.network');
    return t('err.http', { status: e.status, detail: e.detail });
  }
  return t('err.generic', { detail: e?.message || String(e) });
}

// ── UI helpers ─────────────────────────────────────────────────────────────

function setStep(id, s) { $(`#step-${id}`).dataset.state = s; }

function setStatus(el, kind, html) {
  el.className = `status ${kind || ''}`;
  el.innerHTML = html || '';
}

function busyButton(btn, label) {
  btn.disabled = true;
  btn.dataset.label = btn.innerHTML;
  btn.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${label}`;
}
function restoreButton(btn, label) {
  btn.disabled = false;
  btn.innerHTML = label ?? btn.dataset.label;
}

function log(html, kind = '') {
  const ol = $('#log');
  ol.hidden = false;
  const li = document.createElement('li');
  const now = new Date().toLocaleTimeString(lang, { hour12: false });
  li.innerHTML = `<time>${now}</time><span class="${kind}">${html}</span>`;
  ol.append(li);
  ol.scrollTop = ol.scrollHeight;
}

const names = (snap) => new Set(snap.flashes.map((f) => f.name));
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

function updateGates() {
  const ready = !!(state.phone && state.session);
  if ($('#step-analyse').dataset.state === 'locked' && ready) setStep('analyse', 'active');
  if (!ready && !state.preview) setStep('analyse', 'locked');
  $('#btn-analyse').disabled = !ready || state.busy;
}

// ── Step 2: detect ─────────────────────────────────────────────────────────

async function detect() {
  const btn = $('#btn-detect');
  const status = $('#detect-status');
  busyButton(btn, t('detect.connecting'));
  setStatus(status, '', '');
  try {
    const p = await phone();
    state.phone = await p.connect({
      onWaitingForApproval: () => setStatus(status, 'wait', t('detect.waiting')),
    });
    const name = [state.phone.manufacturer, state.phone.model].filter(Boolean).join(' ');
    setStatus(status, 'ok', t('detect.ok', { name, android: state.phone.android }));
    setStep('detect', 'done');
    $('#detect-help').open = false;
    restoreButton(btn, t('detect.again'));
  } catch (e) {
    state.phone = null;
    setStep('detect', 'active');
    setStatus(status, 'err', errorText(e));
    // Every phone error but a closed picker means troubleshooting will help.
    if (e?.code !== 'picker') $('#detect-help').open = true;
    restoreButton(btn, t('detect.btn'));
  }
  updateGates();
}

// ── Step 3: login ──────────────────────────────────────────────────────────

async function login(ev) {
  ev.preventDefault();
  const btn = $('#btn-login');
  const status = $('#login-status');
  const username = $('#username').value.trim();
  const password = $('#password').value;
  if (!username || !password) return;
  busyButton(btn, t('login.busy'));
  setStatus(status, '', '');
  try {
    const tok = await api('/auth/login', { method: 'POST', body: { username, password }, auth: false });
    state.session = { access: tok.access_token, refresh: tok.refresh_token, username };
    const snap = await api('/flash-import/snapshot');
    state.session.username = snap.username;
    state.account = snap;
    $('#password').value = '';
    $('#login-form').hidden = true;
    $('#logged-in').hidden = false;
    setStatus(status, 'ok', t('login.ok', { username: snap.username, total: snap.total }));
    setStep('login', 'done');
  } catch (e) {
    state.session = null;
    setStatus(status, 'err', e instanceof ApiError && e.status === 401 ? t('login.bad') : errorText(e));
  } finally {
    restoreButton(btn, t('login.btn'));
  }
  updateGates();
}

function logout() {
  if (state.session) {
    fetch(`${API}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: state.session.refresh }),
    }).catch(() => {});
  }
  state.session = null;
  state.account = null;
  resetAnalysis();
  $('#login-form').hidden = false;
  $('#logged-in').hidden = true;
  setStatus($('#login-status'), '', '');
  setStep('login', 'active');
  $('#username').focus();
  updateGates();
}

// ── Step 4: analyse ────────────────────────────────────────────────────────

function resetAnalysis() {
  state.preview = null;
  state.files = null;
  $('#report').hidden = true;
  $('#log').hidden = true;
  $('#log').innerHTML = '';
  setStep('analyse', 'locked');
  setStep('sync', 'locked');
}

async function analyse() {
  const btn = $('#btn-analyse');
  if (!state.phone || !state.session) {
    setStatus($('#detect-status'), 'err', t('analyse.needs'));
    return;
  }
  state.busy = true;
  busyButton(btn, t('analyse.btn'));
  $('#log').innerHTML = '';
  $('#report').hidden = true;
  $('#result-ok').hidden = true;
  $('#result-err').hidden = true;
  setStep('sync', 'locked');
  try {
    log(t('log.listing'));
    const p = await phone();
    const { path, files } = await p.listFlashFiles({
      onPath: (dir, count) => log(t('log.path', { path: dir, count })),
    });
    // The official app keeps a second image per flash ("PA_12_S.jpg"): not a flash.
    state.files = files.filter((f) => !/_S(\.[^.]*)?$/i.test(f));
    log(t('log.found', { count: state.files.length, path }), 'ok');

    log(t('log.comparing', { username: state.session.username }));
    const [account, preview] = await Promise.all([
      api('/flash-import/snapshot'),
      api('/flash-import/', { method: 'POST', body: { names: state.files, mirror: true, confirm: false } }),
    ]);
    state.account = account;
    state.preview = preview;
    log(t('log.result', { phone: preview.phone_total, app: preview.app_total }));
    log(t('log.toAdd', { count: preview.imported }), preview.imported ? 'ok' : '');
    if (preview.to_remove.length) log(t('log.toRemove', { count: preview.to_remove.length }), 'warn');
    if (preview.unknown.length) log(t('log.unknown', { count: preview.unknown.length }), 'warn');

    renderReport();
    renderSyncChoices();
    setStep('analyse', 'done');
    setStep('sync', 'active');
    restoreButton(btn, t('analyse.again'));
  } catch (e) {
    log(errorText(e), 'err');
    if (e?.code === 'not-connected') { state.phone = null; setStep('detect', 'active'); }
    restoreButton(btn, t('analyse.btn'));
  } finally {
    state.busy = false;
    updateGates();
  }
}

// Series order is fixed (never re-ranked): on both → to add → account only.
const SERIES = [
  { key: 'both', cls: 'sw-both', label: 'chart.both' },
  { key: 'add', cls: 'sw-add', label: 'chart.add' },
  { key: 'remove', cls: 'sw-remove', label: 'chart.remove' },
];
const MAX_CITIES = 12;

function cityOf(name) { return name.split('_')[0] || name; }

function renderReport() {
  const pv = state.preview;
  const toRemove = new Set(pv.to_remove);
  const both = state.account.flashes.map((f) => f.name).filter((n) => !toRemove.has(n));
  const groups = { both, add: pv.to_add, remove: pv.to_remove };

  $('#tiles').innerHTML = [
    tile(pv.phone_total, 'tile.phone'),
    tile(pv.app_total, 'tile.app'),
    tile(pv.imported, 'tile.add', 'sw-add'),
    tile(pv.to_remove.length, 'tile.remove', 'sw-remove'),
    pv.unknown.length ? tile(pv.unknown.length, 'tile.unknown') : '',
  ].join('');

  // Overall composition of phone ∪ account.
  const legend = SERIES.map((s) => `<span><i class="swatch ${s.cls}"></i>${t(s.label)} · ${fmt(groups[s.key].length)}</span>`).join('');
  $('#legend-overall').innerHTML = legend;
  const total = both.length + pv.to_add.length + pv.to_remove.length;
  $('#stack-overall').innerHTML = stack(SERIES.map((s) => ({ ...s, n: groups[s.key].length })), total, t('chart.overallTitle'));
  $('#overall-max').textContent = fmt(total);

  // Per city: top MAX_CITIES by total, the rest folded into "Other".
  const byCity = new Map();
  for (const s of SERIES) {
    for (const n of groups[s.key]) {
      const c = cityOf(n);
      if (!byCity.has(c)) byCity.set(c, { city: c, both: 0, add: 0, remove: 0 });
      byCity.get(c)[s.key]++;
    }
  }
  const sum = (r) => r.both + r.add + r.remove;
  let rows = [...byCity.values()].sort((a, b) => sum(b) - sum(a) || a.city.localeCompare(b.city));
  const allRows = rows;
  if (rows.length > MAX_CITIES) {
    const rest = rows.slice(MAX_CITIES - 1);
    const other = { city: t('chart.other', { count: rest.length }), both: 0, add: 0, remove: 0 };
    for (const r of rest) for (const s of SERIES) other[s.key] += r[s.key];
    rows = [...rows.slice(0, MAX_CITIES - 1), other];
  }
  const max = Math.max(1, ...rows.map(sum));
  $('#cities').innerHTML = rows.map((r) => `
    <span class="city">${esc(r.city)}</span>
    <div class="bar-track"><div class="stack" style="width:${(sum(r) / max) * 100}%">${stack(SERIES.map((s) => ({ ...s, n: r[s.key] })), sum(r), r.city)}</div></div>
    <span class="total">${fmt(sum(r))}</span>`).join('');
  $('#chart-cities').hidden = allRows.length === 0;

  $('#cities-table').innerHTML = `<thead><tr><th>${t('chart.city')}</th>${SERIES.map((s) => `<th>${t(s.label)}</th>`).join('')}<th>${t('chart.total')}</th></tr></thead>
    <tbody>${allRows.map((r) => `<tr><td>${esc(r.city)}</td>${SERIES.map((s) => `<td>${fmt(r[s.key])}</td>`).join('')}<td>${fmt(sum(r))}</td></tr>`).join('')}</tbody>`;

  // Warnings.
  $('#warn-remove').hidden = pv.to_remove.length === 0;
  $('#warn-remove-title').innerHTML = t('warn.removeTitle', { count: pv.to_remove.length });
  $('#warn-remove-names').textContent = pv.to_remove.join('  ');
  $('#warn-unknown').hidden = pv.unknown.length === 0;
  $('#warn-unknown-title').innerHTML = t('warn.unknownTitle', { count: pv.unknown.length });
  $('#warn-unknown-names').textContent = pv.unknown.join('  ');

  $('#report').hidden = false;
}

function tile(v, key, sw) {
  return `<div class="tile"><div class="v">${fmt(v)}</div><div class="k">${sw ? `<i class="swatch ${sw}"></i>` : ''}${t(key)}</div></div>`;
}

/** Flex segments with 2px gaps; each carries its tooltip text. */
function stack(parts, total, title) {
  if (!total) return '';
  return parts.filter((p) => p.n > 0).map((p) => {
    const tip = tt('chart.tip', { city: title, label: tt(p.label), count: p.n });
    return `<div class="seg ${p.cls}" style="flex:${p.n} 0 0" data-tip="${esc(tip)}" aria-label="${esc(tip)}"></div>`;
  }).join('');
}

// ── Step 5: sync ───────────────────────────────────────────────────────────

function renderSyncChoices() {
  const pv = state.preview;
  const add = pv.imported;
  const remove = pv.to_remove.length;
  const inSync = add === 0 && remove === 0;

  $('#in-sync').hidden = !inSync;
  $('#sync-actions').hidden = inSync;
  $('#progress').hidden = true;
  $('#progress').querySelectorAll('li').forEach((li) => { li.dataset.s = ''; li.querySelector('.ico').textContent = ''; });
  $('#progress [data-k="revert"]').hidden = true;

  $('#sync-add-label').innerHTML = t('sync.add');
  $('#sync-add-hint').innerHTML = remove ? t('sync.addHint', { add, keep: remove }) : t('sync.addHintNoKeep', { add });
  $('#btn-sync-add').disabled = add === 0;

  $('#sync-mirror-label').innerHTML = t('sync.mirror');
  $('#sync-mirror-hint').innerHTML = remove
    ? t('sync.mirrorHint', { add, remove, total: pv.app_total + add - remove })
    : t('sync.mirrorNothing');
  $('#mirror-confirm-row').hidden = !remove || !!pv.refused;
  $('#mirror-confirm').checked = false;
  $('#mirror-confirm-label').innerHTML = t('sync.mirrorConfirm', { remove, username: pv.username });
  $('#mirror-refused').hidden = !pv.refused;
  $('#mirror-refused').innerHTML = pv.refused ? t('sync.refused', { reason: pv.refused }) : '';
  updateMirrorButton();
}

function updateMirrorButton() {
  const pv = state.preview;
  $('#btn-sync-mirror').disabled = !pv || !pv.to_remove.length || !!pv.refused || !$('#mirror-confirm').checked;
}

function progress(key, s) {
  const li = $(`#progress [data-k="${key}"]`);
  li.hidden = false;
  li.dataset.s = s;
  li.querySelector('.ico').innerHTML = { run: '<span class="spinner"></span>', ok: '✓', err: '✗' }[s] || '';
}

async function sync(mirror) {
  if (state.busy) return;
  state.busy = true;
  $('#sync-actions').hidden = true;
  $('#progress').hidden = false;
  updateGates();

  // 1. Backup — nothing is written without one.
  progress('backup', 'run');
  try {
    state.backup = await api('/flash-import/snapshot');
    saveBackupLocally(state.backup);
    progress('backup', 'ok');
    log(t('log.backup', { count: state.backup.total }), 'ok');
  } catch (e) {
    progress('backup', 'err');
    log(errorText(e), 'err');
    state.busy = false;
    updateGates();
    return showFailure(e, 'unchanged');
  }

  // 2. Write.
  progress('write', 'run');
  log(t('log.write'));
  let res;
  try {
    res = await api('/flash-import/', { method: 'POST', body: { names: state.files, mirror, confirm: mirror } });
    progress('write', 'ok');
    log(t('log.written', { added: res.imported, removed: res.removed }), 'ok');
  } catch (e) {
    progress('write', 'err');
    log(errorText(e), 'err');
    return revert(e);
  }

  // 3. Verify: the account must be backup + added − removed, exactly.
  progress('verify', 'run');
  log(t('log.verify'));
  try {
    const after = await api('/flash-import/snapshot');
    const expected = names(state.backup);
    res.to_add.forEach((n) => expected.add(n));
    if (mirror) res.to_remove.forEach((n) => expected.delete(n));
    if (!sameSet(names(after), expected)) {
      progress('verify', 'err');
      log(t('log.mismatch'), 'err');
      const err = new Error('verify');
      err.code = 'verify';
      return revert(err);
    }
    progress('verify', 'ok');
    log(t('log.verified', { total: after.total }), 'ok');
    state.busy = false;
    updateGates();
    showSuccess(res, after);
  } catch (e) {
    progress('verify', 'err');
    log(errorText(e), 'err');
    return revert(e);
  }
}

/** Put the backup back unless the account is already identical to it. */
async function revert(cause) {
  progress('revert', 'run');
  let outcome;
  try {
    const now = await api('/flash-import/snapshot');
    if (sameSet(names(now), names(state.backup))) {
      log(t('log.unchanged'), 'ok');
      outcome = 'unchanged';
    } else {
      log(t('log.reverting'), 'warn');
      const restored = await restoreBackup();
      log(t('log.reverted', { total: restored.total }), 'ok');
      outcome = 'reverted';
    }
    progress('revert', 'ok');
  } catch (e) {
    progress('revert', 'err');
    log(t('log.revertFailed', { error: errorText(e) }), 'err');
    outcome = 'failed';
  }
  state.busy = false;
  updateGates();
  showFailure(cause, outcome);
}

/** POST the backup to /restore and check the account now matches it. */
async function restoreBackup() {
  const restored = await api('/flash-import/restore', { method: 'POST', body: { flashes: state.backup.flashes } });
  const expected = new Set(state.backup.flashes.filter((f) => !restored.skipped.includes(f.invader_id)).map((f) => f.name));
  if (!sameSet(names(restored), expected)) {
    const e = new Error('verify');
    e.code = 'verify';
    throw e;
  }
  return restored;
}

// ── Step 6: result ─────────────────────────────────────────────────────────

function showSuccess(res, after) {
  setStep('sync', 'done');
  $('#done-summary').innerHTML = t('done.summary', { username: res.username, total: after.total });
  $('#done-tiles').innerHTML = [
    tile(res.imported, 'tile.added', 'sw-add'),
    tile(res.removed, 'tile.removed', 'sw-remove'),
    tile(after.total, 'tile.total'),
  ].join('');
  $('#btn-undo').hidden = false;
  setStatus($('#undo-status'), '', '');
  $('#result-ok').hidden = false;
  $('#result-ok').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showFailure(cause, outcome) {
  $('#fail-error').innerHTML = errorText(cause);
  $('#fail-revert').innerHTML = {
    unchanged: t('fail.unchanged'),
    reverted: t('fail.reverted', { total: state.backup?.total ?? 0 }),
    failed: t('fail.revertFailed'),
  }[outcome];
  $('#btn-retry-restore').hidden = outcome !== 'failed';
  $('#result-err').querySelectorAll('[data-action="download-backup"]').forEach((b) => { b.hidden = !state.backup; });
  $('#result-err').hidden = false;
  $('#result-err').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function undo() {
  if (!state.backup || !confirm(tt('done.confirmUndo', { total: state.backup.total }))) return;
  const btn = $('#btn-undo');
  const status = $('#undo-status');
  busyButton(btn, t('done.undoing'));
  try {
    const restored = await restoreBackup();
    setStatus(status, 'ok', t('done.undone', { total: restored.total }));
    log(t('log.reverted', { total: restored.total }), 'ok');
    btn.hidden = true;
  } catch (e) {
    setStatus(status, 'err', t('done.undoFailed', { error: errorText(e) }));
    restoreButton(btn, t('done.undo'));
  }
}

async function retryRestore() {
  const btn = $('#btn-retry-restore');
  busyButton(btn, t('done.undoing'));
  try {
    const restored = await restoreBackup();
    log(t('log.reverted', { total: restored.total }), 'ok');
    $('#fail-revert').innerHTML = t('fail.reverted', { total: restored.total });
    btn.hidden = true;
  } catch (e) {
    log(t('log.revertFailed', { error: errorText(e) }), 'err');
    restoreButton(btn, t('fail.retryRestore'));
  }
}

function restart() {
  $('#result-err').hidden = true;
  $('#result-ok').hidden = true;
  state.backup = null;
  resetAnalysis();
  updateGates();
  $('#step-analyse').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Backup file ────────────────────────────────────────────────────────────

const backupKey = (u) => `ih-flash-backup-${u}`;

function saveBackupLocally(b) {
  writePref(backupKey(b.username), JSON.stringify(b));
}

function downloadBackup() {
  if (!state.backup) return;
  const stamp = new Date(state.backup.taken_at + (state.backup.taken_at.endsWith('Z') ? '' : 'Z'))
    .toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const blob = new Blob([JSON.stringify(state.backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hintvaders-backup-${state.backup.username}-${stamp}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ── Tooltip ────────────────────────────────────────────────────────────────

function initTooltip() {
  const tip = $('#tooltip');
  document.addEventListener('mousemove', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (!el) { tip.hidden = true; return; }
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    const w = tip.offsetWidth;
    tip.style.left = `${Math.min(e.clientX + 12, innerWidth - w - 8)}px`;
    tip.style.top = `${e.clientY + 14}px`;
  });
  document.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
}

// ── Screenshot placeholders ────────────────────────────────────────────────

function initShots() {
  document.querySelectorAll('figure.shot img').forEach((img) => {
    const miss = () => img.closest('figure').classList.add('missing');
    if (img.complete && !img.naturalWidth) miss();
    img.addEventListener('error', miss);
  });
}

// ── Boot ───────────────────────────────────────────────────────────────────

async function boot() {
  applyStatic();
  initShots();
  initTooltip();

  const supported = window.__IH_FAKE_PHONE__ || (!!navigator.usb && window.isSecureContext);
  $('#unsupported').hidden = !!supported;
  $('#btn-detect').disabled = !supported;

  $('#lang').addEventListener('click', () => {
    lang = lang === 'fr' ? 'en' : 'fr';
    writePref(LANG_KEY, lang);
    applyStatic();
    // Re-render dynamic parts in the new language.
    if (state.preview) { renderReport(); if (!state.busy && $('#step-sync').dataset.state === 'active') renderSyncChoices(); }
    if (state.phone) setStatus($('#detect-status'), 'ok', t('detect.ok', { name: [state.phone.manufacturer, state.phone.model].filter(Boolean).join(' '), android: state.phone.android }));
    if (state.session && state.account) setStatus($('#login-status'), 'ok', t('login.ok', { username: state.session.username, total: state.account.total }));
    $('#btn-detect').innerHTML = t(state.phone ? 'detect.again' : 'detect.btn');
    $('#btn-analyse').innerHTML = t(state.preview ? 'analyse.again' : 'analyse.btn');
  });

  $('#btn-detect').addEventListener('click', detect);
  $('#login-form').addEventListener('submit', login);
  $('#btn-logout').addEventListener('click', logout);
  $('#btn-analyse').addEventListener('click', analyse);
  $('#btn-sync-add').addEventListener('click', () => sync(false));
  $('#btn-sync-mirror').addEventListener('click', () => sync(true));
  $('#mirror-confirm').addEventListener('change', updateMirrorButton);
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-retry-restore').addEventListener('click', retryRestore);
  $('#btn-restart').addEventListener('click', restart);
  document.querySelectorAll('[data-action="download-backup"]').forEach((b) => b.addEventListener('click', downloadBackup));

  // Release the USB interface when leaving, so adb / another tab can use the phone.
  addEventListener('pagehide', () => { phoneApi?.disconnect?.(); });

  updateGates();
}

boot();
