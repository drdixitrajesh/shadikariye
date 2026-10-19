import assert from 'node:assert/strict';
import {readFileSync,existsSync,realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

const sourcePath=new URL('../lib/portal-photos.ts',import.meta.url);
assert.ok(existsSync(sourcePath),'Private D1 photo adapter must exist');
const source=ts.transpileModule(readFileSync(sourcePath,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {sanitizePhoto,createPhotoStore,PhotoValidationError,PhotoQuotaError,MAX_PHOTO_BYTES,MAX_PHOTO_STORAGE_BYTES}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const require=createRequire(import.meta.url);
const mfPath=require.resolve('miniflare',{paths:[realpathSync('node_modules/wrangler')]});
const {Miniflare}=await import(pathToFileURL(mfPath).href);
const sharp=(await import(pathToFileURL(require.resolve('sharp',{paths:[mfPath]})).href)).default;
const image=sharp({create:{width:2,height:3,channels:3,background:'#66aa88'}});
const originalPng=await image.clone().png().toBuffer(),jpeg=await image.clone().jpeg().toBuffer(),webp=await image.clone().webp().toBuffer();
const pngParts=[originalPng.subarray(0,8)];
for(let p=8;p<originalPng.length;){const end=p+12+originalPng.readUInt32BE(p);if(['IHDR','IDAT','IEND'].includes(originalPng.toString('ascii',p+4,p+8)))pngParts.push(originalPng.subarray(p,end));p=end;}
const png=Buffer.concat(pngParts);
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function pngChunk(type,data){const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length,0);b.write(type,4);data.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,-4)),b.length-4);return b;}
function withPngChunk(type,data){return Buffer.concat([png.subarray(0,33),pngChunk(type,data),png.subarray(33)]);}
function riff(chunks){const body=Buffer.concat(chunks);const header=Buffer.alloc(12);header.write('RIFF');header.writeUInt32LE(body.length+4,4);header.write('WEBP',8);return Buffer.concat([header,body]);}
function webpChunk(type,data){const b=Buffer.alloc(8+data.length+(data.length%2));b.write(type);b.writeUInt32LE(data.length,4);data.copy(b,8);return b;}
const extended=Buffer.from([0x2c,0,0,0,1,0,0,2,0,0]);
const privateWebp=riff([webpChunk('VP8X',extended),webpChunk('ICCP',Buffer.from('private profile')),webp.subarray(12),webpChunk('EXIF',Buffer.from('private GPS')),webpChunk('XMP ',Buffer.from('private name'))]);
const privateJpeg=Buffer.concat([jpeg.subarray(0,2),Buffer.from([0xff,0xe1,0,13]),Buffer.from('private GPS'),Buffer.from([0xff,0xfe,0,14]),Buffer.from('private name'),jpeg.subarray(2)]);

for(const [mime,data] of [['image/png',png],['image/jpeg',jpeg],['image/webp',webp]]){
  test('accepts genuine '+mime,()=>{const clean=sanitizePhoto(data);assert.equal(clean.mime,mime);assert.ok(clean.bytes.length>0);});
  test('rejects trailing or truncated '+mime,()=>{assert.throws(()=>sanitizePhoto(Buffer.concat([data,Buffer.from('payload')])),PhotoValidationError);assert.throws(()=>sanitizePhoto(data.subarray(0,-1)),PhotoValidationError);});
}
test('removes PNG text, EXIF, ICC and unknown ancillary metadata',()=>{for(const type of ['tEXt','eXIf','iCCP','aaAa']){const clean=sanitizePhoto(withPngChunk(type,Buffer.from('private GPS')));assert.deepEqual(Buffer.from(clean.bytes),png);}});
test('rejects PNG invalid CRC and unknown critical chunks',()=>{const corrupt=Buffer.from(png);corrupt[20]^=1;assert.throws(()=>sanitizePhoto(corrupt),PhotoValidationError);assert.throws(()=>sanitizePhoto(withPngChunk('ABCD',Buffer.from('payload'))),PhotoValidationError);});
test('removes JPEG APP and comment metadata',()=>{const clean=sanitizePhoto(privateJpeg);assert.ok(!Buffer.from(clean.bytes).includes(Buffer.from('private')));assert.equal(clean.mime,'image/jpeg');});
test('removes WebP metadata and clears extended metadata flags',()=>{const clean=sanitizePhoto(privateWebp);assert.ok(!Buffer.from(clean.bytes).includes(Buffer.from('private')));assert.equal(clean.bytes[20],0);assert.equal(Buffer.from(clean.bytes).readUInt32LE(4),clean.bytes.length-8);});
test('rejects malformed WebP chunk lengths and animation',()=>{const broken=Buffer.from(webp);broken.writeUInt32LE(0xfffffff0,16);assert.throws(()=>sanitizePhoto(broken),PhotoValidationError);const animated=Buffer.from(privateWebp);animated[20]|=2;assert.throws(()=>sanitizePhoto(animated),PhotoValidationError);});
test('rejects inconsistent WebP metadata declarations and chunk ordering',()=>{const missingFlags=Buffer.from(privateWebp);missingFlags[20]=0;assert.throws(()=>sanitizePhoto(missingFlags),PhotoValidationError);assert.throws(()=>sanitizePhoto(riff([webpChunk('VP8X',extended),webp.subarray(12),webpChunk('ICCP',Buffer.from('profile')),webpChunk('EXIF',Buffer.from('GPS')),webpChunk('XMP ',Buffer.from('name'))])),PhotoValidationError);});
test('sanitized pictures decode and preserve transparency',async()=>{for(const bytes of [privateJpeg,withPngChunk('eXIf',Buffer.from('GPS')),privateWebp]){const clean=sanitizePhoto(bytes);const info=await sharp(clean.bytes).metadata();assert.equal(info.width,2);assert.equal(info.height,3);}for(const format of ['png','webp']){const transparent=await sharp({create:{width:2,height:3,channels:4,background:{r:10,g:20,b:30,alpha:0.5}}})[format]().toBuffer();const clean=sanitizePhoto(transparent);const info=await sharp(clean.bytes).metadata();assert.equal(info.hasAlpha,true);}const lossless=await image.clone().webp({lossless:true}).toBuffer();assert.equal((await sharp(sanitizePhoto(lossless).bytes).metadata()).width,2);});
test('rejects oversized dimensions in all formats',()=>{const hugePng=Buffer.from(png);hugePng.writeUInt32BE(4097,16);hugePng.writeUInt32BE(crc32(hugePng.subarray(12,29)),29);assert.throws(()=>sanitizePhoto(hugePng),PhotoValidationError);const hugeJpeg=Buffer.from(jpeg);const sof=hugeJpeg.indexOf(Buffer.from([0xff,0xc0]));assert.ok(sof>0);hugeJpeg.writeUInt16BE(4097,sof+7);assert.throws(()=>sanitizePhoto(hugeJpeg),PhotoValidationError);const hugeWebp=Buffer.from(privateWebp);hugeWebp.writeUIntLE(4096,24,3);assert.throws(()=>sanitizePhoto(hugeWebp),PhotoValidationError);});
test('rejects unsupported signatures and over 256 KiB before sanitization',()=>{assert.throws(()=>sanitizePhoto(Buffer.from('<svg></svg>')),PhotoValidationError);assert.throws(()=>sanitizePhoto(Buffer.alloc(MAX_PHOTO_BYTES+1)),PhotoQuotaError);assert.equal(MAX_PHOTO_BYTES,262144);assert.equal(MAX_PHOTO_STORAGE_BYTES,41943040);});

test('D1 adapter stores sanitized bytes, detects MIME and deletes privately',async()=>{
  const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-05-15',d1Databases:{DB:'photos'}});
  try{const db=await mf.getD1Database('DB');await db.prepare('CREATE TABLE portal_photos(key TEXT PRIMARY KEY,body BLOB NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL CHECK(size >= 0 AND size <= 262144))').run();const store=createPhotoStore(db);
    await store.put('first',withPngChunk('eXIf',Buffer.from('private GPS')),{httpMetadata:{contentType:'text/html'}});const saved=await store.get('first');assert.equal(saved.httpMetadata.contentType,'image/png');assert.deepEqual(Buffer.from(saved.body),png);assert.equal(await store.get('missing'),null);
    await store.put('second',jpeg);await store.delete(['first','second']);assert.equal(await store.get('first'),null);assert.equal(await store.get('second'),null);await store.delete('missing');
    await assert.rejects(store.put('large',Buffer.alloc(MAX_PHOTO_BYTES+1)),PhotoQuotaError);await assert.rejects(store.put('bad',Buffer.from('invalid image')),PhotoValidationError);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM portal_photos').first()).n,0);
    await db.prepare('WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<159) INSERT INTO portal_photos SELECT CAST(i AS TEXT),zeroblob(262144),\'image/png\',262144 FROM n').run();const remaining=MAX_PHOTO_STORAGE_BYTES-159*MAX_PHOTO_BYTES-png.length;await db.prepare('INSERT INTO portal_photos VALUES(?,zeroblob(?),?,?)').bind('filler',remaining,'image/png',remaining).run();
    const concurrent=await Promise.allSettled([store.put('a',png),store.put('b',png)]);assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);const rejected=concurrent.find(x=>x.status==='rejected');assert.ok(rejected.reason instanceof PhotoQuotaError);assert.equal(rejected.reason.status,413);assert.equal((await db.prepare('SELECT SUM(size) AS n FROM portal_photos').first()).n,MAX_PHOTO_STORAGE_BYTES);
    const key=concurrent[0].status==='fulfilled'?'a':'b';await store.put(key,png);await assert.rejects(store.put('still-full',png),PhotoQuotaError);await store.delete(key);await store.put('released',png);assert.ok(await store.get('released'));
  }finally{await mf.dispose();}
});
