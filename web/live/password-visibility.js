// Public authentication only. Never persist passwords to storage or a URL.
// Changing the input's type keeps the same DOM field and value.
const FIELDS=new Set(['password','signupPasswordConfirm','newPassword','confirmPassword']);
export function togglePublicPasswordVisibility(doc,fieldId,trigger){
 if(!FIELDS.has(fieldId)||!trigger||trigger.dataset?.action!=='togglePassword')return false;
 if(trigger.dataset.id!==fieldId||trigger.getAttribute('aria-controls')!==fieldId)return false;
 const field=doc?.getElementById?.(fieldId);
 if(!field||field.tagName!=='INPUT'||!['password','text'].includes(field.type))return false;
 const shown=field.type==='password';
 field.type=shown?'text':'password';
 const label=doc.querySelector('label[for="'+fieldId+'"]')?.textContent?.trim()||'le mot de passe';
 trigger.textContent=shown?'Masquer':'Afficher';
 trigger.setAttribute('aria-pressed',String(shown));
 trigger.setAttribute('aria-label',(shown?'Masquer ':'Afficher ')+label);
 return true;
}
