// Mission checklist proof. All validation is repeated by the PostgreSQL RPC.
// This helper never stores credentials or sends anything to third parties.
export function missionChecklistItems(source){
 const items=String(source??'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
 const used=new Set();
 if(items.length<1||items.length>8)throw Error('Indiquez de 1 à 8 étapes de checklist.');
 for(const item of items){
  const norm=item.toLocaleLowerCase('fr-CA');
  if(item.length<3||item.length>120||/[\x00-\x1f\x7f]/.test(item)||used.has(norm))
   throw Error('Chaque étape doit être unique et contenir de 3 à 120 caractères.');
  used.add(norm);
 }
 return items;
}
export function missionChecklistConfirmed(items,checked){
 return Array.isArray(items)&&items.length>0&&items.length<=8&&
  Array.isArray(checked)&&checked.length===items.length&&items.every((_,i)=>checked.includes(i));
}
