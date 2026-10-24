/** Server only. No browser/native imports. Delivery is not account activation. */
export function normalizePhone(value) {
  const phone = String(value ?? '').replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('PHONE_E164_REQUIRED');
  return phone;
}
function httpsUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('HTTPS_REQUIRED');
  return url;
}
export function invitationMessage({firstName, companyName, activationUrl, allowedOrigin}) {
  const url = httpsUrl(activationUrl);
  if (url.origin !== httpsUrl(allowedOrigin).origin) throw new Error('ACTIVATION_ORIGIN_DENIED');
  const clean = value => String(value ?? '').replace(/[\r\n\x00-\x1f]/g, ' ').trim();
  const name = clean(firstName), company = clean(companyName);
  if (!name || !company || name.length > 80 || company.length > 160) throw new Error('INVALID_INVITATION');
  return `Bonjour ${name}! ${company} vous invite à rejoindre PUNCH Essentiel. Consultez vos horaires et vos heures. Activez votre compte : ${url.href}`;
}
export class SmsError extends Error {
  constructor(code, outcome = 'failed') { super(code); this.outcome = outcome; }
}
/** Caller must claim a durable outbox row atomically, verify consent, limits,
 * worker/invitation/company ownership and test environment BEFORE calling.
 * Never retry an ambiguous timeout automatically: the provider may have sent it. */
export async function sendTwilioSms(config, message, fetcher = fetch) {
  if (config.enabled !== true) throw new SmsError('SMS_DISABLED');
  if (message.testCompany || config.environment !== 'production') throw new SmsError('REAL_SMS_DENIED');
  if (message.consent !== true) throw new SmsError('SMS_CONSENT_REQUIRED');
  if (!/^AC[0-9a-f]{32}$/i.test(config.accountSid ?? '') || !config.authToken) throw new SmsError('SMS_NOT_CONFIGURED');
  if (!/^MG[0-9a-f]{32}$/i.test(config.messagingServiceSid ?? '')) throw new SmsError('SMS_SERVICE_REQUIRED');
  const to = normalizePhone(message.to);
  if (!message.body || message.body.length > 1600) throw new SmsError('INVALID_SMS_BODY');
  const callback = httpsUrl(config.statusCallbackUrl);
  const params = new URLSearchParams({To:to, Body:message.body, MessagingServiceSid:config.messagingServiceSid, StatusCallback:callback.href});
  let response;
  try {
    response = await fetcher(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
      method:'POST', redirect:'error', signal:AbortSignal.timeout(15000),
      headers:{Authorization:`Basic ${btoa(`${config.accountSid}:${config.authToken}`)}`, 'Content-Type':'application/x-www-form-urlencoded'},
      body:params.toString()
    });
  } catch { throw new SmsError('SMS_DELIVERY_UNKNOWN', 'unknown'); }
  // Never surface raw provider payload: it may contain phone numbers and content.
  if (!response.ok) throw new SmsError(`SMS_PROVIDER_HTTP_${response.status}`, response.status >= 500 ? 'unknown' : 'failed');
  let data;
  try { data = await response.json(); } catch { throw new SmsError('SMS_RESPONSE_UNKNOWN', 'unknown'); }
  if (!/^SM[0-9a-f]{32}$/i.test(data.sid ?? '')) throw new SmsError('SMS_RESPONSE_UNKNOWN', 'unknown');
  return {providerMessageId:data.sid, status:'sent'}; // accepted by Twilio, NOT delivered
}
/** Verify form-urlencoded callbacks using the configured public URL, never Host headers.
 * No DB mutation should occur before verification and AccountSid/MessageSid matching. */
export async function verifyTwilioSignature({authToken, publicUrl, form, signature}) {
  if (!authToken || !signature || !/^[A-Za-z0-9+/]{27}=$/.test(signature)) return false;
  httpsUrl(publicUrl);
  let payload = publicUrl;
  for (const key of [...new Set(form.keys())].sort()) {
    for (const value of [...new Set(form.getAll(key))].sort()) payload += key + value;
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(authToken), {name:'HMAC',hash:'SHA-1'}, false, ['verify']);
  const bytes = Uint8Array.from(atob(signature), c=>c.charCodeAt(0));
  return crypto.subtle.verify('HMAC', key, bytes, encoder.encode(payload));
}
const ranks = {queued:0,accepted:0,sending:1,sent:2,delivered:3,undelivered:3,failed:3};
export function nextDeliveryStatus(current, incoming) {
  if (!(incoming in ranks) || !(current in ranks)) throw new Error('INVALID_DELIVERY_STATUS');
  // Terminal receipts and duplicate callbacks are immutable; activation is separate.
  return ranks[current] === 3 || ranks[incoming] < ranks[current] ? current : incoming;
}
