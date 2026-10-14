// InvadersHunter — presentation site: language switch + screenshot placeholders.
import { STRINGS } from './i18n.js';

const LANG_KEY = 'ih-site-lang';
let lang = readPref(LANG_KEY) || ((navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en');

function applyStrings() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.innerHTML = STRINGS[lang][el.dataset.i18n] ?? STRINGS.fr[el.dataset.i18n] ?? el.dataset.i18n;
  });
  document.getElementById('lang').textContent = lang === 'fr' ? 'EN' : 'FR';
}

function readPref(k) { try { return localStorage.getItem(k); } catch { return null; } }
function writePref(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }

// Screenshot slots: drop the PNG in img/ — a missing file shows a placeholder.
function watchShots() {
  document.querySelectorAll('figure.shot img').forEach((img) => {
    const miss = () => img.closest('figure').classList.add('missing');
    if (img.complete && !img.naturalWidth) miss();
    img.addEventListener('error', miss);
  });
}

// Links still waiting for their URL (see TODOs in index.html) do nothing.
function disableTodoLinks() {
  document.querySelectorAll('a.is-todo').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));
}

document.getElementById('lang').addEventListener('click', () => {
  lang = lang === 'fr' ? 'en' : 'fr';
  writePref(LANG_KEY, lang);
  applyStrings();
});

applyStrings();
watchShots();
disableTodoLinks();
