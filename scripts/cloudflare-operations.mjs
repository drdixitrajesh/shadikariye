import { ACCOUNT_ID, WORKER_NAME, DATABASE_NAME, SITE_KEY, cloudflare, requireFreePlan } from './cloudflare-api.mjs';
import { spawnSync } from 'node:child_process';

const operation = process.argv[2];
if (!['status', 'provision'].includes(operation)) throw new Error('Use status or provision.');
await requireFreePlan();
const settings = await cloudflare(`/accounts/${ACCOUNT_ID}/workers/scripts/${WORKER_NAME}/settings`);
console.log(JSON.stringify({ worker: WORKER_NAME, bindings: settings.bindings?.map(b => ({ name: b.name, type: b.type })) }));
const widgets = await cloudflare(`/accounts/${ACCOUNT_ID}/challenges/widgets`);
console.log(JSON.stringify({ turnstile: widgets.filter(w => w.sitekey === SITE_KEY).map(w => ({ sitekey: w.sitekey, mode: w.mode, domains: w.domains })) }));
const d1Token = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
function d1(args) {
  const result = spawnSync(process.execPath, [
    '--import', './scripts/sites-env.mjs', 'node_modules/wrangler/bin/wrangler.js', 'd1', ...args,
  ], { encoding: 'utf8', env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID, CLOUDFLARE_API_TOKEN: d1Token, WRANGLER_SEND_METRICS: 'false' } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Wrangler D1 operation failed (exit ${result.status}); recheck the dedicated token's D1 permission.`);
  return result.stdout;
}
try {
  const databases = JSON.parse(d1(['list', '--json']));
  let database = databases.find(d => d.name === DATABASE_NAME);
  if (!database && operation === 'provision') {
    d1(['create', DATABASE_NAME, '--config', 'wrangler.managelove.jsonc', '--update-config', 'false']);
    database = JSON.parse(d1(['list', '--json'])).find(d => d.name === DATABASE_NAME);
  }
  console.log(JSON.stringify({ database: database ? { name: database.name, id: database.uuid } : null }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
