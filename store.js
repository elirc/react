import { defaultData } from './data.js';
export const STORAGE_KEY = 'customJeopardy';
const MAX_BYTES = 2 * 1024 * 1024;
function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error(`Invalid ${label} fields.`);
}
function text(value, max, label) { if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} must contain 1-${max} characters.`); return value.trim(); }
function identity(value) { if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw new Error('Invalid record identity.'); return value; }
export function validateState(value) {
  object(value, ['schemaVersion','revision','categories','usedQuestionIds'], 'board');
  if (value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0) throw new Error('Unsupported board version or revision.');
  if (!Array.isArray(value.categories) || value.categories.length > 10) throw new Error('Use at most 10 categories.');
  const ids = new Set(); const questionIds = new Set();
  const claim = id => { identity(id); if (ids.has(id)) throw new Error('Duplicate record identity.'); ids.add(id); return id; };
  const categories = value.categories.map(category => {
    object(category, ['id','name','questions'], 'category'); const id = claim(category.id);
    if (!Array.isArray(category.questions) || category.questions.length > 20) throw new Error('Use at most 20 questions per category.');
    const questions = category.questions.map(question => {
      object(question, ['id','prompt','answer','points'], 'question'); const questionId = claim(question.id); questionIds.add(questionId);
      if (!Number.isInteger(question.points) || question.points < 100 || question.points > 10000 || question.points % 100) throw new Error('Points must be a multiple of 100 from 100 to 10000.');
      return { id: questionId, prompt: text(question.prompt, 1000, 'Prompt'), answer: text(question.answer, 1000, 'Answer'), points: question.points };
    });
    return { id, name: text(category.name, 80, 'Category name'), questions };
  });
  if (!Array.isArray(value.usedQuestionIds) || new Set(value.usedQuestionIds).size !== value.usedQuestionIds.length || value.usedQuestionIds.some(id => !questionIds.has(id))) throw new Error('Used clues must refer to unique existing questions.');
  return { schemaVersion: 1, revision: value.revision, categories, usedQuestionIds: [...value.usedQuestionIds] };
}
export function migrateLegacy(data) {
  if (!Array.isArray(data)) throw new Error('Legacy board must be an array.');
  return validateState({ schemaVersion: 1, revision: 0, categories: data.map((category, index) => {
    object(category, ['category','questions'], 'legacy category');
    if (!Array.isArray(category.questions)) throw new Error('Invalid legacy questions.');
    return { id: `category-${index+1}`, name: category.category, questions: category.questions.map((question, number) => {
      object(question, ['q','a'], 'legacy question'); return { id: `question-${index+1}-${number+1}`, prompt: question.q, answer: question.a, points: (number+1)*100 };
    }) };
  }), usedQuestionIds: [] });
}
export const freshState = () => migrateLegacy(defaultData);
export function parseState(raw) {
  if (raw === null) return freshState();
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_BYTES) throw new Error('Saved board exceeds the 2 MiB limit.');
  let value; try { value = JSON.parse(raw); } catch { throw new Error('Saved board is not valid JSON. Export it before choosing a replacement.'); }
  return Array.isArray(value) ? migrateLegacy(value) : validateState(value);
}
export class BoardStore {
  constructor(storage, locks) { this.storage = storage; this.locks = locks; }
  load() { let raw; try { raw = this.storage.getItem(STORAGE_KEY); } catch { throw new Error('Browser storage is unavailable. No saved data was changed.'); } return { raw, state: parseState(raw) }; }
  async save(candidate, expectedRaw, { replaceInvalid = false } = {}) {
    const normalized = validateState(candidate);
    if (!this.locks?.request) throw new Error('Saving needs Web Locks. Open the local server in a supported browser.');
    return this.locks.request(`quiz-board:${STORAGE_KEY}`, async () => {
      let current; try { current = this.storage.getItem(STORAGE_KEY); } catch { throw new Error('Browser storage is unavailable.'); }
      if (current !== expectedRaw) throw new Error('This board changed in another tab. Reload before saving; your draft is preserved.');
      let revision = 0;
      try { revision = parseState(current).revision; } catch (error) { if (!replaceInvalid) throw error; }
      if (revision >= Number.MAX_SAFE_INTEGER) throw new Error('Revision limit reached; export and review the board.');
      const state = { ...normalized, revision: revision + 1 }; const raw = JSON.stringify(state);
      if (new TextEncoder().encode(raw).length > MAX_BYTES) throw new Error('Board exceeds the 2 MiB limit.');
      try { this.storage.setItem(STORAGE_KEY, raw); } catch { throw new Error('Save failed: browser storage is full or unavailable. Your draft is preserved.'); }
      return { raw, state };
    });
  }
}
export function removeCategory(state, id) { const candidate = structuredClone(state); candidate.categories = candidate.categories.filter(c => c.id !== id); const retained = new Set(candidate.categories.flatMap(c => c.questions.map(q => q.id))); candidate.usedQuestionIds = candidate.usedQuestionIds.filter(id => retained.has(id)); return candidate; }
export function removeQuestion(state, categoryId, id) { const candidate = structuredClone(state); const category = candidate.categories.find(c => c.id === categoryId); if (!category) throw new Error('Category not found.'); category.questions = category.questions.filter(q => q.id !== id); candidate.usedQuestionIds = candidate.usedQuestionIds.filter(value => value !== id); return candidate; }
