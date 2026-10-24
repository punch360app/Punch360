const CACHE='punch-360-plans-v5';
const FILES=['./','./index.html','./styles.css','./app.js','./journal.js','./vendor/supabase.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('punch-360-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// Cache only application code. Supabase auth/API requests and personal data are NEVER cached here.
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;const staticFile=url.pathname.endsWith('/')||/\.(html|js|css)$/.test(url.pathname);if(!staticFile)return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(async()=>await caches.match(event.request)||await caches.match('./index.html')));});
