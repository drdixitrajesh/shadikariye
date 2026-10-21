import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase} from '../scripts/node-d1.mjs';
import {reserveCredentialAttempt,clearCredentialAttempts,CREDENTIAL_LOCK_MS} from '../lib/credential-attempts.ts';

test('three attempts lock for 15 minutes after the third, then recover',async()=>{
  const db=createDatabase(':memory:');
  try{
    await db.exec('CREATE TABLE portal_credential_attempts(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires_at INTEGER NOT NULL)');
    assert.equal(await reserveCredentialAttempt(db,'login:one',0),true);
    assert.equal(await reserveCredentialAttempt(db,'login:one',1000),true);
    assert.equal(await reserveCredentialAttempt(db,'login:one',2000),true);
    assert.equal(await reserveCredentialAttempt(db,'login:one',2001),false);
    assert.equal(await reserveCredentialAttempt(db,'login:one',CREDENTIAL_LOCK_MS+1999),false);
    assert.equal(await reserveCredentialAttempt(db,'login:one',CREDENTIAL_LOCK_MS+2000),true);
    await clearCredentialAttempts(db,'login:one');
    assert.equal(await db.prepare('SELECT count(*) AS n FROM portal_credential_attempts').first('n'),0);
    const results=await Promise.all(Array.from({length:8},()=>reserveCredentialAttempt(db,'mfa:one',5000)));
    assert.equal(results.filter(Boolean).length,3);
  }finally{db.close();}
});
