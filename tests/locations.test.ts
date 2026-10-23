import {test} from 'node:test';
import assert from 'node:assert/strict';
import countries from '../public/locations/countries.json';
import india from '../public/locations/IN.json';
import {validLocation} from '../lib/location-validation';
import {DEMO_PROFILES,matchesFilters,validateProfile,formatLocation} from '../lib/matrimony';

test('country, state and district catalog covers India and global choices',()=>{
  assert.ok(countries.length>=249);
  assert.ok(countries.some(c=>c.name==='India'));
  assert.ok(countries.some(c=>c.name==='United States'));
  assert.ok(india.states.includes('Madhya Pradesh'));
  assert.ok(india.districts['Madhya Pradesh'].includes('Indore'));
});
test('location hierarchy and missing-list fallback preserve old profiles',()=>{
  assert.equal(validLocation({}),true);
  assert.equal(validLocation({country:'India',state:'Madhya Pradesh',district:'Indore'}),true);
  assert.equal(validLocation({country:'Unknown country'}),false);
  assert.equal(validLocation({country:'India',state:'California',district:'Indore'}),false);
  assert.equal(validLocation({country:'India',state:'Madhya Pradesh',district:'Jaipur'}),false);
  assert.equal(validLocation({country:'India',state:'Madhya Pradesh',district:'New local district'}),true);
  assert.equal(validLocation({country:'India',state:'Madhya Pradesh'}),false);
});
test('location and field dropdowns match only the selected values',()=>{
  const profile={...DEMO_PROFILES[0],country:'India',state:'Madhya Pradesh',district:'Indore',city:'Indore'};
  assert.equal(matchesFilters(profile,{country:'India',state:'Madhya Pradesh',district:'Indore'}),true);
  assert.equal(matchesFilters(profile,{country:'United States'}),false);
  assert.equal(matchesFilters(profile,{state:'Rajasthan'}),false);
  assert.equal(matchesFilters(profile,{education:profile.education,profession:profile.profession}),true);
  assert.equal(matchesFilters(profile,{profession:'Engineer'}),false);
  assert.equal(matchesFilters(DEMO_PROFILES[0],{country:'India'}),false,'old city-only records are not assigned guessed locations');
  assert.equal(formatLocation(profile),'Indore, Madhya Pradesh, India');
  assert.equal(validateProfile({...profile,consent:true}).data?.district,'Indore');
  assert.equal(validateProfile({...profile,country:'X'.repeat(161),consent:true}).success,false);
});
