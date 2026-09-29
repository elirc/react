import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BoardStore,
  STORAGE_KEY,
  freshState,
  parseState,
  validateState,
  removeQuestion,
  removeCategory,
} from '../store.js';
import { defaultData } from '../data.js';
function storage(initial = null) {
  let value = initial;
  return {
    getItem(key) {
      assert.equal(key, STORAGE_KEY);
      return value;
    },
    setItem(key, next) {
      assert.equal(key, STORAGE_KEY);
      value = next;
    },
  };
}
function locks() {
  let tail = Promise.resolve();
  return {
    request(_name, callback) {
      const next = tail.then(callback);
      tail = next.catch(() => {});
      return next;
    },
  };
}
test('missing storage produces detached example banks without writes', () => {
  const a = freshState(),
    b = freshState();
  a.categories[0].name = 'Changed';
  assert.notEqual(b.categories[0].name, 'Changed');
  const memory = storage();
  new BoardStore(memory, locks()).load();
  assert.equal(memory.getItem(STORAGE_KEY), null);
});
test('legacy data migrates deterministically without changing the source', () => {
  const before = JSON.stringify(defaultData),
    a = parseState(before),
    b = parseState(before);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(defaultData), before);
  assert.equal(a.categories[0].questions[1].points, 200);
});
test('invalid JSON and unsupported versions reject without falling back', () => {
  assert.throws(() => parseState('{broken'), /not valid JSON/);
  const state = freshState();
  state.schemaVersion = 9;
  assert.throws(() => validateState(state), /Unsupported/);
});
test('record identities must be unique across categories and questions', () => {
  const state = freshState();
  state.categories[1].id = state.categories[0].questions[0].id;
  assert.throws(() => validateState(state), /Duplicate/);
});
test('unknown fields and empty required text are rejected', () => {
  const state = freshState();
  state.categories[0].owner = 'forged';
  assert.throws(() => validateState(state), /Invalid category/);
  delete state.categories[0].owner;
  state.categories[0].questions[0].answer = ' ';
  assert.throws(() => validateState(state), /Answer/);
});
test('points and maximum collection sizes are bounded', () => {
  const state = freshState();
  state.categories[0].questions[0].points = 125;
  assert.throws(() => validateState(state), /multiple/);
  state.categories = Array(11).fill(state.categories[0]);
  assert.throws(() => validateState(state), /10 categories/);
});
test('used clues must be unique existing questions', () => {
  const state = freshState();
  state.usedQuestionIds = ['missing'];
  assert.throws(() => validateState(state), /Used clues/);
  state.usedQuestionIds = [
    state.categories[0].questions[0].id,
    state.categories[0].questions[0].id,
  ];
  assert.throws(() => validateState(state), /Used clues/);
});
test('save commits normalized state with a new revision and reloads', async () => {
  const memory = storage(),
    store = new BoardStore(memory, locks()),
    loaded = store.load();
  loaded.state.categories[0].name = ' New name ';
  const saved = await store.save(loaded.state, loaded.raw);
  assert.equal(saved.state.revision, 1);
  assert.equal(store.load().state.categories[0].name, 'New name');
});
test('caller-supplied revisions do not control the next committed revision', async () => {
  const memory = storage(),
    store = new BoardStore(memory, locks()),
    state = freshState();
  state.revision = 999;
  const saved = await store.save(state, null);
  assert.equal(saved.state.revision, 1);
});
test('two concurrent cooperating saves from one baseline have one winner', async () => {
  const memory = storage(),
    lock = locks(),
    a = new BoardStore(memory, lock),
    b = new BoardStore(memory, lock);
  const first = freshState(),
    second = freshState();
  first.categories[0].name = 'First';
  second.categories[0].name = 'Second';
  const results = await Promise.allSettled([a.save(first, null), b.save(second, null)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  assert.equal(a.load().state.revision, 1);
});
test('stale snapshots cannot overwrite later round progress', async () => {
  const memory = storage(),
    store = new BoardStore(memory, locks()),
    old = store.load(),
    round = structuredClone(old.state);
  round.usedQuestionIds = [round.categories[0].questions[0].id];
  await store.save(round, old.raw);
  old.state.categories[0].name = 'Old editor';
  await assert.rejects(store.save(old.state, old.raw), /another tab/);
  assert.equal(store.load().state.usedQuestionIds.length, 1);
});
test('quota failure preserves exact storage and caller draft', async () => {
  const raw = JSON.stringify(freshState()),
    memory = {
      getItem: () => raw,
      setItem() {
        throw new Error('Quota');
      },
    },
    store = new BoardStore(memory, locks()),
    draft = freshState();
  draft.categories[0].name = 'Unsaved';
  await assert.rejects(store.save(draft, raw), /full or unavailable/);
  assert.equal(memory.getItem(), raw);
  assert.equal(draft.categories[0].name, 'Unsaved');
});
test('missing Web Locks refuses unsafe saves', async () => {
  const memory = storage();
  await assert.rejects(new BoardStore(memory, null).save(freshState(), null), /Web Locks/);
  assert.equal(memory.getItem(STORAGE_KEY), null);
});
test('corrupt data requires explicit replacement with matching saved text', async () => {
  const memory = storage('broken'),
    store = new BoardStore(memory, locks());
  await assert.rejects(store.save(freshState(), 'broken'), /not valid JSON/);
  assert.equal(memory.getItem(STORAGE_KEY), 'broken');
  await assert.rejects(store.save(freshState(), 'old', { replaceInvalid: true }), /another tab/);
  await store.save(freshState(), 'broken', { replaceInvalid: true });
  assert.equal(store.load().state.revision, 1);
});
test('deleting a question removes its used marker without changing input', () => {
  const state = freshState(),
    category = state.categories[0],
    id = category.questions[0].id;
  state.usedQuestionIds = [id];
  const candidate = removeQuestion(state, category.id, id);
  assert.equal(candidate.usedQuestionIds.length, 0);
  assert.equal(state.usedQuestionIds.length, 1);
  assert.equal(validateState(candidate).categories[0].questions.length, 4);
});
test('deleting a category cleans its used markers while retaining others', () => {
  const state = freshState();
  state.usedQuestionIds = [
    state.categories[0].questions[0].id,
    state.categories[1].questions[0].id,
  ];
  const candidate = removeCategory(state, state.categories[0].id);
  assert.equal(candidate.categories.length, 4);
  assert.equal(candidate.usedQuestionIds.length, 1);
  validateState(candidate);
});
test('empty bank is valid and can be persisted', async () => {
  const state = { schemaVersion: 1, revision: 0, categories: [], usedQuestionIds: [] },
    store = new BoardStore(storage(), locks());
  await store.save(state, null);
  assert.deepEqual(store.load().state.categories, []);
});
test('oversized imports and exhausted revisions are rejected', async () => {
  assert.throws(() => parseState(' '.repeat(2 * 1024 * 1024 + 1)), /2 MiB/);
  const state = freshState();
  state.revision = Number.MAX_SAFE_INTEGER;
  const raw = JSON.stringify(state),
    store = new BoardStore(storage(raw), locks());
  await assert.rejects(store.save(state, raw), /Revision limit/);
});
test('unavailable storage reports an error instead of overwriting defaults', () => {
  const store = new BoardStore(
    {
      getItem() {
        throw new Error('denied');
      },
    },
    locks(),
  );
  assert.throws(() => store.load(), /unavailable/);
});
test('normalization detaches nested input and keeps literal markup as text', () => {
  const state = freshState();
  state.categories[0].name = '<img src=x onerror=alert(1)>';
  const result = validateState(state);
  state.categories[0].questions[0].prompt = 'Changed';
  assert.notEqual(result.categories[0].questions[0].prompt, 'Changed');
  assert.match(result.categories[0].name, /<img/);
});
