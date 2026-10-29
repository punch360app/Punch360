import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../web/live/essential.css',import.meta.url),'utf8');
const visual=readFileSync(new URL('../.github/scripts/visual-capture.cjs',import.meta.url),'utf8');

// Guard the already-approved brand foundation, not every accent/personal theme.
test('official Essentiel and Super Admin share the established sage palette',()=>{
  assert.match(css,/\.ess-pricing,\.ess-platform,\.essential-management\s*\{[^}]*--ess-sage:#779574/i);
  assert.match(css,/--ess-text:#2f4935/i);
  assert.match(css,/\.essential-management\s+\.btn\.gold\s*\{[^}]*background:#4e7051/i);
});

test('controls keep keyboard affordances and a minimum touch foundation',()=>{
  assert.match(css,/\.ess-btn\s*\{[^}]*min-height:44px/);
  assert.match(css,/\.ess-field input\s*\{[^}]*min-height:46px/);
  assert.match(css,/\.ess-btn:focus-visible/);
  assert.match(css,/\.ess-faq summary:focus-visible/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test('phone and tablet have intentional essential and platform layouts',()=>{
  assert.match(css,/@media\(max-width:720px\)\{[\s\S]*?\.essential-public \.ess-price-grid\s*\{grid-template-columns:1fr/);
  assert.match(css,/@media\(max-width:1050px\)[^{]*\{\s*\.ess-platform\s*\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(visual,/public-ui-inventory\.json/);
  assert.match(visual,/inventory\.screens!==24/);
});
