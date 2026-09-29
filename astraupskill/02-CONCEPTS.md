# Drafts, identity and cooperating browser tabs

A draft is a proposal. The saved board is the accepted state. Mixing them creates a common CRUD bug: the screen changes before persistence succeeds, then a reload loses the apparent update. The editor copies the loaded board, changes the copy and submits it only when the learner saves. `BoardStore.save` validates and writes before the controller replaces `current`. A storage error leaves the proposal visible in the dialog and the accepted board unchanged.

Stable IDs distinguish records from positions. Deleting the first question should not make its used marker refer to the former second question. Categories and questions have unique IDs, while round progress stores question IDs. Delete helpers remove obsolete used markers together with the corresponding records. Validation rejects duplicates and references to missing questions, keeping the relationship explicit.

## Why a lock is not enough

A Web Lock serializes cooperating saves on the same origin. Imagine two tabs both load revision zero. Tab A saves a changed category and releases the lock. Tab B later acquires it, but its draft was still based on revision zero. If it simply writes, it loses A's change. Therefore the save also compares the current stored text with the exact text remembered when that draft began. B conflicts instead of overwriting A.

The app increments revision for display and exported metadata, deriving the next value from current storage. It does not trust a revision number supplied in an import. The actual stale-write condition uses the raw baseline. This is coarse whole-board concurrency: two tabs editing different questions still conflict. Per-record versions in a server database are a later exercise.

## Missing, empty and corrupt data

Missing storage loads examples without automatically writing. An empty category list is a valid user-created board. Malformed JSON or an unsupported schema version is corruption or incompatibility, so the app preserves the raw text and offers recovery. It does not silently replace a broken board with examples. Explicit replacement checks the same raw baseline, preventing an old recovery screen from overwriting a newer repair in another tab.

Input validation and safe rendering solve different problems. A category name containing angle brackets can be valid literal text. The DOM renderer uses textContent and text nodes, so that value does not create an image or execute markup. Import validation checks structure, bounds and relationships before it reaches rendering. Neither local validation nor a content security policy creates authenticated ownership.

The storage guarantee assumes all app tabs use the same lock protocol. DevTools, older scripts or other code can bypass it. localStorage is origin-scoped and is not a remote backup or a database transaction across users. These limits matter when translating the design into a server-backed CRUD application.
