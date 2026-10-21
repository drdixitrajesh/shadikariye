// The production server handles its image optimizer before application auth.
// This app uses ordinary protected <img> URLs, so disable that public shortcut.
export function disablePublicImageOptimizer(server){
  const handlers=server.listeners('request');
  server.removeAllListeners('request');
  server.on('request',function(request,response){
    let pathname;
    try{pathname=new URL(decodeURIComponent(new URL(request.url,'http://localhost').pathname),'http://localhost').pathname;}catch{pathname='';}
    if(pathname==='/_next/image'||pathname.startsWith('/_next/image/')){
      response.writeHead(403,{'Cache-Control':'private, no-store','Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff'});
      response.end('Image optimization is unavailable.');return;
    }
    for(const handler of handlers)handler.call(this,request,response);
  });
}
