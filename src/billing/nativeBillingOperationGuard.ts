/**
 * A Stripe action belongs to exactly one mounted Boss/company billing view.
 * Invalidating the view prevents late RPC/Edge responses from navigating,
 * starting follow-up Stripe requests, or updating a different user's screen.
 * Actions already sent to the server cannot be rolled back client-side.
 */
export function createNativeBillingOperationGuard(){
 let scope:string|null=null,revision=0,active=false;
 return {
  activate(nextScope:string){
   if(typeof nextScope!=='string'||!nextScope)throw Error('INVALID_BILLING_SCOPE');
   revision++;scope=nextScope;active=true;
  },
  invalidate(){revision++;active=false;scope=null;},
  begin(expectedScope:string){
   const captured=revision;
   return ()=>active&&revision===captured&&scope===expectedScope;
  }
 };
}

export async function billingGuardedResult<T>(
 current:()=>boolean,operation:()=>Promise<T>
):Promise<T>{
 if(!current())throw Error('STALE_BILLING_VIEW');
 const result=await operation();
 if(!current())throw Error('STALE_BILLING_VIEW');
 return result;
}
