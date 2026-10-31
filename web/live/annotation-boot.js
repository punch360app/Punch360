/** Punch-owned fallback only; the device frames and preview stay in Atelier. */
export function showAtelierBootFailure(boot,reload=()=>globalThis.location.reload()){
 if(!boot)return;
 boot.replaceChildren();
 boot.setAttribute('role','alert');
 const message=boot.ownerDocument.createElement('span');
 message.textContent='L’aperçu responsive Atelier est temporairement indisponible. Les annotations locales restent sur cet appareil.';
 const retry=boot.ownerDocument.createElement('button');
 retry.type='button';
 retry.className='punch-preview-retry';
 retry.textContent='Réessayer le chargement';
 retry.addEventListener('click',reload);
 boot.append(message,retry);
}

/**
 * A stalled external module must not freeze the local review indefinitely.
 * No fake renderer is substituted if the official Atelier import times out.
 */
export async function loadAtelierResponsiveModule(importModule,timeoutMs=12000){
 if(typeof importModule!=='function')throw new TypeError('Atelier importer must be a function');
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0)
  throw new RangeError('Atelier import timeout must be positive');
 let timeoutId;
 const deadline=new Promise((_,reject)=>{
  timeoutId=setTimeout(()=>reject(new Error('Délai de chargement du module responsive Atelier dépassé')),timeoutMs);
 });
 try{return await Promise.race([Promise.resolve().then(importModule),deadline])}
 finally{clearTimeout(timeoutId)}
}
