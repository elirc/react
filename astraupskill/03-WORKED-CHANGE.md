# Worked change: preserve a draft when persistence fails

The earlier editor changed the shared question array before calling localStorage.setItem. If storage was full or unavailable, the visible in-memory state had already changed. The save handler could also close the editor as though the operation succeeded. This walkthrough follows the delivered candidate-state approach in [edit.js](../edit.js), [main.js](../main.js) and [store.js](../store.js).

When the editor opens, it copies the currently accepted board with structuredClone and remembers the exact stored text as its baseline. Form input changes this local draft. It does not change the board displayed behind the modal. Adding a category or deleting a question also affects only the draft. Cancel simply closes the modal; the next opening starts from the accepted state again.

Submission first benefits from native required-field checks, then calls the store's full structural validation. The store checks stable IDs, supported counts, nonempty text, point values and used-clue references. Browser form validation improves feedback but is not the authoritative rule: imports and direct module callers also go through the same store validator.

The save acquires a named Web Lock. Inside the lock, it rereads storage and compares it with the editor's baseline. A mismatch reports that another tab changed the board. If the baseline still matches, it computes the next revision from saved state, serializes the normalized candidate and performs setItem. Only after that call succeeds does the store return an accepted snapshot. The controller then replaces current state, rerenders the board, reports success and allows the editor to close.

## The save the walkthrough follows

The paragraphs above describe one function. Here it is, from `store.js:48-62`: validation first, then the named Web Lock, then the baseline comparison, and only then `setItem`. The accepted snapshot is the return value, so the controller cannot close the editor on a failed write.

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

## Follow a failure

Imagine the learner renames a category to “CRUD practice” and storage throws a quota error. The store throws a readable failure without returning a committed snapshot. The controller reports it inside the editor and leaves the draft open. The old category name remains on the accepted board. The learner can correct the situation or copy the proposal; a reload does not falsely promise that the failed edit was saved.

Now imagine a second tab marks a clue used while the first tab's editor is open. A storage event refreshes the accepted board but leaves the open draft intact. Saving that old draft still uses its original baseline and therefore conflicts. Replacing the baseline automatically would let old used-marker state overwrite the newer round. The explicit recovery is to cancel, reload and reapply intended edits against current data.

The Node tests inject quota failure and serialize competing saves through a controlled lock boundary. Browser tests additionally override the real Storage method, inspect the retained form, and run two tabs through the actual Web Locks API. These layers establish different claims. Neither proves coordination with a script that ignores the lock or persistence after browser data is cleared.
