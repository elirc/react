# Worked change: preserve a draft when persistence fails

This walkthrough follows the delivered candidate-state design in [edit.js](../edit.js), [main.js](../main.js) and [store.js](../store.js). The repository history in this clone is a single snapshot commit, so the pre-change editor cannot be shown here; the problem it solved is the classic one — mutating shared state before `localStorage.setItem`, so a failed write leaves the screen showing data that was never saved, and closing the editor as though the save worked.

## Step 1 — open a draft

`createEditor().open()` (`edit.js:27`):

```js
function open() { const current = getSnapshot(); draft = structuredClone(current.state); baseline = current.raw; ... render(); dialog.showModal(); }
```

`getSnapshot` is `() => current` from `main.js:9`. The draft is a deep copy; `baseline` is the exact stored text (or `null` if nothing is stored yet). Form input changes this draft only. Adding a category or deleting a question also affects only the draft. Cancel (`edit.js:29`) just closes the dialog; the next `open()` starts from the accepted state again.

## Step 2 — validate before anything else

Submission first benefits from native required-field checks (`input.required = true`, `edit.js:7`; the form's `submit` event only fires if they pass). Then `main.js` `save()` calls `store.save()`, whose first line is `validateState(candidate)` (`store.js:49`). Browser validation improves feedback but is not the authoritative rule: imports and direct module callers go through the same validator.

Note the HTML constraints and the store constraints overlap but are not identical. The numeric input has `min=100 max=10000 step=100` (`edit.js:8`), matching `store.js:20`. Text inputs have `maxLength` 80 or 1000 (`edit.js:8`, `16`), matching `store.js:21` and `:23`. The store additionally trims and rejects whitespace-only text, which `required` alone would accept.

## Step 3 — the save

From `store.js:48-62`: validation first, then the named Web Lock, then the baseline comparison, and only then `setItem`. The accepted snapshot is the return value, so the controller cannot close the editor on a failed write.

```js
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
```

Every `throw` here is a user-readable message; the controller displays `cause.message` directly (`main.js:26`).

## Step 4 — publish only on success

`main.js:22-28`:

1. `if (busy) return false` — a second submit while one is in flight does nothing.
2. Snapshot every `button,input,textarea` and its `disabled` flag, then disable them all (line 24).
3. `await store.save(...)`; on success replace `current`, clear errors, show the status, re-render, return `true` (line 25).
4. On failure show the message, clear the status, return `false` (line 26).
5. `finally`: restore each control's previous `disabled` flag if it is still in the document (`element.isConnected`), then re-apply the `valid`-dependent toolbar state (line 27).

The `isConnected` check matters because a successful save re-renders the board, replacing tile buttons that were in the snapshot.

## Follow a failure

The learner renames a category to "CRUD practice" and storage throws a quota error. `store.js:59` throws; `main.js:26` shows "Save failed: browser storage is full or unavailable. Your draft is preserved." in the editor (via `editor-error`, `main.js:10`); `edit.js:30` sees `false` and leaves the dialog open. The old category name remains on the accepted board. A reload shows the old name, which is the truth.

## Follow a conflict

A second tab marks a clue used while this tab's editor is open. This tab receives a `storage` event, reloads accepted state and warns inside the editor (`main.js:65-69`), but leaves the open draft — and its `baseline` — intact. Saving that draft fails at `store.js:53`. Replacing the baseline automatically would let the draft's old `usedQuestionIds` overwrite the newer round. The intended recovery is cancel, reload, reapply.

## Evidence for this change

- Node: `quota failure preserves exact storage and caller draft` (`test/store.test.js:131-145`) and `stale snapshots cannot overwrite later round progress` (`:120-130`).
- Browser: `storage quota failure retains the draft and leaves the visible bank unchanged` (`e2e/board.spec.js:85-102`) overrides `Storage.prototype.setItem` and checks the field still holds `Unsaved draft`; `stale editor in another tab preserves its proposal and rejects overwrite` (`:103-125`).

Neither layer proves coordination with a script that ignores the lock, or persistence after site data is cleared.

## Exercises

**Goal:** see why validation sits outside the lock. **Check:** explain what changes if `validateState` moved inside the lock callback (an invalid draft would hold the lock while failing; the error is identical either way), and why the current order is cheaper.

**Goal:** find the asymmetry in mutation style. **Check:** name the editor operations that mutate `draft` in place and those that replace it, citing `edit.js` lines, and say why replacing `draft` requires an immediate `render()` (the input closures captured the old objects).
