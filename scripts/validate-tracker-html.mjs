import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync('web/live/suivi.html','utf8');
const matches=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
if(matches.length<2)throw Error('Expected embedded data and interactive script');
let executable=0;
for(const match of matches){
 if(/type=["']application\/json["']/.test(match[1])){
  JSON.parse(match[2]);
 }else{
  new Script(match[2],{filename:'suivi.html:inline.js'});
  executable++;
 }
}
if(executable!==1)throw Error('Unexpected number of interactive scripts: '+executable);
for(const id of ['dataBundle','progressFraction','progressPercent','progressTestedFraction','progressTestedPercent',
 'progressDeliveredFraction','progressDeliveredPercent','workRecent','progressSync']){
 if(!html.includes('id="'+id+'"'))throw Error('Missing dashboard element: '+id);
}
console.log('PUNCH tracker validated: inline JS parses and 3 progress counters exist');
