# Dr. Rajesh: updating ManageLove through ChatGPT Work

Repository: [drdixitrajesh/shadikariye](https://github.com/drdixitrajesh/shadikariye). Website: [managelove.com](https://managelove.com).

## Deployment access prepared on 2026-10-09

The private repository now has an encrypted `CLOUDFLARE_API_TOKEN` Actions secret. It is a dedicated token scoped to the Softinator GJ account and the managelove.com zone, with Workers Scripts, D1, Turnstile, Workers Builds, account-read and billing-read permissions. It cannot change billing, manage API tokens, or edit DNS. Cloudflare scopes Workers/D1 permissions at account level, so this token must stay in Secrets and workflows must target only ManageLove. Do not try to read its value into a Work conversation or commit it into source.

The token is available **inside GitHub Actions**, not automatically inside a ChatGPT Work shell. An unauthenticated local Wrangler does not prevent writing and testing portal code or invoking an authorized workflow.

`npm run verify:cloudflare` builds, typechecks, and runs the managed and standalone integration checks. `npm run deploy:cloudflare` applies configured D1 migrations, deploys `wrangler.managelove.jsonc`, records the Git commit, and checks `/api/health`. It refuses paid Workers plans and usage-billed R2/Containers/AI bindings. It never creates or resets login accounts on an ordinary deploy.

The `ManageLove Cloudflare` workflow can deploy, inspect access, or provision the dedicated `managelove-test-portal` D1 database. It runs only reviewed `main`. Repository Secrets are supplied only to the operation step, not dependency installation or tests. Review the actual run and live health before reporting a successful deployment.

**Free-only gate:** the repository is private, so GitHub-hosted Actions may bill after its included minutes. The workflow remains gated until the owner verifies a $0 Actions budget with stop-usage enabled and sets `MANAGELOVE_FREE_CI_ENABLED=true`, or confirms that budget when dispatching a run. No hosted job should be started merely to work around a missing Cloudflare login. Native Cloudflare Workers Builds Free is preferred; it has a hard monthly Free limit. Its one-time GitHub App connection still needs repository-owner sign-in. Use build command `npm run verify:cloudflare`, deploy command `npm run deploy:cloudflare`, production branch `main`, root `/`, Node `25.2.1`, and a build token with the same required scopes. Keep branch preview deployments disabled.

Turnstile widget `0x4AAAAAAFR5uwPEgcKjcCzJ` is provisioned in managed mode for `managelove.com` and `www.managelove.com`. `TURNSTILE_SECRET_KEY` exists in the Worker and GitHub Secrets; the public site key is in the deployment configuration. **The application does not yet render or validate Turnstile challenges.** Implement server verification with the correct hostname/actions before enabling standalone login.

The dedicated D1 database `managelove-test-portal` exists with UUID `ea008378-69be-45ef-b609-07b18e599f81` and is configured as `DB` with migrations in `drizzle`. The authenticated dashboard shows Free hard limits. Official Wrangler D1 list access has passed; use Wrangler for migrations and queries, because the earlier raw API checks returned 401. Native build token `managelove-cloudflare-builds-20261009` has been securely stored in Cloudflare Builds (UUID `d09ec93e-d7f1-4909-ad74-701d0727225d`). Native Git connection and its first build are still pending the repository owner's GitHub App sign-in/authorization. The admin and six member accounts remain a separate portal implementation task.

Ready-to-paste instruction:

> Pull the latest main of drdixitrajesh/shadikariye. Cloudflare credentials are securely configured as GitHub Actions Secrets; do not put credentials in source or stop simply because Wrangler is unauthenticated in your local Work shell. Implement the approved standalone portal with a secure admin account, six clearly fictional test accounts, private one-time activation, proper authorization and server-verified Turnstile. Use only Cloudflare Free services. Use the repository's verify/deploy commands and the ManageLove Cloudflare workflow after its free-budget gate is satisfied, or native Cloudflare Free Builds after the one-time GitHub connection. Apply reviewed migrations without resetting accounts, then verify actual authenticated behavior and the live /api/health commit. Report code, CI, deployment and account tests separately; do not invent credentials or claim pending gates passed.
