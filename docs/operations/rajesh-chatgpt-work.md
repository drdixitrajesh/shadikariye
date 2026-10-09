# Dr. Rajesh: updating ManageLove through ChatGPT Work

Repository: [drdixitrajesh/shadikariye](https://github.com/drdixitrajesh/shadikariye). Website: [managelove.com](https://managelove.com).

## Native automatic deployment configured on 2026-10-09

Cloudflare Workers Builds is connected to this private GitHub repository. A push to `main` triggers the production build for the existing `managelove` Worker. Preview builds are disabled. The build uses Node `25.2.1`, pnpm `11.25.0`, build command `npm run verify:cloudflare`, deploy command `npm run deploy:cloudflare`, and root `/`.

The dedicated build token is stored securely in Cloudflare Builds. A normal website update does not require Cloudflare OAuth or an API token in the ChatGPT Work shell: implement and test the change, commit it, and push reviewed `main`. Changes left in a local checkout or pushed only to another branch do not update production. Watch the Cloudflare build result and compare `https://managelove.com/api/health` with the pushed Git SHA before reporting the change live.

Cloudflare production settings: [ManageLove Builds](https://dash.cloudflare.com/0806706663c74737529a2e2f9de75440/workers/services/view/managelove/production/settings#builds). Production trigger UUID: `4635a085-6aa9-4c4e-8d3a-0c92a27ac454`. Repository connection UUID: `65b20b0d-c7cd-4f14-9eec-e3d8162d12ce`. These IDs are metadata, not credentials.

## Credentials and operations

The private repository now has an encrypted `CLOUDFLARE_API_TOKEN` Actions secret. It is a dedicated token scoped to the Softinator GJ account and the managelove.com zone, with Workers Scripts, D1, Turnstile, Workers Builds, account-read and billing-read permissions. It cannot change billing, manage API tokens, or edit DNS. Cloudflare scopes Workers/D1 permissions at account level, so this token must stay in Secrets and workflows must target only ManageLove. Do not try to read its value into a Work conversation or commit it into source.

The Actions token is available **inside an enabled GitHub Actions job**, not automatically inside a ChatGPT Work shell. Native Builds uses its separately stored build token. Never extract either token into a conversation. An unauthenticated local Wrangler does not prevent writing and testing portal code or deploying through a push to `main`.

`npm run verify:cloudflare` builds, typechecks, and runs the managed and standalone integration checks. `npm run deploy:cloudflare` applies configured D1 migrations, deploys `wrangler.managelove.jsonc`, records the Git commit, and checks `/api/health`. It refuses paid Workers plans and usage-billed R2/Containers/AI bindings. It never creates or resets login accounts on an ordinary deploy.

The `ManageLove Cloudflare` workflow can deploy, inspect access, or provision the dedicated `managelove-test-portal` D1 database. It runs only reviewed `main`. Repository Secrets are supplied only to the operation step, not dependency installation or tests. Review the actual run and live health before reporting a successful deployment.

**Free-only gate:** use the configured native Cloudflare Workers Builds on Workers Free. It has a hard monthly Free build quota; exhaustion must fail without an upgrade. The repository is private, so GitHub-hosted Actions may bill after its included minutes. The fallback workflow remains gated until the owner verifies a $0 Actions budget with stop-usage enabled and sets `MANAGELOVE_FREE_CI_ENABLED=true`, or confirms that budget when dispatching a run. Do not enable or dispatch the hosted fallback merely to work around a missing local Cloudflare login. Do not enable paid Workers, R2, SMS OTP or other usage-billed services for this portal.

The GitHub App grant covers only `drdixitrajesh/shadikariye`. The Cloudflare tokens include D1 read/write, Workers Scripts write, Turnstile site write and Workers Builds configuration write, plus account/billing read and the managelove.com route scope. They have no billing-write, token-management, DNS-write or R2 permission. Cloudflare grants Workers and D1 permissions at account level; keep operational code pinned to this Worker and dedicated database.

Turnstile widget `0x4AAAAAAFR5uwPEgcKjcCzJ` is provisioned in managed mode for `managelove.com` and `www.managelove.com`. `TURNSTILE_SECRET_KEY` exists in the Worker and GitHub Secrets; the public site key is in the deployment configuration. **The application does not yet render or validate Turnstile challenges.** Implement server verification with the correct hostname/actions before enabling standalone login.

The dedicated D1 database `managelove-test-portal` exists with UUID `ea008378-69be-45ef-b609-07b18e599f81` and is configured as `DB` with migrations in `drizzle`. The authenticated dashboard shows Free hard limits. Official Wrangler D1 access, a remote read query, and all five existing migrations have passed. Deploys apply reviewed migrations without seeding or resetting accounts. Native build token `managelove-cloudflare-builds-20261009` is securely stored in Cloudflare Builds (UUID `d09ec93e-d7f1-4909-ad74-701d0727225d`).

## Portal implementation still required

The current standalone site remains a browsing demo. The administrator and six member accounts do not yet exist. Build the approved invitation-only test portal using the dedicated D1 database; changing `STANDALONE_MODE` alone does not implement authentication.

Create an owner administrator with MFA before exposing administrator writes, and six separate fictional test members linked to Ananya Sharma, Ishita Mishra, Meera Jha, Aarav Tripathi, Rohan Shukla and Aditya Joshi. Use private, expiring, single-use activation so each account sets its own password. Store only password/session/activation hashes; never put credentials in commits, build logs or ordinary chat. Enforce server-side ownership and roles, secure cookies, logout/revocation, same-origin mutations and login throttling. Continue rejecting forged managed identity headers and do not show phone-verification badges for test access.

Implement persistent profile edits, references, mutual interests, messaging, own-profile deletion, audited administrator deletion, daily quotas and profile expiry. Keep immutable identities and fictional labels clear. For the Free test release, use authenticated D1 photo storage with strict type/byte checks, metadata removal, an explicit total storage cap, and at most five 256 KiB images per profile. Preserve real data during deploys and migrations. Keep real-member public registration unavailable until its verification and recovery are ready.

Retain the existing tests and verify actual live owner activation/MFA, all six distinct logins, member/admin isolation, session behavior, Turnstile rejection, photo access, persistence, messaging, quotas and deletion. A healthy `/api/health` proves the running source commit; it does not prove that authentication or database-backed member features work.

Ready-to-paste instruction:

> Pull the latest main of drdixitrajesh/shadikariye and read docs/operations/rajesh-chatgpt-work.md. Native Cloudflare Free Builds is configured: pushing reviewed main builds, tests, applies D1 migrations and deploys the existing managelove Worker. Deployment credentials stay in Cloudflare Builds and encrypted GitHub Secrets; do not request or put credentials in source, and do not stop because local Wrangler is unauthenticated. Implement the approved standalone test portal with owner MFA, six fictional test accounts, private single-use activation, persistent member workflows, authorization and server-verified Turnstile. Use only Free services and the existing dedicated D1 DB; do not reset accounts/data or enable paid storage/SMS. Run npm run verify:cloudflare, commit and push main, inspect the Cloudflare build and compare live /api/health with that commit. Verify real live account and workflow behavior before supplying private activation instructions or claiming the portal complete. Leave the GitHub Actions paid-usage gate in place.
