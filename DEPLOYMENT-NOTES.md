# Deployment notes, 7 October 2026

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
