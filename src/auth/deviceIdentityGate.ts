/**
 * A remembered user is permitted only when the network state explicitly
 * reports offline. A connected device must check Supabase Auth again and
 * must never fall back to a cached identity on an Auth/network error.
 * The offline branch does not grant server permissions.
 */
export async function selectNativeDeviceIdentity<T extends {id:string}>(
 offline:boolean,readCached:()=>Promise<T|null>,readVerified:()=>Promise<T>
):Promise<T>{
 if(offline===true){
  const cached=await readCached();
  if(!cached||typeof cached.id!=='string'||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cached.id))
    throw Error('OFFLINE_IDENTITY_UNAVAILABLE');
  return cached;
 }
 // No catch: failed verification, revoked tokens and server outages must
 // propagate. Only confirmed offline state may use a remembered identity.
 return readVerified();
}
