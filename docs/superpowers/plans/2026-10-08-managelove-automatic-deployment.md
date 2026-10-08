# ManageLove Automatic Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for inline execution, or `superpowers:subagent-driven-development` if the owner explicitly selects delegation. Steps use checkbox syntax. Execute only after the owner reviews this plan and chooses its execution method.

**Goal:** Automatically build, test and deploy approved changes pushed to `drdixitrajesh/shadikariye` main, without Dr. Rajesh needing Cloudflare credentials in each ChatGPT conversation.

**Architecture:** Connect the existing `managelove` Worker to the existing private GitHub repository through Cloudflare Workers Builds. Production builds run the repository's reproducible checks before deploying; a failed build leaves the current version live. Production deploys only main, and neither tests nor previews use production account data.

**Tech Stack:** Existing Node/pnpm/vinext/Wrangler project and native Cloudflare Workers Builds on Free.

**Spec:** Owner's 2026-10-08 request for automatic deployment of Dr. Rajesh's repository edits, and `docs/superpowers/specs/2026-10-08-managelove-test-portal-design.md` for the portal's release/data constraints. Companion portal plan: `2026-10-08-managelove-test-portal.md`.

## Global constraints

- Existing repository `https://github.com/drdixitrajesh/shadikariye`; production branch main; Worker name managelove; existing apex/www routes.
- Cloudflare Free services only. Workers Builds currently includes 3,000 minutes/month; quota exhaustion stops builds rather than causing an upgrade.
- No production credentials in source, PR comments, chat, or deployment logs. No copy of the broadly scoped existing BWS token into GitHub Actions.
- No GitHub Actions billing dependency for this pipeline. Repository-native local tests and Free Workers Builds perform validation.
- No automatic public registration, destructive database migrations, account reseeding, or password resets on ordinary code deployment.
- Current GitHub identity has push but no repository admin permission. Do not promise that installing the Cloudflare GitHub App or enforcing branch protection can be done with the current collaborator identity.
- Portal code may use only its dedicated test DB; an unapproved branch must not run against that DB or receive authentication secrets.
- Work mode alone does not prove repository write access. A generated answer, downloaded project, ChatGPT-hosted Sites publish or unpushed change is not a GitHub main commit or a Cloudflare deployment.

## Task 1: Add a reproducible verification command

**Files:** Create `scripts/verify-portal.mjs`, `tests/deployment-contract.mjs`; modify `package.json`. If the companion portal implementation already created the verification script, extend the same file instead of creating a second command.

**Consumes:** Existing build/integration/standalone scripts and companion portal tests. **Produces:** `npm run verify:portal`, with no production network/data access.

- [ ] Write contract tests that validate the Worker name, correct deployment config, Free-only resource allowlist, no R2/paid-provider binding, and portal environment marker. Verify that an intentionally failing child check stops subsequent work.

```js
assert.equal(config.name, 'managelove');
assert.equal(config.vars.STANDALONE_MODE, 'portal');
assert.equal(config.vars.PORTAL_ENVIRONMENT, 'test');
assert.equal(config.r2_buckets, undefined);
assert.equal(config.durable_objects.bindings[0].class_name, 'PortalCompute');
assert.ok(config.migrations.some(m=>m.new_sqlite_classes?.includes('PortalCompute')));
```

- [ ] Run `node --test tests/deployment-contract.mjs`; confirm it fails on the current demo-only config before implementing the new contract.
- [ ] Add `verify:portal: node scripts/verify-portal.mjs`. The script runs checked child processes sequentially and exits immediately on any nonzero status:

```js
const checks = [
  ['npm', ['run', 'build']],
  [process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']],
  [process.execPath, ['tests/integration.mjs']],
  [process.execPath, ['tests/standalone.mjs']],
  [process.execPath, ['--test', ...portalTestFiles]],
  [process.execPath, ['--test', 'tests/deployment-contract.mjs']],
];
```

`portalTestFiles` is the sorted list matching `tests/portal-*.mjs`; refuse an empty list. Add meaningful matrimony/data tests using the repository's real test invocation. Run focused lint or fix the existing full lint baseline before making full lint a required green gate. Do not suppress new lint errors to pass CI. Strip deployment and other secret variables from test subprocess environments; configure isolated local D1 and mocked outbound providers only.

- [ ] Pin CI's Node version to 25.2.1, matching the successfully exercised local runtime, and pnpm to 11.25.0. Validate a clean checkout with `npx --yes pnpm@11.25.0 install --frozen-lockfile`; do not disable package verification or modify the lockfile in CI. If the Free build image cannot supply this Node version, select a documented supported version satisfying >=22.13.0, rerun the complete checks on that exact version, and record it before enabling automatic deployments.
- [ ] Run the complete verification command and test the fail-stop behavior. Commit only these files as `build: add reproducible portal release verification`.

## Task 2: Add an explicit deployment command and public commit receipt

**Files:** Create `scripts/cloudflare-release.mjs`, `app/api/health/route.ts`; modify `package.json`, `cloudflare-env.d.ts`, `wrangler.managelove.jsonc`, `DEPLOYMENT-NOTES.md`.

**Consumes:** Passing build output and the configured dedicated test DB. **Produces:** `npm run deploy:cloudflare` and a safe deployment SHA receipt.

- [ ] Write tests proving the release script refuses a missing build, an invalid Git SHA, an unexpected Worker name, absent required bindings, unexpected paid resources, absent test marker and a failed migration. Stub the process runner in these contract tests; never point them at production.
- [ ] Run the tests and confirm the command does not yet exist.
- [ ] Implement `deploy:cloudflare: node scripts/cloudflare-release.mjs`. Read the source SHA from `git rev-parse HEAD`, validate 40 hexadecimal characters, and use argument arrays rather than shell interpolation. Run the following deployment child only after configuration validation and any permitted additive migration complete:

```js
const args = [
  '--import', './scripts/sites-env.mjs',
  'node_modules/wrangler/bin/wrangler.js', 'deploy',
  '--config', 'wrangler.managelove.jsonc',
  '--var', 'DEPLOYMENT_SHA:' + sha,
  '--message', 'GitHub main ' + sha,
];
```

Prove in the dry run that adding DEPLOYMENT_SHA preserves STANDALONE_MODE, PORTAL_ENVIRONMENT and other required vars; never use the generated managed Sites Wrangler config for this production deploy.

- [ ] Apply only reviewed additive migrations to `managelove-test` with Wrangler's dedicated config and remote D1 flag. Refuse migrations containing destructive DROP/TRUNCATE, broad data DELETE/UPDATE, account reseeding, credential modification, external-resource creation or real-environment changes; those need a separate operator release. On migration error, abort deployment. The ordinary deploy command must not run bootstrap/recovery.
- [ ] Add GET `/api/health` returning only `{status:'ok',environment:'test',commit:DEPLOYMENT_SHA}` after a bounded schema/marker readiness check. Return 503 on missing readiness. Do not return account counts, identities, token values, keys, database IDs or private data. Header Cache-Control:no-store; status check is not a write.
- [ ] Test a successful/failed local health receipt and record dry-run metadata. Commit `build: add explicit Cloudflare release and commit receipt`.

## Task 3: Connect the existing Worker to GitHub main

**Files:** Modify only the documented Cloudflare build settings and `DEPLOYMENT-NOTES.md`; create ignored sanitized configuration receipts under `outputs/portal-release/`.

**Consumes:** Tested committed source from Tasks 1–2 and the authorized Cloudflare session. **Produces:** A Free production build trigger for the exact repository/main branch.

- [ ] Open the existing Worker Settings → Builds, select GitHub and inspect available authorized installations. Reuse an installation that already grants access to this repository. If none exists, prepare the exact repository-only access grant for `drdixitrajesh/shadikariye` and hand off the owner authorization in GitHub. A browser grant of new security-sensitive access requires action-time confirmation; do not request passwords, API tokens or OTPs in chat.
- [ ] Set repository `drdixitrajesh/shadikariye`, root `/`, production branch `main`, Worker name `managelove`, and these commands:

| Setting | Value |
| --- | --- |
| Build command | `npm run verify:portal` |
| Deploy command | `npm run deploy:cloudflare` |
| Dependency manager | pnpm 11.25.0 from packageManager/frozen lockfile |
| Node | 25.2.1, or the exact supported version validated in Task 1 |
| Non-production branch deployments | Disabled |
| Build cache | Free built-in cache, with ordinary source/lockfile invalidation |

- [ ] Use Cloudflare's build credential with the minimum actually required deployment/D1 scopes on the selected account. Verify required scopes using an authorized read/dry-run/migration operation without printing the credential. Do not copy an unrelated broad BWS credential as a shortcut. Keep runtime Turnstile/MFA/auth secrets in runtime secrets, never public build variables. Record any owner-only authorization that remains unresolved.
- [ ] Validate installation repository scope and a settings receipt, confirm the subscription remains Free, and confirm the trigger selects only main. Do not enable simultaneous GitHub Actions/manual scheduled deployment paths that race this trigger.
- [ ] Ask the repository owner to enable main protection/review requirements if supported by the current private-repository plan, without buying an upgrade. If the plan/account lacks those controls, enforce reviewed changes operationally and report the limitation. Do not silently claim protected branches exist.
- [ ] Document the configured trigger and exact required commands as `docs: document Git-triggered Free deployments`.

## Task 4: Prove a pushed commit reaches the live domain automatically

**Files:** Create `docs/operations/rajesh-chatgpt-work.md`; update `DEPLOYMENT-NOTES.md`; save sanitized build/commit/live receipts.

**Consumes:** The connected main trigger and working portal. **Produces:** Verified automatic deployment and instructions Dr. Rajesh can use.

- [ ] Run the contract tests with a deliberately failing local check and prove release is skipped; do not publish a broken main commit just to test the pipeline.
- [ ] Push an authorized, meaningful checked change to main. Wait for the actual Cloudflare build result, including the source SHA, checks and deployed version. Report queued while it is running; do not say deployed on Git push alone.
- [ ] Verify live `/api/health` returns that SHA and portal login/anonymous protection still behave correctly. If unattended shell requests are blocked at the edge, identify the actual source of the denial without weakening the site's protections; use the authenticated browser for immediate proof and document the exact limitation.
- [ ] Check that the previous version can be selected for rollback and that D1 state survived the release. Deployment success is separate from rollback/restore proof and from human administrator activation.
- [ ] Give Dr. Rajesh the prompt below and confirm what his environment actually has: repo file/push tools, a local clone, or the read-only GitHub connector. If it only has read tools, use Codex or a local Work environment with the repository rather than promising chat instructions alone can push GitHub code.
- [ ] Final handoff reports repository/branch, build link, pushed SHA, Cloudflare version, live commit proof, free subscription status and any owner-only authorization still outstanding. Only then call automatic deployment enabled.

## Dr. Rajesh's reusable prompt

> Work on the existing repository `drdixitrajesh/shadikariye` for `https://managelove.com`. First verify that this environment can read, edit, commit and push this repository; tell me clearly if access is read-only. Implement my requested change in this repository, preserving the working login, administrator MFA, Cloudflare Turnstile, private data, fictional test labels and Cloudflare Free-only deployment setup. Read the repository's product/design/operational instructions. Run `npm run verify:portal` and review the diff. Use a change branch and PR when available; after my approval and passing checks, merge or push the approved change to main. Cloudflare Workers Builds is intended to deploy main automatically; verify the build and live commit receipt before saying the website is updated. Do not publish to a separate ChatGPT Sites URL, expose credentials, reseed accounts, reset passwords or use paid services. My requested change is: [describe the change].

Current state: the verification/deployment commands and Cloudflare Git trigger in that prompt are planned, not installed yet. Use the checked commands documented in the repo at execution time; do not claim they currently exist.

Capability sources: [ChatGPT Work](https://learn.chatgpt.com/docs/get-started-with-work) can use approved local files/tools when available. The ordinary [ChatGPT GitHub connector](https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt) is read-only; direct edit/push requires a capable coding/local environment. [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) supports automatic deployment on repository pushes; its [Free limit](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/) is verified separately from account configuration.

## Self-review and execution handoff

Owner-requested automatic deploy: Tasks 1–4. Test-before-publish and failed-build protection: Tasks 1–2. Exact repository/main and authorization: Task 3. No paid CI dependency: Global constraints and Task 3. Dr. Rajesh Work-mode limitations/prompt: Task 4. Source SHA/live deployment evidence and rollback: Tasks 2–4.

Execute inline in this chat (recommended), or with delegated implementation/review agents if the owner selects that method. Both this plan and the portal plan need the same execution selection; there is no need to approve the original supplied spec again.
