// storage.js
export const IDX_KEY = 'pc_capsules_index';
export const CAP_KEY = id => `pc_capsule_${id}`;
export const PROG_KEY = id => `pc_progress_${id}`;

const safeParse = (str, fallback = null) => {
  try {
    if (typeof str !== 'string') return fallback;
    return JSON.parse(str);
  } catch (e) {
    console.warn('JSON parse error', e);
    return fallback;
  }
};

export const generateId = (prefix = 'cap') =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;

export const nowIso = () => new Date().toISOString();

/* Index helpers */
export const loadIndex = () =>
  safeParse(localStorage.getItem(IDX_KEY), []);

export const saveIndex = (idx = []) =>
  localStorage.setItem(IDX_KEY, JSON.stringify(idx));

export const upsertIndexEntry = (meta) => {
  const idx = loadIndex();
  const i = idx.findIndex(it => it.id === meta.id);
  const entry = {
    id: meta.id,
    title: meta.title || 'Untitled',
    subject: meta.subject || '',
    level: meta.level || '',
    updatedAt: meta.updatedAt || nowIso()
  };
  if (i >= 0) idx[i] = { ...idx[i], ...entry };
  else idx.push(entry);
  saveIndex(idx);
  return idx;
};

export const removeIndexEntry = (id) => {
  const idx = loadIndex().filter(it => it.id !== id);
  saveIndex(idx);
  return idx;
};

/* Capsule CRUD */
export const loadCap = (id) =>
  safeParse(localStorage.getItem(CAP_KEY(id)), null);

export const saveCap = (cap) => {
  if (!cap || !cap.id) throw new Error('cap must have id');
  localStorage.setItem(CAP_KEY(cap.id), JSON.stringify(cap));
  const meta = {
    id: cap.id,
    title: cap.meta?.title || 'Untitled',
    subject: cap.meta?.subject || '',
    level: cap.meta?.level || '',
    updatedAt: cap.meta?.updatedAt || nowIso()
  };
  upsertIndexEntry(meta);
  return cap;
};

export const deleteCap = (id) => {
  localStorage.removeItem(CAP_KEY(id));
  removeIndexEntry(id);
  localStorage.removeItem(PROG_KEY(id));
};

/* Progress CRUD */
export const loadProg = (id) =>
  safeParse(localStorage.getItem(PROG_KEY(id)), { bestScore: 0, knownFlashcards: [], lastStudied: null });

export const saveProg = (id, prog = {}) =>
  localStorage.setItem(PROG_KEY(id), JSON.stringify(prog));

export const deleteProg = (id) => localStorage.removeItem(PROG_KEY(id));

/* Listing */
export const listCapsulesMeta = () => loadIndex();

export const listCapsulesFull = () => {
  const idx = loadIndex();
  return idx.map(item => {
    const cap = loadCap(item.id);
    return cap || { id: item.id, meta: { title: item.title, subject: item.subject, level: item.level }, _missing: true };
  });
};

/* Validation */
export const validateCapsule = (obj) => {
  const errors = [];
  if (!obj || typeof obj !== 'object') {
    errors.push('Not an object');
    return { valid: false, errors };
  }
  if (obj.schema !== 'pocket-classroom/v1') errors.push('Unsupported or missing schema (expect "pocket-classroom/v1")');
  if (!obj.id) errors.push('Missing id');
  if (!obj.meta || !obj.meta.title) errors.push('Missing meta.title');
  if (!((obj.notes && obj.notes.length) || (obj.flashcards && obj.flashcards.length) || (obj.quiz && obj.quiz.length))) {
    errors.push('Must contain at least one of notes, flashcards or quiz');
  }
  return { valid: errors.length === 0, errors };
};

/* Export / Import */
export const exportCapsule = (id) => {
  const cap = loadCap(id);
  if (!cap) throw new Error(`Capsule ${id} not found`);
  return cap;
};

export const exportAllCapsules = () => {
  const bundles = listCapsulesFull().map(cap => cap).filter(Boolean);
  const manifest = {
    schema: 'pocket-classroom/v1-bundle',
    exportedAt: nowIso(),
    appVersion: '1.0.0'
  };
  return { manifest, capsules: bundles };
};

export const importBundle = (bundle, options = { onConflict: 'merge' }) => {
  const res = { imported: [], skipped: [], errors: [] };
  const capsules = Array.isArray(bundle) ? bundle : (bundle.capsules ? bundle.capsules : [bundle]);

  for (const cap of capsules) {
    const v = validateCapsule(cap);
    if (!v.valid) {
      res.errors.push({ id: cap?.id || null, reason: v.errors.join('; ') });
      continue;
    }

    const existing = loadCap(cap.id);
    const strategy = options.onConflict || 'merge';

    if (existing) {
      if (strategy === 'skip') {
        res.skipped.push(cap.id);
        continue;
      } else if (strategy === 'overwrite') {
        saveCap({ ...cap, meta: { ...cap.meta, updatedAt: nowIso() } });
        res.imported.push(cap.id);
      } else {
        const merged = {
          ...existing,
          ...cap,
          meta: { ...existing.meta, ...cap.meta, updatedAt: nowIso() }
        };
        saveCap(merged);
        res.imported.push(cap.id);
      }
    } else {
      const toSave = {
        ...cap,
        meta: {
          ...cap.meta,
          createdAt: cap.meta?.createdAt || nowIso(),
          updatedAt: nowIso()
        }
      };
      saveCap(toSave);
      res.imported.push(cap.id);
    }
  }

  return res;
};

export const repairIndex = () => {
  const idx = loadIndex();
  const cleaned = idx.filter(item => {
    if (!item?.id) return false;
    const cap = loadCap(item.id);
    return !!cap;
  });
  if (cleaned.length !== idx.length) saveIndex(cleaned);
  return cleaned;
};
