/**
 * Return an explicit submit button only when Enter belongs to a kiosk text field.
 * Native Enter on buttons, links and the language select must keep its own action.
 * No network operation, credentials or server permission is handled here.
 */
export function kioskEnterTarget(root,event,{paired=false,identified=false,busy=false}={}){
  if(!root||!event||event.key!=='Enter'||event.isComposing||event.repeat||busy)return null;
  const field=event.target;
  if(!field||field.tagName!=='INPUT'||field.disabled||!root.contains(field))return null;
  if(!['text','password'].includes(String(field.type).toLowerCase()))return null;
  let selector='';
  if(!paired&&field.id==='pairCode')selector='button[data-action="pair"]';
  else if(paired&&!identified&&['number','pin','enrollment','pinConfirm'].includes(field.id))
    selector='button[data-key="OK"]';
  const button=selector?root.querySelector(selector):null;
  return button&&!button.disabled?button:null;
}
