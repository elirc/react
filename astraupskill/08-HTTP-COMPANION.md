# 08. Companion: the question bank behind HTTP

[Course index](README.md) · the worked version of practice exercise 3

The board keeps its state in `localStorage` with a baseline comparison in `store.js`. This chapter moves the *question bank* (categories and clues) behind an Express + SQLite API and keeps the same conflict rule, so the lesson transfers to the stack you are training for.

## Target

```
GET    /api/bank            -> { version, categories: [...] }        ETag: "<version>"
PUT    /api/bank            If-Match: "<version>"  body: { categories }  -> 200 { version+1 } | 409 | 428
```

One row, one version. That is the same shape as the board's baseline: the client says which version it edited, the server accepts only if that is still the current one.

## Server (Express + node:sqlite)

```js
import express from 'express';
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('bank.sqlite');
db.exec(`CREATE TABLE IF NOT EXISTS bank (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL, body TEXT NOT NULL)`);
db.exec(`INSERT OR IGNORE INTO bank VALUES (1, 1, '{"categories":[]}')`);
const app = express(); app.use(express.json({ limit: '256kb' }));

app.get('/api/bank', (req, res) => {
  const row = db.prepare('SELECT version, body FROM bank WHERE id = 1').get();
  res.set('ETag', `"${row.version}"`).json({ version: row.version, ...JSON.parse(row.body) });
});

app.put('/api/bank', (req, res) => {
  const match = /^"(\d+)"$/.exec(req.get('if-match') ?? '');
  if (!match) return res.status(428).json({ error: 'If-Match with the version you loaded is required' });
  const errors = validateState({ categories: req.body?.categories });   // reuse store.js's validator on the server
  if (errors.length) return res.status(400).json({ errors });
  const expected = Number(match[1]);
  const result = db.prepare('UPDATE bank SET version = version + 1, body = ? WHERE id = 1 AND version = ?')
    .run(JSON.stringify({ categories: req.body.categories }), expected);
  if (result.changes === 0) return res.status(409).json({ error: 'The bank changed since you loaded it. Reload, then reapply your edit.' });
  res.set('ETag', `"${expected + 1}"`).json({ version: expected + 1 });
});
```

`changes === 0` is the whole conflict rule: no read-then-compare, one conditional `UPDATE`. That is what `store.js` simulates by comparing the raw string it last read.

## Client change

`BoardStore` keeps doing what it does; only the persistence edge changes. Replace the `localStorage` write in the save path with `fetch('/api/bank', { method: 'PUT', headers: { 'if-match': `"${loadedVersion}"` }, body })`, keep the draft on 409, and adopt the returned `version` on 200. The baseline variable becomes `loadedVersion`.

## Tests to write

1. `PUT` without `If-Match` is 428 and the row is unchanged.
2. Two clients load version 1; the first `PUT` is 200 with version 2; the second is 409 and the body is still the first client's.
3. A body that fails `validateState` is 400 and the version does not move.
4. The Playwright scenario from `e2e/board.spec.js`, unchanged, against the served page: the board still works because the store's contract did not change.

## What moved

| board today | with the API |
|---|---|
| raw-string baseline compare | `If-Match` + conditional `UPDATE ... WHERE version = ?` |
| `validateState` in the browser | the same function, on the server, before the write |
| `localStorage` quota errors | 413 from `express.json({ limit })` and a 507 if the disk is full |
| two tabs | two clients; same rule, now enforced where it cannot be bypassed |
