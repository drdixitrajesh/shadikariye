import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {createNodePortalRuntime} from './node-portal-runtime.mjs';
const origin='https://vedik-milan.softinator.org';
process.env.TRUST_CLOUDFLARE_PROXY='1';
const runtime=await createNodePortalRuntime({bindings:{STANDALONE_MODE:'test-portal',REQUIRE_ACCOUNT_MOBILE:'1',PUBLIC_REGISTRATION:'1',PORTAL_KEY:'a'.repeat(64),TURNSTILE_SECRET_KEY:'test'},outboundService:request=>new Response(JSON.stringify({success:true,hostname:'vedik-milan.softinator.org',action:'post',challenge_ts:new Date().toISOString()}))});
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
try{
 const db=await runtime.getD1Database();
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
 async function account(role,mfa=true){const id=randomUUID(),token=randomBytes(32).toString('hex');await db.prepare("INSERT INTO portal_accounts(id,username,role,status,test_account,created_at,mobile) VALUES(?,?,?,'active',0,?,?)").bind(id,'qa.'+id,role,Date.now(),'+919'+String(Math.floor(Math.random()*1e9)).padStart(9,'0')).run();await db.prepare('INSERT INTO portal_sessions(token_hash,account_id,session_version,mfa_verified,created_at,expires_at) VALUES(?,?,0,?,?,?)').bind(createHash('sha256').update(token).digest('hex'),id,mfa?1:0,Date.now(),Date.now()+3600000).run();return {id,username:'qa.'+id,cookie:'__Host-managelove='+token};}
 const admin=await account('admin'),member=await account('member'),unverifiedAdmin=await account('admin',false);
 const details={name:'Fictional Guest',birthDate:'1996-04-15',mobile:'9999999988',gender:'male',community:'Gaur',gotra:'Unknown',city:'Maihar',country:'',state:'',district:'',education:'Graduate',profession:'Teacher',height:175,maritalStatus:'Never married',about:'Fictional biodata for isolated submission testing.',managedBy:'Self',language:'Hindi',consent:true,termsAccepted:true,turnstile:'test'};
 async function post(body,cookie='',photos=[],ip=randomUUID(),requestOrigin=origin){const form=new FormData();form.set('details',JSON.stringify(body));photos.forEach(p=>form.append('photo',new File([p],'photo.png',{type:'image/png'})));const r=await runtime.dispatchFetch(origin+'/api/submissions',{method:'POST',headers:{Origin:requestOrigin,'CF-Connecting-IP':ip,...(cookie?{Cookie:cookie}:{})},body:form});return {status:r.status,data:await r.json()};}
 async function call(path,cookie='',method='GET',body){const r=await runtime.dispatchFetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
 function birthAt(years,offset=0){const d=new Date(Date.now()+19800000);d.setUTCFullYear(d.getUTCFullYear()-years);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
 for(const [gender,years,offset,status] of [['female',18,0,201],['female',18,1,400],['female',17,0,400],['male',21,0,201],['male',21,1,400],['male',20,0,400],['female',71,0,400]]){eq((await post({...details,gender,birthDate:birthAt(years,offset)},admin.cookie)).status,status);}
 const page=await runtime.dispatchFetch(origin+'/post');eq(page.status,200);const html=await page.text();eq(html.includes('9131591131'),true);eq(html.includes('name="password"'),false);
 eq((await post({...details,turnstile:''})).status,403);
 eq((await post({...details,consent:false})).status,400);
 eq((await post({...details,references:[{name:'Incomplete'}]})).status,400);
 eq((await post(details,'',[],'origin-test','https://example.org')).status,403);
 eq((await post(details,'',[new Uint8Array([1,2,3])])).status,400);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWP48OHDfxBmgDEAiNQPPY9NJdMAAAAASUVORK5CYII=','base64');
 const guest=await post({...details,approvalStatus:'approved'},'', [png]);eq(guest.status,201);eq(guest.data.approvalStatus,'pending');
 const row=await db.prepare('SELECT owner,data,photo_key FROM profiles WHERE id=?').bind(guest.data.profileId).first();eq(JSON.parse(row.data).referenceCount,0);eq(JSON.parse(row.data).publicListing,false);
 eq((await db.prepare('SELECT status,password_hash,mobile FROM portal_accounts WHERE id=?').bind(row.owner).first()),{status:'invited',password_hash:null,mobile:null});
 const contact=await call('/api/admin/members?id='+row.owner,admin.cookie);eq(contact.status,200);eq(contact.data.member.mobile,'+919999999988');
 eq((await call('/api/admin/members?id='+row.owner,member.cookie)).status,403);
 eq((await runtime.dispatchFetch(origin+'/api/photo/'+row.photo_key)).status,401);
 eq((await call('/api/admin/members',admin.cookie)).status,200);
 const ref={name:'Fictional Reference',relationship:'Friend',phone:'+919999999991',consent:true};
 const direct=await post({...details,references:[ref]},admin.cookie);eq(direct.status,201);eq(direct.data.approvalStatus,'approved');
 eq((await db.prepare("SELECT COUNT(*) AS n FROM admin_actions WHERE target=? AND action='create_profile'").bind(direct.data.profileId).first()).n,1);
 const noMfa=await post(details,unverifiedAdmin.cookie);eq(noMfa.status,201);eq(noMfa.data.approvalStatus,'pending');
 const duplicate=await post({...details,references:[ref,ref]},admin.cookie);eq(duplicate.status,400);
 const editor=await account('member');
 eq((await call('/api/profile',editor.cookie,'POST',{...details,references:[]})).status,200);
 eq((await call('/api/profile',editor.cookie,'POST',{...details,references:[ref]})).status,200);
 eq((await call('/api/profile',editor.cookie,'POST',{...details,references:[ref,{...ref,phone:'+919999999992'}]})).status,200);
 eq((await call('/api/profile',editor.cookie,'POST',{...details,references:[ref,ref]})).status,400);
 const editorState=await call('/api/state',editor.cookie);eq(editorState.data.own.referenceCount,2);
 const adminPost=await post({...details,references:[ref],publicListing:true},admin.cookie);eq(adminPost.status,201);eq(adminPost.data.approvalStatus,'approved');
 const adminRow=await db.prepare('SELECT data FROM profiles WHERE id=?').bind(adminPost.data.profileId).first();eq(JSON.parse(adminRow.data).publicListing,true);
 eq((await db.prepare("SELECT COUNT(*) AS n FROM admin_actions WHERE target=? AND action='create_profile'").bind(adminPost.data.profileId).first()).n,1);
 eq((await runtime.dispatchFetch(origin+'/admin/post',{headers:{Cookie:admin.cookie}})).status,200);
 eq((await runtime.dispatchFetch(origin+'/admin/post',{headers:{Cookie:unverifiedAdmin.cookie}})).status,307);
 const deleteBody={id:member.id,confirmation:member.username,reason:'Remove fictional account for testing'};
 eq((await call('/api/admin/members',member.cookie,'DELETE',deleteBody)).status,403);
 eq((await call('/api/admin/members',admin.cookie,'DELETE',{...deleteBody,confirmation:'wrong'})).status,400);
 eq((await call('/api/admin/members',admin.cookie,'DELETE',{...deleteBody,id:admin.id,confirmation:admin.username})).status,404);
 eq((await call('/api/admin/members',admin.cookie,'DELETE',deleteBody)).status,200);
 eq((await db.prepare('SELECT COUNT(*) AS n FROM portal_sessions WHERE account_id=?').bind(member.id).first()).n,0);
 const directAccount=await db.prepare('SELECT username FROM portal_accounts WHERE id=?').bind(direct.data.memberId).first();
 eq((await call('/api/admin/members',admin.cookie,'DELETE',{id:direct.data.memberId,confirmation:directAccount.username,reason:deleteBody.reason})).status,409);
 eq((await call('/api/admin/profiles',admin.cookie,'DELETE',{id:guest.data.profileId,confirmation:details.name,reason:deleteBody.reason})).status,200);
 eq((await db.prepare('SELECT COUNT(*) AS n FROM portal_photos WHERE key=?').bind(row.photo_key).first()).n,0);
 eq((await call('/api/admin/profiles',admin.cookie,'DELETE',{id:direct.data.profileId,confirmation:details.name,reason:deleteBody.reason})).status,200);
 eq((await call('/api/admin/members',admin.cookie,'DELETE',{id:direct.data.memberId,confirmation:directAccount.username,reason:deleteBody.reason})).status,200);
 eq((await db.prepare('SELECT COUNT(*) AS n FROM submission_contacts WHERE owner=?').bind(direct.data.memberId).first()).n,0);
 const limitIp=randomUUID();for(let i=0;i<5;i++)eq((await post({...details,turnstile:''},'',[],limitIp)).status,403);eq((await post(details,'',[],limitIp)).status,429);
 console.log(`PASS: ${checks} guest/admin posting and deletion checks`);
}finally{await runtime.dispose();}
