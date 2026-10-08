import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readdirSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';

const require=createRequire(import.meta.url);
const {Miniflare}=await import(require.resolve('miniflare',{paths:[realpathSync('node_modules/wrangler')]}));
const entry=resolve('dist/server/index.js');
function modules(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?modules(resolve(dir,f.name)):/\.m?js$/.test(f.name)?[{type:'ESModule',path:resolve(dir,f.name)}]:[]);}
const workerModules=modules(resolve('dist/server'));
workerModules.sort((a,b)=>a.path===entry?-1:b.path===entry?1:0);
const mf=new Miniflare({
  modules:workerModules,modulesRoot:resolve('dist/server'),
  modulesRules:[{type:'ESModule',include:['**/*.js','**/*.mjs']}],
  compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  bindings:{STANDALONE_MODE:'demo',ADMIN_EMAILS:'admin@example.com'},
  outboundService:()=>{throw new Error('Standalone demo must not invoke paid external services');},
});
const forged={'oai-authenticated-user-id':'admin','oai-authenticated-user-email':'admin@example.com'};
let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
try{
  for(const headers of [{},forged]){
    let r=await mf.dispatchFetch('https://managelove.com/');
    check(r.status===200,'Homepage renders without database or photo bindings');
    check((await r.text()).includes('सदस्य सेवाएं जल्द उपलब्ध होंगी'),'Homepage clearly explains the deployment mode');
    r=await mf.dispatchFetch('https://managelove.com/api/state',{headers});
    const state=await r.json();
    check(r.status===200&&state.profiles.length===6&&state.profiles.every(p=>p.demo),'Only fictional demos are available');
    check(!state.isAdmin&&!state.own&&!state.security.otpReady,'Forged identity never grants membership or administration');
    for(const path of ['/api/profile','/api/otp','/api/photo','/api/messages','/api/safety','/api/actions']){
      r=await mf.dispatchFetch('https://managelove.com'+path,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'});
      check(r.status===401||r.status===403,'Member writes are denied at '+path);
    }
    for(const method of ['GET','DELETE','PATCH']){
      r=await mf.dispatchFetch('https://managelove.com/api/admin/profiles',{method,headers});
      check(r.status===401||r.status===403,'Forged identity cannot administer profiles with '+method);
    }
  }
  for(const path of ['/signin-with-chatgpt','/signout-with-chatgpt','/callback']){
    const r=await mf.dispatchFetch('https://managelove.com'+path);
    check(r.status===503&&(await r.text()).includes('not available yet'),'Managed sign-in routes have an honest unavailable response');
  }
  for(const origin of ['http://managelove.com','https://www.managelove.com']){
    const r=await mf.dispatchFetch(origin+'/terms?lang=en',{redirect:'manual'});
    check(r.status===308&&r.headers.get('location')==='https://managelove.com/terms?lang=en','Canonical HTTPS redirects preserve the path and query');
  }
  console.log(`${checks} standalone deployment checks passed`);
}finally{await mf.dispose();}
