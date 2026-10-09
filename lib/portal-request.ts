export class RequestLimitError extends Error {}
// Count actual streamed bytes. Content-Length is not trusted and multipart is
// not parsed until the entire request has passed its small, fixed budget.
export async function boundedPortalRequest(request:Request){
  if(!['POST','PATCH','PUT','DELETE'].includes(request.method)||!request.body)return request;
  const photo=new URL(request.url).pathname==='/api/photo';
  const limit=photo?280000:16384;
  if(Number(request.headers.get('content-length')??0)>limit)throw new RequestLimitError();
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let total=0;
  for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit){await reader.cancel();throw new RequestLimitError();}chunks.push(value);}
  const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
  return new Request(request,{body:bytes});
}
