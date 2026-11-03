const CACHE='punch-360-essential-v100-bento';
const FILES=['./','./index.html','./styles.css?v=essential-41','./styles.css?v=visual-taps-20261027','./app.js?v=essential-86-bento','./public-edition.js','./public-plan-intent.js','./public-signup-validation.js','./password-visibility.js','./essential-message-navigation.js','./essential-mobile-punch.js','./company-chat-context.js','./chat-unread.js','./qualified-coverage.js','./labor-budgets.js','./platform-users.js','./platform-price-proposals.js','./subscription-directory.js','./platform-directory.js','./invitation-email.js','./notification-preferences.js','./schedule-templates.js','./supervisor-approvals.js','./break-policies.js','./kiosk-offline.js','./kiosk-locale.js','./kiosk-offline-review.js','./essential-locale.js','./missing-days.js','./archives.js','./archive-codec.js','./archive-preflight.js','./essential.js','./platform-tests.js','./support.js','./platform-audit.js','./promotions.js','./platform-finance.js','./commercial.js','./break-corrections.js','./planning.js','./personal-calendar.js','./shift-absence.js','./weekly-availability.js','./schedule-preferences.js','./availability-reminders.js','./client-directory.js','./arrival-issues-controller.js','./arrival-issues.js','./multi-site-overview.js','./planned-client-report.js','./billing.js','./appearance.js','./hr.js','./communications.js','./payroll.js','./payroll-export.js','./idempotency.js','./themes.json','./essential.css?v=essential-44','./public-bento.css?v=bento-05-7','./essential.css?v=essential-42','./essential.css?v=essential-43','./kiosk.html','./kiosk.js?v=essential-44','./kiosk.css?v=essential-43','./kiosk.webmanifest','./kiosk-icon.svg','./journal.js','./passive-punch-refresh.js','./offline-identity.js','./essential-manager-approvals-summary.js','./essential-hours-view.js','./essential-hours-export.js','./hours-csv.js','./company-onboarding.js','./rpc-rejection.js','./worker-onboarding.js','./personal-client-visit.js','./missions.js','./navigation-choices.js','./company-workspaces.js','./boss-handoff.js','./restricted-management.js','./active-punch-break.js','./punch-sync-state.js','./platform-admins.js','./shift-client-sites.js','./mission-completion-request.js','./mission-day-review.js','./mission-batch-import.js','./mission-multiday-import.js','./mission-recurrence.js','./mission-issues.js','./mission-issue-decision.js','./mission-postpone.js','./mission-checklist.js','./mission-offline-queue.js','./mission-cancel.js','./mission-reassign.js','./mission-reschedule.js','./mission-upcoming.js','./essential-correction.js','./essential-leave.js','./vendor/supabase.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('punch-360-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// Only public assets from the install precache may be cached at runtime.
// Matching the full URL (including query string) prevents caching dynamic JSON,
// auth callbacks, or an unversioned/unknown asset with the same extension.
const PUBLIC_ASSETS=new Set(FILES.map(file=>new URL(file,self.registration.scope).href));
const OFFLINE_SHELLS=new Map([
 [new URL('./',self.registration.scope).pathname,'./index.html'],
 [new URL('./index.html',self.registration.scope).pathname,'./index.html'],
 [new URL('./kiosk.html',self.registration.scope).pathname,'./kiosk.html']
]);
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 const isPublicAsset=PUBLIC_ASSETS.has(url.href);
 // A known PWA entrypoint can fall back offline even with a navigation query.
 // Query-specific responses, including possible auth tokens, are never cached.
 const offlineShell=request.mode==='navigate'?OFFLINE_SHELLS.get(url.pathname):null;
 if(!isPublicAsset&&!offlineShell)return;
 event.respondWith((async()=>{
  try{
   const response=await fetch(request,{cache:'no-cache'});
   if(isPublicAsset&&response.ok){
    // Await the write within respondWith's promise so the fetch event stays
    // alive until the cache update completes. Storage failures must not hide
    // a valid network response.
    try{
     const copy=response.clone();
     const cache=await caches.open(CACHE);
     await cache.put(request,copy);
    }catch(_error){/* The network response remains usable without offline cache. */}
   }
   return response;
  }catch(_error){
   if(isPublicAsset){
    const cached=await caches.match(request);
    if(cached)return cached;
   }
   if(offlineShell)return await caches.match(offlineShell)||Response.error();
   return Response.error();
  }
 })());
});
