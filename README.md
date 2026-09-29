# Quiz board studio

A small vanilla JavaScript CRUD app for editing a question bank and playing quiz rounds. The folder is historically named `react`, but the implementation uses browser ES modules, DOM APIs, localStorage and Web Locks. Start with [the detailed learning course](astraupskill/README.md).

## Run

Prerequisites: Node 22 and a current browser with Web Locks on localhost.

```powershell
npm ci
npm start
```

Open `http://127.0.0.1:4173`. Serve through the local server instead of opening index.html as a file. The server serves only the app's seven assets and binds to loopback. It does not expose a data API or other repository files. `PORT` can select another port; browser storage belongs to the exact origin, so changing the port changes which saved board is visible.

## Use

Choose Edit question bank to create, rename or delete categories and create, update or delete questions. Category deletion removes its questions from the draft. Save bank persists the entire validated candidate; Cancel discards the draft. Each category supports up to 20 questions, with up to 10 categories overall. Questions have a prompt, answer and point value.

Clue tiles show points. Open a clue, reveal its answer and explicitly mark it used. Closing a clue alone does not consume it. New round clears used markers while retaining the question bank. Progress survives reload in this browser. Points label clues; automatic player scoring is not implemented.

Export creates a portable JSON copy. Import validates before requesting replacement confirmation. Existing legacy arrays under `customJeopardy` load without an automatic write and convert to the versioned format on the next successful save. Corrupt saved text is preserved, with export and explicit replacement controls. Storage failures retain the editor draft. Cooperating tabs use Web Locks plus exact saved-text comparison to reject stale writes.

## Verify

```powershell
npm test
npx playwright install chromium
npm run test:browser
```

The Node suite checks storage/domain behavior. Chromium scenarios exercise actual CRUD, reload, cross-tab conflicts, Web Locks, quota failure, import/export and layouts using fresh browser contexts. See [verification](astraupskill/VERIFICATION.md) for evidence and limits.

This is a local learning app. It has no server database, authenticated accounts, shared remote classroom, player score ledger or guaranteed backup. Existing sample question content is retained as supplied. Web-service and SQL extensions are [practice work](astraupskill/05-PRACTICE.md).
