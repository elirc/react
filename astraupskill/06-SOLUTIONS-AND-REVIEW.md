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

