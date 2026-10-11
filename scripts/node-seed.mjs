import { existsSync, readFileSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { createDecipheriv, createHash, randomUUID } from 'node:crypto';
import { createDatabase } from './node-d1.mjs';

export async function importSeedIfMissing(databasePath, { path, key, sha256 } = {}) {
  if (existsSync(databasePath)) return false;
  if (!path || !/^[a-f0-9]{64}$/.test(key ?? '') || !/^[a-f0-9]{64}$/.test(sha256 ?? '')) throw new Error('Imported database is missing and no verified migration seed is configured.');
  const payload = readFileSync(path);
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), payload.subarray(0,12));
  decipher.setAuthTag(payload.subarray(12,28));
  const sql = Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]);
  if (createHash('sha256').update(sql).digest('hex') !== sha256) throw new Error('Migration seed checksum does not match.');
  mkdirSync(dirname(databasePath), { recursive: true });
  const temporary = databasePath + '.importing-' + randomUUID();
  const db = createDatabase(temporary);
  try {
    await db.exec(sql.toString('utf8'));
    if (await db.prepare('PRAGMA integrity_check').first('integrity_check') !== 'ok' || (await db.prepare('PRAGMA foreign_key_check').all()).results.length) throw new Error('Imported database integrity check failed.');
    if (await db.prepare('SELECT count(*) AS count FROM portal_accounts').first('count') < 1) throw new Error('Migration seed has no portal accounts.');
    db.close();
    renameSync(temporary, databasePath);
    return true;
  } catch (error) {
    try { db.close(); } catch {}
    for (const suffix of ['', '-wal', '-shm']) rmSync(temporary + suffix, { force: true });
    throw error;
  }
}
