# Full profile form QA — 23 October 2026

`tests/profile-form.mjs` fills a new profile from an empty form in Chromium at 1280px and 390px. It uses an isolated in-memory SQLite database, fictional accounts/references, generated colored JPEGs and intercepted browser requests. It does not create production records or send SMS/email.

All 112 browser/API assertions passed. They cover every form field, linked India/state/district choices, optional email and four-digit identity suffix, five photo uploads, two consented references, public-listing and publication consent, required-field validation and server rejection of duplicate reference phone numbers. Persisted values are checked after submission and reload. Name/date locking, pending visibility, administrator approval, member/public projections, reference/contact privacy and protected photo responses are also checked. Both viewport sizes had no client exceptions or horizontal overflow.

Additional existing checks passed: 328 portal assertions, 54 approval assertions, 85 public browsing/mobile-access assertions, public registration suite and eight model/location unit tests. These checks establish the tested flows in the isolated environment; they are not a claim that every possible device, input or production integration was exercised.

Run after `pnpm build:node`:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge' # optional installed browser channel
# Set PLAYWRIGHT_MODULE to a module URL if Playwright is supplied outside the repo.
node tests/profile-form.mjs
```

Sanitized screenshots and machine-readable results are written under ignored `outputs/profile-form/`. Browser requests use the production hostname only as a routing fixture; all responses come from local build files or the isolated runtime.
