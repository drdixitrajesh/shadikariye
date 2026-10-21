import sharp from 'sharp';
import {createHash} from 'node:crypto';

// Vector lettering avoids dependence on fonts installed in the container.
const glyphs={
  A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],I:['11111','00100','00100','00100','00100','00100','11111'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','11001','10101','10011','10011','10001'],P:['11110','10001','10001','11110','10000','10000','10000'],R:['11110','10001','10001','11110','10100','10010','10001'],T:['11111','00100','00100','00100','00100','00100','00100'],V:['10001','10001','10001','10001','10001','01010','00100'],
  0:['01110','10001','10011','10101','11001','10001','01110'],1:['00100','01100','00100','00100','00100','00100','01110'],2:['01110','10001','00001','00010','00100','01000','11111'],3:['11110','00001','00001','01110','00001','00001','11110'],4:['00010','00110','01010','10010','11111','00010','00010'],5:['11111','10000','10000','11110','00001','00001','11110'],6:['01110','10000','10000','11110','10001','10001','01110'],7:['11111','00001','00010','00100','01000','01000','01000'],8:['01110','10001','10001','01110','10001','10001','01110'],9:['01110','10001','10001','01111','00001','00001','01110']
};
function lettering(label){let path='';for(let i=0;i<label.length;i++)for(let y=0;y<7;y++)for(let x=0;x<5;x++)if(glyphs[label[i]]?.[y]?.[x]==='1')path+=`M${i*6+x} ${y}h1v1h-1z`;return path;}
export function watermarkSvg(width,height,viewerTag){
  if(!/^[a-f0-9]{10}$/.test(viewerTag))throw new Error('Invalid private viewer tag');
  const scale=Math.max(.25,Math.min(3,width/100)),tileWidth=90*scale,tileHeight=48*scale;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><pattern id="mark" width="${tileWidth}" height="${tileHeight}" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><g transform="translate(${8*scale} ${8*scale}) scale(${scale})" fill="white" stroke="#452538" stroke-width=".22" opacity=".36"><path d="${lettering('VEDIK MILAN')}"/><path transform="translate(0 12) scale(.8)" d="${lettering('PRIVATE')}"/><path transform="translate(0 23) scale(.8)" d="${lettering(viewerTag.toUpperCase())}"/></g></pattern></defs><rect width="100%" height="100%" fill="url(#mark)"/></svg>`);
}
export function createPhotoProtection(){
  const cache=new Map();let cacheBytes=0;
  let active=0;const waiting=[];
  async function acquire(){if(active<2){active++;return;}if(waiting.length>=12)throw new Error('Protected photo service is busy');await new Promise(resolve=>waiting.push(resolve));}
  function release(){const next=waiting.shift();if(next)next();else active--;}
  return {async render(body,viewerTag){
    const source=Buffer.from(body),key=createHash('sha256').update(source).update(viewerTag).digest('hex');
    if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value.slice().buffer;}
    await acquire();try{
    const prepared=await sharp(source,{limitInputPixels:4096*4096,animated:false,failOn:'error'}).rotate().resize({width:900,height:1100,fit:'inside',withoutEnlargement:true}).flatten({background:'#faf9f6'}).toBuffer({resolveWithObject:true});
    const marked=await sharp(prepared.data).composite([{input:watermarkSvg(prepared.info.width,prepared.info.height,viewerTag)}]).jpeg({quality:78,mozjpeg:true}).toBuffer();
    const bytes=Uint8Array.from(marked);cache.set(key,bytes);cacheBytes+=bytes.byteLength;
    while(cache.size>64||cacheBytes>16*1024*1024){const oldest=cache.keys().next().value;cacheBytes-=cache.get(oldest).byteLength;cache.delete(oldest);}
    return bytes.slice().buffer;
    }finally{release();}
  }};
}
