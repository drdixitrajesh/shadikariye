import { spawnSync } from 'node:child_process';

// The credentials are intentionally absent from dependency installation and tests.
const env = { ...process.env };
for (const key of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_D1_API_TOKEN', 'TURNSTILE_SECRET_KEY']) delete env[key];
for (const [command, args] of [
  ['npm', ['run', 'build']],
  [process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']],
  [process.execPath, ['tests/integration.mjs']],
  [process.execPath, ['tests/standalone.mjs']],
  [process.execPath, ['tests/photo-storage.mjs']],
  [process.execPath, ['tests/portal-ui.mjs']],
  [process.execPath, ['tests/portal.mjs']],
]) {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

