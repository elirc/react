# Learn CRUD through a complete browser workflow

This small application now has a real question-bank editing workflow rather than only a set of clickable tiles. Your goal is to follow a user action through draft state, validation, persistence and rendering, then explain what happens when saving fails or another tab acts first. Those skills transfer directly to larger CRUD web applications.

Start with [the root setup](../README.md). Install the locked development dependency with `npm ci`, start the local server and open its loopback URL. The application itself has no framework or runtime package dependency. Despite the historical folder name, it is vanilla JavaScript. Read the code as browser modules rather than looking for React components that are not present.

## Prerequisites and glossary

**Prerequisites:** ES modules and `async`/`await`, JSON and `localStorage`, DOM events including `<dialog>`, and the browser devtools Application panel.

| Term | Meaning here | Where in this project |
|---|---|---|
| accepted state | The board as it exists in storage, held as one snapshot with its exact text. | `current = { state, raw }` in `main.js` |
| draft | The editor copy that survives a rejected save. | `draft` inside `createEditor` in `edit.js` |
| baseline | The exact saved text the draft was opened from. | the `expectedRaw` argument of `BoardStore.save` in `store.js` |
| compare-and-set | Refusing the write when storage no longer holds that baseline text. | `if (current !== expectedRaw)` inside `BoardStore.save`, `store.js` |
| revision | The counter raised once per accepted save. | `revision: revision + 1` in `BoardStore.save`, `store.js` |
| web lock | The named lock that serialises two saves in the same browser. | `this.locks.request(...)` in `store.js`, supplied as `navigator.locks` in `main.js` |
| validation before write | Shape checks that run on the candidate, not on what is already stored. | `validateState` in `store.js` |
| legacy migration | Reading an older saved shape into the current one instead of discarding it. | `migrateLegacy` and `parseState` in `store.js` |
| unreadable saved data | A parse failure that disables editing and offers the raw text as a recovery export. | the `valid` flag and the `export-raw` button in `main.js` |
| busy gate | Disabling controls during a save so one click cannot be applied twice. | `busy` in `save()`, `main.js` |
| origin storage key | Saved data belongs to one origin and one key. | `STORAGE_KEY = 'customJeopardy'` in `store.js` |
| If-Match | The HTTP header that carries the same idea to a server. | `08-HTTP-COMPANION.md` |

## Your first session

Open a clue. Notice that the board initially shows points, then the dialog displays the prompt. Reveal answer shows the answer, while Mark clue used persists its consumed state. Close alone leaves it available. Reload and compare the used count. New round clears progress while retaining the same questions. The app does not calculate a player's score; point values identify clue values only.

Open Edit question bank and add a category called CRUD practice. Add a question, supply a prompt and answer, and save. Reload to see the persisted category. Edit the question, cancel once and verify that the saved version remains. Then save an update, delete the question with confirmation and finally delete the empty category. This sequence exercises the full create/read/update/delete lifecycle.

Read [the code map](01-CODEBASE-MAP.md), [concepts](02-CONCEPTS.md) and [worked change](03-WORKED-CHANGE.md). Use [testing and debugging](04-TESTING-AND-DEBUGGING.md) to connect each guarantee to evidence. Attempt [practice](05-PRACTICE.md) before consulting [review guidance](06-SOLUTIONS-AND-REVIEW.md). Complete [the trace lab](07-TRACE-LAB.md) and read [verification](VERIFICATION.md) before describing the application as reliable.

For every change, write a short note with the user intent, valid input, state owner, save boundary, failure path and test. For example, “An editor opened before another tab marks a clue used must not restore the older round state.” That sentence explains why exact saved-text comparison is needed in addition to a lock.

The app stores data in this browser on this exact origin. Export provides a copy you can move elsewhere. There is no authenticated account, remote database or shared classroom service. The course teaches those as next steps. A mid-level engineer should be able to distinguish a working local workflow from the additional consistency and access-control requirements of a multi-user server application.

Practice exercise 3 has a worked companion: [08-HTTP-COMPANION.md](08-HTTP-COMPANION.md) (Express + SQLite, `If-Match` and a conditional `UPDATE`).
