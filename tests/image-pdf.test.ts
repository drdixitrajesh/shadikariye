import {test} from 'node:test';
import assert from 'node:assert/strict';
import {imagePdf} from '../lib/image-pdf.ts';
test('PDF image streams and cross-reference offsets are byte accurate',()=>{const jpeg=new Uint8Array([255,216,0,5,255,217]);const bytes=imagePdf([{bytes:jpeg,width:1240,height:1754},{bytes:jpeg,width:1240,height:1754}]);const text=Buffer.from(bytes).toString('latin1');assert.match(text,/^%PDF-1.4/);assert.match(text,/\/Count 2/);const xref=Number(/startxref\n(\d+)/.exec(text)![1]);assert.equal(text.slice(xref,xref+4),'xref');const lines=text.slice(xref).split('\n');const count=Number(lines[1].split(' ')[1]);for(let id=1;id<count;id++){const offset=Number(lines[id+2].slice(0,10));assert.ok(text.slice(offset).startsWith(id+' 0 obj'),String(id));}assert.equal((text.match(/\/Length 6 >>\nstream/g)||[]).length,2);});
test('empty PDF is rejected',()=>assert.throws(()=>imagePdf([])));
