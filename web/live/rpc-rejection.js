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
 // SQLSTATE 5-character codes; P0001 is explicit RAISE EXCEPTION.
 // PostgREST PGRST codes are structured 4xx responses.
 if(/^[A-Z0-9]{5}$/.test(code))return true;
 if(/^PGRST\d{3}$/.test(code))return true;
 return false;
}
