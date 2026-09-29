# Follow the browser's state owners

[index.html](../index.html) supplies the toolbar, board and two native dialogs. It loads one module entry point and the actual stylesheet paths. The original markup referenced nonexistent subdirectories and duplicated scripts before and after the DOM. The current module entry waits for document parsing and imports its dependencies explicitly, making startup order visible.

[main.js](../main.js) coordinates the application. `current` holds the last loaded or accepted saved board plus its exact raw storage text. The editor owns a separate draft. `valid` distinguishes usable saved data from a corrupt or unavailable storage state, and `busy` prevents overlapping UI save commands. The controller handles clue dialogs, import/export, new rounds and storage events from other tabs.

[store.js](../store.js) defines the data contract and persistence boundary. `validateState` checks schema version, revision, category and question counts, stable IDs, required text, point values and used-question references. `migrateLegacy` converts the earlier category/question array into deterministic IDs without changing the source array. `parseState` distinguishes missing storage, legacy data, valid current data and malformed content. `BoardStore.save` owns locking, stale-data comparison and the actual localStorage write.

[edit.js](../edit.js) builds labeled form controls with DOM methods. It starts from a deep copy of the current state and remembers the raw baseline at editor opening. Input events update only that draft. Adding or deleting categories/questions rerenders the draft form. Submission passes the candidate and original baseline to the save callback. The modal closes only after save succeeds; a failure preserves the draft for correction or export-oriented recovery.

[board.js](../board.js) renders one section per category, keeping its heading and question tiles together. Each tile is a button with an accessible label and a callback carrying the selected question. User-controlled names and text are assigned as text, not inserted as HTML. Used IDs determine disabled tiles. The displayed progress count is derived from the state rather than maintained by a separate counter.

[data.js](../data.js) retains the supplied example content. [server.js](../server.js) is a small local static server with an explicit asset allowlist. It has no database or mutation endpoint. Serving through loopback gives the browser a suitable origin for modules, storage and Web Locks.

Read [store tests](../test/store.test.js) for pure validation and controlled storage behavior, then [browser tests](../e2e/board.spec.js) for real DOM, localStorage and cross-tab coordination. Trace a successful edit across all these files and identify where the visible board becomes authoritative. Then trace a quota error and show why the old board and new draft remain separate.
