
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../web/live/',import.meta.url);
const html=readFileSync(new URL('annotations.html',root),'utf8');
const css=readFileSync(new URL('annotations.css',root),'utf8');
const js=readFileSync(new URL('annotations.js',root),'utf8');
const pages=readFileSync(new URL('../.github/workflows/deploy-web.yml',import.meta.url),'utf8');
test('annotation dashboard is a standalone responsive GitHub Pages entry point',()=>{
 assert.match(html,/<html lang="fr-CA">/);
 assert.match(html,/name="viewport"/);
 assert.match(html,/annotations\.js\?v=1/);
 assert.match(html,/annotations\.css\?v=1/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/@media\(max-width:395px\)/);
 assert.match(css,/--sage:#779574/);
 assert.match(pages,/path: \.\/web\/live/);
});
test('local screenshots and comments are not automatically uploaded to a remote app',()=>{
 assert.match(html,/Stockage local/);
 assert.match(html,/Rien n’est envoyé à Atelier/);
 assert.match(js,/indexedDB\.open\(DB,1\)/);
 assert.match(js,/punch360-annotation-review/);
 assert.match(js,/JSON\.stringify\(file,null,2\)/);
 assert.doesNotMatch(js,/supabase|sendBeacon|XMLHttpRequest|WebSocket/i);
});
test('upload and import accept only bounded image types, and external links remain Github scoped',()=>{
 assert.match(js,/MAX_IMAGE=12\*1024\*1024/);
 assert.match(js,/image\/png','image\/jpeg','image\/webp/);
 assert.match(js,/IMAGE_RE\.test\(data\)/);
 assert.match(js,/body\.screens\.length>50/);
 assert.match(js,/validLink\(value\)/);
 assert.match(html,/connect-src https:\/\/api\.github\.com/);
 assert.match(html,/script-src 'self'/);
});
test('all four annotation statuses, tools and comparison modes are present',()=>{
 for(const id of ['activity-view','reviews-view','capture-dialog','image-area','note-editor','export-button','import-button','after-file']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 for(const tool of ['pin','rect','arrow'])assert.match(html,new RegExp('data-tool="'+tool+'"'));
 for(const mode of ['before','after','compare'])assert.match(html,new RegExp('data-view="'+mode+'"'));
 for(const state of ['todo','progress','review','approved'])assert.match(html,new RegExp('value="'+state+'"'));
 assert.match(js,/saveNote\(\)/);assert.match(js,/deleteNote\(\)/);
});
test('the visual review tests a synthetic image, with no private customer input',()=>{
 const visual=readFileSync(new URL('../.github/scripts/visual-annotations.cjs',import.meta.url),'utf8');
 assert.match(visual,/PNG\.sync\.write/);
 assert.match(visual,/IndexedDB reload/);
 assert.match(visual,/download/);
 assert.match(visual,/annotations-dashboard-audit\.json/);
});
