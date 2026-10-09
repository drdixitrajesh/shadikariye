import { readFileSync, existsSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { ACCOUNT_ID, WORKER_NAME, requireFreePlan, cloudflare } from './cloudflare-api.mjs';
import ts from 'typescript';
import {randomBytes} from 'node:crypto';

const parsed = ts.parseConfigFileTextToJson('wrangler.managelove.jsonc', readFileSync('wrangler.managelove.jsonc', 'utf8'));
if (parsed.error) throw new Error('Invalid Wrangler JSONC configuration.');
const config = parsed.config;
if (config.account_id !== ACCOUNT_ID || config.name !== WORKER_NAME) throw new Error('Unexpected deployment account or Worker.');
if (config.r2_buckets?.length || config.containers?.length || config.ai || config.vectorize?.length || config.hyperdrive?.length) {
  throw new Error('A usage-billed service is configured. This deployment permits only Free services.');
}
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Cannot identify the deployment commit.');
if (execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim()) {
  throw new Error('Commit the reviewed source changes before deploying.');
}
if ((process.env.GITHUB_REF && process.env.GITHUB_REF !== 'refs/heads/main') ||
    (process.env.WORKERS_CI_BRANCH && process.env.WORKERS_CI_BRANCH !== 'main')) {
  throw new Error('Production deployment is allowed only from main.');
}
if (!existsSync('dist/server/index.js') || !existsSync('dist/client')) throw new Error('Run npm run verify:cloudflare first.');
await requireFreePlan();
// Provision the encryption key once inside the authorized native build. Secret
// values are sent only over Wrangler stdin, never printed, committed or rotated.
const settings=await cloudflare(`/accounts/${ACCOUNT_ID}/workers/scripts/${WORKER_NAME}/settings`);
if(!(settings.bindings??[]).some(binding=>binding.name==='TURNSTILE_SECRET_KEY'&&binding.type==='secret_text'))throw new Error('The configured Turnstile secret is missing; deployment stopped.');
if(!(settings.bindings??[]).some(binding=>binding.name==='PORTAL_KEY'&&binding.type==='secret_text')){
  const result=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','node_modules/wrangler/bin/wrangler.js','secret','put','PORTAL_KEY','--config','wrangler.managelove.jsonc'],{input:randomBytes(32).toString('hex')+'\n',stdio:['pipe','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'}});
  if(result.error||result.status!==0)throw new Error('Secure MFA key provisioning failed; deployment stopped.');
  console.log('MFA encryption key provisioned securely.');
}

function wrangler(args, extraEnv = {}) {
  const result = spawnSync(process.execPath, [
    '--import', './scripts/sites-env.mjs', 'node_modules/wrangler/bin/wrangler.js', ...args,
  ], { stdio: 'inherit', env: { ...process.env, ...extraEnv, WRANGLER_SEND_METRICS: 'false' } });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Reviewed migrations are applied only after a real D1 binding is added to source.
// Account creation, password resets, and test-account bootstrap never run here.
for (const db of config.d1_databases ?? []) {
  wrangler(['d1', 'migrations', 'apply', db.binding, '--remote', '--config', 'wrangler.managelove.jsonc'],
    process.env.CLOUDFLARE_D1_API_TOKEN ? { CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_D1_API_TOKEN } : {});
}
wrangler(['deploy', '--config', 'wrangler.managelove.jsonc', '--var', `DEPLOYMENT_SHA:${sha}`, '--message', `Git commit ${sha}`]);
const deployments = await cloudflare(`/accounts/${ACCOUNT_ID}/workers/scripts/${WORKER_NAME}/deployments`);
const active = deployments.deployments?.[0];
console.log(JSON.stringify({ commit: sha, deployment: active?.id, versions: active?.versions, url: 'https://managelove.com' }));

// A successful upload is distinguished from a successful public request.
let verified = false;
for (const url of ['https://managelove.com/api/health', 'https://managelove.softinator-gj-account.workers.dev/api/health']) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: 'error' });
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const health = await response.json();
      if (health.status === 'ok' && health.commit === sha) { console.log(`Live commit verified at ${url}`); verified = true; }
    }
  } catch { /* The public edge may reject an automated request; report it below. */ }
}
if (!verified) throw new Error('Worker deployed, but the public commit check did not pass. Check /api/health in the browser before calling it live.');

