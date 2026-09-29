# Verify the real state boundary

Run `npm test` for the 20 Node cases and `npm run test:browser` for the Chromium workflows after installing the matching Playwright browser. The [configuration](../playwright.config.js) launches an isolated loopback static server and refuses to reuse an existing listener. Browser tests use new contexts, so personal browser storage is not a fixture and is not cleared.

The [store suite](../test/store.test.js) tests missing data, deterministic legacy migration, invalid JSON, schema versions, IDs, required fields, bounds, used-clue references and empty boards. Persistence cases assert new revision behavior, stale baseline rejection, quota failure, missing Web Locks, explicit corruption replacement and exhausted revisions. Delete cases verify that round-progress references are cleaned without modifying the input snapshot.

The controlled lock in Node serializes callbacks so races can be tested deterministically. It is useful for store logic, but it is not proof that the browser's lock implementation coordinates tabs. The [browser suite](../e2e/board.spec.js) therefore opens two pages in one context, lets both capture the same saved baseline, then starts their saves together. Exactly one succeeds. Another UI case preserves an older open form after a competing tab has saved.

Browser workflows also test category/question CRUD through labeled controls, reload, cancelled editing and deletion, quota failure, corrupt-data preservation, explicit replacement, literal rendering of markup-like text, import/export and new-round behavior. A clue is not consumed merely by opening and closing its dialog. Keyboard Escape dismisses an idle native dialog and returns focus. Desktop and narrow checks capture screenshots and reject document-wide horizontal overflow.

The static-server case checks that only application assets are served, including a successful HEAD request with no body. Repository files such as package metadata, server source and environment paths are not part of the asset allowlist. Response headers supply a content type, nosniff and a restrictive content security policy. This is a local static server, not a general-purpose production hosting service.

When debugging a failed save, ask three questions in order: did validation accept the candidate, did the stored baseline still match, and did setItem succeed? Inspect the editor error instead of assuming any open dialog means a broken click handler. For a missing saved board, compare protocol, hostname and port; changing localhost to 127.0.0.1 changes the origin and its storage.

A passing local suite does not establish authenticated ownership, remote persistence, full accessibility compliance or power-loss durability. Keep [verification](VERIFICATION.md) beside any claims you make about the project.

## The three commands

Both layers are declared in `package.json`; `npm run verify` is simply the pair, and it fails if the Node cases fail before Playwright starts.

```bash
npm test          # node --test test/store.test.js
npm run test:browser  # playwright test
npm run verify    # npm test && npm run test:browser
```

