# Verification and practical limits

Recorded result: all 31 tests passed (20 Node and 11 Chromium), alongside six syntax checks reported as successful. The tested environment was Node 22.16.0 and Playwright 1.60.0 (the version pinned in `package.json`) with its matching Chromium build. The TAP output and browser JSON were kept in the central implementation workspace and are **not included in this repository**; only the two screenshots are, as [desktop](images/desktop.png) and [narrow](images/narrow.png). This record therefore reports a past run; it is not something this clone can display.

To reproduce:

```powershell
npm ci
npm test                      # node --test test/store.test.js  -> expect 20 passing
npx playwright install chromium   # once, for the browser suite
npm run test:browser          # playwright test                 -> expect 11 passing
```

`npm run verify` runs both and stops before Playwright if the Node suite fails (`package.json` scripts). The browser suite starts its own server on port 24763 by default (`QUIZ_TEST_PORT`, `playwright.config.js:2`) with `reuseExistingServer: false`, so it fails rather than testing a stale server already on that port. Screenshots are written only when `QUIZ_RESULTS_DIR` is set (`e2e/board.spec.js:231-243`).

Node cases exercise actual validation and migration functions plus controlled storage and lock boundaries. They verify detached defaults, deterministic legacy IDs, malformed input, unknown fields, unique identity, bounded points and collections, valid used-clue references, revision derivation, stale saves, quota errors, unavailable storage, explicit corrupt replacement, deletion cleanup and empty banks. These cases establish the store's behavior without depending on browser UI timing.

Chromium scenarios exercise the real application modules and localStorage. They cover category/question CRUD and reload, cancelled edits and deletes, clue reveal and accepted use, new rounds, retained drafts after quota failure, stale forms in another tab, actual simultaneous Web Locks saves, corrupt-data preservation and explicit replacement, import/export and literal rendering of markup-like names. Layout checks inspect desktop and narrow widths, capture screenshots and exercise keyboard dialog dismissal with focus return. The static-server scenario verifies its asset allowlist, response headers and HEAD behavior.

The record says an earlier browser run passed ten scenarios and the final run added the server-boundary case (`e2e/board.spec.js:252-271`). Browser contexts are isolated test data; no personal browser profile or existing localStorage was used. The local server refuses to reuse an existing listener. Dependency installation used the checked-in lockfile outcome, and the application runtime itself requires only built-in browser APIs.

The supplied example question content was retained. Existing legacy saved arrays are read and migrated in memory, then converted on the next successful save. That migration is not a live rewrite performed during this improvement pass. Corrupt saved text remains untouched until the app user explicitly confirms replacement, and its current raw baseline must still match. Export offers a recovery copy but is not an automated backup schedule.

Limits remain: no server-side database, authentication, remote classroom sharing, player scoring history, automatic answer secrecy, full accessibility certification, crash-recovery or power-loss guarantee. Web Locks coordinate cooperating tabs on the same origin; code that bypasses the protocol can still change storage. Browser storage can be cleared or unavailable, and changing protocol, hostname or port changes the origin. The asset server is for local learning, with no production deployment claim. These boundaries are the starting point for the HTTP, SQL and ownership exercises, not hidden unfinished features.

## Counts you can check without running anything

| Claim | How to check in this clone |
|---|---|
| 20 Node cases | `test(` appears 20 times in `test/store.test.js` |
| 11 browser scenarios | `test(` appears 11 times in `e2e/board.spec.js` |
| 25 sample tiles | `data.js` has 5 categories x 5 questions; asserted at `e2e/board.spec.js:10` |
| seven served assets | `server.js:6-14` |
| one storage write site | `setItem` appears once across the app assets, at `store.js:59` |

**Check:** each row above holds in your checkout; if a count differs, this record is stale and must be updated before it is cited.
