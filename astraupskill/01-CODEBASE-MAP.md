# Follow the browser's state owners

The whole application is seven browser assets plus a 44-line static server. Line counts in this clone: `main.js` 71, `store.js` 65, `data.js` 53, `edit.js` 32, `board.js` 16, `index.html` 10, `styles.css` 1 (minified), `server.js` 44. The tests are `test/store.test.js` (213 lines, 20 cases) and `e2e/board.spec.js` (271 lines, 11 scenarios). Everything below can be read in one sitting.

## File-by-file

[index.html](../index.html) supplies the toolbar (line 4), the status and error panel (line 5), the board container (line 6) and two native `<dialog>` elements: the clue dialog `answer-modal` (line 8) and the editor `editor-modal` (line 9). It loads exactly one module entry point, `<script type="module" src="main.js">` in the `<head>` (line 2); module scripts are deferred, so `main.js` runs after the document is parsed.

[main.js](../main.js) is the controller.

| Lines | Responsibility |
|---|---|
| 6 | obtain `localStorage`, or a stand-in whose methods throw if access is denied |
| 7 | `new BoardStore(storage, navigator.locks)` |
| 8 | the controller's state: `current = { state, raw }`, `valid`, `busy`, `clue` |
| 9 | create the editor, giving it `getSnapshot` and a `save` callback |
| 10 | `error(message)` writes the same message to three places and toggles recovery buttons |
| 12-16 | `render()` — draw the board; disable editing, new round and import when `!valid` |
| 17-21 | `load()` — read storage; on failure keep the raw text, show examples read-only |
| 22-28 | `save(draft, baseline, message, options)` — the busy gate and the only place `current` is replaced after a write |
| 29-42 | clue dialog: open, reveal, close, mark used |
| 45-48 | new round |
| 49-55 | export, recovery export, replace corrupt data |
| 56-64 | import |
| 65-69 | `storage` event from other tabs |
| 70 | block `Escape` on any dialog while a save is in flight |

[store.js](../store.js) is the data contract and persistence boundary.

| Lines | Function | What it guarantees |
|---|---|---|
| 2-3 | constants | key `customJeopardy`; 2 MiB limit |
| 4-8 | `object`, `text`, `identity` helpers | no unknown fields; trimmed non-empty text with a maximum; ids match `^[a-zA-Z0-9_-]{1,80}$` |
| 9-27 | `validateState` | schema version 1; non-negative safe-integer revision; at most 10 categories and 20 questions each; ids unique across categories *and* questions; points a multiple of 100 between 100 and 10000; `usedQuestionIds` unique and referring to existing questions; returns a new normalized object |
| 28-37 | `migrateLegacy` | legacy `[{category, questions:[{q,a}]}]` becomes ids `category-N` / `question-N-M` and points `100 * position` |
| 38 | `freshState` | the sample data migrated fresh on every call |
| 39-44 | `parseState` | `null` -> examples; over 2 MiB -> error; bad JSON -> error; array -> legacy; object -> validate |
| 45-63 | `BoardStore` | `load()` wraps storage errors; `save()` validates, locks, compares, derives revision, writes |
| 64-65 | `removeCategory`, `removeQuestion` | return a cloned candidate with dangling used markers removed |

[edit.js](../edit.js) builds the editor form with DOM methods. `open()` (line 27) deep-copies the current state with `structuredClone` and remembers `current.raw` as `baseline`. `field()` (lines 5-10) creates a labelled input whose `input` event writes straight into the draft object; numeric fields convert with `Number(...)`. Add-question (line 23) and add-category (line 28) create records with `crypto.randomUUID()` ids and enforce the 20/10 limits in the UI. The submit handler (line 30) calls `save(draft, baseline)` and closes the dialog only if it returned `true`.

[board.js](../board.js) renders one `<section>` per category (lines 4-14). Each tile is a `<button>` with `data-question-id`, an `aria-label` such as `Passover Basics: 100 points, used` (line 10), and is disabled when its id is in `usedQuestionIds` (line 9). All user text goes through `textContent`. The progress line (line 15) is derived from state on every render.

[data.js](../data.js) holds the supplied sample content in the legacy shape: five categories with five `{q, a}` questions each, hence the 25 tiles the browser tests expect.

[server.js](../server.js) serves only the seven names in its allowlist (lines 6-14), only for `GET` and `HEAD` (line 21), from `127.0.0.1` (line 41). Every response carries `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` and a `Content-Security-Policy` of `default-src 'self'` with no inline scripts (lines 28-34). There is no data API.

## Two paths to trace

**A successful edit:** `edit.js:30` submit -> `main.js:9` callback -> `main.js:22-25` -> `store.js:48-61` -> back in `main.js:25`, `current = committed`, `render()` -> `edit.js:30` closes the dialog. The visible board becomes authoritative at `main.js:25`, and only after `setItem` returned at `store.js:59`.

**A quota error:** `store.js:59` throws -> `main.js:26` shows the message and returns `false` -> `edit.js:30` does not close -> the draft object in `edit.js` still holds the user's text, and `current` was never replaced.

## Exercise

**Goal:** locate every write to persistent storage.

**Check:** search the seven assets for `setItem`. There must be exactly one call, at `store.js:59`. Then list every caller path that can reach it (editor save, mark used, new round, replace corrupt data, import — `main.js:9`, `41`, `47`, `54`, `62`) and confirm each goes through `main.js` `save()`.
