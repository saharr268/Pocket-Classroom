// author.js
import * as storage from './storage.js';
import { escapeHTML, slugify } from './utils.js';
import { notify } from './main.js';

const shell = () => document.getElementById('authorShell');

function blankCapsule() {
  const id = storage.generateId();
  return {
    schema: 'pocket-classroom/v1',
    id,
    meta: {
      title: '',
      subject: '',
      level: 'Beginner',
      desc: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    notes: [],
    flashcards: [],
    quiz: [],
    resources: []
  };
}

let current = null;
let autoSaveTimer = null;

function renderEditor(cap = null) {
  current = cap || blankCapsule();
  const s = shell();
  s.innerHTML = '';
  s.insertAdjacentHTML('beforeend', `
    <form id="capForm" class="row g-2">
    <div class="col g-2 col-lg-6 col-12">
    
      
    <div class="col-sm-12 col-lg-12">
        <label class="form-label">Title *</label>
        <input id="metaTitle" type="text" class="form-control text-light" value="${escapeHTML(current.meta.title || '')}" required>
      </div>
      <div class="col-sm-12 col-lg-12">
        <label class="form-label">Subject</label>
        <input id="metaSubject" type="text" class="form-control text-light" value="${escapeHTML(current.meta.subject || '')}">
      </div>
      <div class="col-sm-12 col-lg-12">
        <label class="form-label">Level</label>
        <select id="metaLevel" class="form-select text-light">
          <option${current.meta.level==='Beginner'?' selected':''}>Beginner</option>
          <option${current.meta.level==='Intermediate'?' selected':''}>Intermediate</option>
          <option${current.meta.level==='Advanced'?' selected':''}>Advanced</option>
        </select>
      </div>
      <div class="col-12">
        <label class="form-label">Description</label>
        <textarea id="metaDesc" class="form-control text-light" rows="2">${escapeHTML(current.meta.desc || '')}</textarea>
      </div>
    
    </div>
    
    <div class="col col-l2 g-2">
    
    
      <div class="col-12">
        <h5 class="mb-2">Notes</h5>
        <textarea id="notesArea" class="form-control text-light" rows="4" placeholder="One line per note...">${(current.notes || []).join('\n')}</textarea>
      </div>

    
    </div>
    
  

      <div class="col-12">
        <h5 class="mb-2 d-flex justify-content-between">
          <span>Flashcards</span>
          <button type="button" id="addCardBtn" class="btn btn-sm btn-outline-light">Add card</button>
        </h5>
        <div id="cardsList"></div>
      </div>

      <div class="col-12">
        <h5 class="mb-2 d-flex justify-content-between">
          <span>Quiz (Multiple choice)</span>
          <button type="button" id="addQBtn" class="btn btn-sm btn-outline-light">Add question</button>
        </h5>
        <div id="quizList"></div>
      </div>

      <div class="col-12 d-flex gap-2">
        <button id="saveCapBtn" class="btn btn-primary">Save Capsule</button>
        <button id="cancelEditBtn" type="button" class="btn btn-outline-secondary">Cancel</button>
      </div>
    </form>
  `);

  renderCards();
  renderQuiz();
  attachEvents();
}

function renderCards() {
  const list = document.getElementById('cardsList');
  list.innerHTML = '';
  (current.flashcards || []).forEach((c, idx) => {
    list.insertAdjacentHTML('beforeend', `
      <div class="card card-app mb-2" data-index="${idx}">
        <div class="row g-2 p-2 align-items-center">
          <div class="col-5"><input id="fcard" class="form-control text-light" placeholder="Front" value="${escapeHTML(c.front||'')}"></div>
          <div class="col-5"><input id="fcard" class="form-control text-light" placeholder="Back" value="${escapeHTML(c.back||'')}"></div>
          <div class="col-2 text-end">
            <button class="btn btn-sm btn-danger btn-remove-card">Remove</button>
          </div>
        </div>
      </div>
    `);
  });
}

function renderQuiz() {
  const list = document.getElementById('quizList');
  list.innerHTML = '';
  (current.quiz || []).forEach((q, idx) => {
    list.insertAdjacentHTML('beforeend', `
      <div class="card card-app p-2 mb-2 text-light" data-qindex="${idx}">
        <div class="mb-2"><input id="quiz" class="form-control text-light q-text" placeholder="Question" value="${escapeHTML(q.q||'')}"></div>
        <div class="row g-2">
          <div class="col-6"><input id="quiz" class="form-control text-light q-choice" data-choice="0" placeholder="Choice A" value="${escapeHTML(q.choices?.[0]||'')}"></div>
          <div class="col-6"><input id="quiz" class="form-control text-light q-choice" data-choice="1" placeholder="Choice B" value="${escapeHTML(q.choices?.[1]||'')}"></div>
        </div>
        <div class="row g-2 mt-2">
          <div class="col-6"><input id="quiz" class="form-control text-light q-choice" data-choice="2" placeholder="Choice C" value="${escapeHTML(q.choices?.[2]||'')}"></div>
          <div class="col-6"><input id="quiz" class="form-control text-light q-choice" data-choice="3" placeholder="Choice D" value="${escapeHTML(q.choices?.[3]||'')}"></div>
        </div>
        <div class="mt-2 d-flex align-items-center">
          <label class="me-2 small-muted">Correct</label>
          <select id="quiz" class="form-select text-light form-select-sm q-correct" style="width:120px">
            <option id="quiz" value="0"${q.answerIndex===0?' selected':''}>A</option>
            <option id="quiz" value="1"${q.answerIndex===1?' selected':''}>B</option>
            <option id="quiz" value="2"${q.answerIndex===2?' selected':''}>C</option>
            <option id="quiz" value="3"${q.answerIndex===3?' selected':''}>D</option>
          </select>
          <button class="btn btn-sm btn-danger ms-auto btn-remove-q">Remove</button>
        </div>
      </div>
    `);
  });
}

function attachEvents() {
  const form = document.getElementById('capForm');
  form.addEventListener('input', () => triggerAutoSave());

  document.getElementById('addCardBtn').addEventListener('click', () => {
    current.flashcards = current.flashcards || [];
    current.flashcards.push({ id: storage.generateId('card'), front: '', back: '' });
    renderCards();
    triggerAutoSave();
  });

  document.getElementById('addQBtn').addEventListener('click', () => {
    current.quiz = current.quiz || [];
    current.quiz.push({ id: storage.generateId('q'), q: '', choices: ['','','',''], answerIndex: 0, explain: '' });
    renderQuiz();
    triggerAutoSave();
  });

  document.getElementById('cardsList').addEventListener('click', (ev) => {
    if (ev.target.classList.contains('btn-remove-card')) {
      const cardDiv = ev.target.closest('[data-index]');
      const idx = Number(cardDiv.dataset.index);
      current.flashcards.splice(idx,1);
      renderCards();
      triggerAutoSave();
    }
  });

  document.getElementById('quizList').addEventListener('click', (ev) => {
    if (ev.target.classList.contains('btn-remove-q')) {
      const qDiv = ev.target.closest('[data-qindex]');
      const idx = Number(qDiv.dataset.qindex);
      current.quiz.splice(idx,1);
      renderQuiz();
      triggerAutoSave();
    }
  });

  // Save
  document.getElementById('saveCapBtn').addEventListener('click', (ev) => {
    ev.preventDefault();
    doSave(true);
  });

  document.getElementById('cancelEditBtn').addEventListener('click', () => {
    if (confirm('Discard changes?')) {
      document.dispatchEvent(new CustomEvent('storage-updated'));
    }
  });

  // reflect inputs into current object on demand (saves on blur)
  document.getElementById('capForm').addEventListener('change', (ev) => {
    syncFormToModel();
  });
}

function triggerAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    doSave(false);
  }, 800);
}

function syncFormToModel() {
  current.meta.title = document.getElementById('metaTitle').value.trim();
  current.meta.subject = document.getElementById('metaSubject').value.trim();
  current.meta.level = document.getElementById('metaLevel').value;
  current.meta.desc = document.getElementById('metaDesc').value.trim();
  current.notes = document.getElementById('notesArea').value.split('\n').map(s => s.trim()).filter(Boolean);

  // cards
  const cardEls = Array.from(document.querySelectorAll('#cardsList > .card'));
  current.flashcards = cardEls.map((el, idx) => {
    const front = el.querySelector('.card-front').value.trim();
    const back = el.querySelector('.card-back').value.trim();
    return { id: (current.flashcards?.[idx]?.id) || storage.generateId('card'), front, back };
  }).filter(c => (c.front || c.back));

  // quiz
  const qEls = Array.from(document.querySelectorAll('#quizList > .card'));
  current.quiz = qEls.map((el, idx) => {
    const qtxt = el.querySelector('.q-text').value.trim();
    const choices = Array.from(el.querySelectorAll('.q-choice')).map(i=>i.value.trim());
    const answerIndex = Number(el.querySelector('.q-correct').value);
    return { id: (current.quiz?.[idx]?.id) || storage.generateId('q'), q: qtxt, choices, answerIndex };
  }).filter(q => q.q && q.choices.some(Boolean));
}

function validateModel() {
  if (!current.meta.title || !current.meta.title.trim()) return { ok:false, msg:'Title is required' };
  if (!((current.notes && current.notes.length) || (current.flashcards && current.flashcards.length) || (current.quiz && current.quiz.length))) {
    return { ok:false, msg:'Add at least one of Notes, Flashcards or Quiz' };
  }
  return { ok:true };
}

function doSave(showNotify = true) {
  syncFormToModel();
  const v = validateModel();
  if (!v.ok) {
    if (showNotify) alert(v.msg);
    return false;
  }

  current.meta.updatedAt = new Date().toISOString();
  storage.saveCap(current);
  document.dispatchEvent(new CustomEvent('storage-updated'));
  if (showNotify) notify('Saved capsule');
  return true;
}

export function initAuthor() {
  // initial empty editor
  renderEditor();
  // open when editing a specific capsule
  document.addEventListener('app:edit-capsule', (ev) => {
    const id = ev.detail?.id;
    const cap = storage.loadCap(id);
    if (cap) renderEditor(cap);
  });

  // new capsule event
  document.addEventListener('app:new-capsule', () => {
    renderEditor();
  });
}

