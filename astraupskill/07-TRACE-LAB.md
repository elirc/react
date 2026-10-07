# Trace one edit through two browser tabs

Start the local server at its ordinary loopback URL and open a disposable browser profile or context if you want to keep existing learning data separate. Do not clear a personal browser's site data as a testing shortcut. The automated browser suite already creates isolated contexts for this purpose.

Begin by opening and closing a clue without marking it used. Confirm that the tile remains available. Open it again, reveal the answer and mark it used. Inspect localStorage under `customJeopardy`: the saved object includes schemaVersion, revision, categories and usedQuestionIds. The used marker refers to a question ID rather than its position in the displayed board. Reload and compare the progress count.

Open Edit question bank. Change a category name, but do not save yet. Inspect the board behind the dialog and the stored JSON. Both still contain the accepted name; the proposal lives only in the editor's draft. Save and inspect the revision increment. Explain why an imported revision of 999 would not control the next revision: the store derives it from current saved state.

Now open a second tab on the exact same origin. Open editors in both tabs. Save a name change in the first while retaining a different proposal in the second. The second receives a storage event, refreshes its accepted board and preserves the draft. Its later Save bank uses the baseline captured at editor opening and conflicts. Cancel, reload and deliberately reapply the intended change. Do not merely replace the baseline token on the old draft.

Export the board and inspect the downloaded JSON. Copy it, change one category name to literal markup-like text and import the copy. The name should render as text, not create an element. Then make a malformed copy and attempt import again. Validation must fail before the saved board is replaced. Keep your valid export for recovery rather than editing the only copy you own.

Read the quota-failure browser test. It makes setItem throw, submits a changed category and checks that the editor retains the proposal while storage remains unchanged. Compare that result with a stale-save failure: one means the persistence medium rejected the write; the other means the proposal was based on old data. Their recovery paths differ.

Write a trace table covering input collection, draft change, validation, lock acquisition, baseline comparison, storage write, accepted-state publication and render. Mark which steps can fail and what the user sees. Finish by mapping those stages to a future form component, API route, service and SQL transaction. The current static server serves assets only; those data-service layers remain future work.

## What the second tab actually receives

When the first tab saves, the second tab does not poll: it reloads accepted state from a `storage` event and leaves the open draft alone. From `main.js:65-69`:

```js
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  load(); status('Saved board changed in another tab.');
  if (editor.dialog.open) byId('editor-error').textContent = 'Another tab changed the saved board. This draft is preserved; cancel and reload before editing again.';
});
```


## Reference trace table

Fill this in yourself first, then compare. One editor save of a renamed category:

| Stage | Code | Can fail? | What the user sees on failure |
|---|---|---|---|
| input collection | `edit.js:9` writes into `draft` | no | — |
| native constraints | `required`, `maxLength`, `min/max/step` (`edit.js:7-8`) | yes | browser tooltip; no submit event |
| submit | `edit.js:30` -> `main.js:9` -> `main.js:22` | busy gate | nothing (`main.js:23`) |
| controls disabled | `main.js:24` | no | — |
| structural validation | `store.js:49` -> `validateState` | yes | message in editor; dialog stays open |
| lock availability | `store.js:50` | yes | "Saving needs Web Locks" |
| lock acquisition | `store.js:51` | waits | controls stay disabled while waiting |
| read current | `store.js:52` | yes | "Browser storage is unavailable." |
| baseline comparison | `store.js:53` | yes | "This board changed in another tab..." |
| revision derivation | `store.js:55-56` | yes | parse error or revision limit |
| size check | `store.js:58` | yes | "Board exceeds the 2 MiB limit." |
| storage write | `store.js:59` | yes | "Save failed: browser storage is full..." |
| publish accepted state | `main.js:25` (`current = committed`) | no | — |
| render | `main.js:25` -> `board.js` | no | — |
| close editor | `edit.js:30` | no | — |
| other tabs notified | browser fires `storage` -> `main.js:65-69` | — | "Saved board changed in another tab." |

Mapping to a future server stack: native constraints -> form component; submit and busy gate -> client adapter; validation -> API route (reuse `validateState`); lock + baseline + write -> a single conditional `UPDATE` in a transaction ([08](08-HTTP-COMPANION.md)); `storage` event -> polling, server-sent events or a websocket.

**Check:** your table marks exactly five stages as unable to fail (input collection, disabling controls, publishing, rendering, closing), and every failure row names a message that appears verbatim in `store.js`.
