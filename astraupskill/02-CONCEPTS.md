# Drafts, identity and cooperating browser tabs

## Draft vs. accepted state

A draft is a proposal. The saved board is the accepted state. Mixing them creates a common CRUD bug: the screen changes before persistence succeeds, then a reload loses the apparent update. Here the editor copies the loaded board (`structuredClone` in `edit.js:27`), changes only the copy, and submits it when the learner saves. `BoardStore.save` validates and writes (`store.js:48-61`) before the controller replaces `current` (`main.js:25`). A storage error leaves the proposal visible in the dialog and the accepted board unchanged.

Notice that the draft is mutated in place by input handlers (`edit.js:9`, e.g. `category.name = value` on line 16), but the delete helpers return a *new* cloned candidate (`store.js:64-65`) that replaces `draft` before re-rendering (`edit.js:17`, `21`). Both styles are safe here because neither touches `current.state`.

## Stable identity

Stable ids distinguish records from positions. Deleting the first question must not make its used marker refer to the former second question. Categories and questions carry ids; round progress stores question ids (`usedQuestionIds`). The delete helpers remove obsolete used markers together with the records (`store.js:64` filters markers against the retained question set; `store.js:65` filters the single deleted id). Validation then rejects duplicates — across categories and questions together, because both go through one `claim()` set (`store.js:13-14`) — and references to missing questions (`store.js:25`).

Ids come from two sources: deterministic `category-N` / `question-N-M` for migrated legacy data (`store.js:33-34`), and `crypto.randomUUID()` for anything created in the editor (`edit.js:23`, `28`). A UUID's 36 characters of hex and hyphens satisfy the identity pattern on `store.js:8`.

## Why a lock is not enough

A Web Lock serializes cooperating saves on the same origin. Imagine two tabs both load revision zero. Tab A saves a changed category and releases the lock. Tab B later acquires it, but its draft was still based on revision zero. If it simply wrote, it would lose A's change. So the save also compares the current stored text with the exact text remembered when that draft began (`store.js:52-53`). B conflicts instead of overwriting A.

The comparison is on the **raw string**, not the parsed object or the revision number. Any change at all — even one that leaves `revision` the same, such as another tool writing to the key — makes the baseline stale.

## Revision is derived, not trusted

The next revision is computed from current storage: `parseState(current).revision` plus one (`store.js:55-57`). Any revision on the candidate is overwritten by the spread on line 57, so an imported file with `revision: 999` does not control the result (Node test at `test/store.test.js:98-105`). The revision is for display (`board.js:15`) and exported metadata. This is coarse whole-board concurrency: two tabs editing different questions still conflict. Per-record versions in a server database are a later exercise ([08-HTTP-COMPANION](08-HTTP-COMPANION.md)).

## Missing, empty and corrupt data

- **Missing** (`getItem` returns `null`): `parseState` returns examples (`store.js:40`) and nothing is written until the first save.
- **Empty bank** (`categories: []`): valid; the board says so (`board.js:3`).
- **Malformed JSON, oversized text, unsupported schema:** `parseState` throws (`store.js:41-43`), `main.js:19` sets `valid = false`, keeps the raw text in `current.raw`, and shows the examples with tiles and editing disabled (`main.js:14-15`). The raw text can be downloaded (`main.js:51`).
- **Explicit replacement:** `replace-btn` saves the examples with `replaceInvalid: true` (`main.js:54`). Inside the lock the baseline comparison still runs first (`store.js:53`), so an old recovery screen cannot overwrite a newer repair from another tab; only the parse of the corrupt current value is excused (`store.js:55`).

## Validation and safe rendering are different defences

A category name containing angle brackets can be valid literal text; validation does not strip it (`test/store.test.js:206-213`). The renderer uses `textContent` and text nodes (`board.js:6`, `9`; `edit.js:6`), so the value does not create elements. Import validation checks structure, bounds and relationships before anything renders. The server's CSP (`server.js:33`) is a second layer. None of these create authenticated ownership.

## Assumptions

The storage guarantee assumes every writer uses the same lock protocol. DevTools, older scripts or other code can bypass it. `localStorage` is origin-scoped (protocol, host and port) and is not a remote backup or a cross-user transaction.

## Concept checks

1. **Goal:** distinguish CAS from locking. **Check:** explain which line would let tab B overwrite tab A if deleted — `store.js:53` — and why removing the lock on `store.js:51` *instead* would still leave a window: lines 52-59 contain no `await`, so they run without interruption *within* one tab, but tabs may run in separate processes and `localStorage` offers no atomic read-modify-write across them, so two compare-then-write sequences could interleave.
2. **Goal:** identity over position. **Check:** using `store.js:65`, state what happens to `usedQuestionIds` when you delete a used question, and why the remaining markers still point at the right tiles.
3. **Goal:** recovery semantics. **Check:** list the three controls disabled when `valid` is false (`main.js:14`) and the two that become visible (`main.js:10`).
