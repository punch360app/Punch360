// Native OAuth and password-recovery redirects must be handled both when
// an already-running app receives a Linking event and when a cold-started app
// receives the URL through Linking.getInitialURL().
// This module is pure/testable and never logs a one-use PKCE authorization code.
export type NativeOAuthResult='ignored'|'invalid'|'duplicate'|'authenticated'|'recovery'|'failed';
export type NativeOAuthExchange=(code:string)=>Promise<{data:{session:unknown|null}|null;error:unknown}>;

export async function processNativeOAuthCallback(
 url:string|null|undefined,seen:Set<string>,exchange:NativeOAuthExchange
):Promise<NativeOAuthResult>{
 if(typeof url!=='string'||!url)return 'ignored';
 let callback:URL;
 try{callback=new URL(url);}catch{return 'ignored';}
 if(callback.protocol!=='punchapp:'||callback.hostname!=='auth'||
    callback.pathname!=='/callback'||callback.username||callback.password||callback.port)return 'ignored';
 const code=callback.searchParams.get('code');
 if(!code||code.length>2048)return 'invalid';
 // An event and getInitialURL() may report the very same deep link. Claim
 // the code synchronously, before any async exchange, to prevent replay.
 if(seen.has(code))return 'duplicate';
 seen.add(code);
 try{
  const result=await exchange(code);
  if(result.error||!result.data?.session)return 'failed';
  return callback.searchParams.get('type')==='recovery'?'recovery':'authenticated';
 }catch{return 'failed';}
}
