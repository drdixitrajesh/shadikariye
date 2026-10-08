# Deployment notes, 7 October 2026

## managelove.com free-only deployment, 8 October 2026

The Cloudflare zone `managelove.com` is active on Free Website. The owner-authenticated Workers plans dashboard separately confirms **Free / $0 / Current plan** for account `0806706663c74737529a2e2f9de75440`. No subscription upgrade or paid service was activated. The browsing-only deployment is live at **https://managelove.com**; full member features remain unavailable. Deployment completed on 8 October 2026 at 11:42 IST, using Worker version `90be8a85-5bf9-48e6-aa16-0905eba533c4` at 100% traffic. The additional Worker address is `https://managelove.softinator-gj-account.workers.dev`.

`wrangler.managelove.jsonc` is the standalone browsing-only configuration. It serves the existing Vinext application and static assets on Workers Free, without D1, R2, Twilio, or connector bindings. R2 has usage-based overages and is deliberately excluded from this strict free-only deployment. Managed Sites hosting remains configured separately in `.openai/hosting.json`.

`STANDALONE_MODE=demo` rejects managed identity headers and denies member and administrator operations, including forged identity requests. Managed ChatGPT auth routes return an explicit unavailable response. The interface explains that only fictional demo browsing and the community/gotra directory are currently available. Existing trusted managed-host behavior is retained when this standalone flag is absent. No existing member records or photos are imported.

Routing attaches only `managelove.com/*` and `www.managelove.com/*` to the new `managelove` Worker. Existing proxied parking DNS records were verified unchanged. The Worker redirects HTTP and www to `https://managelove.com`, retaining paths and query strings. Both routes have `request_limit_fail_open=false`. The predeploy DNS, Worker routes, Worker domains and Worker inventory snapshot is saved in ignored `outputs/deployment-2026-10-08/predeploy-cloudflare.json`; immediate pre/post-cutover snapshots are `cutover-before.json` and `cutover-after.json` in the same directory. Rollback removes only route IDs `a67c2ee6a3924225b1399a7c647521bf` (apex) and `7554cb99ee34422092c1260bffb4f5fb` (www), returning traffic to the original DNS destination.

Checks: production build, TypeScript and Wrangler deployment dry run passed; 31 standalone checks and 126 existing integration checks passed. Live HTTPS homepage and terms, static assets, demo API state, forged-header rejection, blocked member/admin operations, and HTTP/www redirects passed. Six live JS/CSS assets and the portrait file matched the local build/source SHA-256 hashes. Browser verification confirmed language switching, city filtering, six demo listings after reset, and the unavailable-member-services screen. Repository-wide lint still reports eight errors inherited from HEAD in the original interface/admin/terms files; the deployment/auth changes pass focused lint with one existing Worker export-style warning. Evidence, deployment logs, `live-verification.json`, `baseline-lint.json`, free-plan proof and live screenshots are stored in ignored `outputs/deployment-2026-10-08/`.

For subsequent updates, rebuild and deploy from the repository root using the existing deployment credential injected through BWS into `CLOUDFLARE_API_TOKEN`, never printed or committed:

```sh
npm run build
node node_modules/wrangler/bin/wrangler.js deploy --config wrangler.managelove.jsonc
```

Keep the account on Workers Free. The current plan allows 100,000 Worker requests per day and 10 ms CPU per request; exceeding free allowances may cause request failures instead of a paid upgrade. Verify HTTPS, both hostnames, static assets, anonymous state, rejection of forged identity headers, and administrator denial on the live deployment before calling it complete. Full member launch requires independently verified standalone authentication and an explicitly agreed mobile-verification approach that satisfies the free-only requirement; do not bypass the existing verification controls.

This revision updates the existing owner-private Vaidik Milan preview. A new GitHub repository and the user's own Cloudflare account deployment are still pending account access. Do not treat the managed preview as deployment to shadikariye.com.

## OTP activation

The implementation uses Twilio Verify SMS with India +91 mobile numbers. All features remain free for members. SMS provider costs, regulatory sender setup, and hosting usage are the operator's responsibility; no paid provider account has been created or connected.

Configure these secrets through the host's secure secret settings, never in committed files:

- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_VERIFY_SERVICE_SID, with six-digit codes and default ten-minute validity
- OTP_HASH_SECRET, a random secret of at least 32 characters; retain it across deployments because verified phone fingerprints depend on it

Without all four, OTP is explicitly unavailable and new profile publication and real member contact are denied. Integration tests use a mock provider; no real SMS has been sent or tested. OTP proves control of a mobile number only. One verified phone fingerprint maps to one account. Unverified reservations expire in ten minutes; failed sends release the reservation. Each account can request five SMS/day, with sixty seconds between requests and five attempts per challenge.

## Existing identity and migration

Do not deploy the current ChatGPT identity header reader directly to an untrusted own-account Worker. The managed platform strips/injects identity headers. Standalone hosting requires independently verified authentication, trusted session handling and equivalent account IDs. Caller-supplied headers alone are not authentication.

D1 migrations 0001 and 0002 add identity locks, private references, five photo slots, view limits, OTP metadata, blocks and reports, backfill existing profile photo slot 0, and retain stable profile IDs. No production sample profiles are seeded. Existing profiles retain their name and must complete OTP and private birth-date/reference setup for subsequent publication edits. Birthday age is computed without exposing birth date.

Name, birth date and optional private four-digit Aadhaar suffix are locked on first save, including across profile deletion and recreation. The site never collects a full Aadhaar number and does not perform UIDAI verification. Identity corrections/erasure require an operator-reviewed process before public launch. An optional suffix cannot identify duplicate people.

## Viewing and safety

A server-issued daily feed contains at most twenty distinct other profiles per account on an India calendar day. Reopening a feed does not reserve extra profiles; filters search this daily feed. Anonymous visitors only see the fixed fictional demo set. Own profile is excluded. Photo endpoints enforce the same allowance. A verified mobile account is required to see real listings. This is an account/mobile limit, not a guarantee against people using multiple phones.

Reports are persisted with pending status and block contact in both directions. No automatic review, police notification or human-response SLA is claimed. The operator needs a staffed review process; review pending reports through authorized database administration. Stable profile IDs stop block evasion through deletion/recreation. Conditional SQL message and interest writes enforce authorization in the same statement as insertion.

Before public launch, supply operator legal identity/address, grievance officer and contact; establish private identity/security record retention, verified correction/erasure procedures and reference consent handling; obtain legal review of /terms. The disclaimer qualifies user-content responsibility and preserves legal duties. It cannot guarantee complete legal immunity. Full Aadhaar verification needs a separate lawful consent-based authorized integration, not a free-text identity number.

## Portability

The current code uses D1 and R2. Migration to a Sudama Nagar server will require an alternative database/object-store adapter and proper server authentication, with a documented data migration. No DNS changes have been made.

## Administrator profile removal
Configure trusted sign-in ADMIN_EMAILS and/or ADMIN_USER_IDS allowlists in host settings. Missing allowlists deny access. Only the existing site owner is initially enabled through the managed host's runtime configuration; optional profile contact email never grants privileges. /admin lists and searches all member profiles with pagination; /api/admin/profiles enforces authorization and origin checks on every action. Delete requires the exact profile name and a reason. Deletion transaction removes the profile, references, photos, shortlists, interests and messages, records the trusted actor/reason/time, and marks related reports profile_removed. Identity locks, blocks, verification and safety records remain private. Deletion does not ban account republication. Static fictional demo examples are excluded. Failed photo cleanup is persisted in photo_cleanup; files cannot be served after the profile is removed. Admins can retry cleanup in batches. Migrating to standalone Cloudflare or another server requires real authentication before using this admin system, not caller-provided identity headers.

## Post lifetime (2026-10-08)
Posts have immutable first-publication and expiry timestamps: six India-time calendar months, clamped to the target month’s last day. Mutable edits never renew expiry. Legacy posts use the current post’s last saved timestamp as the conservative publication estimate because retained identity locks can predate deletion/republication. Authors retain the existing anytime delete button. Republish after deletion starts a fresh lifetime with the same permanent identity. Every website request atomically sweeps expired posts before serving data, cascading references, interests, messages and photo metadata, and retries private R2 cleanup (50 objects per request). Identity and anti-abuse records remain private under existing terms. There is no independent timer configured on managed hosting: with no traffic, physical cleanup waits for the next website request. A future standalone Cloudflare Worker can invoke the same sweep from a Cron Trigger. The UI, profile expiry date and terms explain deletion. Hindi punch line: “संस्कारों से जुड़ें,”; second line remains “परंपरा के साथ।”
