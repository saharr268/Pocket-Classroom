// learn.js
import * as storage from './storage.js';
import { timeAgo } from './utils.js';
import { notify } from './main.js';

const shell = () => document.getElementById('learnShell');
let activeCapId = null;
let currentIndex = 0;
let flipped = false;

function renderLearnShell() {
  const s = shell();
  s.innerHTML = `
    <div class="row">
      <div class="col-md-4">
        <div class="mb-3">
          <label class="form-label text-light">Choose capsule</label>
          <select id="learnCapSelect" class="form-select text-light"></select>
        </div>

        <div id="capMeta" class="card card-app p-2 mb-3"></div>

        <div class="list-group">
          <button id="list-item" class="list-group-item list-group-item-action active" data-tab="notes">Notes</button>
          <button id="list-item" class="list-group-item list-group-item-action" data-tab="flashcards">Flashcards</button>
          <button id="list-item" class="list-group-item list-group-item-action" data-tab="quiz">Quiz</button>
        </div>
      </div>

      <div class="col-md-8">
        <div id="tabContent" class="p-2"></div>
      </div>
    </div>
  `;
  populateCaps();
  attachHandlers();
}

function populateCaps() {
  const sel = document.getElementById('learnCapSelect');
  sel.innerHTML = '';
  const meta = storage.loadIndex();
  if (!meta.length) {
    sel.innerHTML = '<option value="">-- none --</option>';
    renderEmpty();
    return;
  }
  meta.forEach(m => {
    const o = document.createElement('option');
    o.value = m.id;
    o.textContent = `${m.title} — ${m.subject || ''}`;
    sel.appendChild(o);
  });
 
  activeCapId = sel.value || meta[0].id;
  sel.value = activeCapId;
  renderMeta();
  showTab('notes');
}

function attachHandlers() {
  document.getElementById('learnCapSelect').addEventListener('change', (ev) => {
    activeCapId = ev.target.value;
    currentIndex = 0; flipped = false;
    renderMeta();
    showTab('notes');
  });

  document.querySelectorAll('#learnShell .list-group .list-group-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#learnShell .list-group .list-group-item').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      showTab(btn.dataset.tab);
    });
  });

  document.addEventListener('app:learn-open', (ev) => {
    if (ev.detail?.id) {
      activeCapId = ev.detail.id;
      const sel = document.getElementById('learnCapSelect');
      if (sel) { sel.value = activeCapId; }
      currentIndex = 0; flipped = false;
      renderMeta();
      showTab('notes');
    }
  });

 
  window.addEventListener('keydown', (ev) => {
    const tab = document.querySelector('#learnShell .list-group .active')?.dataset.tab;
    if (tab === 'flashcards' && ev.code === 'Space') {
      ev.preventDefault();
      toggleFlip();
    }
  });
}

function renderMeta() {
  const metaEl = document.getElementById('capMeta');
  const cap = storage.loadCap(activeCapId);
  if (!cap) { metaEl.innerHTML = '<div class="small-muted">No capsule selected</div>'; return; }
  metaEl.innerHTML = `<div><strong>${cap.meta.title}</strong></div>
    <div class="small-muted">${cap.meta.subject || ''} • <span class="level-badge badge bg-secondary">${cap.meta.level||''}</span></div>
    <div class="small-muted mt-1">Updated ${timeAgo(cap.meta.updatedAt)}</div>`;
}

function renderEmpty() {
  document.getElementById('tabContent').innerHTML = `<div class="card card-app p-3 text-center">No capsule available. Create one first.</div>`;
}

function showTab(tab) {
  const content = document.getElementById('tabContent');
  if (!activeCapId) { renderEmpty(); return; }
  const cap = storage.loadCap(activeCapId);
  if (!cap) { renderEmpty(); return; }

  if (tab === 'notes') {
    content.innerHTML = `
      <div class="mb-2">
        <input id="notesSearch" class="form-control form-control-sm" placeholder="Search notes...">
      </div>
      <ol id="notesList" class="list-group list-group-numbered"></ol>
    `;
    const notes = cap.notes || [];
    const nl = document.getElementById('notesList');
    if (!notes.length) nl.innerHTML = `<li class="list-group-item small-muted">No notes</li>`;
    else {
      notes.forEach(n => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.innerHTML = `<div>${n}</div>`;
        nl.appendChild(li);
      });
    }
    document.getElementById('notesSearch').addEventListener('input', (ev) => {
      const q = ev.target.value.toLowerCase();
      Array.from(document.querySelectorAll('#notesList li')).forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  } else if (tab === 'flashcards') {
    const cards = cap.flashcards || [];
    const prog = storage.loadProg(activeCapId);
    content.innerHTML = `
      <div class="mb-2 d-flex justify-content-between align-items-center">
        <div><strong>Flashcards</strong> <small class="small-muted">(${cards.length})</small></div>
        <div class="small-muted">Known: <span id="knownCount">${(prog.knownFlashcards||[]).length}</span></div>
      </div>
      <div id="flashcardArea" class="flashcard card-app p-3 mb-3">
        <div class="flip-inner"></div>
      </div>
      <div class="d-flex gap-2">
        <button id="prevCard" class="btn btn-outline-light">Prev</button>
        <button id="flipCard" class="btn btn-outline-primary">Flip</button>
        <button id="nextCard" class="btn btn-outline-light">Next</button>
        <button id="markKnown" class="btn btn-success ms-auto">Known</button>
        <button id="markUnknown" class="btn btn-outline-danger">Unknown</button>
      </div>
    `;
    renderFlashcard();
    document.getElementById('prevCard').addEventListener('click', () => { moveCard(-1); });
    document.getElementById('nextCard').addEventListener('click', () => { moveCard(1); });
    document.getElementById('flipCard').addEventListener('click', toggleFlip);
    document.getElementById('markKnown').addEventListener('click', markKnown);
    document.getElementById('markUnknown').addEventListener('click', markUnknown);
  } else if (tab === 'quiz') {
    content.innerHTML = `<div id="quizArea"></div>`;
    startQuiz(cap);
  }
}

function renderFlashcard() {
  const cap = storage.loadCap(activeCapId);
  const cards = cap.flashcards || [];
  const area = document.getElementById('flashcardArea');
  const inner = area.querySelector('.flip-inner');
  inner.innerHTML = '';
  if (!cards.length) {
    inner.innerHTML = `<div class="card-face card-front">No flashcards</div>`;
    return;
  }
  const card = cards[currentIndex];
  const front = document.createElement('div');
  front.className = 'card-face card-front';
  front.innerHTML = `<div>${card.front || ''}</div>`;
  const back = document.createElement('div');
  back.className = 'card-face card-back';
  back.innerHTML = `<div>${card.back || ''}</div>`;
  inner.appendChild(front);
  inner.appendChild(back);

  updateFlipUI();
}

function updateFlipUI() {
  const area = document.getElementById('flashcardArea');
  if (!area) return;
  if (flipped) area.classList.add('flipped');
  else area.classList.remove('flipped');
}

function moveCard(delta) {
  const cap = storage.loadCap(activeCapId);
  const total = (cap.flashcards || []).length;
  if (!total) return;
  currentIndex = (currentIndex + delta + total) % total;
  flipped = false;
  renderFlashcard();
}

function toggleFlip() {
  flipped = !flipped;
  updateFlipUI();
}

function markKnown() {
  const prog = storage.loadProg(activeCapId);
  prog.knownFlashcards = prog.knownFlashcards || [];
  const cap = storage.loadCap(activeCapId);
  const card = cap.flashcards[currentIndex];
  if (!card) return;
  if (!prog.knownFlashcards.includes(card.id)) prog.knownFlashcards.push(card.id);
  storage.saveProg(activeCapId, prog);
  document.getElementById('knownCount').textContent = prog.knownFlashcards.length;
  notify('Marked known');
}

function markUnknown() {
  const prog = storage.loadProg(activeCapId);
  prog.knownFlashcards = prog.knownFlashcards || [];
  const cap = storage.loadCap(activeCapId);
  const card = cap.flashcards[currentIndex];
  if (!card) return;
  prog.knownFlashcards = prog.knownFlashcards.filter(id => id !== card.id);
  storage.saveProg(activeCapId, prog);
  document.getElementById('knownCount').textContent = prog.knownFlashcards.length;
  notify('Marked unknown');
}

/* Quiz */
function startQuiz(cap) {
  const questions = (cap.quiz || []).slice();
  if (!questions.length) {
    document.getElementById('quizArea').innerHTML = `<div class="card card-app p-3 small-muted">No quiz questions</div>`;
    return;
  }
  let qIndex = 0;
  let correct = 0;

  const area = document.getElementById('quizArea');
  function showQ() {
    const q = questions[qIndex];
    area.innerHTML = `
      <div class="card card-app p-3">
        <div class="mb-2"><strong>Q ${qIndex+1}/${questions.length}</strong></div>
        <div class="mb-3">${q.q}</div>
        <div class="list-group">
          ${q.choices.map((c,i)=>`<button class="list-group-item list-group-item-action q-choice" data-i="${i}">${c}</button>`).join('')}
        </div>
      </div>
    `;
    area.querySelectorAll('.q-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.i);
        const ok = i === q.answerIndex;
        if (ok) correct++;
        btn.classList.add(ok ? 'list-group-item-success' : 'list-group-item-danger');
        setTimeout(() => {
          qIndex++;
          if (qIndex >= questions.length) finish();
          else showQ();
        }, 700);
      });
    });
  }

  function finish() {
    const pct = Math.round((correct / questions.length) * 100);
    area.innerHTML = `<div class="card card-app p-3 text-center">
      <h4>Your score: ${pct}%</h4>
      <div class="small-muted">Correct ${correct} of ${questions.length}</div>
      <div class="mt-3">
        <button id="quizDone" class="btn btn-primary">Done</button>
      </div>
    </div>`;
    document.getElementById('quizDone').addEventListener('click', () => {
      // save best score
      const prog = storage.loadProg(activeCapId);
      prog.bestScore = Math.max(prog.bestScore||0, pct);
      prog.lastStudied = new Date().toISOString();
      storage.saveProg(activeCapId, prog);
      document.dispatchEvent(new CustomEvent('storage-updated'));
      notify(`Score saved (${pct}%)`);
    });
  }

  showQ();
}

export function initLearn() {
  renderLearnShell();
  // when index updates, refresh selector
  document.addEventListener('storage-updated', () => populateCaps());
}
