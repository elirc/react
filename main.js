import { BoardStore, STORAGE_KEY, freshState, parseState } from './store.js';
import { renderBoard } from './board.js';
import { createEditor } from './edit.js';
const byId = id => document.getElementById(id);
let storage;
try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('Storage unavailable'); }, setItem() { throw new Error('Storage unavailable'); } }; }
const store = new BoardStore(storage, navigator.locks);
let current = { state: freshState(), raw: null }, valid = true, busy = false, clue = null;
const editor = createEditor({ getSnapshot: () => current, save: (draft, baseline) => save(draft, baseline, 'Question bank saved.') });
function error(message) { byId('error').textContent = message; byId('error-panel').hidden = !message; byId('editor-error').textContent = message; byId('clue-error').textContent = message; byId('replace-btn').hidden = valid; byId('export-raw').hidden = valid; }
function status(message) { byId('status').textContent = message; }
function render() {
  renderBoard(current.state, showClue);
  byId('edit-btn').disabled = !valid; byId('reset-round').disabled = !valid; byId('import-file').disabled = !valid;
  if (!valid) document.querySelectorAll('.tile').forEach(button => { button.disabled = true; });
}
function load() {
  try { current = store.load(); valid = true; error(''); }
  catch (cause) { valid = false; let raw = null; try { raw = storage.getItem(STORAGE_KEY); } catch { /* Recovery still explains unavailable storage. */ } current = { state: freshState(), raw }; error(cause.message); }
  render();
}
async function save(draft, baseline, message, options) {
  if (busy) return false;
  busy = true; const controls = [...document.querySelectorAll('button,input,textarea')].map(element => [element, element.disabled]); controls.forEach(([element]) => { element.disabled = true; });
  try { const committed = await store.save(draft, baseline, options); current = committed; valid = true; error(''); status(message); render(); return true; }
  catch (cause) { error(cause.message); status(''); return false; }
  finally { busy = false; controls.forEach(([element, disabled]) => { if (element.isConnected) element.disabled = disabled; }); byId('edit-btn').disabled = !valid; byId('reset-round').disabled = !valid; byId('import-file').disabled = !valid; }
}
function showClue(question, category) {
  clue = { question: structuredClone(question), raw: current.raw }; byId('clue-error').textContent = '';
  byId('clue-title').textContent = `${category} · ${question.points} points`; byId('clue-text').textContent = question.prompt;
  byId('answer-text').textContent = question.answer; byId('answer-text').hidden = true; byId('answer-modal').showModal();
}
byId('reveal-answer').addEventListener('click', () => { byId('answer-text').hidden = false; });
byId('close-answer').addEventListener('click', () => byId('answer-modal').close());
byId('mark-used').addEventListener('click', async () => {
  if (!clue) return;
  const draft = structuredClone(current.state);
  if (!draft.categories.some(category => category.questions.some(question => question.id === clue.question.id))) { error('This clue was removed. Close it and reload the board.'); return; }
  if (!draft.usedQuestionIds.includes(clue.question.id)) draft.usedQuestionIds.push(clue.question.id);
  if (await save(draft, clue.raw, 'Clue marked used.')) byId('answer-modal').close();
});
byId('edit-btn').addEventListener('click', () => { if (valid && !busy) editor.open(); });
byId('reload-btn').addEventListener('click', () => { load(); if (valid) status('Saved board reloaded.'); });
byId('reset-round').addEventListener('click', async () => {
  if (!confirm('Start a new round? Questions stay; used clues become available again.')) return;
  const draft = structuredClone(current.state); draft.usedQuestionIds = []; await save(draft, current.raw, 'New round started.');
});
function download(text, name) { const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
byId('export-btn').addEventListener('click', () => { if (valid) download(JSON.stringify(current.state,null,2),'quiz-board.json'); else error('Use Export saved text to preserve the unreadable original.'); });
byId('export-raw').addEventListener('click', () => { if (current.raw !== null) download(current.raw,'quiz-board-recovery.txt'); else error('There is no readable saved text to export.'); });
byId('replace-btn').addEventListener('click', async () => {
  if (!confirm('Replace the unreadable saved data with the example board? Export saved text first if you want to keep it.')) return;
  await save(freshState(), current.raw, 'Example board saved.', { replaceInvalid: true });
});
byId('import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file || busy) return; const baseline = current.raw;
  try {
    if (file.size > 2*1024*1024) throw new Error('Import must be at most 2 MiB.');
    const draft = parseState(await file.text());
    if (!confirm('Replace this saved board with the imported question bank and round state?')) return;
    await save(draft, baseline, 'Imported board saved.');
  } catch (cause) { error(cause.message); }
});
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  load(); status('Saved board changed in another tab.');
  if (editor.dialog.open) byId('editor-error').textContent = 'Another tab changed the saved board. This draft is preserved; cancel and reload before editing again.';
});
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
load();
