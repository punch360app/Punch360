/**
 * Serialized identity cache. Explicit SIGNED_OUT invalidates all in-flight
 * reads and writes synchronously, even while AsyncStorage is still writing.
 * No cached punch journal keys are deleted here.
 */
export type RememberedIdentity={id:string;email?:string};
type Storage={
 getItem(key:string):Promise<string|null>;
 setItem(key:string,value:string):Promise<void>;
 removeItem(key:string):Promise<void>;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const valid=(id:unknown):id is string=>typeof id==='string'&&id.length===36&&uuid.test(id);

export function createNativeIdentityCache(storage:Storage,key:string){
 let revision=0,blocked=false,expectedId:string|null=null;
 let tail=Promise.resolve();
 const enqueue=(operation:()=>Promise<void>):Promise<void>=>{
  const run=tail.then(operation);
  tail=run.catch(()=>{});
  return run;
 };
 return {
  remember(identity:RememberedIdentity):Promise<void>{
   if(!valid(identity?.id))return Promise.reject(Error('INVALID_LOCAL_IDENTITY'));
   const mine=++revision;
   expectedId=identity.id;blocked=false;
   return enqueue(async()=>{
    if(blocked||revision!==mine)return;
    await storage.setItem(key,JSON.stringify({id:identity.id,email:identity.email}));
   });
  },
  forget():Promise<void>{
   ++revision;blocked=true;expectedId=null;
   // Queue the deletion AFTER any already-running write: a late write cannot
   // resurrect a signed-out account on the next offline launch.
   return enqueue(()=>storage.removeItem(key));
  },
  async read():Promise<RememberedIdentity|null>{
   if(blocked)return null;
   const mine=revision;
   try{
    const raw=await storage.getItem(key);
    if(blocked||mine!==revision||!raw)return null;
    const decoded:unknown=JSON.parse(raw);
    if(!decoded||typeof decoded!=='object')return null;
    const id=(decoded as {id?:unknown}).id;
    if(!valid(id)||(expectedId!==null&&expectedId!==id))return null;
    const email=(decoded as {email?:unknown}).email;
    return {id,...(typeof email==='string'?{email}:{})};
   }catch{return null;}
  }
 };
}
