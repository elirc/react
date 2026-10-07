# Review the invariant, not the framework choice

Use these notes after attempting [practice](05-PRACTICE.md). The current implementation uses plain modules, but the same review questions apply if you later introduce React or a server framework. A framework does not decide which state is authoritative or when a command is safe to call successful.

For filtered editing, keep the draft's canonical collection separate from the visible filtered projection. Event handlers should carry category and question IDs. A deletion should find the record by identity, not by the filtered list's index. Test a filter that hides the first question, then update the visible second one and confirm that the hidden record remains unchanged. Decide whether filter text itself belongs in persistent board data; it usually represents local UI state.

For scoring, model an award as an explicit record with player, clue, round, amount and identity. Derive totals from accepted records. Undo can append a reversal or remove a draft award according to the audit requirements you choose. Do not let both the score total and history mutate independently. A double-click or repeated network request must not award the same event twice. That introduces a useful idempotency exercise once scoring moves behind HTTP.

For the HTTP adapter, preserve the current promise that a failed save leaves the draft open. Parse non-success responses before treating their bodies as data, and handle 204 without JSON parsing. Carry an expected resource version with updates. A request completing for an old editor session should not replace a newer proposal or close its dialog. Test delayed responses and explicit cancellation, not only immediate success.

For SQL persistence, put related writes inside the same transaction and use conditional updates at the write boundary. A transaction around an unconditional update still permits a stale editor to overwrite newer values. Define category-deletion policy and test it with active round references. If historical rounds must remain explainable after question edits, store the relevant prompt/answer snapshot or prohibit destructive changes to referenced records.

For access control, the owner comes from authenticated server identity. A hidden answer element or disabled edit button is only presentation. Learner responses should omit protected fields, and every mutation route must check authorization independently. Test users who know each other's IDs and nested question references. Keep authorization errors consistent with the resource-disclosure policy you select.

For migration and recovery, validate the complete input before writing any replacement. Preserve an existing backup until a restore has actually been verified. A successful import should report what changed and which format version was accepted. During review, ask the author to reproduce one stale save, one storage failure and one incomplete import. The strongest explanation connects each failure to a specific boundary and its test evidence.

## The invariant a framework change must not lose

Whatever you later put in front of this store, this case must keep passing: two savers sharing one baseline produce exactly one winner and one revision. From `test/store.test.js:106-119`:

```js
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
```


## Answers to the code-reading drills

**7a.** The first click disables every control (`main.js:24`), so a genuine second click lands on a disabled button and does nothing. `if (busy) return false` (`main.js:23`) is defence in depth for programmatic calls, such as a `storage` event handler or a keyboard submit racing the disable. Either way the user sees no message for the ignored attempt.

**7b.** `showClue` stores `raw: current.raw` at open time (`main.js:30`). Mark used builds its draft from the *latest* `current.state` (line 38) but saves against the remembered `clue.raw` (line 41). After another tab's new round, this tab's `storage` handler has reloaded `current`, but `clue.raw` is old, so `store.js:53` rejects with "This board changed in another tab". That is safe — it cannot resurrect old progress — but conservative: the user must close and reopen the clue. A reasonable alternative is to rebase only when the change is compatible (the clue still exists and is not yet used), which would need its own test.

**7c.** `text()` throws `Prompt must contain 1-1000 characters.` (`store.js:7`, called on line 21). The message is the same for every question, so in a bank of 50 questions the user must hunt. Including the category and question position in the thrown message would fix this; the validator already has both indices in scope at lines 15-18 via `map`.

## Senior-review findings

1. **Validation errors do not identify the record.** `store.js:5`, `:7`, `:20` throw generic messages ("Invalid question fields.", "Prompt must contain...", "Points must be...") with no category or question index. For imports this makes a 2 MiB file very hard to repair.
2. **Answers are shipped before reveal.** `main.js:32` writes `question.answer` into a hidden element; anyone with devtools can read it. Fine for a local study tool, but the README's "Reveal answer" should not be mistaken for secrecy (practice exercise 5).
3. **Clue completion uses an open-time baseline.** `main.js:30` / `:41` (drill 7b) — safe but forces a reopen after any change elsewhere, including an unrelated category rename.
4. **One error string, three destinations.** `error()` (`main.js:10`) writes the same message to the page panel, the editor and the clue dialog. An editor validation error therefore also appears in the main error panel behind the modal, and the panel is only cleared by the next successful operation or `load()`.
5. **Shadowed parameter.** `removeCategory(state, id)` reuses `id` as the inner filter parameter (`store.js:64`: `.filter(id => retained.has(id))`). Behaviour is correct, but the outer `id` is unreachable inside that callback; renaming avoids a future bug.
6. **Silent no-op on concurrent save.** `main.js:23` returns `false` with no status. If a future caller awaits the result to close a dialog, it will stay open with no explanation.
7. **Whole-board CAS is coarse by design.** `store.js:53` compares the full serialized board, so any write anywhere conflicts with any open editor. Documented as a limit (chapter 02) — reviewers should expect that, not flag it as a bug, until per-record versions exist.
8. **Strengths worth keeping.** One write site (`store.js:59`); validation before lock; revision derived from storage (`store.js:55-57`); recovery that refuses to overwrite unreadable data without confirmation and a matching baseline (`main.js:52-55`, `store.js:53-55`); a server that serves an explicit allowlist with CSP (`server.js:6-14`, `:28-34`).
