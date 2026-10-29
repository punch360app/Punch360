// Busy feedback for a shared kiosk: no credential storage, request, or redraw.
// Keep the user's input intact while the server verifies an operation.
export function showKioskProcessing(root,message){
 if(!root||typeof root.querySelectorAll!=='function')throw TypeError('Kiosk root required');
 const status=root.querySelector('.kiosk-notice[role="status"]');
 const section=root.querySelector('.kiosk-content');
 if(section)section.setAttribute('aria-busy','true');
 if(status){
  status.textContent=String(message||'');
  status.setAttribute('data-pending','true');
 }
 for(const element of root.querySelectorAll('button,input,select')){
  element.disabled=true;
 }
}
