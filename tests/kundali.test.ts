import assert from 'node:assert/strict';
import {test} from 'node:test';
import {EclipticGeoMoon,AstroTime,e_tilt} from 'astronomy-engine';
import {birthUtc,chartFromLongitude,lahiriAyanamsa,moonChart,scoreCharts,matchKundali,type BirthInput,type MoonChart} from '../lib/kundali.ts';
const input=(values:Partial<BirthInput>={}):BirthInput=>({name:'Fictional QA',date:'1996-04-15',time:'10:30',place:'Indore, India',zone:'Asia/Kolkata',...values});
const chart=(lon:number):MoonChart=>({...chartFromLongitude(lon),utc:'2000-01-01T12:00:00.000Z',ayanamsa:23.857});
test('local birth times use explicit zones, not the device zone',()=>{
 assert.equal(birthUtc(input()).toISOString(),'1996-04-15T05:00:00.000Z');
 assert.equal(birthUtc(input({zone:'Asia/Kathmandu'})).toISOString(),'1996-04-15T04:45:00.000Z');
 assert.equal(birthUtc(input({time:'05:00',zone:'UTC'})).toISOString(),'1996-04-15T05:00:00.000Z');
 assert.equal(moonChart(input()).longitude,moonChart(input({time:'05:00',zone:'UTC',place:'London, UK'})).longitude);
});
test('calendar, clock, future, missing place and invalid zone errors are explicit',()=>{
 for(const v of [{date:'1900-02-29'},{date:'2001-02-29'},{date:'1996-04-31'},{time:'24:00'},{time:'12:60'},{time:''},{zone:'Not/AZone'},{place:''},{date:'2099-01-01'}])assert.throws(()=>birthUtc(input(v)));
 assert.equal(birthUtc(input({date:'2000-02-29'})).toISOString(),'2000-02-29T05:00:00.000Z');
});
test('DST gaps are rejected and duplicated times need an explicit occurrence',()=>{
 assert.throws(()=>birthUtc(input({date:'2000-04-02',time:'02:30',zone:'America/New_York'})),/मौजूद नहीं/);
 const fold=input({date:'2000-10-29',time:'01:30',zone:'America/New_York'});assert.throws(()=>birthUtc(fold),/दो बार/);
 assert.equal(birthUtc({...fold,fold:'earlier'}).toISOString(),'2000-10-29T05:30:00.000Z');
 assert.equal(birthUtc({...fold,fold:'later'}).toISOString(),'2000-10-29T06:30:00.000Z');
});
test('geocentric Moon agrees with independent JPL Horizons observations within 0.02 degrees',()=>{
 // JPL Horizons: target 301, center 500@399, OBSERVER, quantity 31, UTC, DE441.
 for(const [iso,expected] of [['1968-05-24T00:00:00Z',26.9081349],['1992-04-12T00:00:00Z',133.1763292],['2000-01-01T12:00:00Z',223.3237860]] as const){assert.ok(Math.abs(EclipticGeoMoon(new Date(iso)).lon-expected)<.02);}
});
test('Lahiri uses the published epoch and true-ecliptic nutation convention',()=>{
 const date=new Date('1899-12-31T12:00:00Z'),mean=lahiriAyanamsa(date)-e_tilt(new AstroTime(date)).dpsi/3600;
 assert.ok(Math.abs(mean-22.46047)<.00001);
 const j2000=new Date('2000-01-01T12:00:00Z');assert.ok(Math.abs(lahiriAyanamsa(j2000)-e_tilt(new AstroTime(j2000)).dpsi/3600-23.85709)<.001);
});
test('rashi/nakshatra/pada wrap and boundary uncertainty are handled',()=>{
 assert.equal(chartFromLongitude(360).rashi,0);assert.equal(chartFromLongitude(-1).rashi,11);
 assert.equal(chartFromLongitude(30).rashi,1);assert.equal(chartFromLongitude(40).nakshatra,3);assert.equal(chartFromLongitude(40).pada,1);
 assert.equal(chartFromLongitude(359).nakshatra,26);assert.equal(chartFromLongitude(359).pada,4);
 assert.equal(chartFromLongitude(.02).nearBoundary,true);assert.equal(chartFromLongitude(1).nearBoundary,false);
 assert.throws(()=>chartFromLongitude(NaN));
});
test('published scoring examples, directional Gana and Yoni enemy pairs',()=>{
 const ash=chart(1),bharani=chart(15),cat=chart(85),rat=chart(125),buffalo=chart(165);
 assert.deepEqual(scoreCharts(ash,ash).map(k=>k.points),[1,2,3,4,5,6,7,0]);
 assert.deepEqual(scoreCharts(ash,bharani).map(k=>k.points),[1,2,3,2,5,5,7,8]);
 assert.equal(scoreCharts(bharani,ash)[5].points,6);
 assert.equal(scoreCharts(ash,buffalo)[3].points,0);assert.equal(scoreCharts(cat,rat)[3].points,0);
 assert.equal(scoreCharts(chart(211),chart(31))[6].points,7);
});
test('all 108 lunar-pada pairs produce bounded half-point totals and exactly eight kootas',()=>{
 const charts=Array.from({length:108},(_,i)=>chart((i+.5)*10/3));
 for(const b of charts)for(const g of charts){const k=scoreCharts(b,g),sum=k.reduce((s,x)=>s+x.points,0);assert.equal(k.length,8);assert.equal(k.reduce((s,x)=>s+x.max,0),36);assert.ok(sum>=0&&sum<=36);for(const x of k)assert.ok(x.points>=0&&x.points<=x.max&&Number.isInteger(x.points*2));}
});
test('fictional end-to-end pair returns 32.5 and independent lunar classifications',()=>{
 const r=matchKundali(input(),input({date:'1992-08-22',time:'16:45'}));assert.equal(r.total,32.5);assert.equal(r.boundary,false);assert.equal(r.bride.rashi,10);assert.equal(r.bride.nakshatra,24);assert.equal(r.groom.rashi,1);assert.equal(r.groom.nakshatra,3);
});
