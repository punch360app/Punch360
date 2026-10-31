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
