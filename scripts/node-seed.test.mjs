import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, createCipheriv, createHash } from 'node:crypto';
import { importSeedIfMissing } from './node-seed.mjs';
import { createDatabase } from './node-d1.mjs';

test('migration seed is authenticated and imports once without replacing saved data', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'managelove-seed-test-'));
  const path = join(directory, 'seed.aesgcm'), database = join(directory, 'portal.sqlite');
  const sql = Buffer.from("CREATE TABLE portal_accounts(id TEXT PRIMARY KEY); INSERT INTO portal_accounts VALUES ('preserved');");
  const key = randomBytes(32), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(sql), cipher.final()]);
  writeFileSync(path, Buffer.concat([iv, cipher.getAuthTag(), body]));
  const options = { path, key: key.toString('hex'), sha256: createHash('sha256').update(sql).digest('hex') };
  try {
    await assert.rejects(importSeedIfMissing(database, { ...options, sha256: '0'.repeat(64) }));
    assert.equal(existsSync(database), false);
    await assert.rejects(importSeedIfMissing(database, { ...options, key: '0'.repeat(64) }));
    assert.equal(await importSeedIfMissing(database, options), true);
    const db = createDatabase(database);
    await db.prepare("INSERT INTO portal_accounts VALUES ('new-after-migration')").run();
    db.close();
    assert.equal(await importSeedIfMissing(database, options), false);
    const reopened = createDatabase(database);
    assert.equal(await reopened.prepare('SELECT count(*) AS count FROM portal_accounts').first('count'), 2);
    reopened.close();
  } finally {
    for (const file of [path, database, database + '-wal', database + '-shm']) rmSync(file, { force: true });
    rmdirSync(directory);
  }
});
