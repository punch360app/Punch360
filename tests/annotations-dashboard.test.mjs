import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../web/live/',import.meta.url);
const html=readFileSync(new URL('annotations.html',root),'utf8');
const css=readFileSync(new URL('annotations.css',root),'utf8');
const js=readFileSync(new URL('annotations.js',root),'utf8');
const demo=readFileSync(new URL('punch-review-data.js',root),'utf8');
const pages=readFileSync(new URL('../.github/workflows/deploy-web.yml',import.meta.url),'utf8');

test('the shared Atelier responsive workspace is imported once, never copied',()=>{
 const url='https://atelier-projets-jf.juliensav.chatgpt.site/responsive/v1/entry.mjs';
 assert.ok(js.includes("import {mountResponsiveWorkspace} from '"+url+"'"));
 assert.match(js,/await mountResponsiveWorkspace\(\{/);
 assert.match(js,/renderApp\(\{container,slot\}\)/);
 assert.match(js,/renderWeb\(\{container\}\)/);
 assert.match(js,/projectId:PROJECT_ID/);
 assert.match(js,/punch360-12fb1917-94ea-481d-b131-16c58a5bf010/);
 assert.doesNotMatch(js,/attachDeviceChrome|createRenderedDevice|DEVICE_PRESETS|LAYOUTS|createElement\(['\"]iframe/i);
 assert.doesNotMatch(html,/<iframe|class="image-frame"|id="capture-file"/i);
 assert.doesNotMatch(css,/\.image-frame|\.ornament|\.device-catalog|\.responsive-frame/);
});

test('real Punch controllers render directly in the same document and handle events',()=>{
 for(const name of ['createSupportController','createPlatformDirectoryController','createPlatformAuditController'])
  assert.match(js,new RegExp(name));
 assert.match(js,/container\.append\(host\)/);
 assert.match(js,/panel\.innerHTML=view\.controller\.render\(\)/);
 assert.match(js,/view\.controller\?\.handle\?\.\(element\)/);
 assert.match(js,/handleAnnotateClick/);
 assert.ok(js.includes("'[data-punch-live-root]'"));
 assert.match(html,/id="punch-note-form"/);
 assert.match(html,/id="annotate-mode"/);
});

test('notes stay local and import/export is scoped to the Punch project',()=>{
 assert.match(js,/const STORAGE_KEY=PROJECT_ID\+':live-annotations:v1'/);
 assert.match(js,/localStorage\.setItem\(STORAGE_KEY,JSON\.stringify\(notes\)\)/);
 assert.match(js,/punch360-live-annotations/);
 assert.match(js,/parsed\.projectId!==PROJECT_ID/);
 assert.match(js,/const safeNotes|function safeNotes/);
 assert.doesNotMatch(js,/supabase|sendBeacon|XMLHttpRequest|WebSocket/i);
 assert.match(html,/Aucun envoi automatique à Atelier/);
 assert.match(html,/connect-src https:\/\/api\.github\.com https:\/\/atelier-projets-jf\.juliensav\.chatgpt\.site/);
 assert.match(html,/script-src 'self' https:\/\/atelier-projets-jf\.juliensav\.chatgpt\.site/);
});

test('real responsive layout uses container queries on Atelier ap-content',()=>{
 assert.doesNotMatch(css,/\.ap-content\s*\{\s*container-type/);
 assert.match(css,/@container ap-content \(max-width:540px\)/);
 assert.match(css,/--punch-sage:#779574/);
 assert.match(css,/min-height:44px/);
 assert.match(pages,/path: \.\/web\/live/);
});

test('the preview data adapter never reaches production Supabase or external RPCs',()=>{
 assert.match(demo,/createPunchReviewBackend/);
 assert.match(demo,/REVIEW_COMPANY_ID='punch-preview-company'/);
 assert.match(demo,/support_list_tickets/);
 assert.match(demo,/platform_search_companies/);
 assert.match(demo,/platform_search_audit/);
 assert.doesNotMatch(demo,/createClient\s*\(|\bfetch\s*\(|https:\/\/|from\s+['\"]@supabase/i);
});

test('visual QA checks actual rendered controls rather than screenshot-only overlays',()=>{
 const visual=readFileSync(new URL('../.github/scripts/visual-annotations.cjs',import.meta.url),'utf8');
 assert.match(visual,/annotations\.html/);
 assert.match(visual,/data-punch-live-root/);
 assert.match(visual,/punch-annotation-pin/);
 assert.match(visual,/punch360-live-annotations/);
});
