import { resolve } from 'node:path';
import { createDatabase } from './node-d1.mjs';
import { importSeedIfMissing } from './node-seed.mjs';

process.env.NODE_ENV = 'production';
const databasePath = resolve(process.env.DATABASE_PATH ?? '/data/managelove.sqlite');
for (const name of ['PORTAL_KEY', 'TURNSTILE_SECRET_KEY', 'TURNSTILE_SITE_KEY']) {
  if (!process.env[name]) throw new Error(`Required runtime setting ${name} is missing.`);
}
if (!/^[a-f0-9]{64}$/.test(process.env.PORTAL_KEY)) throw new Error('Invalid MFA encryption key.');
await importSeedIfMissing(databasePath, { path: process.env.MIGRATION_SEED_PATH, key: process.env.MIGRATION_SEED_KEY, sha256: process.env.MIGRATION_SEED_SHA256 });
const bindings = {
  DB: createDatabase(databasePath),
  STANDALONE_MODE: 'test-portal',
  PORTAL_KEY: process.env.PORTAL_KEY,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY,
  DEPLOYMENT_SHA: process.env.DEPLOYMENT_SHA ?? 'sudama-node',
};
globalThis[Symbol.for('managelove.node.env')] = bindings;
const { importServerEntryModule, startProdServer } = await import('vinext/server/prod-server');
if (await bindings.DB.prepare('PRAGMA quick_check').first('quick_check') !== 'ok') throw new Error('Database integrity check failed.');
await bindings.DB.prepare('SELECT id FROM portal_accounts LIMIT 1').first();
console.log('Database ready:', JSON.stringify({ accounts: await bindings.DB.prepare('SELECT count(*) AS total FROM portal_accounts').first('total'), profiles: await bindings.DB.prepare('SELECT count(*) AS total FROM profiles').first('total'), integrity: 'ok' }));
const { PortalPasswordService, cleanup } = await importServerEntryModule(resolve('dist/server/index.js'));
const passwordService = new PortalPasswordService();
bindings.PASSWORD_SERVICE = {
  idFromName: name => name,
  get: () => ({ fetch: (url, init) => passwordService.fetch(new Request(url, init)) }),
};
const { server } = await startProdServer({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.maxRequestsPerSocket = 1000;
let cleaning = false;
const cleanupTimer = setInterval(async () => {
  if (cleaning) return;
  cleaning = true;
  try { await cleanup(); } catch { console.error('Scheduled cleanup failed.'); }
  finally { cleaning = false; }
}, 3600000);
cleanupTimer.unref();
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
  clearInterval(cleanupTimer);
  server.close(() => { bindings.DB.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
});
