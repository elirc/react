# Verify the real state boundary

Run `npm test` for the 20 Node cases and `npm run test:browser` for the 11 Chromium workflows after installing the matching Playwright browser. The [configuration](../playwright.config.js) launches an isolated loopback static server and refuses to reuse an existing listener. Browser tests use new contexts, so personal browser storage is not a fixture and is not cleared.

The [store suite](../test/store.test.js) tests missing data, deterministic legacy migration, invalid JSON, schema versions, IDs, required fields, bounds, used-clue references and empty boards. Persistence cases assert new revision behavior, stale baseline rejection, quota failure, missing Web Locks, explicit corruption replacement and exhausted revisions. Delete cases verify that round-progress references are cleaned without modifying the input snapshot.

The Node helpers are tiny: `storage()` (`test/store.test.js:13-25`) is a one-value store that asserts every access uses `STORAGE_KEY`, and `locks()` (lines 26-35) chains callbacks on a promise tail so each runs after the previous one settles. The controlled lock in Node serializes callbacks so races can be tested deterministically. It is useful for store logic, but it is not proof that the browser's lock implementation coordinates tabs. The [browser suite](../e2e/board.spec.js) therefore opens two pages in one context, lets both capture the same saved baseline, then starts their saves together. Exactly one succeeds. Another UI case preserves an older open form after a competing tab has saved.

Browser workflows also test category/question CRUD through labeled controls, reload, cancelled editing and deletion, quota failure, corrupt-data preservation, explicit replacement, literal rendering of markup-like text, import/export and new-round behavior. A clue is not consumed merely by opening and closing its dialog. Keyboard Escape dismisses an idle native dialog and returns focus. Desktop and narrow checks capture screenshots and reject document-wide horizontal overflow.

The static-server case checks that only application assets are served, including a successful HEAD request with no body. Repository files such as package metadata, server source and environment paths are not part of the asset allowlist. Response headers supply a content type, nosniff and a restrictive content security policy. This is a local static server, not a general-purpose production hosting service.

When debugging a failed save, ask three questions in order: did validation accept the candidate, did the stored baseline still match, and did setItem succeed? Inspect the editor error instead of assuming any open dialog means a broken click handler. For a missing saved board, compare protocol, hostname and port; changing localhost to 127.0.0.1 changes the origin and its storage.

A passing local suite does not establish authenticated ownership, remote persistence, full accessibility compliance or power-loss durability. Keep [verification](VERIFICATION.md) beside any claims you make about the project.

## The three commands

Both layers are declared in `package.json`; `npm run verify` is simply the pair, and it fails if the Node cases fail before Playwright starts.

```bash
npm test          # node --test test/store.test.js
npm run test:browser  # playwright test
npm run verify    # npm test && npm run test:browser
```


## Claim-to-test map

| Claim | Node case (`test/store.test.js`) | Browser scenario (`e2e/board.spec.js`) |
|---|---|---|
| missing storage shows examples without writing | 36 | 4 (25 tiles) |
| legacy arrays migrate deterministically | 45 | — |
| bad JSON / unsupported versions are rejected, not replaced | 53 | 155 |
| ids unique; unknown fields and blank text rejected | 59, 64 | — |
| points and collection sizes bounded | 72 | — |
| used markers reference unique existing questions | 79 | — |
| save trims, bumps revision, reloads | 89 | 30 |
| supplied revision ignored | 98 | — |
| one winner from a shared baseline | 106 | 126 (real `navigator.locks`) |
| stale snapshot cannot overwrite round progress | 120 | 103 |
| quota failure keeps storage and draft | 131 | 85 |
| no Web Locks -> no save | 146 | — |
| corrupt data replaced only explicitly, with matching baseline | 151 | 155 |
| deletes clean used markers without mutating input | 160, 170 | 71 (cancelled delete) |
| empty bank valid | 181 | — |
| 2 MiB and revision ceiling | 187 | — |
| storage access denied -> error, not overwrite | 195 | — |
| markup-like text stays literal | 206 | 177 |
| clue opened then closed is not consumed | — | 4 |
| new round clears markers, keeps questions | — | 216 |
| layouts fit; Escape closes editor and restores focus | — | 230 |
| server allowlist, headers, HEAD | — | 252 |

Line numbers are the `test(` lines in this clone. Rows marked "—" have no automated case at that layer. Notably, **malformed import** has no browser scenario (the import scenario at line 177 uses a valid file), and the editor's own validation messages are not asserted in the browser.

## Debugging table

| Symptom | First question | Where |
|---|---|---|
| Save shows "changed in another tab" unexpectedly | Did anything else write the key since the editor opened? Compare `current.raw` with storage. | `store.js:53`, `edit.js:27` |
| Save shows a field error | Which record? The messages do not name it; bisect by deleting draft records. | `store.js:7`, `:20` |
| Board shows examples and editing is disabled | Is `valid` false? Read the error panel; export the raw text first. | `main.js:19`, `:14` |
| Nothing happens on Save | Is `busy` stuck? It is reset in `finally`, so look for a hung lock request. | `main.js:23`, `:27`, `store.js:51` |
| "Saving needs Web Locks" | Are you on `file://` or an old browser? | `store.js:50` |
| Saved board missing after restart | Same protocol, host *and* port? `PORT` changes the origin. | `server.js:16`, `:41` |
