// Run with pnpm exec tsx tests/privacy-shield.mjs. PLAYWRIGHT_MODULE may point
// to the workstation's bundled playwright/index.mjs when it is not installed here.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
import {renderToStaticMarkup} from 'react-dom/server';
import React from 'react';
import PhotoCopyGuard from '../app/photo-copy-guard.tsx';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const controller=ts.transpileModule(readFileSync('lib/privacy-shield.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace('export function','function');
const css=readFileSync('app/globals.css','utf8');
// Render the actual component; its hook effects are installed below in the browser.
const markup=renderToStaticMarkup(React.createElement(PhotoCopyGuard));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
mkdirSync('outputs/privacy-shield',{recursive:true});
try{
  for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
    const page=await browser.newPage({viewport});
    await page.setContent(`<html lang="hi"><head><style>${css}</style></head><body>${markup}<main><article class="profile-card"><h1>Fictional test profile</h1><input value="Editable form text"/><button id="background-button">View profile</button></article></main></body></html>`);
    await page.addScriptTag({content:controller+';window.cleanup=installPrivacyShield(document.querySelector("dialog"),"/");'});
    check(await page.locator('main').isVisible(),'normal content visible');
    const copy=await page.evaluate(()=>{
      const fire=(el,type)=>!el.dispatchEvent(new Event(type,{bubbles:true,cancelable:true}));
      return {photo:fire(document.querySelector('h1'),'copy'),input:fire(document.querySelector('input'),'copy'),drag:fire(document.querySelector('h1'),'dragstart')};
    });
    check(copy.photo&&copy.drag&&!copy.input,'copy blocked on profiles and allowed in forms');
    for(const shortcut of [ {key:'PrintScreen'}, {key:'s',metaKey:true,shiftKey:true}, {key:'4',metaKey:true,shiftKey:true}, {key:'s',ctrlKey:true,shiftKey:true} ]){
      await page.evaluate(shortcut=>document.dispatchEvent(new KeyboardEvent('keydown',{...shortcut,bubbles:true,cancelable:true})),shortcut);
      check(await page.locator('dialog').isVisible(),'shortcut opens curtain');
      check(await page.locator('main').evaluate(el=>getComputedStyle(el).visibility==='hidden'),'sensitive content hidden');
      await page.keyboard.press('Escape');
      check(await page.locator('dialog').isVisible(),'Escape does not reveal content');
      await page.locator('[data-privacy-resume]').click();
      check(await page.locator('main').isVisible(),'explicit resume restores content');
    }
    await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'PrintScreen',bubbles:true})));
    await page.screenshot({path:`outputs/privacy-shield/curtain-${viewport.width}.png`});
    check(await page.locator('dialog').evaluate(el=>getComputedStyle(el).backgroundColor==='rgb(0, 0, 0)'),'curtain is black');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    check(await page.locator('dialog').isVisible(),'focus alone cannot reveal content');
    await page.locator('[data-privacy-resume]').click();
    await page.evaluate(()=>{
      Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    check(!await page.locator('dialog').isVisible(),'hidden tab does not conceal content');
    await page.evaluate(()=>{
      Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    check(!await page.locator('dialog').isVisible(),'returning to a visible tab leaves content open');
    await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('pagehide'));document.dispatchEvent(new KeyboardEvent('keydown',{key:'p',ctrlKey:true}));});
    check(!await page.locator('dialog').isVisible(),'focus loss, pagehide and print shortcuts do not open the curtain');
    await page.emulateMedia({media:'print'});
    check(await page.locator('main').evaluate(el=>getComputedStyle(el).display==='none'),'print hides photo and data');
    await page.emulateMedia({media:'screen'});
    await page.evaluate(()=>{window.cleanup();window.cleanup=installPrivacyShield(document.querySelector('dialog'),'/login');document.dispatchEvent(new KeyboardEvent('keydown',{key:'PrintScreen',bubbles:true}));});
    check(!await page.locator('dialog').isVisible(),'login remains usable on focus loss');
    await page.evaluate(()=>{window.cleanup();document.dispatchEvent(new KeyboardEvent('keydown',{key:'PrintScreen',bubbles:true}));});
    check(!await page.locator('dialog').isVisible(),'cleanup removes listeners');
    await page.close();
  }
  console.log(`${checks} privacy curtain browser checks passed (desktop and mobile).`);
}finally{await browser.close();}
