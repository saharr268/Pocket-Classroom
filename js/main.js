// main.js
import { initLibrary, renderLibrary } from './library.js';
import { initAuthor } from './author.js';
import { initLearn } from './learn.js';

const VIEWS = ['library', 'author', 'learn'];

export const $ = sel => document.querySelector(sel);
export const $$ = sel => Array.from(document.querySelectorAll(sel));

const navLinks = $$('.nav-link[data-view]');
const viewSections = VIEWS.map(v => $(`#view-${v}`));

const initialView = (() => {
  const h = location.hash.replace('#', '');
  return VIEWS.includes(h) ? h : 'library';
})();

function setActiveNav(view) {
  navLinks.forEach(a => {
    if (a.dataset.view === view) a.classList.add('active');
    else a.classList.remove('active');
  });
  navLinks.forEach(a => a.setAttribute('aria-selected', a.dataset.view === view ? 'true' : 'false'));
}

export function showView(view, { pushHistory = true } = {}) {
  if (!VIEWS.includes(view)) return;
  viewSections.forEach(sec => {
    const id = sec.id.replace('view-', '');
    if (id === view) sec.classList.add('active');
    else sec.classList.remove('active');
  });
  setActiveNav(view);
  if (pushHistory) history.pushState({ view }, '', `#${view}`);
  const el = $(`#view-${view}`);
  if (el) el.setAttribute('tabindex', '-1'), el.focus({ preventScroll: true });
}

function initNav() {
  navLinks.forEach(a => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const view = a.dataset.view;
      showView(view);
    });
  });

  $('#btnNew')?.addEventListener('click', () => {
    showView('author');
    document.dispatchEvent(new CustomEvent('app:new-capsule', { bubbles: true }));
  });

  $('#btnImport')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('app:trigger-import', { bubbles: true }));
  });

  window.addEventListener('popstate', (ev) => {
    const view = (ev.state && ev.state.view) || location.hash.replace('#','') || 'library';
    showView(view, { pushHistory: false });
  });
}

function initShortcuts() {
  window.addEventListener('keydown', (ev) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return;
    if (ev.key === '[') { cycleView(-1); ev.preventDefault(); }
    else if (ev.key === ']') { cycleView(1); ev.preventDefault(); }
  });
}

function cycleView(direction = 1) {
  const current = VIEWS.findIndex(v => document.querySelector(`#tab-${v}`)?.classList.contains('active'));
  let next = (current + direction + VIEWS.length) % VIEWS.length;
  showView(VIEWS[next]);
}

export function notify(msg, { timeout = 2200 } = {}) {
  let el = document.getElementById('app-notice');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-notice';
    el.setAttribute('aria-live', 'polite');
    Object.assign(el.style, {
      position: 'fixed',
      right: '1rem',
      bottom: '1rem',
      zIndex: 1100,
      background: 'rgba(6,8,12,0.75)',
      color: '#e6eef6',
      padding: '0.6rem 0.9rem',
      borderRadius: '8px',
      boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
      fontSize: '0.95rem'
    });
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  if (el._timeout) clearTimeout(el._timeout);
  el._timeout = setTimeout(() => { el.style.opacity = '0'; }, timeout);
}

function boot() {
  initNav();
  initShortcuts();
  // initialize modules
  initLibrary();
  initAuthor();
  initLearn();
  // initial render
  showView(initialView, { pushHistory: false });
  renderLibrary();
}

document.addEventListener('DOMContentLoaded', boot);
