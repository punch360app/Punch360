// Read-only, logged-out Chromium captures for PUNCH Web; no real backend calls.
// Every external request is blocked so this workflow cannot use production services.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const output = 'visual-captures';
fs.mkdirSync(output, {recursive:true});
const devices = [['S25',412,915],['iPad',820,1180],['PC',1440,900]];
(async () => {
  const browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    for (const [device,width,height] of devices) {
      const errors=[];
      let blockedExternalRequests=0;
      const page=await browser.newPage({
        viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block',
        isMobile:width<768,hasTouch:width<900
      });
      page.on('pageerror',error=>{if(errors.length<10) errors.push(String(error.message).slice(0,250));});
      // Only the local static test server can be reached by this capture.
      await page.route('**/*', route=>{
        const url=new URL(route.request().url());
        if (url.protocol==='http:' && url.hostname==='127.0.0.1' && url.port==='8765') return route.continue();
        blockedExternalRequests++;
        return route.abort('blockedbyclient');
      });
      try {
        const response=await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
        if (!response || !response.ok()) throw new Error('Local web server returned '+(response ? response.status():'no response'));
        await page.waitForFunction(()=>{
          const root=document.querySelector('#root');
          return root && root.textContent.trim() && !root.textContent.includes('Chargement de l’application');
        },null,{timeout:30000});
        await page.evaluate(()=>document.fonts.ready);
        await page.waitForTimeout(400);
        const metrics=await page.evaluate(()=>{
          const visible=el=>{
            const rect=el.getBoundingClientRect();
            const style=getComputedStyle(el);
            return style.display!=='none' && style.visibility!=='hidden' && Number(style.opacity)!==0 &&
              rect.width>0 && rect.height>0 && rect.bottom>0 && rect.right>0 &&
              rect.top<innerHeight && rect.left<innerWidth;
          };
          const targets=Array.from(document.querySelectorAll('button,a[href],[role="button"],input:not([type="hidden"]),select,textarea'))
            .filter(visible);
          const small=targets.filter(el=>{
            const r=el.getBoundingClientRect();
            return r.width<44 || r.height<44;
          });
          return {
            layout:{documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,
              overflowPx:Math.max(0,document.documentElement.scrollWidth-innerWidth)},
            tapTargets:{total:targets.length,smallCount:small.length,
              examples:small.slice(0,8).map(el=>({
                label:(el.getAttribute('aria-label')||el.textContent||el.tagName).trim().slice(0,70),
                width:Math.round(el.getBoundingClientRect().width),
                height:Math.round(el.getBoundingClientRect().height)
              }))}
          };
        });
        const file=path.join(output,'punch-'+device+'-logged-out.png');
        await page.screenshot({path:file,animations:'disabled'});
        fs.writeFileSync(path.join(output,'audit-'+device+'.json'),JSON.stringify({
          device,viewport:{width,height},screen:'logged-out',...metrics,pageErrors:errors,blockedExternalRequests
        },null,2)+'\n');
        console.log('Captured '+file+'; overflow '+metrics.layout.overflowPx+'px; tiny targets '+metrics.tapTargets.smallCount);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
