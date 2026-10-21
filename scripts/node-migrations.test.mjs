import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase} from './node-d1.mjs';
import {migrateAccountContacts} from './node-migrations.mjs';

test('contact migration preserves existing accounts and is safe on restart',async()=>{
  const db=createDatabase(':memory:');
  try{
    await db.exec("CREATE TABLE portal_accounts(id TEXT PRIMARY KEY,username TEXT); INSERT INTO portal_accounts VALUES('existing','member');");
    await migrateAccountContacts(db);await migrateAccountContacts(db);
    assert.deepEqual(await db.prepare('SELECT * FROM portal_accounts').first(),{id:'existing',username:'member',mobile:null,contact_email:''});
    await db.prepare('UPDATE portal_accounts SET mobile=? WHERE id=?').bind('+919876543210','existing').run();
    await migrateAccountContacts(db);
    assert.equal(await db.prepare('SELECT mobile FROM portal_accounts').first('mobile'),'+919876543210');
    await assert.rejects(()=>db.prepare("INSERT INTO portal_accounts(id,mobile) VALUES('duplicate','+919876543210')").run(),/UNIQUE/);
  }finally{db.close();}
});
