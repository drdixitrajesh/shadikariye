import {DurableObject} from 'cloudflare:workers';
import {scrypt,randomBytes,timingSafeEqual} from 'node:crypto';
const N=32768,r=8,p=3;
function derive(password:string,salt:string):Promise<Buffer>{return new Promise((resolve,reject)=>scrypt(password,salt,64,{N,r,p,maxmem:64*1024*1024},(e,key)=>e?reject(e):resolve(key)));}
// Only an internal namespace binding can reach this service. No public route is
// exposed. CPU-intensive password hashing uses the Free SQLite DO CPU allowance.
export class PortalPasswordService extends DurableObject {
  async fetch(request:Request){
    if(request.method!=='POST')return new Response(null,{status:405});
    const body=await request.json() as {password?:string;hash?:string;operation?:string};
    if(typeof body.password!=='string'||body.password.length>128)return new Response(null,{status:400});
    if(body.operation==='hash'){
      const salt=randomBytes(16).toString('hex');
      return Response.json({hash:`$scrypt$${N}$${r}$${p}$${salt}$${(await derive(body.password,salt)).toString('hex')}`});
    }
    const parts=(body.hash??'').split('$');
    const valid=parts.length===7&&parts[1]==='scrypt'&&parts[2]==='32768'&&parts[3]==='8'&&parts[4]==='3'&&/^[a-f0-9]{32}$/.test(parts[5])&&/^[a-f0-9]{128}$/.test(parts[6]);
    const salt=valid?parts[5]:'00000000000000000000000000000000';
    const expected=Buffer.from(valid?parts[6]:'00'.repeat(64),'hex');
    const actual=await derive(body.password,salt);
    return Response.json({ok:valid&&timingSafeEqual(actual,expected)});
  }
}
