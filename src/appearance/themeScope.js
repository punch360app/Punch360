// Ephemeral per-user, per-request guard for cached and remote theme preferences.
export function createPersonalThemeScope(initialUser){
 let user=String(initialUser||''),epoch=0,read=0,writing=false;
 const current=()=>({user,epoch});
 const allows=token=>Boolean(token&&user&&token.user===user&&token.epoch===epoch);
 return {
  current,allows,
  matches:next=>Boolean(user&&user===String(next||'')),
  enter:next=>{user=String(next||'');epoch++;read++;writing=false;return current()},
  invalidate:()=>{epoch++;read++;writing=false},
  startRead:token=>{
   if(!allows(token)||writing)return null;
   return {...token,read:++read};
  },
  allowsRead:ticket=>Boolean(ticket&&allows(ticket)&&!writing&&ticket.read===read),
  beginWrite:token=>{
   if(!allows(token)||writing)return false;
   writing=true;read++;return true;
  },
  endWrite:token=>{
   if(!allows(token))return false;
   writing=false;return true;
  }
 };
}
export function themeGridColumns(width){
 return Number.isFinite(width)&&width>=920?3:Number.isFinite(width)&&width>=360?2:1;
}
export function themeGridItemWidth(columns){
 return columns===3?'31%':columns===2?'48%':'100%';
}
