import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundedRequestBody, identifyMissionPhoto, MAX_PHOTO_BYTES } from '../supabase/functions/mission-photo/image-validation.mjs';
function png() {
 const a = new Uint8Array(32);
 a.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0]);
 return a;
}
test('photo verification trusts bytes not extension or forged MIME', () => {
 assert.deepEqual(identifyMissionPhoto(png()), {mime:'image/png',extension:'png'});
 assert.throws(()=>identifyMissionPhoto(new Uint8Array(32)),/Seules/);
 assert.throws(()=>identifyMissionPhoto(new Uint8Array(MAX_PHOTO_BYTES+1)),/taille/);
 assert.throws(()=>identifyMissionPhoto(new Uint8Array([255,216,255,...Array(15).fill(0)])),/Seules/);
 const jpg=new Uint8Array(18);jpg.set([255,216,255]);jpg.set([255,217],16);
 assert.deepEqual(identifyMissionPhoto(jpg).mime,'image/jpeg');
 const webp=new Uint8Array(20);webp.set([82,73,70,70,12,0,0,0,87,69,66,80,86,80,56,88]);
 assert.deepEqual(identifyMissionPhoto(webp).mime,'image/webp');
 webp[4]=13;assert.throws(()=>identifyMissionPhoto(webp),/tronqué/);
});
test('stream reader enforces received bytes even if declared size lies', async()=>{
 const bytes=await boundedRequestBody(new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2]));c.enqueue(new Uint8Array([3]));c.close();}}),null,5);
 assert.deepEqual([...bytes],[1,2,3]);
 await assert.rejects(boundedRequestBody(new ReadableStream({start(c){c.enqueue(new Uint8Array(6));c.close();}}),1,5),/volumineux/);
 await assert.rejects(boundedRequestBody(new ReadableStream({start(c){c.close();}}),100,5),/volumineux/);
});
