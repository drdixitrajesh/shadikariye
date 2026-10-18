# ManageLove on Sudama

Live website: https://managelove.com

Hosting: Sudama Dokploy, project `ManageLove`, application `ManageLove Sudama` (`AKe0fBSobpaNyG3b4j1AJ`). Dockerfile: `Dockerfile.sudama`. Build uses pinned Node 24.19.0 and pnpm 11.25.0, with the existing Vinext app and native SQLite. One replica only; multiple replicas must not share this SQLite volume.

## Storage and routing

Persistent Docker volume `managelove-sudama-data` is mounted at `/data`; database is `/data/managelove.sqlite`. Accounts, sessions, profiles and private photos are stored here. Deploying or restarting the app must preserve this volume. Do not delete the volume or deploy an empty replacement database.

Cloudflare Tunnel `dokploy-sudama` (`d5cd04ad-9a55-45c6-ba23-5814b56c9115`) routes the apex, www and staging hostname to `http://localhost:80`. Traefik routes these hostnames to application port 3000; no application host ports are published. Cloudflare supplies public TLS. `VINEXT_TRUST_PROXY=1` and `TRUST_CLOUDFLARE_PROXY=1` are required for this topology. Only enable these settings when the application's origin is reachable through the trusted tunnel.

Runtime secrets live in Dokploy, never in Git or build arguments. Preserve `PORTAL_KEY` for the lifetime of the database; changing it after MFA enrollment makes existing encrypted MFA secrets unreadable. Keep the production Turnstile credentials and the canonical hostname `managelove.com`.

Public posting is enabled with `PUBLIC_REGISTRATION=1`. `/register` creates a normal member account after terms acceptance, password validation and Turnstile; signup directs the member to the existing profile editor. Publishing still requires profile details, reference consent and publication consent. Members are not labelled phone/identity verified. Original invited test accounts remain fictional and administrator accounts retain mandatory MFA. Setting the flag to `0` closes signup and removes publishing access for public accounts while retaining original test access.

## Updates

Current deployment uses Dokploy ZIP uploads from branch `codex/dokploy-sudama`. It does not automatically deploy changes pushed to GitHub. Use `pnpm build:node`, `pnpm test:node`, `PORTAL_TEST_RUNTIME=node node tests/portal.mjs` and `pnpm exec tsc --noEmit` before uploading source. Include tracked source and intended untracked source only; exclude local databases, credentials, outputs and dependencies. Choose `Dockerfile.sudama` with context `.`. Existing databases start without a migration seed; bootstrap credentials were removed after import.

`pnpm start:node` starts the native production server. Cleanup runs hourly. Container health checks call `/api/health`; successful migrated responses include `X-ManageLove-Origin: sudama-node`. Startup logs report only account/profile counts and integrity status.

## Recovery

The pre-migration Cloudflare Worker `managelove` and D1 database `managelove-test-portal` were retained. Builds and the public Workers URL are disabled, and `managelove.com/*` / `www.managelove.com/*` no longer invoke the Worker. Merely restoring those routes after new server writes would discard the new writes from the user's view. Freeze writes and reconcile the current SQLite data before reverting to D1.

Before migration, apex DNS was two proxied A records (`3.33.152.147`, `15.197.142.173`); www was a proxied CNAME to `managelove.com`. Apex now points to the Sudama tunnel CNAME; www resolves to that tunnel as well.

Initial snapshot: 7 accounts, 6 profiles, zero enrolled MFA secrets; SHA-256 `5d853705d0f6cf2193199c22a6c93e1e152f0a5255706a7f09c29df0b3a014a3`. The encrypted SQL backup, deployment archive, import receipt and protected runtime settings are stored outside the repository under the Windows user's `.codex/integrations/dokploy` directory. DPAPI backups require that same Windows account. Retain protected copies of database and MFA key together. This migration does not configure automatic off-server backups.

Dokploy MCP is installed locally with protected credentials. Its Access policy is restricted to the Sudama Dokploy panel. The temporary D1/Turnstile read token used for export was revoked after verification.

## Member administration
After administrator MFA, /admin shows real members and publication status. Enable the test-account checkbox to include fictional seed accounts. Each member links to /admin/members/<account-id> for the public-profile preview, photos, current account/publication dates and retained activity counts/timeline. GET /api/admin/members enforces administrator MFA and paginates the list. Counts describe retained records; this is not a complete historical click or login audit. Private references, identity details, credentials and message bodies are excluded. Authenticated administrators can preview member photos without consuming member browsing quotas. Password setup is in the separate login-help section; deletion remains behind name/reason confirmation. No schema migration is required.

Public visibility is per profile and defaults off. Authenticated members may opt in with the subject's consent or turn it off in the profile editor. Anonymous /api/state exposes only opted-in, unexpired, non-test profiles (up to twenty), excludes contact email and all private identity/reference data, and exposes their current photos. Photo access rechecks live visibility and uses no-store responses. Other profiles remain member-only. Administrator member screens show the audience explicitly. Changing visibility does not reset publication or expiry timestamps.
