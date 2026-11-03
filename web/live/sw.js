const CACHE='punch-360-essential-v101-bento';
const FILES=['./','./index.html','./styles.css?v=essential-41','./styles.css?v=visual-taps-20261027','./app.js?v=essential-86-bento','./public-edition.js','./public-plan-intent.js','./public-signup-validation.js','./password-visibility.js','./essential-message-navigation.js','./essential-mobile-punch.js','./company-chat-context.js','./chat-unread.js','./qualified-coverage.js','./labor-budgets.js','./platform-users.js','./platform-price-proposals.js','./subscription-directory.js','./platform-directory.js','./invitation-email.js','./notification-preferences.js','./schedule-templates.js','./supervisor-approvals.js','./break-policies.js','./kiosk-offline.js','./kiosk-locale.js','./kiosk-offline-review.js','./essential-locale.js','./missing-days.js','./archives.js','./archive-codec.js','./archive-preflight.js','./essential.js','./platform-tests.js','./support.js','./platform-audit.js','./promotions.js','./platform-finance.js','./commercial.js','./break-corrections.js','./planning.js','./personal-calendar.js','./shift-absence.js','./weekly-availability.js','./schedule-preferences.js','./availability-reminders.js','./client-directory.js','./arrival-issues-controller.js','./arrival-issues.js','./multi-site-overview.js','./planned-client-report.js','./billing.js','./appearance.js','./hr.js','./communications.js','./payroll.js','./payroll-export.js','./idempotency.js','./themes.json','./essential.css?v=essential-44','./public-bento.css?v=bento-05-7','./essential.css?v=essential-42','./essential.css?v=essential-43','./kiosk.html','./kiosk.js?v=essential-44','./kiosk.css?v=essential-43','./kiosk.webmanifest','./kiosk-icon.svg','./journal.js','./passive-punch-refresh.js','./offline-identity.js','./essential-manager-approvals-summary.js','./essential-hours-view.js','./essential-hours-export.js','./hours-csv.js','./company-onboarding.js','./rpc-rejection.js','./worker-onboarding.js','./personal-client-visit.js','./missions.js','./navigation-choices.js','./company-workspaces.js','./boss-handoff.js','./restricted-management.js','./active-punch-break.js','./punch-sync-state.js','./platform-admins.js','./shift-client-sites.js','./mission-completion-request.js','./mission-day-review.js','./mission-batch-import.js','./mission-multiday-import.js','./mission-recurrence.js','./mission-issues.js','./mission-issue-decision.js','./mission-postpone.js','./mission-checklist.js','./mission-offline-queue.js','./mission-cancel.js','./mission-reassign.js','./mission-reschedule.js','./mission-upcoming.js','./essential-correction.js','./essential-leave.js','./vendor/supabase.js'];
// Only public installation assets can enter the runtime cache.
const PUBLIC_ASSETS=new Set(FILES.map(path=>new URL(path,self.registration.scope).href));
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('punch-360-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// Cache only application code. Supabase auth/API requests and personal data are NEVER cached here.
self.addEventListener('fetch',event=>{
 const request=event.request;
 const url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 const scopePath=new URL(self.registration.scope).pathname;
 if(!url.pathname.startsWith(scopePath))return;
 const precached=PUBLIC_ASSETS.has(url.href);
 const navigation=request.mode==='navigate';
 const homePath=new URL('./index.html',self.registration.scope).pathname;
 const kioskPath=new URL('./kiosk.html',self.registration.scope).pathname;
 // Only the two real PWA entrypoints (and the scope root) get an offline HTML shell.
 const publicNavigation=navigation&&(url.pathname===scopePath||url.pathname===homePath||url.pathname===kioskPath);
 // Never intercept arbitrary same-origin navigations, JSON, APIs or employee data.
 if(!precached&&!publicNavigation)return;
 const network=fetch(request,{cache:'no-cache'});
 // Register lifetime work synchronously, before the fetch event dispatch returns.
 if(precached)event.waitUntil(network.then(response=>{
  if(!response.ok)return;
  const copy=response.clone();
  return caches.open(CACHE).then(cache=>cache.put(request,copy));
 }).catch(()=>{}));
 // A gateway can return an HTTP error without rejecting fetch().
 // Offer the installed public shell only for transient gateway outages.
 // Authorization/not-found responses stay visible and never become cached success.
 const installedFallback=async()=>{
  if(precached){
   const cached=await caches.match(request);
   if(cached)return cached;
  }
  if(publicNavigation&&url.pathname===kioskPath)
   return await caches.match('./kiosk.html')||null;
  if(publicNavigation)return await caches.match('./index.html')||null;
  return null;
 };
 event.respondWith(network.then(async response=>{
  if(response.status===502||response.status===503||response.status===504)
   return await installedFallback()||response;
  return response;
 }).catch(async()=>await installedFallback()||Response.error()));
});
