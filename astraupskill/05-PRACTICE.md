# Exercises toward a server-backed CRUD app

These are proposed extensions. Build on the delivered local workflow and keep each change small enough to review with its test. Start by stating which state belongs to a draft, a saved resource or a derived display value.

## 1. Add search in the editor

Filter questions by prompt or answer while preserving stable IDs and category context. Editing a filtered result must update the intended question, not the record currently occupying an array index. Test two questions with similar text, deleting an earlier question and clearing the filter. Decide how unsaved changes affect search results, and avoid replacing the draft merely because the filter changes.

**Goal:** keep handlers keyed by identity. **Check:** your delete handler calls `removeQuestion(draft, category.id, question.id)` exactly as `edit.js:21` does today, never an index; a test that hides question 1, edits question 2 and saves leaves question 1's text byte-identical in storage.

## 2. Add players and explicit scoring

The current point values do not represent a score ledger. Introduce players and a record of awarded or deducted points for a clue. Define whether a clue may be scored more than once and how undo works. Derive totals from scoring records instead of independently updating a displayed total and history array. Test a corrected award, a deleted question and a new round. Decide whether a historical score refers to an immutable clue snapshot.

**Goal:** derive, don't duplicate. **Check:** the saved shape gains one new array of award records and *no* stored total; `validateState` (`store.js:9-27`) is extended to reject awards that reference unknown questions, the same way line 25 rejects unknown used markers.

## 3. Move the question bank behind HTTP

Create a server with category and question CRUD endpoints. Return readable resource identities after creation, clear errors for invalid input and conflicts for stale updates. Keep the existing store interface or an adapter so the editor can preserve its draft on failed requests. Add an actual HTTP test before connecting the browser. A network response may arrive after the user closes and reopens an editor; use a session or request identity to prevent stale completion from closing the wrong draft.

**Goal:** keep the draft-preservation promise across a network. **Check:** a test where the PUT returns 409 leaves the editor open with the user's text, exactly as the quota scenario (`e2e/board.spec.js:85-102`) does today. A worked version is in [08-HTTP-COMPANION](08-HTTP-COMPANION.md).

## 4. Introduce SQL relationships and per-record versions

Model categories, questions and rounds explicitly. Add foreign keys, unique IDs and a version column on editable resources. Deleting a category and its related questions must follow an intentional cascade or restriction policy. A transaction should also handle any associated round references. Test two users editing different questions successfully and two users editing the same version with one winner. Compare that behavior with the current whole-board conflict policy.

**Goal:** narrow the conflict unit. **Check:** two clients editing *different* questions both get success, while the current store would reject the second (`store.js:53` compares the whole board's text).

## 5. Separate teacher and learner access

Add authenticated teacher ownership and a learner-facing quiz view. The browser currently receives every answer, so hiding a paragraph is not a security boundary. Design separate response models if answers must remain server-side until reveal or scoring. Test copied resource IDs across teachers, unauthorized imports and attempts to edit a question through the learner role. Derive identity from the server's trusted authentication context.

**Goal:** recognise presentation vs. security. **Check:** show that the current page already ships every answer to the browser — `main.js:32` writes `question.answer` into the hidden `#answer-text` element before the learner reveals it — and design a response model that omits it.

## 6. Add migration and recovery tooling

Design an import preview with counts, validation errors and a downloadable backup of the existing board. Test legacy migration on disposable copies. Add a database backup/restore exercise once the server exists. Keep the distinction between a successful save response, a durable backup and a user-visible recovery workflow. Finish with a short release note stating the tested environment and the remaining storage and access assumptions.

**Goal:** make import non-destructive to inspect. **Check:** the preview shows category and question counts computed from `parseState` output (`store.js:39-44`) *before* the existing `confirm` in `main.js:61`, and a malformed file produces an error without any write.

## 7. Small code-reading drills (no new features)

**7a. Goal:** understand the busy gate. **Check:** explain what the user sees if they press Save twice quickly (`main.js:23` returns `false` silently, and the second click is on a button already disabled by line 24).

**7b. Goal:** find a conservative conflict. **Check:** open a clue, let another tab start a new round, then press Mark clue used. Using `main.js:30`, `:38` and `:41`, predict the message (the clue remembered the old `raw`, so `store.js:53` rejects) and decide whether that is the right user experience.

**7c. Goal:** read validation errors as a user. **Check:** add a question in the editor and save without filling it. Which message appears (`store.js:7`, label `Prompt`) and how would a user know *which* question failed?
