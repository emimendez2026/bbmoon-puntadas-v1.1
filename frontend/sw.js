const CACHE='bbmoon-v1.3.0';
const APP=['./','./index.html','./manifest.json','./css/styles.css','./js/core.js','./js/app-core.js','./js/app-stock-clients.js','./js/app-quotes-works.js','./js/app-management.js','./icon-192.png','./icon-512.png','./assets/logo_cuadrado.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
