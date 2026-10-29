// Temporary diagnostic: public Atelier responsive integration contract only.
// No credentials, cookies, signed URLs or app records are sent.
const https=require('node:https');
const base='https://atelier-projets-jf.juliensav.chatgpt.site';
async function read(url){
 return await new Promise((resolve,reject)=>{
  https.get(url,{headers:{'User-Agent':'Punch360-UI-Integration-Check/1.0','Accept':'text/plain,*/*'}},res=>{
   let chunks=[],length=0;
   res.on('data',d=>{length+=d.length;if(length<=160000)chunks.push(d)});
   res.on('end',()=>resolve({status:res.statusCode,contentType:res.headers['content-type'],length,body:Buffer.concat(chunks).toString('utf8')}));
  }).on('error',reject).setTimeout(15000,function(){this.destroy(Error('timeout'))});
 });
}
(async()=>{
 for(const route of ['/responsive/integration.md','/responsive/v1/entry.mjs']){
  try{const r=await read(base+route);
    console.log('ATELIER RESPONSIVE CONTRACT',route,'HTTP',r.status,'type',r.contentType,'size',r.length);
    console.log('BODY START\n'+r.body.slice(0,route.endsWith('.md')?18000:15000)+'\nBODY END');
  }catch(e){console.log('ATELIER RESPONSIVE CONTRACT',route,'unavailable',e.message)}
 }
})().catch(e=>console.error('Atelier contract diagnostics',e.message));
