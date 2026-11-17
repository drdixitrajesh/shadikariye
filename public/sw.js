/* Only generic, public installation assets are cached. No API, photos or profile HTML. */
const CACHE='vedik-app-shell-v1';
const SHELL=['/offline.html','/icons/app-192.png','/icons/app-512.png','/icons/app-maskable.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('vedik-app-shell-')&&key!==CACHE).map(key=>caches.delete(key)))));});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    // Every navigation stays on the network; credentials and consent changes remain current.
    event.respondWith(fetch(request).catch(async()=>await caches.match('/offline.html')||new Response('इंटरनेट से जुड़कर फिर खोलें।',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}})));
  }else if(!url.search&&SHELL.includes(url.pathname))event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
});
