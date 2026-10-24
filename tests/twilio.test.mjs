import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {normalizePhone, invitationMessage, sendTwilioSms, verifyTwilioSignature, nextDeliveryStatus} from '../server/sms/twilio.mjs';
const config={enabled:true,environment:'production',accountSid:'AC'+'a'.repeat(32),authToken:'secret',messagingServiceSid:'MG'+'b'.repeat(32),statusCallbackUrl:'https://punch.example/sms/status'};
const msg={to:'+14185550134',body:'Invitation',consent:true,testCompany:false};
test('SMS refuses missing consent, sandbox, test tenants and configuration without contacting provider',async()=>{
 let calls=0;const fetcher=async()=>{calls++;};
 for(const [c,m] of [[{...config,enabled:false},msg],[{...config,environment:'test'},msg],[config,{...msg,testCompany:true}],[config,{...msg,consent:false}],[{...config,authToken:''},msg]]) await assert.rejects(sendTwilioSms(c,m,fetcher));
 assert.equal(calls,0);assert.equal(normalizePhone('+1 (418) 555-0134'),msg.to);assert.throws(()=>normalizePhone('4185550134'));
});
test('Twilio submission uses server credentials, an encoded body and never claims delivery',async()=>{
 const result=await sendTwilioSms(config,msg,async(url,options)=>{
 assert.match(url,/api.twilio.com/);assert.equal(options.redirect,'error');assert.equal(new URLSearchParams(options.body).get('To'),msg.to);
 return {ok:true,json:async()=>({sid:'SM'+'c'.repeat(32),status:'delivered'})};
 });assert.equal(result.status,'sent');
 await assert.rejects(sendTwilioSms(config,msg,async()=>{throw Error('secret');}),e=>e.outcome==='unknown'&&!e.message.includes('secret'));
});
test('callback signature covers public URL and all form values',async()=>{
 const publicUrl=config.statusCallbackUrl,form=new URLSearchParams({MessageSid:'SM123',MessageStatus:'delivered',AccountSid:config.accountSid});
 let body=publicUrl;for(const key of [...form.keys()].sort())body+=key+form.get(key);
 const signature=createHmac('sha1',config.authToken).update(body).digest('base64');
 const input={authToken:config.authToken,publicUrl,form,signature};
 assert.equal(await verifyTwilioSignature(input),true);
 form.set('MessageStatus','failed');assert.equal(await verifyTwilioSignature(input),false);
 assert.equal(await verifyTwilioSignature({...input,signature:''}),false);
});
test('delivery callbacks cannot downgrade a terminal receipt or imply activation',()=>{
 assert.equal(nextDeliveryStatus('delivered','sent'),'delivered');assert.equal(nextDeliveryStatus('sent','queued'),'sent');assert.equal(nextDeliveryStatus('sent','delivered'),'delivered');assert.throws(()=>nextDeliveryStatus('sent','activated'));
});
test('invitation links must belong to the configured activation origin',()=>{
 const input={firstName:'Alex',companyName:'Atelier',activationUrl:'https://punch.example/?invite=token',allowedOrigin:'https://punch.example'};
 assert.match(invitationMessage(input),/Bonjour Alex/);assert.throws(()=>invitationMessage({...input,activationUrl:'https://evil.example/'}));
});

test('deployed shared adapter stays identical to the tested server adapter',async()=>{assert.equal(await readFile(new URL('../server/sms/twilio.mjs',import.meta.url),'utf8'),await readFile(new URL('../supabase/functions/_shared/twilio.mjs',import.meta.url),'utf8'));});
