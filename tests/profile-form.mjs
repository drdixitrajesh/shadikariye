// Full form entry in an isolated database: no production accounts or posts.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import sharp from 'sharp';
import {createNodePortalRuntime} from './node-portal-runtime.mjs';
const origin='https://vedik-milan.softinator.org';
const runtime=await createNodePortalRuntime({bindings:{STANDALONE_MODE:'test-portal',REQUIRE_ACCOUNT_MOBILE:'1',PUBLIC_REGISTRATION:'1',PORTAL_KEY:'a'.repeat(64)},outboundService:()=>{throw Error('Unexpected outbound request');}});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
let checks=0;const evidence=[];
const eq=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
async function call(path,cookie,body){const response=await runtime.dispatchFetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
try{
  const db=await runtime.getD1Database();
  for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
  async function account(role,mobile){const id=randomUUID(),token=randomBytes(32).toString('hex');await db.prepare("INSERT INTO portal_accounts(id,username,role,status,test_account,created_at,mobile) VALUES(?,?,?,'active',0,?,?)").bind(id,'qa.'+id,role,Date.now(),mobile).run();await db.prepare('INSERT INTO portal_sessions(token_hash,account_id,session_version,mfa_verified,created_at,expires_at) VALUES(?,?,0,1,?,?)').bind(createHash('sha256').update(token).digest('hex'),id,Date.now(),Date.now()+3600000).run();return {id,token,cookie:'__Host-managelove='+token};}
  const admin=await account('admin','+919000000000');
  const viewer=await account('member','+919000000001');
  mkdirSync('outputs/profile-form',{recursive:true});
  for(const width of [1280,390]){
    const owner=await account('member','+91900000'+String(width).padStart(4,'0'));
    const context=await browser.newContext({viewport:{width,height:900}});
    await context.addCookies([{name:'__Host-managelove',value:owner.token,url:origin,secure:true,httpOnly:true,sameSite:'Lax'}]);
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.fulfill({status:204,body:''});
      const file=resolve('dist/client','.'+decodeURIComponent(url.pathname));
      if(file.startsWith(resolve('dist/client')+'/')||file.startsWith(resolve('dist/client')+'\\')){
        if(existsSync(file)&&extname(file))return route.fulfill({status:200,body:readFileSync(file),contentType:({'.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]??'application/octet-stream'});
      }
      const response=await runtime.dispatchFetch(url.href,{method:request.method(),headers:await request.allHeaders(),...(request.postDataBuffer()?{body:request.postDataBuffer()}:{})});
      await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
    });
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/?createProfile=1',{waitUntil:'networkidle'});
    const form=page.locator('.profile-form');await form.waitFor({state:'visible'});
    const choose=async(label,option)=>{await form.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name:option,exact:true}).click();};
    const next=()=>form.locator('.form-footer button[type="submit"]').click();
    await next();eq(await form.locator('.form-steps .current').textContent(),'1परिचय');
    const name='Fictional Form QA '+width;
    await page.locator('#profile-name').fill(name);
    await choose('प्रोफ़ाइल संभालने वाला','माता-पिता');
    await choose('वर या वधू',width===1280?'वर':'वधू');
    await page.locator('#profile-birth').fill('1994-04-15');await page.locator('#identity-suffix').fill('4567');
    await page.locator('#profile-email').fill('fictional.form'+width+'@example.invalid');
    const location=form.locator('.location-fields');await location.getByRole('combobox',{name:'देश',exact:true}).selectOption('India');
    await location.getByRole('combobox',{name:'राज्य / प्रांत',exact:true}).locator('option[value="Madhya Pradesh"]').waitFor({state:'attached'});
    await location.getByRole('combobox',{name:'राज्य / प्रांत',exact:true}).selectOption('Madhya Pradesh');
    await location.getByRole('combobox',{name:'ज़िला / काउंटी',exact:true}).selectOption('Indore');
    await page.locator('#profile-city').fill('Indore');await page.locator('#profile-height').fill('170');
    await location.scrollIntoViewIfNeeded();await page.screenshot({path:`outputs/profile-form/basics-${width}.png`,animations:'disabled'});await next();
    await choose('ब्राह्मण समुदाय','गौड़');await choose('गोत्र','भारद्वाज');
    await choose('वैवाहिक स्थिति','अविवाहित');await choose('मातृभाषा','हिंदी');
    await page.locator('#profile-education').fill('M.Sc. Test Education');await page.locator('#profile-profession').fill('Fictional Teacher');await next();
    const about='This is a fictional adult profile for an isolated end-to-end form test. No real personal information is included.';
    await page.locator('#profile-about').fill(about);
    for(let i=0;i<2;i++){
      await page.locator('#reference-'+i+'-name').fill('Fictional Reference '+(i+1));
      await page.locator('#reference-'+i+'-relationship').fill(i?'Relative':'Friend');
      await page.locator('#reference-'+i+'-phone').fill('+919999999991');
      await page.locator('.references-form fieldset').nth(i).locator('input[type="checkbox"]').check();
    }
    for(let i=0;i<5;i++){
      const photo=await sharp({create:{width:120,height:160,channels:3,background:['#c6a899','#a9bac5','#b2c5a9','#c5b3d1','#d5c69c'][i]}}).jpeg().toBuffer();
      await page.locator('#profile-photo-'+i).setInputFiles({name:'fictional-'+i+'.jpg',mimeType:'image/jpeg',buffer:photo});
      await page.locator('.photo-upload').nth(i).locator('small').waitFor({state:'visible'});
    }
    await page.locator('.public-listing-consent input').check();await page.locator('.terms-check input').check();await page.locator('.consent [data-slot="checkbox"]').click();
    let response=page.waitForResponse(r=>r.url().endsWith('/api/profile')&&r.request().method()==='POST');await next();eq((await response).status(),400);
    assert.match(await form.locator('.form-error').innerText(),/दो अलग रेफरेंस/);checks++;
    eq((await call('/api/state',owner.cookie)).data.own,null);
    await page.locator('#reference-1-phone').fill('+919999999992');
    await page.locator('.references-form').scrollIntoViewIfNeeded();await page.screenshot({path:`outputs/profile-form/references-${width}.png`,animations:'disabled'});
    response=page.waitForResponse(r=>r.url().endsWith('/api/profile')&&r.request().method()==='POST');await next();eq((await response).status(),200);
    await page.locator('.photo-upload img').nth(4).waitFor({state:'visible'});
    let state=(await call('/api/state',owner.cookie)).data;const saved=state.own;
    const expected={name,email:'fictional.form'+width+'@example.invalid',gender:width===1280?'male':'female',managedBy:'Parent',country:'India',state:'Madhya Pradesh',district:'Indore',city:'Indore',height:170,community:'Gaur',gotra:'Bharadwaj',education:'M.Sc. Test Education',profession:'Fictional Teacher',maritalStatus:'Never married',language:'Hindi',about,publicListing:true,approvalStatus:'pending'};
    for(const [key,value] of Object.entries(expected))eq(saved[key],value);
    eq(saved.photoSlots.length,5);eq(state.ownPrivate.references.length,2);eq(state.ownPrivate.birthDate,'1994-04-15');eq(state.ownPrivate.aadhaarLast4,'4567');
    for(const reference of state.ownPrivate.references)eq(reference.consent,true);
    eq((await call('/api/state')).data.profiles.some(p=>p.id===saved.id),false);
    eq((await call('/api/admin/profiles/review',admin.cookie,{id:saved.id,decision:'approved',reviewToken:saved.reviewToken})).status,200);
    const publicProfile=(await call('/api/state')).data.profiles.find(p=>p.id===saved.id);eq(publicProfile.country,'India');eq(publicProfile.photoKeys.length,5);eq('email' in publicProfile,false);eq('references' in publicProfile,false);eq('birthDate' in publicProfile,false);
    for(const key of publicProfile.photoKeys){const photo=await runtime.dispatchFetch(origin+'/api/photo/'+key);eq(photo.status,200);eq(photo.headers.get('x-photo-protection'),'watermark-v1');}
    const member=(await call('/api/state',viewer.cookie)).data.profiles.find(p=>p.id===saved.id);eq(member.district,'Indore');
    await page.goto(origin+'/?createProfile=1',{waitUntil:'networkidle'});
    eq(await page.locator('#profile-name').inputValue(),name);eq(await page.locator('#profile-name').isDisabled(),true);eq(await page.locator('#profile-birth').isDisabled(),true);
    eq(await page.locator('.location-fields').getByRole('combobox',{name:'ज़िला / काउंटी',exact:true}).inputValue(),'Indore');
    await form.locator('.form-steps button').nth(2).click();eq(await page.locator('#profile-about').inputValue(),about);
    eq(await page.locator('#reference-1-phone').inputValue(),'+919999999992');eq(await page.locator('.photo-upload img').count(),5);
    eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);eq(errors,[]);
    evidence.push({width,allFieldsPersisted:true,photos:5,references:2,duplicateReferenceRejected:true,approvalAndVisibility:true,watermarkedPhotos:true,reload:true,clientErrors:errors});await context.close();
  }
  writeFileSync('outputs/profile-form/verification.json',JSON.stringify({checks,evidence},null,2));console.log(`${checks} full profile form browser/API checks passed (desktop and mobile).`);
}finally{await browser.close();await runtime.dispose();}
