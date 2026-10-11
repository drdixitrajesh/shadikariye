import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from './node-d1.mjs';

test('SQLite preserves D1 rows, scalar queries, blobs and mutation metadata', async () => {
  const db = createDatabase(':memory:');
  try {
    await db.exec('CREATE TABLE records (id INTEGER PRIMARY KEY, name TEXT UNIQUE, photo BLOB)');
    const bytes = new Uint8Array([0, 127, 255]);
    const result = await db.prepare('INSERT INTO records(name,photo) VALUES (?,?) RETURNING id').bind('first', bytes.buffer).all();
    assert.equal(result.meta.changes, 1);
    assert.equal(result.results[0].id, 1);
    const row = await db.prepare('SELECT * FROM records WHERE id=?').bind(1).first();
    assert.equal(row.name, 'first');
    assert.deepEqual(Array.from(row.photo), Array.from(bytes));
    assert.equal(await db.prepare('SELECT count(*) AS count FROM records').first('count'), 1);
    assert.equal(await db.prepare('SELECT * FROM records WHERE id=2').first(), null);
    assert.deepEqual(await db.prepare('SELECT name FROM records').raw(), [['first']]);
  } finally { db.close(); }
});

test('a failed batch rolls back every statement, including returned updates', async () => {
  const db = createDatabase(':memory:');
  try {
    await db.exec('CREATE TABLE counts (id TEXT PRIMARY KEY, count INTEGER); INSERT INTO counts VALUES (\'a\',1)');
    await assert.rejects(db.batch([
      db.prepare('UPDATE counts SET count=count+1 RETURNING count'),
      db.prepare('INSERT INTO counts VALUES (?,?)').bind('a', 99),
    ]));
    assert.equal(await db.prepare('SELECT count FROM counts').first('count'), 1);
    const result = await db.batch([
      db.prepare('UPDATE counts SET count=count+1 RETURNING count'),
      db.prepare('SELECT count FROM counts'),
    ]);
    assert.equal(result[0].results[0].count, 2);
    assert.equal(result[1].results[0].count, 2);
  } finally { db.close(); }
});
