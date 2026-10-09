import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
let helpers;
test('activation token is consumed from the fragment and removed before any request',async()=>{
  assert.ok(existsSync('app/portal/helpers.ts'),'Portal helpers have been implemented');
  helpers=await import('../app/portal/helpers.ts');
  let replaced;
  const token='a'.repeat(43);
  assert.equal(helpers.consumeActivationToken({hash:'#token='+token,pathname:'/activate',search:'?tracking=private'},{replaceState:(...args)=>{replaced=args;}}),token);
  assert.deepEqual(replaced,[null,'','/activate']);
  assert.equal(helpers.consumeActivationToken({hash:'',pathname:'/activate',search:'?token='+token},{replaceState:()=>{}}),'');
});
test('activation password requires 16 through 128 characters and an exact confirmation',async()=>{
  assert.ok(existsSync('app/portal/helpers.ts'),'Portal helpers have been implemented');
  helpers??=await import('../app/portal/helpers.ts');
  assert.ok(helpers.passwordError('a'.repeat(15),'a'.repeat(15)));
  assert.equal(helpers.passwordError('a'.repeat(16),'a'.repeat(16)),'');
  assert.equal(helpers.passwordError('a'.repeat(128),'a'.repeat(128)),'');
  assert.ok(helpers.passwordError('a'.repeat(129),'a'.repeat(129)));
  assert.ok(helpers.passwordError('a'.repeat(16),'b'.repeat(16)));
});
test('photo fitting never enlarges an image and preserves its aspect ratio',async()=>{
  assert.ok(existsSync('app/portal/photo.ts'),'Photo preparation has been implemented');
  const {photoDimensions}=await import('../app/portal/photo.ts');
  assert.deepEqual(photoDimensions(4000,2000,1600),{width:1600,height:800});
  assert.deepEqual(photoDimensions(800,1200,1600),{width:800,height:1200});
  assert.deepEqual(photoDimensions(2000,4000,1600),{width:800,height:1600});
});
// Render the real components after TypeScript compilation, with actual React hooks
// (server rendering intentionally does not run browser effects).
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire,Module} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const nativeRequire=createRequire(import.meta.url),compiled=new Map();
function loadComponent(file){
  const filename=resolve(file);if(compiled.has(filename))return compiled.get(filename).exports;
  const mod=new Module(filename);compiled.set(filename,mod);mod.filename=filename;
  mod.require=name=>{if(name.startsWith('.')){const base=resolve(dirname(filename),name);return loadComponent(existsSync(base+'.tsx')?base+'.tsx':existsSync(base+'.ts')?base+'.ts':base);}return nativeRequire(name);};
  mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,filename);return mod.exports;
}
test('real activation form enforces new password bounds without rendering an invitation secret',()=>{
  const {CredentialsForm}=loadComponent('app/portal/client.tsx');
  const html=renderToStaticMarkup(React.createElement(CredentialsForm,{activation:true}));
  assert.match(html,/minLength="16"/);assert.match(html,/maxLength="128"/);
  assert.equal((html.match(/autoComplete="new-password"/g)??[]).length,2);
  assert.match(html,/single-use/);assert.match(html,/disabled=""/);
  assert.doesNotMatch(html,/portal-username/);
});
test('real login form offers invited account access and no public signup',()=>{
  const {CredentialsForm,PortalFrame}=loadComponent('app/portal/client.tsx');
  const html=renderToStaticMarkup(React.createElement(PortalFrame,{title:'Sign in'},React.createElement(CredentialsForm)));
  assert.match(html,/Invitation-only access/);assert.match(html,/There is no public registration/);
  assert.match(html,/autoComplete="username"/);assert.match(html,/autoComplete="current-password"/);
  assert.doesNotMatch(html,/signin-with-chatgpt|new-password/);
});
