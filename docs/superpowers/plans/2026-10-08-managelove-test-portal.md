# ManageLove Test Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for inline execution, or `superpowers:subagent-driven-development` if the owner explicitly selects delegation. Steps use checkbox syntax. Do not start product implementation before the owner reviews this plan and chooses its execution method.

**Goal:** Deliver one working administrator and six fictional member accounts on https://managelove.com, with secure activation, persistent matrimonial workflows, Turnstile, and Cloudflare Free services only.

**Architecture:** Keep the existing vinext Worker and managed Sites mode. Add a separate standalone portal mode backed by an isolated D1 test database and server-verified sessions. Use a private SQLite Durable Object binding for expensive password hashing and bounded image processing, keeping that work outside the frontend Worker's small CPU budget. Add Cloudflare Workers Builds in the companion deployment plan.

**Tech Stack:** Existing React 19.2.6, vinext 1.0.0-beta.5, Vite 8.0.13, Wrangler 4.92.0, TypeScript 5.9.3, Drizzle, D1, SQLite Durable Objects, Node-compatible crypto, Cloudflare Turnstile; Node >=22.13.0 and pnpm 11.25.0.

**Spec:** `docs/superpowers/specs/2026-10-08-managelove-test-portal-design.md`, copied unchanged from the owner-supplied document. The owner requested implementation of that written spec on 2026-10-08. The document's old access-dependency paragraph describes another environment; this environment has an authenticated Cloudflare dashboard and existing Worker deployment access.

## Global constraints

- Invitation-only test release; no public registration of real members.
- Seven usernames: `drdixitrajesh`, `ananya.test`, `ishita.test`, `meera.test`, `aarav.test`, `rohan.test`, `aditya.test`.
- Fictional accounts and their content visibly carry test labels; never claim mobile verification without a completed real provider verification.
- An explicit immutable owner account ID controls administration; administrator writes require MFA.
- Short-lived, distinct, single-use activation tokens; only token and session hashes persist. No shared password, committed password, token, session, or MFA secret.
- Cookies are Secure, HttpOnly, SameSite, host-only; expiry, revocation, same-origin mutation checks and database-backed throttling are mandatory.
- A dedicated D1 test database; test authorization cannot reach any future real-member environment.
- Five JPEG/PNG/WebP images per profile, each at most 256 KiB; private serving, metadata removal and an explicit total storage cap.
- Preserve locked names and birth dates, editable optional contact email, two consenting test references, mutual-interest messaging, 20 distinct other profiles per India-time day, deletion and six-calendar-month expiry.
- Preserve “संस्कारों से जुड़ें, परंपरा के साथ।” and existing संयोजक contacts; restore “कोई छिपा शुल्क नहीं”.
- Use only Free Workers, Free D1, SQLite Durable Objects on Free, Free Turnstile, and Free Workers Builds. No R2 enablement, paid SMS, paid plan, paid storage, paid image service, or automatic billing upgrade.
- Preserve existing managed-host functionality and its integration checks. Changes in this plan must not re-enable untrusted managed identity headers on the public domain.

## Verified starting state and release boundaries

- Repository: private `drdixitrajesh/shadikariye`; `main` at `5a21c35e520b0ba516d610c0e41a7cbd6fb01950`; checkout was clean when planning began.
- Worker `managelove`, account `0806706663c74737529a2e2f9de75440`, deployed version `90be8a85-5bf9-48e6-aa16-0905eba533c4` at 100%.
- Dashboard confirms `STANDALONE_MODE=demo`, no connected bindings, and no Git build integration. The public browser still renders six fictional static profiles with the member-services-unavailable notice.
- No Turnstile widget or server verification integration exists in this app's source. A Cloudflare account-level bot setting would not substitute for application authentication or Turnstile verification.
- Prior same-source checks: 126 managed integration checks and 31 standalone checks passed. Re-run after implementation; they do not prove the future portal works.
- Existing full lint has eight errors and seven warnings. Record the baseline, fix violations in touched files, and do not report full lint success until it really passes.
- A fresh shell HTTP probe returned generic 403 responses on every checked route, including the homepage; it did not exercise application authorization. Browser refresh and dashboard observations are the current live proof. Investigate shell access before relying on unattended smoke checks.
- Current GitHub identity has push permission but no repository admin permission. Cloudflare GitHub App access may need the repository owner's authorization.
- First release is a functional test portal on the production domain. Opening real-member registration also requires agreed verification, recovery, legal operator/privacy/retention details and separate production data. Do not call those future requirements complete.

## File boundaries

| Unit | Files | Responsibility |
| --- | --- | --- |
| Portal contract | `lib/portal/config.ts`, `lib/portal/types.ts` | Mode, origin, environment marker, account/session types and fixed limits |
| Account storage | `db/schema.ts`, `drizzle/0005_portal_accounts.sql`, `drizzle/meta/*` | Accounts, invitations, sessions, throttles, MFA/recovery and photo blobs |
| Private compute | `build/portal-compute.ts`, `lib/portal/password.ts`, `lib/portal/photo-sanitize.ts` | Password KDF and trusted image decoding/re-encoding |
| Authentication | `lib/portal/auth.ts`, `lib/portal/turnstile.ts`, `lib/portal/mfa.ts`, `app/api/auth/*/route.ts` | Activation, login, logout, session authentication and MFA |
| Existing identity bridge | `app/chatgpt-auth.ts`, `lib/store.ts`, `lib/admin.ts`, `lib/security.ts`, `build/sites-worker.ts` | Select managed/demo/portal identity safely and enforce authorization |
| Stored member workflows | `app/api/state/route.ts`, `app/api/profile/route.ts`, `app/api/actions/route.ts`, `app/api/messages/route.ts`, `app/api/safety/route.ts`, `lib/matrimony.ts` | Test permission, stored profiles, privacy, interests, messages and quotas |
| Photos and deletion | `lib/portal/photos.ts`, `app/api/photo/route.ts`, `app/api/photo/[key]/route.ts`, `lib/profile-deletion.ts`, `lib/profile-expiry.ts` | D1 storage, authorization, cap, cleanup and expiry |
| Member surfaces | `app/login/*`, `app/activate/*`, `app/account/*`, `app/page.tsx`, `app/milan.tsx`, `app/profile-security.tsx`, `app/globals.css` | Usable Hindi/English authentication, account status and member actions |
| Administration | `app/admin/page.tsx`, `app/admin/profiles.tsx`, `app/admin/accounts.tsx`, `app/api/admin/accounts/route.ts`, `app/api/admin/profiles/route.ts` | MFA-gated moderation, test-account reset and audit |
| Operations | `scripts/portal-bootstrap.mjs`, `scripts/portal-recover.mjs`, `scripts/verify-portal.mjs`, `wrangler.managelove.jsonc`, `vite.config.ts`, `cloudflare-env.d.ts` | Safe bootstrap, recovery, reproducible build and Free-only bindings |
| Evidence | `tests/portal-*.mjs`, `tests/helpers/portal.mjs`, `DEPLOYMENT-NOTES.md`, `PRODUCT.md` | Meaningful regressions, operational instructions and honest release receipt |

### Shared interfaces

```ts
type PortalAccount = {
  id: string; username: string; displayName: string;
  role: 'admin' | 'member'; isTest: boolean;
  status: 'invited' | 'active' | 'disabled';
  sessionVersion: number;
};
type PortalSession = {
  hash: string; account: PortalAccount;
  expiresAt: number; mfaVerifiedAt: number | null;
  purpose: 'member' | 'admin' | 'mfa';
};
type PasswordRecord = {
  algorithm: 'scrypt'; N: 16384; r: 8; p: 5;
  salt: string; hash: string;
};
type SafePhoto = {
  bytes: ArrayBuffer; mime: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number; height: number;
};
```

`lib/portal/config.ts` exports `isPortalMode(): boolean` and `assertTestDatabase(database: D1Database): Promise<void>`. Mode is `STANDALONE_MODE=portal` with `PORTAL_ENVIRONMENT=test` and a D1 singleton marker containing the exact configured `PORTAL_INSTANCE_ID`. Wrong/missing mode, marker, instance ID, database, secret or owner-ID configuration fails closed with 503. Public configuration names are `PORTAL_ORIGIN`, `PORTAL_ENVIRONMENT`, `PORTAL_INSTANCE_ID`, `PORTAL_ADMIN_ID`, `TURNSTILE_SITE_KEY`; secrets are `TURNSTILE_SECRET_KEY`, `PORTAL_MFA_KEY` and `PORTAL_RATE_KEY`. Production origin is exactly `https://managelove.com`.

`lib/portal/auth.ts` exports `authenticate(cookieHeader: string | null): Promise<PortalSession | null>`, `requirePortalAdmin(session: PortalSession | null, freshMfa: boolean): Promise<PortalSession>`, `hashToken(raw: string): Promise<string>`, and `revokeAccountSessions(accountId: string): Promise<void>`.

`lib/portal/password.ts` exports `hashPassword(password: string): PasswordRecord` and `verifyPassword(password: string, record: PasswordRecord): boolean`, callable only inside `PortalCompute`. The Worker calls its binding's `hashPassword`, `verifyPassword`, and `sanitizePhoto` RPC methods; there is no public compute route.

`lib/portal/turnstile.ts` exports `verifyTurnstile(token: string, action: 'login' | 'activate' | 'mfa', request: Request): Promise<boolean>`.

`lib/portal/photos.ts` exports `putPhoto(profileId: string, slot: number, photo: SafePhoto): Promise<string>`, `readPhoto(key: string): Promise<{bytes: ArrayBuffer; mime: string} | null>`, and `deletePhotoKeys(keys: string[]): Promise<void>`.

`lib/security.ts` keeps `verified(owner)` as actual mobile verification and adds `canUseMemberFeatures(owner: string): Promise<boolean>`. Test authorization is a separate result, only for an active marked account in the marked test environment. Never change `verified()` to treat test accounts as OTP-verified.

## Task 1: Establish isolated schema and a real-runtime test harness

**Files:** Create `drizzle/0005_portal_accounts.sql`, `tests/helpers/portal.mjs`, `tests/portal-storage.mjs`; modify `db/schema.ts`, `drizzle/meta/*`, `cloudflare-env.d.ts`, `vite.config.ts`.

**Consumes:** Existing migrations 0000–0004 and the existing Miniflare loading pattern. **Produces:** The account/session schema and `createPortalFixture()` described below.

- [ ] Write storage tests before changing schema. Apply all migrations to isolated Miniflare D1, then execute these assertions:

```js
assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM portal_accounts').first()).n, 0);
await db.prepare("INSERT INTO portal_environment(id,kind,instance_id) VALUES(1,'test','local-test-instance')").run();
await assert.rejects(db.prepare("INSERT INTO portal_environment(id,kind,instance_id) VALUES(2,'real','another-instance')").run());
```

- [ ] Run `node --test tests/portal-storage.mjs`; confirm failure because the new tables do not exist.
- [ ] Add schema and generated Drizzle metadata with these exact columns and constraints:

```sql
CREATE TABLE portal_environment (
  id INTEGER PRIMARY KEY CHECK(id=1), kind TEXT NOT NULL CHECK(kind='test'),
  instance_id TEXT NOT NULL
);
CREATE TABLE portal_accounts (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','member')),
  is_test INTEGER NOT NULL CHECK(is_test IN (0,1)),
  status TEXT NOT NULL CHECK(status IN ('invited','active','disabled')),
  password_record TEXT, session_version INTEGER NOT NULL DEFAULT 0,
  mfa_ciphertext TEXT, mfa_pending_ciphertext TEXT,
  mfa_pending_expires_at INTEGER, mfa_last_step INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX portal_one_admin ON portal_accounts(role) WHERE role='admin';
CREATE TABLE portal_activations (
  token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES portal_accounts(id),
  expires_at INTEGER NOT NULL, consumed_at INTEGER, created_at INTEGER NOT NULL
);
CREATE INDEX portal_activations_account ON portal_activations(account_id);
CREATE TABLE portal_sessions (
  token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES portal_accounts(id),
  account_version INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL, mfa_verified_at INTEGER,
  purpose TEXT NOT NULL CHECK(purpose IN ('member','admin','mfa'))
);
CREATE INDEX portal_sessions_account ON portal_sessions(account_id);
CREATE TABLE portal_rate_limits (
  key TEXT NOT NULL, window INTEGER NOT NULL, attempts INTEGER NOT NULL,
  PRIMARY KEY(key,window)
);
CREATE TABLE portal_recovery_codes (
  code_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES portal_accounts(id),
  consumed_at INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE portal_photo_blobs (
  key TEXT PRIMARY KEY, bytes BLOB NOT NULL CHECK(length(bytes)<=262144),
  mime TEXT NOT NULL CHECK(mime IN ('image/jpeg','image/png','image/webp')),
  created_at INTEGER NOT NULL
);
CREATE TRIGGER portal_photo_storage_cap BEFORE INSERT ON portal_photo_blobs
WHEN (SELECT COALESCE(SUM(length(bytes)),0) FROM portal_photo_blobs)+length(NEW.bytes)>8388608
BEGIN SELECT RAISE(ABORT,'PORTAL_PHOTO_STORAGE_FULL'); END;
```

- [ ] Make `createPortalFixture({seed=true}={})` load built ES/WASM modules, isolated D1, SQLite `PortalCompute`, and mock outbound Turnstile verification. Return `{db, mf, compute, call, activate, login, mfa, dispose}`; `compute` is the private binding stub. The default seed creates seven synthetic invited accounts with fixture activation hashes; storage-schema tests pass `seed:false` so their database is empty. `call(path, {method='GET', body, cookie, origin='https://portal.test', ip='192.0.2.1', headers={}})` returns `{status, data, cookie}`; `activate(username)`, `login(username)`, `mfa(cookie)` return valid fixture session cookies. Use entirely synthetic passwords and deterministic local-only TOTP secrets. Mocking belongs only in the test outbound service, never a production authentication bypass flag.
- [ ] Add a query counter in the harness to record D1 calls per invocation and a second deliberately non-test database fixture. Make helpers dispose workers in `finally`.
- [ ] Run storage tests and the existing managed/standalone checks after a fresh build. Commit only this task's files as `feat: add isolated portal account schema and test harness`.

## Task 2: Prove secure password hashing fits Free infrastructure

**Files:** Create `lib/portal/password.ts`, `build/portal-compute.ts`, `tests/portal-password.mjs`; modify `build/sites-worker.ts`, `vite.config.ts`, `cloudflare-env.d.ts`, `wrangler.managelove.jsonc` only after the local tests pass.

**Consumes:** `PasswordRecord`. **Produces:** `PortalCompute.hashPassword(password)`, `PortalCompute.verifyPassword(password, record)` and the private binding.

- [ ] Write a test for independent salts, correct verification, wrong-password rejection, malformed/tampered record rejection, Unicode passwords and bounded input. Hash/verify through a real workerd Durable Object, not only Node.

```js
const one = await compute.hashPassword('a sufficiently long synthetic password');
const two = await compute.hashPassword('a sufficiently long synthetic password');
assert.notEqual(one.salt, two.salt);
assert.equal(await compute.verifyPassword('wrong synthetic password', one), false);
assert.equal(await compute.verifyPassword('a sufficiently long synthetic password', one), true);
assert.deepEqual([one.N, one.r, one.p], [16384, 8, 5]);
```

- [ ] Run `node --test tests/portal-password.mjs`; confirm missing compute methods fail.
- [ ] Implement the KDF using native `node:crypto` in the Durable Object:

```ts
import {randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
const cost = {N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024};
const salt = randomBytes(16);
const digest = scryptSync(password, salt, 32, cost);
```

Require at least 15 Unicode characters and at most 256 UTF-8 bytes, preserve the actual password without trimming, and allow paste/password managers. Serialize the fixed parameters, 16-byte random salt and 32-byte digest; verify exact lengths and allowed parameters before constant-time comparison. Compute a fixed valid dummy hash for unknown-account login timing. No SHA-only password hash and no weaker KDF parameters to meet the request budget.

- [ ] Export `PortalCompute` from the deployed Worker entrypoint and configure a SQLite `new_sqlite_classes` migration. Test that vinext/Vite preserves the named export and RPC binding; inspect the built entrypoint. Serialize compute calls per object to bound memory, with a fixed small shard set, and rate-limit before KDF invocation.
- [ ] After approval of execution, benchmark hash/verify on the actual Free account using only synthetic credentials and a protected operator benchmark flow. Remove that flow before the release. Record actual runtime, CPU/resource-limit errors and memory behavior; proceed only when the native KDF succeeds consistently. A local pass is not the production-runtime proof.
- [ ] Run the task tests, typecheck, build and Wrangler dry run. Commit `feat: add private Free-tier password compute`.

Design basis: native crypto is supported with documented exceptions, and native Argon2 is unavailable. The selected scrypt memory/cost profile follows the [OWASP password-storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Verify the runtime with [Cloudflare crypto](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/), [Durable Object limits](https://developers.cloudflare.com/durable-objects/platform/limits/) and [Free pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/). Do not use a local-only PBKDF2 benchmark to assume production accepts its work factor.

## Task 3: Add sessions, activation, Turnstile and throttled login

**Files:** Create `lib/portal/config.ts`, `lib/portal/types.ts`, `lib/portal/auth.ts`, `lib/portal/turnstile.ts`, `app/api/auth/login/route.ts`, `app/api/auth/activate/route.ts`, `app/api/auth/logout/route.ts`, `app/api/auth/session/route.ts`, `tests/portal-auth.mjs`; modify `app/chatgpt-auth.ts`, `lib/store.ts`, `build/sites-worker.ts`.

**Consumes:** Tasks 1–2. **Produces:** Authenticated sessions, single-use activation and safe existing-route identity.

- [ ] Add auth integration tests using real session cookies and the harness's fake outbound verifier:

```js
const activated = await portal.activate('ananya.test');
assert.match(activated, /__Host-managelove_session=/);
const r = await portal.call('/api/state', {headers: {
  'oai-authenticated-user-id': 'owner', 'oai-authenticated-user-email': 'admin@example.com'
}});
assert.equal(r.data.isAdmin, false);
assert.equal((await portal.call('/api/auth/login', {method:'POST', body:{username:'ananya.test',password:'wrong',turnstileToken:'rejected'}})).status, 403);
```

- [ ] Run `node --test tests/portal-auth.mjs`; verify new endpoints fail before implementing them.
- [ ] Implement these route contracts with bounded JSON bodies (8 KiB), explicit JSON media type and generic account-denial messages:

| Endpoint | Input | Successful result |
| --- | --- | --- |
| POST `/api/auth/activate` | `{token,password,turnstileToken}` | Conditional single-use consume plus password install in one D1 batch; rotated member or MFA-only cookie |
| POST `/api/auth/login` | `{username,password,turnstileToken}` | New random member cookie or limited MFA-only admin cookie |
| POST `/api/auth/logout` | no account ID input | Delete current session hash and expire cookie; harmless repeated logout |
| GET `/api/auth/session` | cookie only | Safe username/displayName/role/test/MFA status; no credential fields |

Generate 32-byte random activation/session tokens; SHA-256 hashes are appropriate for these high-entropy tokens. Activation lifetime is 24 hours; a reissued link invalidates all earlier invitations. Accept activation tokens in URL fragments so they do not enter HTTP request logs/referrers; POST from the activation form and remove the fragment immediately. Cookie name `__Host-managelove_session`, Path=/, Secure, HttpOnly, SameSite=Lax, no Domain. Members expire after 12 hours, administrators after 4 hours, pending MFA after 5 minutes; reject idle sessions after 30 minutes. Update last-seen no more than once per five minutes. Password/reset/disable increments account session_version and revokes sessions.

- [ ] Before hashing, atomically increment hashed-IP and normalized-username 15-minute counters using `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING attempts`. Limit to 20/IP and 5/username; return 429 with Retry-After when exhausted. Use HMAC of source IP with a Worker secret; do not persist raw IP addresses. Apply equivalent throttles to activation and MFA, with no permanent account lockout. Prune expired counters/sessions/invitations in bounded batches.
- [ ] Require matching Origin for every portal mutation, deny cross-site Fetch Metadata, and verify the configured canonical origin rather than client Host alone. Canonicalize apex HTTP/www to HTTPS apex. Unsupported production hosts return 404 or redirect to the apex; authenticated app responses are private/no-store.
- [ ] Strip all externally supplied `oai-authenticated-user-*` headers in every standalone mode before rendering/API handling. In portal mode, `getChatGPTUser()` derives identity only from `authenticate(headers.get('cookie'))` and rejects sessions with purpose=mfa; those sessions can access only the restricted authentication/enrollment endpoints. It does not fall back to managed headers on a missing cookie. Managed behavior remains available only in managed hosting mode.
- [ ] Verify Turnstile server-side at Cloudflare Siteverify, with 5-second timeout, expected hostname `managelove.com`, exact action and successful result. Require a fresh token for login, activation and MFA. Network/provider failure denies the operation. Production rejects documented Turnstile test sitekeys/secrets. Do not log challenge tokens or passwords. Reserve local test keys for the test verifier only.
- [ ] Run token replay/concurrent-consume, expiry, logout, missing-origin, foreign-origin, fake-role/header, account-enumeration response, unsupported-host and rate-limit tests. Commit `feat: add standalone activation and authenticated sessions`.

## Task 4: Require administrator MFA and provide secure recovery

**Files:** Create `lib/portal/mfa.ts`, `app/api/auth/mfa/route.ts`, `app/account/security/page.tsx`, `app/account/security/mfa-form.tsx`, `scripts/portal-recover.mjs`, `tests/portal-admin.mjs`; modify `lib/admin.ts`, `app/admin/page.tsx`, `DEPLOYMENT-NOTES.md`.

**Consumes:** Portal sessions and a separate Worker AES-256-GCM secret key `PORTAL_MFA_KEY`. **Produces:** Verified MFA sessions, owner-only administration and a recovery runbook.

- [ ] Write deny-by-default tests:

```js
const member = await portal.activate('ananya.test');
assert.equal((await portal.call('/api/admin/profiles', {cookie:member})).status, 403);
const pending = await portal.login('drdixitrajesh');
assert.equal((await portal.call('/api/admin/profiles', {cookie:pending,method:'DELETE',body:{}})).status, 403);
const admin = await portal.mfa(pending);
assert.equal((await portal.call('/api/admin/profiles', {cookie:admin})).status, 200);
```

- [ ] Run `node --test tests/portal-admin.mjs` and confirm failure before implementing the MFA gate.
- [ ] Implement standard six-digit TOTP, 30-second steps, a ±1-step clock window, random 20-byte secret and issuer `ManageLove`. Encrypt enrollment/active secrets with AES-GCM and unique 12-byte IVs; bind account ID as authenticated data. Enrollment expires after 5 minutes and the secret is promoted only after valid proof. Check against independent RFC TOTP test vectors, not implementation-generated expectations.
- [ ] Atomically reject reusing a previously accepted TOTP step; check all matching steps before updating the last accepted step. Rotate the restricted pending cookie into a normal administrator session after successful MFA. Admin writes require MFA within the last 30 minutes, otherwise request step-up; member routes cannot upgrade roles. Verify `account.id===PORTAL_ADMIN_ID`, role=admin, active status and session version for every admin access.
- [ ] Generate eight high-entropy one-time recovery codes; store only hashes and display once to the human owner. Recovery codes require the password as well. Conditional consume prevents concurrent reuse. No user-facing endpoint can clear admin MFA or select a different account role.
- [ ] Document owner-operator recovery: authenticated Cloudflare owner performs an explicit account-ID-targeted recovery command, revokes all sessions/invitations, records an audit, and creates a new private activation link. MFA reset is a separate explicit operator action; never automatically disable it during password reset. No anonymous recovery by username/email alone.
- [ ] Run admin-ID spoofing, role spoofing, stale MFA, stale session-version, encryption tampering, expired enrollment, TOTP replay, recovery-code replay and blocked-member tests. Commit `feat: enforce administrator MFA and recovery`.

## Task 5: Seed editable fictional accounts without faking OTP verification

**Files:** Create `scripts/portal-bootstrap.mjs`, `tests/portal-members.mjs`; modify `lib/matrimony.ts`, `lib/store.ts`, `lib/security.ts`, `app/api/state/route.ts`, `app/api/profile/route.ts`, `app/api/actions/route.ts`, `app/api/messages/route.ts`, `app/api/safety/route.ts`.

**Consumes:** Active sessions, test-database marker and existing profile validation. **Produces:** Six stored member profiles and working protected member workflows.

- [ ] Write these regressions before implementing test permissions:

```js
const ananya = await portal.activate('ananya.test');
const state = await portal.call('/api/state', {cookie:ananya});
assert.equal(state.data.own.test, true);
assert.equal(state.data.security.verified, false);
assert.equal(state.data.security.testAccess, true);
assert.equal(new Set(state.data.profiles.map(p=>p.id)).size, state.data.profiles.length);
assert.equal((await portal.call('/api/profile', {cookie:ananya,method:'POST',body:{...state.data.own,name:'Changed Identity'}})).status, 409);
```

- [ ] Run `node --test tests/portal-members.mjs` and confirm failure.
- [ ] Implement an idempotent operator bootstrap that first validates the named database is isolated and empty of real members, creates one environment marker and seven random immutable account IDs, and writes six profiles with matching identity locks and publication/expiry timestamps. Usernames map in order to the existing six fixtures. Use clearly fictional reference names and non-routable synthetic contact values; do not invent real Aadhaar identifiers or claim real consent. The profile editor must not require a government ID for these test identities.
- [ ] Bootstrap refuses to overwrite active account passwords or silently restore deleted/edited profiles. Invitation reissue is an explicit operation. Emit invitations only to an ignored, mode-0600 handoff file under `outputs/portal-access/`; print the file location and usernames, never links or secrets. The administrator ID is non-secret deployment configuration, fixed after bootstrap.
- [ ] Add `Profile.test?: boolean`; stored test profiles use `demo:false,test:true`, retaining an optional fixture portrait index for the clearly labelled fictional image. In portal mode, lookup/listing uses D1 and never appends static fixtures. Anonymous public listing selects only public test-profile fields; excludes contact email, private references, DOB, identity suffix, photos and account/session data.
- [ ] Add `canUseMemberFeatures` with both marked environment and active marked member account checks. Apply it consistently to profile, photos, interests, messages and safety routes; do not authorize targets based on a `demo-` ID prefix. Real-mode requests continue to require actual OTP. Portal member access never invokes Twilio or creates `otp_accounts` rows.
- [ ] Preserve immutable name/DOB/profile ID and allow edits to other validated fields, optional email, two clearly marked test references and photo slots. Member authorization comes from the session account, not a body owner/id. Editing does not renew publication expiry. Administrator's account is separate and does not become a matrimonial member implicitly.
- [ ] Test all six logins, persistent mutable edits, identity locks, incorrect owner IDs, a non-test account and wrong database marker, no OTP rows, no duplicate fixtures, and private-field filtering. Commit `feat: enable isolated fictional member workflows`.

## Task 6: Make the feed and messaging safe within Free request limits

**Files:** Create `tests/portal-workflows.mjs`; modify `app/api/state/route.ts`, `lib/security.ts`, `app/api/actions/route.ts`, `app/api/messages/route.ts`, `app/api/safety/route.ts` and indexes in the new migration if needed.

**Consumes:** Six stored profiles and session-derived ownership. **Produces:** Persistent feed, saved profiles, reciprocal interests/messages and bounded request costs.

- [ ] Write an end-to-end test that sends an interest as Ananya, rejects sender acceptance, accepts as Aarav, sends both directions, rejects an unrelated member, then tests blocking and ended conversations. Assert returned `mine` attribution and that message reads cannot access private account data.

```js
const a = await portal.activate('ananya.test');
const b = await portal.activate('aarav.test');
const ownB = (await portal.call('/api/state',{cookie:b})).data.own;
assert.equal((await portal.call('/api/actions',{cookie:a,method:'POST',body:{kind:'interest',target:ownB.id,message:'Fictional test introduction'}})).status,200);
const interest = (await portal.call('/api/state',{cookie:b})).data.received[0];
assert.equal((await portal.call('/api/actions',{cookie:a,method:'PATCH',body:{id:interest.id,status:'accepted'}})).status,404);
assert.equal((await portal.call('/api/actions',{cookie:b,method:'PATCH',body:{id:interest.id,status:'accepted'}})).status,200);
assert.equal((await portal.call('/api/messages',{cookie:a,method:'POST',body:{thread:interest.id,body:'Test message'}})).status,200);
```

- [ ] Run `node --test tests/portal-workflows.mjs` and confirm the blocked/unimplemented path fails.
- [ ] Replace per-profile blocked/verified/reservation queries with SQL joins and a bounded atomic daily-view allocation. Keep existing daily views stable, exclude self, allocate at most `20-count(existing)` new eligible IDs, then read only that day's IDs. Include reciprocal blocks in allocation. Fetch photos and genuine phone-verification status in batches/joins. Target no more than 20 D1 statements per full request, including authentication and expiry, safely below the Free limit of 50. Verify statement count with 20 profiles, rather than only the initial six.
- [ ] Enforce accepted-interest membership and both-direction blocks on reads and atomic writes. Retain the existing 20-interest anti-spam rule; keep message length 1–2000 characters, cursor pagination and ownership. Add a database-backed per-account cap of 100 messages per India-time day and a visible 429 response. Include the cap in test-portal copy; it is a Free-resource/abuse limit, not a paid contact gate.
- [ ] Store test labels on conversations by deriving them from the marked participants. Refuse any target account/profile outside the test environment. Add synthetic >20-profile fixtures only in isolated tests; no additional public accounts in bootstrap.
- [ ] Test India-day rollover, same-day rereads, concurrent allocation, >20 profiles, private photo allowance, saved/conversation counterparts, throttled message writes, block/unblock and cursor boundaries. Commit `fix: bound portal workflows for Cloudflare Free limits`.

## Task 7: Store sanitized private photos in D1

**Files:** Create `lib/portal/photo-sanitize.ts`, `lib/portal/photos.ts`, `tests/portal-photos.mjs`, byte fixtures under `tests/fixtures/photos/`; modify `build/portal-compute.ts`, `app/api/photo/route.ts`, `app/api/photo/[key]/route.ts`, package manifest/lockfile if codecs are needed.

**Consumes:** Authenticated active test member, `SafePhoto`, fixed storage limits. **Produces:** Metadata-free valid bounded images and permission-checked serving.

- [ ] Add tests using real valid JPEG, PNG and WebP fixtures with metadata, plus truncated images, spoofed MIME, oversized payloads, animated images and extreme decoded dimensions:

```js
const clean = await compute.sanitizePhoto(metadataFixture, 'image/jpeg');
assert.ok(clean.bytes.byteLength <= 262144);
assert.equal(Buffer.from(clean.bytes).includes(Buffer.from('Exif\0\0')), false);
assert.equal((await portal.call('/api/photo/'+privateKey)).status,401);
assert.equal((await portal.call('/api/photo/'+privateKey,{cookie:unrelatedWithoutView})).status,403);
```

- [ ] Run `node --test tests/portal-photos.mjs`; confirm absent sanitizer/storage fails.
- [ ] At execution time, install exact reviewed versions `@jsquash/jpeg@1.6.0`, `@jsquash/png@3.1.1`, `@jsquash/webp@1.5.0` with pnpm 11.25.0 and commit the resulting lockfile. These versions were read from the npm registry during planning; no dependencies were installed by this planning change. Implement a strict byte parser and actual decode/re-encode in the private compute object. Maximum source and encoded output 262144 bytes, maximum width/height 2048, maximum pixel count 4194304, one frame only. Sniff bytes, reject malformed headers/chunks and MIME mismatch, decode successfully and re-encode without EXIF/XMP/comments/private ancillary chunks. Preserve displayed orientation while stripping metadata. Do not trust filename/MIME/signature alone, proxy uploads through a paid image service, or merely delete an EXIF marker and call the file sanitized. Package required WASM modules as static imports, following the codec project's Cloudflare ESM example, and verify the built worker supports them within script-size/memory limits.

```ts
// After initializing the statically imported codec modules inside PortalCompute:
const decoded = await selectedCodec.decode(source);
if (decoded.width > 2048 || decoded.height > 2048 || decoded.width * decoded.height > 4194304) {
  throw new Error('PHOTO_DIMENSIONS_EXCEEDED');
}
const output = await selectedCodec.encode(decoded);
if (output.byteLength > 262144) throw new Error('PHOTO_SIZE_EXCEEDED');
```

`selectedCodec` is selected only from the three fixed JPEG/PNG/WebP adapters after pre-decoding bounded header checks, never from a user-supplied module/URL. The adapters initialize the corresponding statically imported decoder/encoder WASM module and expose `decode(source:ArrayBuffer)` and `encode(image:{data:Uint8ClampedArray;width:number;height:number})`. The codec authors document [Cloudflare Worker packaging](https://github.com/jamsinclair/jSquash#usage-in-cloudflare-workers); confirm that this particular Vite build retains every module and initialize one codec at a time to bound peak memory.
- [ ] If a codec cannot decode safely in the deployed Free runtime, reject that input with a clear format-specific error; do not release claiming all three formats work until all three pass live. Benchmark this task's maximum-sized inputs using the protected operator proof flow, then remove that flow.
- [ ] Insert sanitized bytes and `profile_photos` metadata atomically; replace only the authenticated owner's slot 0–4, return the new random key and remove superseded bytes. The SQL cap trigger protects concurrent inserts; report `PORTAL_PHOTO_STORAGE_FULL` as a visible storage-cap response. Include an update trigger if updates can grow an existing blob. Prefer insert-new/delete-old semantics to bypassing cap checks on updates.
- [ ] Photo GET first proves current profile existence, active authorized viewer, reciprocal blocks and daily-view allocation or ownership. Return exact image MIME, `X-Content-Type-Options:nosniff`, `Cache-Control:private,no-store` and no public direct-storage URL. Deleted/expired profiles never grant access to leftover bytes. No anonymous uploaded photo serving.
- [ ] Test all five slots, sixth-slot rejection, body limits even without Content-Length, private-byte denial, metadata absence, dimension limits, total cap race, replacement and owner isolation. Commit `feat: add bounded private D1 test photos`.

## Task 8: Complete owner/admin deletion, expiry and test-account reset

**Files:** Create `app/api/admin/accounts/route.ts`, `app/admin/accounts.tsx`, `tests/portal-lifecycle.mjs`; modify `lib/profile-deletion.ts`, `lib/profile-expiry.ts`, `build/sites-worker.ts`, `app/api/admin/profiles/route.ts`, `app/admin/profiles.tsx`, `wrangler.managelove.jsonc`.

**Consumes:** MFA-verified owner and existing identity/deletion semantics. **Produces:** Audited moderation, access reset and durable D1 cleanup.

- [ ] Write deletion/expiry tests with an image and an accepted conversation. Assert profile, refs, messages, interests, saved rows and photo bytes disappear while permanent anti-abuse identity remains; verify admin audit and confirm ordinary members cannot delete another profile.

```js
const before = await portal.db.prepare('SELECT COUNT(*) AS n FROM portal_photo_blobs').first();
assert.equal(before.n, 1);
assert.equal((await portal.call('/api/profile',{cookie:ownerCookie,method:'DELETE'})).status,200);
assert.equal((await portal.db.prepare('SELECT COUNT(*) AS n FROM portal_photo_blobs').first()).n,0);
assert.ok(await portal.db.prepare('SELECT owner FROM identity_locks WHERE owner=?').bind(ownerId).first());
```

- [ ] Run `node --test tests/portal-lifecycle.mjs` and confirm missing D1 cleanup fails.
- [ ] Replace the hard R2 dependency with a minimal `delete(keys:string[]):Promise<void>` photo-cleanup interface: managed mode uses R2; portal mode deletes D1 blobs. Expiry runs before reads and in a scheduled bounded sweep if a Free cron slot is available. Filter expired rows out of queries even when an earlier sweep was interrupted. Keep the existing India-calendar six-month clamping function.
- [ ] Expose administrator test-account status and POST reissue activation with a reason and fresh MFA. Reissue revokes all sessions and old invitations. Targets must be marked member accounts; the admin route cannot reset the owner, clear MFA, change roles, create real users, or affect another environment. Return the new private link once with no-store; never log it.
- [ ] Admin profile deletion still requires exact name confirmation and a reason; user interface explains the cascade. Preserve blocked identity on recreation and do not repopulate deleted fixtures automatically. Access reset and profile republish are distinct actions.
- [ ] Test name confirmation, audits, non-owner denial, fresh-MFA requirement, reset/session revocation, deletion/recreation identity, retry cleanup, expiry with no R2 binding, month-end dates and expired photo/message denial. Commit `feat: finish test portal lifecycle and account administration`.

## Task 9: Deliver professional Hindi/English account and admin surfaces

**Files:** Create `app/login/page.tsx`, `app/login/login-form.tsx`, `app/activate/page.tsx`, `app/activate/activation-form.tsx`, `app/account/page.tsx`, `app/auth/turnstile-widget.tsx`; modify `app/page.tsx`, `app/milan.tsx`, `app/profile-security.tsx`, `app/admin/page.tsx`, `app/admin/profiles.tsx`, `app/globals.css`, `app/terms/page.tsx`, `PRODUCT.md`, `DESIGN.md` only where the new patterns need documentation.

**Consumes:** Auth/session/MFA/member endpoints. **Produces:** Login/logout, activation, account status, editable profiles, messages and owner operations usable on mobile and desktop.

- [ ] Run Impeccable context for the new account routes at execution time, read its new-work/craft-floor references, and preserve the existing family-album palette/typography. Add route rendering/accessibility assertions that fail until the new forms exist:

```js
assert.match(await render('/login'), /autocomplete="username"/);
assert.match(await render('/login'), /autocomplete="current-password"/);
assert.match(await render('/activate'), /autocomplete="new-password"/);
assert.doesNotMatch(await render('/account', memberCookie), /admin recovery codes/i);
```

- [ ] Implement labelled username/password fields, show/hide password, Enter submission, loading/error/retry states, expired-invitation state, Turnstile expiry/reset, safe relative return destinations, clear logout and account navigation. Do not put passwords or activation values into persistent client storage. Admin secret/password/recovery entry in the browser is a human handoff.
- [ ] Replace the demo member-services notice only when portal mode really authenticates. Signed-out viewers get an honest invitation-only login link; no fake public registration button. Signed-in test users get “परीक्षण खाता / Fictional test account”, their own profile actions and working interests/messages. The real mobile-OTP panel is not shown as a prerequisite for marked test users, and its verified badge remains false.
- [ ] Put “पूर्णतः निःशुल्क — कोई छिपा शुल्क नहीं” in the primary service notice. Keep the exact requested headline and संयोजक contacts. Explain fictional test references/photos/conversations without presenting technical implementation details in the user flow. Show current Free-resource limits on the relevant upload/send error.
- [ ] Fix lint issues in touched existing components and use proper internal navigation. Add request-generated nonce CSP through vinext's supported nonce header path; cover framework scripts/styles, Turnstile and existing fonts/assets, object-src none, base-uri self, frame-ancestors none, form-action self. Add Referrer-Policy no-referrer, nosniff, Strict-Transport-Security max-age=31536000 without a preload/subdomain expansion, suitable Permissions-Policy and HTTPS-only cookies. Test CSP in a real browser before enforcement; do not break hydration/Turnstile or claim strict CSP from a report-only header.
- [ ] Run one desktop/mobile QA batch at 1280×900 and 390×844: activation, keyboard login, MFA, edit/save/reload, photo selection/removal, interest/accept/reply, own deletion, admin confirmation and reset-link copy. Fix the batch findings and run one confirmation round. Capture sanitized screenshots with no secrets.
- [ ] Run focused lint, typecheck, build and portal tests. Commit `feat: deliver member and administrator portal screens`.

## Task 10: Verify security and deploy the tested portal

**Files:** Create `scripts/verify-portal.mjs`, `docs/operations/managelove-accounts.md`; modify `wrangler.managelove.jsonc`, `DEPLOYMENT-NOTES.md`; create ignored sanitized receipts under `outputs/portal-release/` and a private activation handoff under `outputs/portal-access/`.

**Consumes:** Passing Tasks 1–9, approved deployment authority and human owner activation. **Produces:** Live tested portal and secure account handoff.

- [ ] Run `npm run build`, `node node_modules/typescript/bin/tsc --noEmit`, `node tests/integration.mjs`, `node tests/standalone.mjs`, `node --test tests/portal-*.mjs`, meaningful pure-data tests and lint. Fix security/behavior regressions, and record any unrelated remaining baseline lint errors accurately. Run the explicitly requested standard security scan on the implemented auth/member/admin/storage paths and assess findings against reachable runtime paths. Fix release-blocking findings before cutting over.
- [ ] In the authenticated Cloudflare account, verify the Free subscription and capacity, create `managelove-test` D1 and a Free Turnstile widget restricted to `managelove.com`, and add a SQLite compute namespace. Do not enable R2 or click Upgrade. If a new permission grant/browser security-sensitive action needs action-time confirmation, show the exact grant and ask only there. Existing Worker deployment access does not automatically imply D1/Turnstile API scope.
- [ ] Apply migrations to the new database, verify its marker and schema, bootstrap exactly seven invited accounts and six fictional profiles, and record the immutable owner ID. Store MFA encryption/throttle/Turnstile secrets through Cloudflare secrets or the authorized secret manager; never in Git or build output. Commit only non-secret resource IDs/configuration.
- [ ] Dry-run the actual built Worker and verify the named Durable Object export, SQLite migration, D1 binding, static assets, production origin, owner ID and portal environment. Use `workers_dev:false` for the authenticated release and preserve existing apex/www routes and fail-closed request-limit behavior. Make a rollback receipt of current routes, version and config before deployment.
- [ ] Associate the source commit with the new deployed version. Deploy only after all checks and real-runtime KDF/image proof succeed. On a release failure, roll back to the previous Worker version without deleting the new database or its evidence. Do not call pending DNS/deploy/CI steps completed.
- [ ] Test the live domain through actual browser sessions. A human sets the owner's password and MFA; do not enter or change their browser credentials on their behalf. Exercise admin login/writes only after MFA. Use synthetic member credentials privately for authorized E2E tests, verify all six accounts, and prove persistent edit/reload and reversible Ananya/Aarav interest/message exchange. Confirm account isolation, denied anonymous/admin endpoints, active Turnstile server verification, no public private photos, logout/replay denial and redirects. Include API smoke checks once the shell-access issue is understood.
- [ ] After live test credentials have served their purpose, revoke test sessions, remove temporary password material and issue fresh single-use member activation links. Hand the owner a mode-0600 private file with usernames, navigation links and activation expiries. If the owner already activated their account, do not silently reset it. Provide eight private MFA recovery codes only to the owner during enrollment. No shared passwords or email/SMS delivery to others.
- [ ] Finish the operations doc with operator recovery, test-account reset, quota-exhaustion behavior, backup/restore checks using Free D1 capabilities and release rollback. State separately: source checks, live deployed commit/version, owner activation/MFA, six member access, production-domain test workflows, auto-deploy status and real-member registration status.
- [ ] Commit the non-secret receipt/docs as `docs: record verified portal release and account operations`; execute the companion automatic-deployment plan and verify its first triggered deployment before claiming automatic publishing is enabled.

## Owner review and execution selection

This plan implements the supplied first-release spec. It does not invent existing credentials or claim that a test portal is a completed real-member public service. The new technical choice is a private Free SQLite Durable Object for strong password hashing and image processing, with real-runtime proof before release.

Execution choices: **inline in this chat** with explicit verification checkpoints (recommended for this repository's single release), or **delegated task-by-task** with separate implementation/review agents. Either choice preserves the same tests, Free-only constraint and release criteria. A simple “plan approved, inline” or “plan approved, delegated” completes the attached Brainstorming skill's remaining prerequisite.

## Self-review and coverage

Authentication/sessions/invitations: Tasks 1–3. Owner role/MFA/recovery: Task 4. Seven accounts/six stored profiles and real-OTP separation: Task 5. Privacy, consented edits/references, quota, messaging and blocks: Tasks 5–6. All photo formats/caps/metadata/private serving: Task 7. Owner/admin deletion, audit, expiry and access reset: Task 8. Requested copy/professional UX/CSP: Task 9. Security scan, Free provisioning, live proof and secure handoff: Task 10. Push-triggered deployment and Dr. Rajesh's Work-mode prompt: companion plan `2026-10-08-managelove-automatic-deployment.md`.
