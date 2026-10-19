# Profile posting verification — 19 October 2026

Target: https://vedik-milan.softinator.org/ and the same Node production build against an isolated SQLite database.

## Corrections

- A saved profile with a failed photo upload no longer also reports complete success. The error names the failed photo slots, retains their selections, and explains how to retry with Save changes. Successful slots are cleared independently.
- Rejecting a replacement photo clears the previous pending selection, preventing an older file from uploading unexpectedly.
- Photo inputs reset after preparation so the same file can be selected again. The prepared file stays in React state for submission and retry.
- A failed refresh after saving explains that saving succeeded and the latest information could not load.

## Verification

- Browser: filled all three form steps with a fictional profile and references; confirmed required-field blocking and reference permission checks.
- Browser: posted privately in the isolated database, injected HTTP 503 for the first photo upload, verified the partial-failure message, then retried successfully without reselecting the photo.
- Browser: saved all five photo slots; reloaded the application and confirmed the saved profile, references and photos persisted. Name, birth date and identity suffix were locked after the first save.
- Browser: replaced a valid pending image with an invalid file; confirmed rejection and removal of the pending selection. Confirmed successful preparation clears the native input while retaining the prepared selection.
- `node --test tests/portal-ui.mjs tests/photo-storage.mjs scripts/node-d1.test.mjs scripts/node-seed.test.mjs`: 25 passed. Includes genuine JPEG/PNG/WebP validation, metadata and malformed-file handling, storage behavior, actual rendered credential forms and SQLite behavior.
- `PORTAL_TEST_RUNTIME=node node tests/portal.mjs`: 332 independent checks passed, including sessions, profile validation, privacy, ownership, photos and expiry.
- `node tests/public-registration.mjs`: passed on the new hostname, including signup, login, consent, posting, anonymous privacy, public-listing opt-in/out, duplicate accounts and rate limits.
- Production build, TypeScript and whitespace checks passed.

The browser posting data stayed in a separate local database. No fake profile or account was added to the live member catalog. Registration challenge responses in the automated suite were mocked at the outbound boundary; a real CAPTCHA or real-user account creation was not completed by the browser test.
