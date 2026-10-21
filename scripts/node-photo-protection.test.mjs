import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createPhotoProtection,watermarkSvg} from './node-photo-protection.mjs';

test('served copies carry visible marks, vary by viewer and preserve the source',async()=>{
  const source=await sharp({create:{width:1200,height:1600,channels:3,background:'#b8a89a'}}).jpeg().toBuffer();
  const original=Buffer.from(source),service=createPhotoProtection();
  const a=Buffer.from(await service.render(source,'0123456789')),b=Buffer.from(await service.render(source,'abcdef0123'));
  assert.ok(source.equals(original));assert.ok(!a.equals(b));assert.ok(!a.equals(source));
  const meta=await sharp(a).metadata();assert.equal(meta.format,'jpeg');assert.ok(meta.width<=900&&meta.height<=1100);assert.equal(meta.exif,undefined);
  const {data}=await sharp(a).raw().toBuffer({resolveWithObject:true});
  let min=255,max=0;for(let i=0;i<data.length;i+=3){min=Math.min(min,data[i]);max=Math.max(max,data[i]);}assert.ok(max-min>15,'visible watermark pixels must differ from a uniform source');
  assert.ok(a.equals(Buffer.from(await service.render(source,'0123456789'))));
  await assert.rejects(()=>service.render(Buffer.from('corrupt'),'0123456789'));
  assert.throws(()=>watermarkSvg(900,1100,'<script>'));
});
