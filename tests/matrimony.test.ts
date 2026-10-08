import {sixMonthsAfter} from '../lib/profile-expiry.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalGotra, matchesFilters, validateProfile } from '../lib/matrimony.ts';

const profile = { id:'test', name:'Ananya Sharma', age:28, gender:'female', community:'Kanyakubj', gotra:'Shandilya', city:'Lucknow', education:'MBA', profession:'Designer', height:165, maritalStatus:'Never married', about:'Family and travel are important to me.', managedBy:'Self', language:'Hindi', demo:false, portrait:null, photoKey:null };
test('recognizes spelling variants without guessing from a surname', () => {
  assert.equal(canonicalGotra(' shandiyla '), 'Shandilya');
  assert.equal(canonicalGotra('शाण्डिल्य'), 'Shandilya');
  assert.equal(canonicalGotra('Sharma'), 'Sharma');
});
test('community and gotra are independent match filters', () => {
  assert.equal(matchesFilters(profile, {community:'Kanyakubj',gotra:'Bharadwaj'}), false);
  assert.equal(matchesFilters(profile, {community:'Kanyakubj',gotra:'Shandilya'}), true);
});
test('optional same-gotra exclusion keeps an unknown gotra visible', () => {
  assert.equal(matchesFilters(profile, {excludeGotra:'Shandilya'}), false);
  assert.equal(matchesFilters({...profile,gotra:'Unknown'}, {excludeGotra:'Shandilya'}), true);
});
test('rejects underage profiles and refuses publication without consent', () => {
  assert.equal(validateProfile({...profile,age:17,consent:true}).success, false);
  assert.equal(validateProfile({...profile,consent:false}).success, false);
  assert.equal(validateProfile({...profile,consent:true}).success, true);
});

test('six-month expiry uses calendar months and clamps month-end dates',()=>{
  assert.equal(new Date(sixMonthsAfter(Date.parse('2026-08-31T12:34:56.789Z'))).toISOString(),'2027-02-28T12:34:56.789Z');
  assert.equal(new Date(sixMonthsAfter(Date.parse('2027-08-31T12:34:56.789Z'))).toISOString(),'2028-02-29T12:34:56.789Z');
  assert.equal(new Date(sixMonthsAfter(Date.parse('2026-08-30T18:35:00Z'))).toISOString(),'2027-02-27T18:35:00.000Z');
  assert.equal(new Date(sixMonthsAfter(Date.parse('2026-10-08T02:15:00Z'))).toISOString(),'2027-04-08T02:15:00.000Z');
});
