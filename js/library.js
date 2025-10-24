// library.js
import * as storage from './storage.js';
import { timeAgo, slugify } from './utils.js';
import { showView, notify } from './main.js';

const grid = () => document.getElementById('libraryGrid');

function emptyState() {
  return `<div class="col-12">
    <div class="card card-app p-4 text-center">
      <p class="mb-0 text-light">No capsules yet — click "New Capsule" to create one or Import a JSON file.</p>
    </div>
  </div>`;
}

function progressHtml(score, known, total) {
  const pct = total ? Math.round((score||0)) : 0;
  return `<div class="mb-2">
    <div class="small-muted mb-1">Quiz best: ${pct}% <span class="ms-3 small-muted">Known cards: ${known}/${total}</span></div>
    <div class="progress" style="height:8px">
      <div class="progress-bar" role="progressbar" style="width:${pct}%" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
    </div>
  </div>`;
}

export function renderLibrary() {
  const meta = storage.loadIndex();
  const container = grid();
  container.innerHTML = '';
  if (!meta || !meta.length) {
    container.innerHTML = emptyState();
    return;
  }

  meta.sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  meta.forEach(item => {
    const cap = storage.loadCap(item.id) || {};
    const prog = storage.loadProg(item.id) || { bestScore: 0, knownFlashcards: [] };
    const totalCards = (cap.flashcards || []).length;
    const known = (prog.knownFlashcards || []).length;
    const score = prog.bestScore || 0;

    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-4';
    col.innerHTML = `
      <div class="card card-app p-3 h-100">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h5 class="mb-1">${item.title}</h5>
            <div class="meta-small">${item.subject || '—'} • <span class="level-badge badge bg-secondary">${item.level || '—'}</span></div>
            <div class="small-muted mt-2">Updated ${timeAgo(item.updatedAt)}</div>
          </div>
          <div class="text-end">
            <div class="small-muted">ID</div>
            <div class="kv">${item.id.slice(0,8)}</div>
          </div>
        </div>

        <div class="mt-3">${progressHtml(score, known, totalCards)}</div>

        <div class="mt-3 d-flex gap-2">
          <button class="btn btn-sm btn-outline-light flex-fill btn-learn" data-id="${item.id}">Learn</button>
          <button class="btn btn-sm btn-outline-primary flex-fill btn-edit" data-id="${item.id}">Edit</button>
        </div>
        <div class="mt-2 d-flex gap-2">
          <button class="btn btn-sm btn-success flex-fill btn-export" data-id="${item.id}">Export</button>
          <button class="btn btn-sm btn-danger flex-fill btn-delete" data-id="${item.id}">Delete</button>
        </div>
      </div>
    `;
    container.appendChild(col);
  });
}

/* wiring */
export function initLibrary() {
  renderLibrary();

  document.getElementById('libraryGrid').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    const id = b.dataset.id;
    if (b.classList.contains('btn-learn')) {
      // open learn view and let learn module pick the capsule
      showView('learn');
      document.dispatchEvent(new CustomEvent('app:learn-open', { detail: { id } }));
    } else if (b.classList.contains('btn-edit')) {
      showView('author');
      document.dispatchEvent(new CustomEvent('app:edit-capsule', { detail: { id } }));
    } else if (b.classList.contains('btn-export')) {
      const cap = storage.exportCapsule(id);
      const blob = new Blob([JSON.stringify(cap, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${slugify(cap.meta?.title || cap.id)}.json`;
      a.click();
      notify('Export started');
    } else if (b.classList.contains('btn-delete')) {
      if (!confirm('Delete this capsule? This cannot be undone.')) return;
      storage.deleteCap(id);
      renderLibrary();
      notify('Deleted capsule');
    }
  });

  // listen for import trigger and click file input
  document.addEventListener('app:trigger-import', () => {
    const fi = document.getElementById('fileImport');
    fi.value = '';
    fi.click();
  });

  // handle file selection
  document.getElementById('fileImport').addEventListener('change', async (ev) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    try {
      const txt = await f.text();
      const parsed = JSON.parse(txt);
      // user must choose conflict strategy; for now auto-merge but avoid id collisions by generating new id if missing/duplicate
      // if single capsule object and id exists, create new id
      const toImport = Array.isArray(parsed) ? parsed : (parsed.capsules ? parsed.capsules : [parsed]);
      const adjusted = toImport.map(c => {
        if (!c.id || storage.loadCap(c.id)) {
          c.id = storage.generateId();
        }
        // ensure schema present
        if (!c.schema) c.schema = 'pocket-classroom/v1';
        return c;
      });
      const res = storage.importBundle({ capsules: adjusted }, { onConflict: 'overwrite' });
      renderLibrary();
      notify(`Imported ${res.imported.length} capsule(s)`);
    } catch (err) {
      console.error(err);
      alert('Import failed: invalid JSON');
    }
  });

  // when capsules change elsewhere
  document.addEventListener('storage-updated', () => renderLibrary());
}
