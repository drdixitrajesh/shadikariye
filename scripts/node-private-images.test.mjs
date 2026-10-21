import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {disablePublicImageOptimizer} from './node-private-images.mjs';

test('the outer Node server denies image optimization before its public image handler',async()=>{
  let applicationCalls=0;
  const server=createServer((_request,response)=>{applicationCalls++;response.end('application');});
  disablePublicImageOptimizer(server);server.listen(0,'127.0.0.1');await once(server,'listening');
  const origin='http://127.0.0.1:'+server.address().port;
  try{
    for(const path of ['/_next/image?url=%2Fportraits.png&w=640&q=75','/_next%2Fimage?url=%2Fportraits.png','/_next/image/']){
      const response=await fetch(origin+path);assert.equal(response.status,403);assert.equal(response.headers.get('cache-control'),'private, no-store');
    }
    assert.equal(applicationCalls,0);
    assert.equal(await (await fetch(origin+'/login')).text(),'application');assert.equal(applicationCalls,1);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
