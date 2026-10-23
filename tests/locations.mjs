import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {createNodePortalRuntime} from './node-portal-runtime.mjs';
const origin='https://vedik-milan.softinator.org';
const runtime=await createNodePortalRuntime({bindings:{STANDALONE_MODE:'test-portal',PUBLIC_REGISTRATION:'1',PORTAL_KEY:'a'.repeat(64)},outboundService:()=>{throw Error('Unexpected outbound request');}});
let checks=0,browser;
const eq=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
async function call(path,cookie,body){const r=await runtime.dispatchFetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
try{
  const db=await runtime.getD1Database();
  for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
  async function account(role){const id=randomUUID(),token=randomBytes(32).toString('hex');await db.prepare("INSERT INTO portal_accounts(id,username,role,status,test_account,created_at) VALUES(?,?,?,'active',0,?)").bind(id,'qa.'+id,role,Date.now()).run();await db.prepare('INSERT INTO portal_sessions(token_hash,account_id,session_version,mfa_verified,created_at,expires_at) VALUES(?,?,0,1,?,?)').bind(createHash('sha256').update(token).digest('hex'),id,Date.now(),Date.now()+3600000).run();return {id,token,cookie:'__Host-managelove='+token};}
  const owner=await account('member'),admin=await account('admin');
  const body={name:'Location QA Member',birthDate:'1996-04-15',aadhaarLast4:'',termsAccepted:true,references:[{name:'Fictional Reference One',relationship:'Friend',phone:'+919999999991',consent:true},{name:'Fictional Reference Two',relationship:'Friend',phone:'+919999999992',consent:true}],gender:'male',community:'Gaur',gotra:'Shandilya',city:'Indore',country:'India',state:'Madhya Pradesh',district:'Indore',education:'Graduate',profession:'Teacher',height:175,maritalStatus:'Never married',about:'This is a fictional profile for isolated location testing.',managedBy:'Self',language:'Hindi',consent:true,publicListing:true};
  let result=await call('/api/profile',owner.cookie,body);eq(result.status,200);
  const id=result.data.profile.id;
  for(const field of ['country','state','district'])eq(result.data.profile[field],body[field]);
  result=await call('/api/state',owner.cookie);eq(result.data.own.state,'Madhya Pradesh');eq(result.data.own.district,'Indore');
  eq((await call('/api/profile',owner.cookie,{...body,state:'California'})).status,400);
  eq((await call('/api/profile',owner.cookie,{...body,district:'Jaipur'})).status,400);
  eq((await call('/api/profile',owner.cookie,{...body,country:'Not a country'})).status,400);
  result=await call('/api/state',owner.cookie);eq(result.data.own.district,'Indore');
  eq((await call('/api/admin/profiles/review',admin.cookie,{id,decision:'approved',reviewToken:result.data.own.reviewToken})).status,200);
  result=await call('/api/state');eq(result.data.profiles.find(p=>p.id===id).country,'India');
  const detail=await call('/api/admin/members?id='+owner.id,admin.cookie);eq(detail.status,200);eq(detail.data.profile.district,'Indore');
  // A city-only older client can still save its profile, and adding location later works.
  const legacy=await account('member');const {country,state,district,...oldBody}=body;
  eq((await call('/api/profile',legacy.cookie,{...oldBody,name:'Legacy QA Member'})).status,200);
  eq((await call('/api/state',legacy.cookie)).data.own.country,'');
  for(const location of [{name:'Location Browser India',city:'Indore',country:'India',state:'Madhya Pradesh',district:'Indore',education:'Graduate',profession:'Teacher'},{name:'Location Browser US',city:'Los Angeles',country:'United States',state:'California',district:'Los Angeles County',education:'MBA',profession:'Designer'}]){
    await db.prepare('INSERT INTO profiles(id,owner,data,updated_at,published_at,expires_at) VALUES(?,?,?,?,?,?)').bind(randomUUID(),randomUUID(),JSON.stringify({...body,...location,approvalStatus:'approved',publicListing:true}),Date.now(),Date.now(),Date.now()+86400000).run();
  }
  if(process.env.LOCATION_BROWSER==='1'){
    const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
    browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
    mkdirSync('outputs/locations',{recursive:true});
    for(const width of [1280,390]){
      const context=await browser.newContext({viewport:{width,height:900}});
      await context.addCookies([{name:'__Host-managelove',value:owner.token,url:origin,secure:true,httpOnly:true,sameSite:'Lax'}]);
      await context.route('**/*',async route=>{
        const request=route.request(),url=new URL(request.url());
        if(url.origin!==origin)return route.fulfill({status:204,body:''});
        const staticFile=resolve('dist/client','.'+decodeURIComponent(url.pathname));
        if(staticFile.startsWith(resolve('dist/client')+'/')||staticFile.startsWith(resolve('dist/client')+'\\')){
          if(existsSync(staticFile)&&extname(staticFile))return route.fulfill({status:200,body:readFileSync(staticFile),contentType:({'.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'})[extname(staticFile)]??'application/octet-stream'});
        }
        const response=await runtime.dispatchFetch(url.href,{method:request.method(),headers:await request.allHeaders(),...(request.postDataBuffer()?{body:request.postDataBuffer()}:{})});
        await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
      });
      const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(origin,{waitUntil:'networkidle'});
      await page.locator('.profile-card').first().waitFor();
      if(width<700)await page.locator('.mobile-filter-button').click();
      const filters=page.locator(width<700?'.filter-sheet':'.filter-sidebar');
      await filters.getByRole('combobox',{name:'देश',exact:true}).selectOption('India');
      await filters.getByRole('combobox',{name:'राज्य / प्रांत',exact:true}).locator('option[value="Madhya Pradesh"]').waitFor({state:'attached'});
      await filters.getByRole('combobox',{name:'राज्य / प्रांत',exact:true}).selectOption('Madhya Pradesh');
      await filters.getByRole('combobox',{name:'ज़िला / काउंटी',exact:true}).selectOption('Indore');
      eq(await filters.getByRole('combobox',{name:'नाम',exact:true}).count(),0);
      await filters.getByRole('combobox',{name:'शहर',exact:true}).selectOption('Indore');
      await filters.getByRole('combobox',{name:'शिक्षा',exact:true}).selectOption('Graduate');
      await filters.getByRole('combobox',{name:'पेशा',exact:true}).selectOption('Teacher');
      eq(await page.locator('.profile-card').count(),1);
      assert.match(await page.locator('.profile-card').innerText(),/Location Browser India/);checks++;
      await filters.getByRole('combobox',{name:'देश',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:`outputs/locations/filters-${width}.png`,animations:'disabled'});
      if(width<700){await page.locator('.sheet-bottom .primary').click();await page.locator('.active-preferences button').click();}else{await filters.locator('.filter-head .text-button').click();}assert.ok(await page.locator('.profile-card').count()>1);checks++;

      await (await page.locator('.header-profile').isVisible()?page.locator('.header-profile'):page.getByRole('tab',{name:'मेरी प्रोफ़ाइल',exact:true})).click();
      const form=page.locator('.location-fields');await form.getByRole('combobox',{name:'देश',exact:true}).selectOption('United States');
      const stateSelect=form.getByRole('combobox',{name:'राज्य / प्रांत',exact:true});
      await stateSelect.locator('option[value="California"]').waitFor({state:'attached'});
      eq(await stateSelect.inputValue(),'');eq(await form.getByRole('combobox',{name:'ज़िला / काउंटी',exact:true}).inputValue(),'');
      await stateSelect.selectOption('California');await form.getByRole('combobox',{name:'ज़िला / काउंटी',exact:true}).selectOption('Los Angeles County');
      await form.getByRole('combobox',{name:'देश',exact:true}).selectOption('India');
      await stateSelect.locator('option[value="Madhya Pradesh"]').waitFor({state:'attached'});
      await stateSelect.selectOption('Madhya Pradesh');await form.getByRole('combobox',{name:'ज़िला / काउंटी',exact:true}).selectOption('Indore');
      await form.scrollIntoViewIfNeeded();await page.screenshot({path:`outputs/locations/form-${width}.png`,animations:'disabled'});
      await page.locator('.form-footer button[type="submit"]').click();await page.locator('.form-footer button[type="submit"]').click();
      await page.locator('.terms-check input').check();await page.locator('.consent [data-slot="checkbox"]').click();
      const saved=page.waitForResponse(r=>r.url().endsWith('/api/profile')&&r.request().method()==='POST');
      await page.locator('.form-footer button[type="submit"]').click();eq((await saved).status(),200);
      await page.reload({waitUntil:'networkidle'});await (await page.locator('.header-profile').isVisible()?page.locator('.header-profile'):page.getByRole('tab',{name:'मेरी प्रोफ़ाइल',exact:true})).click();
      eq(await page.locator('.location-fields').getByRole('combobox',{name:'राज्य / प्रांत',exact:true}).inputValue(),'Madhya Pradesh');
      await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));document.dispatchEvent(new Event('visibilitychange'));});eq(await page.locator('.privacy-screen').isVisible(),false);
      await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'PrintScreen',bubbles:true})));eq(await page.locator('.privacy-screen').isVisible(),true);
      eq(await page.locator('.privacy-screen-limit').count(),0);await page.locator('[data-privacy-resume]').click();
      eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);eq(errors,[]);
      await context.close();
    }
  }
  console.log(`${checks} location API/browser assertions passed.`);
}finally{await browser?.close();await runtime.dispose();}


