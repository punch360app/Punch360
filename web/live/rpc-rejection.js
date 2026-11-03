/**
 * Only a structured, explicit PostgreSQL/PostgREST refusal proves an RPC
 * request failed before committing. A transport problem, timeout, server
 * failure, or unstructured error may have happened AFTER database commit.
 * Never replay a one-shot create/activate request in those cases.
 */
export function isDefinitiveRpcRejection(error){
 if(!error||typeof error!=='object')return false;
 const code=typeof error.code==='string'?error.code.trim():'';
 const status=Number(error.status);
 // Auth/network/transport/5xx are never evidence of a rejected transaction.
 if((Number.isFinite(status)&&status>=500)||
   ['AuthRetryableFetchError','FunctionsFetchError','TypeError','AbortError'].includes(error.name))return false;
 // Explicit SQL errors known to reject and roll back the transaction.
 // Do NOT classify connection errors (SQLSTATE 08xxx), cancellations or
 // server restarts as definitive, even when they have a 5-character code.
 if(new Set(['P0001','23505','23503','23502','23514','42501',
  '22P02','22023','22001','22003','40001','40P01']).has(code))return true;
 // PostgREST 4xx protocol/argument rejection, never a 5xx/unknown response.
 if(/^PGRST\d{3}$/.test(code)&&status>=400&&status<500)return true;
 return false;
}
