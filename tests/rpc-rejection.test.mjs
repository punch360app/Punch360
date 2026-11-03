import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isDefinitiveRpcRejection} from '../web/live/rpc-rejection.js';

test('only documented server refusals are definitive for one-shot creation and activation',()=>{
 for(const code of ['P0001','23505','23502','23503','23514','42501','22P02','22023','40001','40P01']){
  assert.equal(isDefinitiveRpcRejection({code,message:'Rejected'}),true,code);
 }
 assert.equal(isDefinitiveRpcRejection({code:'PGRST116',status:406}),true);
});

test('network and server transport failures never permit a blind repeat',()=>{
 for(const error of [
  new TypeError('Failed to fetch'),
  {name:'AuthRetryableFetchError',status:0,message:'Failed to fetch'},
  {name:'FunctionsFetchError',status:502,code:'P0001'},
  {name:'AbortError',message:'Aborted'},
  {code:'08006',message:'Connection failure'},
  {code:'57P01',message:'Admin shutdown'},
  {code:'57014',message:'Query cancelled'},
  {code:'PGRST000',status:503},
  {code:'P0001',status:504},
  {status:500,message:'Timeout'},
  {message:'Invitation expirée'},null,undefined
 ])assert.equal(isDefinitiveRpcRejection(error),false,JSON.stringify(error));
});

test('browser uses the same response classifier for both paths and preserves verification',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/import \{isDefinitiveRpcRejection\} from '\.\/rpc-rejection\.js'/);
 assert.match(app,/if\(r\?\.error\)definiteError=isDefinitiveRpcRejection\(r\.error\)/);
 assert.match(app,/if\(response\?\.error\)rejected=isDefinitiveRpcRejection\(response\.error\)/);
 assert.match(app,/state\.pendingCompanyCreation=\{companyId:null,\.\.\.pendingContext\}/);
 assert.match(app,/savePendingWorkerActivation\(sessionStorage,state\.user\.id,null,baseline\)/);
 assert.match(app,/if\(state\.authBusy\|\|state\.pendingWorkerActivation\|\|!state\.user\)return/);
});
