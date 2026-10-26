/** A quote may be used only while its plan, cadence and seat inputs stay unchanged. */
export function createNativeBillingQuoteGuard(){
 let revision=0;
 return {
  invalidate(){revision++;return revision;},
  capture(){return revision;},
  isCurrent(expected:number){return expected===revision;},
  async read<T>(expected:number,task:()=>Promise<T>):Promise<T>{
   if(expected!==revision)throw Error('STALE_BILLING_QUOTE');
   const result=await task();
   if(expected!==revision)throw Error('STALE_BILLING_QUOTE');
   return result;
  }
 };
}
