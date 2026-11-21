import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {createNodePortalRuntime} from './node-portal-runtime.mjs';
process.env.TRUST_CLOUDFLARE_PROXY='1';
const origin='https://vedik-milan.softinator.org';
const runtime=await createNodePortalRuntime({bindings:{STANDALONE_MODE:'test-portal',PUBLIC_REGISTRATION:'1',PORTAL_KEY:'a'.repeat(64)},outboundService:()=>{throw Error('Unexpected outbound request');}});
let checks=0;
function eq(actual,expected){assert.deepEqual(actual,expected);checks++;}
async function call(path,cookie,body,requestOrigin=origin){const response=await runtime.dispatchFetch(origin+path,{method:body?'POST':'GET',headers:{Origin:requestOrigin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
try{
  const db=await runtime.getD1Database();
  for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
  async function account(role,mfa=true){const id=randomUUID(),token=randomBytes(32).toString('hex');await db.prepare("INSERT INTO portal_accounts(id,username,role,status,test_account,created_at) VALUES(?,?,?,'active',0,?)").bind(id,'qa.'+id,role,Date.now()).run();await db.prepare('INSERT INTO portal_sessions(token_hash,account_id,session_version,mfa_verified,created_at,expires_at) VALUES(?,?,0,?,?,?)').bind(createHash('sha256').update(token).digest('hex'),id,mfa?1:0,Date.now(),Date.now()+3600000).run();return {id,cookie:'__Host-managelove='+token};}
  const owner=await account('member'),viewer=await account('member'),admin=await account('admin'),passwordAdmin=await account('admin',false);
  const body={name:'Approval QA Member',birthDate:'1996-04-15',aadhaarLast4:'',termsAccepted:true,references:[{name:'Fictional Reference One',relationship:'Friend',phone:'+919999999991',consent:true},{name:'Fictional Reference Two',relationship:'Friend',phone:'+919999999992',consent:true}],gender:'male',community:'Gaur',gotra:'Shandilya',city:'Maihar',education:'Graduate',profession:'Teacher',height:175,maritalStatus:'Never married',about:'This is a fictional profile for isolated approval testing.',managedBy:'Self',language:'Hindi',consent:true,publicListing:true,approvalStatus:'approved',reviewToken:'forged'};
  let result=await call('/api/profile',owner.cookie,body);eq(result.status,200);let p=result.data.profile;const id=p.id;
  eq(p.approvalStatus,'pending');assert.notEqual(p.reviewToken,'forged');checks++;
  async function own(){return (await call('/api/state',owner.cookie)).data.own;}
  async function visible(cookie){return (await call('/api/state',cookie)).data.profiles.some(p=>p.id===id);}
  async function review(decision='approved',token=p.reviewToken,reason='',cookie=admin.cookie,requestOrigin=origin){return call('/api/admin/profiles/review',cookie,{id,reviewToken:token,decision,reason},requestOrigin);}
  eq(await visible(),false);eq(await visible(viewer.cookie),false);eq((await own()).approvalStatus,'pending');
  eq((await review('approved',p.reviewToken,'',null)).status,401);
  eq((await review('approved',p.reviewToken,'',owner.cookie)).status,403);
  eq((await review('approved',p.reviewToken,'',passwordAdmin.cookie)).status,401);
  eq((await review('approved',p.reviewToken,'',admin.cookie,'https://evil.invalid')).status,403);
  eq((await review('approved','old-revision')).status,409);
  eq((await review('rejected',p.reviewToken,'short')).status,400);
  const queue=await call('/api/admin/members?pending=1',admin.cookie);eq(queue.status,200);eq(queue.data.members.some(m=>m.id===owner.id),true);eq(queue.data.summary.pending,1);
  eq((await review('rejected',p.reviewToken,'Please provide clearer profile details.')).status,200);
  p=await own();eq(p.approvalStatus,'rejected');eq(p.reviewReason,'Please provide clearer profile details.');eq(await visible(viewer.cookie),false);
  const rejectedToken=p.reviewToken;
  result=await call('/api/profile',owner.cookie,{...body,city:'Bhopal'});p=result.data.profile;eq(p.approvalStatus,'pending');eq(p.reviewReason,'');
  eq((await review('approved',rejectedToken)).status,409);
  eq((await review()).status,200);eq(await visible(),true);eq(await visible(viewer.cookie),true);
  p=await own();eq(p.approvalStatus,'approved');
  const publicProfile=(await call('/api/state')).data.profiles.find(p=>p.id===id);eq('reviewToken' in publicProfile,false);eq('reviewReason' in publicProfile,false);
  const memberProfile=(await call('/api/state',viewer.cookie)).data.profiles.find(p=>p.id===id);eq('reviewToken' in memberProfile,false);eq('reviewReason' in memberProfile,false);
  // A content edit invalidates approval even for previously viewed profiles.
  await db.prepare('INSERT OR IGNORE INTO daily_views(owner,day,target) VALUES(?,?,?)').bind(viewer.id,new Date(Date.now()+19800000).toISOString().slice(0,10),id).run();
  const approvedToken=p.reviewToken;
  result=await call('/api/profile',owner.cookie,{...body,publicListing:false});p=result.data.profile;eq(await visible(viewer.cookie),false);eq((await review('approved',approvedToken)).status,409);
  eq((await call('/api/actions',viewer.cookie,{kind:'save',target:id,saved:true})).status,404);
  eq((await review()).status,200);eq(await visible(),false);eq(await visible(viewer.cookie),true);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWP48OHDfxBmgDEAiNQPPY9NJdMAAAAASUVORK5CYII=','base64');
  const form=new FormData();form.set('photo',new File([png],'fictional.png',{type:'image/png'}));form.set('slot','0');
  const photo=await runtime.dispatchFetch(origin+'/api/photo',{method:'POST',headers:{Origin:origin,Cookie:owner.cookie},body:form});eq(photo.status,200);const key=(await photo.json()).photoKey;
  p=await own();eq(p.approvalStatus,'pending');eq(await visible(viewer.cookie),false);
  async function photoStatus(cookie){return (await runtime.dispatchFetch(origin+'/api/photo/'+key,{headers:cookie?{Cookie:cookie}:{}})).status;}
  eq(await photoStatus(),401);eq(await photoStatus(viewer.cookie),403);eq(await photoStatus(owner.cookie),200);eq(await photoStatus(admin.cookie),200);
  eq((await review()).status,200);eq(await photoStatus(viewer.cookie),200);
  const oldPhotoToken=(await own()).reviewToken;
  const removed=await runtime.dispatchFetch(origin+'/api/photo?slot=0',{method:'DELETE',headers:{Origin:origin,Cookie:owner.cookie}});eq(removed.status,200);p=await own();eq(p.approvalStatus,'pending');eq((await review('approved',oldPhotoToken)).status,409);
  // Concurrent reviewers cannot both commit decisions for one revision.
  const decisions=await Promise.all([review(),review('rejected',p.reviewToken,'A simultaneous review must not overwrite approval.')]);eq(decisions.map(r=>r.status).sort(),[200,409]);
  const audits=await db.prepare('SELECT actor,action,reason FROM admin_actions WHERE target=? ORDER BY created_at').bind(id).all();eq(audits.results.length,5);eq(audits.results.every(a=>a.actor===admin.id),true);
  eq((await review('approved','missing')).status,409);
  const after=await db.prepare('SELECT COUNT(*) AS n FROM admin_actions WHERE target=?').bind(id).first();eq(after.n,5);
  p=await own();await db.prepare('UPDATE profiles SET expires_at=? WHERE id=?').bind(Date.now()-1,id).run();
  eq((await review()).status,409);

  // An older member's new private revision belongs at the head of the review queue.
  const olderMember=await account('member');
  const olderSubmission=await call('/api/profile',olderMember.cookie,{...body,publicListing:false});
  eq(olderSubmission.status,200);
  const olderProfile=olderSubmission.data.profile;
  const queueTime=Date.now();
  await db.prepare('UPDATE portal_accounts SET created_at=? WHERE id=?').bind(queueTime-60_000,olderMember.id).run();
  await db.prepare('UPDATE profiles SET updated_at=? WHERE id=?').bind(queueTime-60_000,olderProfile.id).run();
  const fixtures=[];
  await db.batch(Array.from({length:33},(_,index)=>{
    const memberId=randomUUID();
    const testAccount=index===0;
    const expired=index===1;
    // Tie the timestamps across the first page boundary to exercise the cursor.
    const updatedAt=queueTime-(testAccount?1_000:2_000);
    fixtures.push({memberId,expired,updatedAt});
    return [
      db.prepare("INSERT INTO portal_accounts(id,username,role,status,test_account,created_at) VALUES(?,?,'member','active',?,?)").bind(memberId,'queue.qa.'+index,Number(testAccount),queueTime-30_000+index),
      db.prepare('INSERT INTO profiles(id,owner,data,updated_at,published_at,expires_at) VALUES(?,?,?,?,?,?)').bind(
        randomUUID(),memberId,JSON.stringify({name:'Fictional Queue Member '+index,city:'Test City',publicListing:false,approvalStatus:'pending'}),updatedAt,queueTime-10_000,expired?queueTime-1:queueTime+86_400_000),
    ];
  }).flat());
  const resubmitted=await call('/api/profile',olderMember.cookie,{...body,city:'Test City',publicListing:false,publicationToken:olderProfile.publishedAt});
  eq(resubmitted.status,200);eq(resubmitted.data.profile.approvalStatus,'pending');
  eq(resubmitted.data.profile.publicListing,false);

  const pendingPath='/api/admin/members?pending=1';
  const realQueue=await call(pendingPath,admin.cookie);
  eq(realQueue.status,200);
  eq(realQueue.data.members[0].id,olderMember.id);
  eq(realQueue.data.total,32);
  eq(realQueue.data.summary.pending,33);
  eq(realQueue.data.members.some(member=>member.testAccount),false);

  const allPendingPath=pendingPath+'&tests=1';
  const allQueue=await call(allPendingPath,admin.cookie);
  eq(allQueue.status,200);
  eq(allQueue.data.total,33);
  eq(allQueue.data.summary.pending,33);
  eq(allQueue.data.members.slice(0,2).map(member=>member.id),[olderMember.id,fixtures[0].memberId]);
  eq(allQueue.data.members.length,30);
  const nextQueue=await call(allPendingPath+'&before='+encodeURIComponent(allQueue.data.nextCursor),admin.cookie);
  eq(nextQueue.status,200);
  eq(nextQueue.data.members.length,3);
  eq(nextQueue.data.nextCursor,null);
  const queuedIds=[...allQueue.data.members,...nextQueue.data.members].map(member=>member.id);
  eq(new Set(queuedIds).size,queuedIds.length);
  eq(new Set(queuedIds),new Set([olderMember.id,...fixtures.filter(fixture=>!fixture.expired).map(fixture=>fixture.memberId)]));
  const updateByMember=new Map(fixtures.map(fixture=>[fixture.memberId,fixture.updatedAt]));
  const updateOrder=queuedIds.slice(1).map(memberId=>updateByMember.get(memberId));
  eq(updateOrder,[...updateOrder].sort((first,second)=>second-first));
  for(const [path,activeLink] of [
    ['/admin','<a href="/admin" aria-current="page">मंज़ूरी बाकी</a>'],
    ['/admin?pending=1','<a href="/admin" aria-current="page">मंज़ूरी बाकी</a>'],
    ['/admin?section=members','<a href="/admin?section=members" aria-current="page">सभी सदस्य</a>'],
  ]){
    const page=await runtime.dispatchFetch(origin+path,{headers:{Cookie:admin.cookie}});
    eq(page.status,200);
    eq((await page.text()).includes(activeLink),true);
  }
  eq((await call(pendingPath,olderMember.cookie)).status,403);
  console.log('PASS: '+checks+' approval checks: pending queue and visibility, roles/MFA, rejection/resubmission, stale revisions, public consent, photos, concurrent review and audit.');
}finally{await runtime.dispose();}
