import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 ANNOTATION_SPACE,pointInScreen,rectangleInScreen,isGeometry,sourceDimensions
} from '../web/live/annotation-geometry.js';

test('a tap stores screen-relative coordinates rather than browser pixels',()=>{
 const p=pointInScreen(225,370,{left:25,top:70,width:400,height:600});
 assert.deepEqual(p,{x:0.5,y:0.5});
 assert.equal(ANNOTATION_SPACE,'screen-content-relative-v1');
 assert.equal(isGeometry('pin',p),true);
 assert.deepEqual(sourceDimensions({width:400,height:600}),{width:400,height:600});
});

test('coordinates do not change when Atelier zooms, rescales or moves the same content',()=>{
 const a=pointInScreen(125,170,{left:25,top:70,width:400,height:600});
 const b=pointInScreen(275,145,{left:225,top:95,width:200,height:300});
 assert.deepEqual(a,b);
 assert.deepEqual(a,{x:0.25,y:0.166667});
});

test('reverse drag produces a normalized rectangle within the screen',()=>{
 const r=rectangleInScreen({x:0.85,y:0.75},{x:0.25,y:0.2});
 assert.deepEqual(r,{x:0.25,y:0.2,width:0.6,height:0.55});
 assert.equal(isGeometry('rect',r),true);
});

test('short taps in zone mode create a visible bounded box',()=>{
 const r=rectangleInScreen({x:0.98,y:0.97},{x:0.98,y:0.97});
 assert.deepEqual(r,{x:0.88,y:0.92,width:0.12,height:0.08});
 assert.equal(isGeometry('rect',r),true);
});

test('coordinates beyond the target content are clamped to the screen',()=>{
 assert.deepEqual(pointInScreen(1000,-90,{left:0,top:0,width:300,height:600}),
  {x:1,y:0});
 assert.equal(isGeometry('pin',{x:1.1,y:0.2}),false);
 assert.equal(isGeometry('rect',{x:0.7,y:0.1,width:0.6,height:0.2}),false);
 assert.equal(isGeometry('rect',{x:0.3,y:0.2,width:0,height:0.3}),false);
 assert.equal(isGeometry('rect',{x:0.3,y:0.2,width:0.4,height:0.3}),true);
});

test('the Punch overlay is inside a real Atelier device and supports touch pointers',()=>{
 const js=readFileSync(new URL('../web/live/annotations.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../web/live/annotations.css',import.meta.url),'utf8');
 const html=readFileSync(new URL('../web/live/annotations.html',import.meta.url),'utf8');
 assert.match(js,/root\.append\(panel\)/);
 assert.match(js,/ensureAnnotationLayer\(view\)/);
 assert.match(js,/layer\.addEventListener\('pointerdown'/);
 assert.match(js,/layer\.addEventListener\('pointermove'/);
 assert.match(js,/layer\.addEventListener\('pointerup'/);
 assert.match(js,/layer\.setPointerCapture\(event\.pointerId\)/);
 assert.match(js,/sourceSize:sourceDimensions\(bounds\)/);
 assert.match(js,/coordinateSpace:ANNOTATION_SPACE/);
 assert.match(js,/version:2,projectId:PROJECT_ID/);
 assert.match(js,/\!\[1,2\]\.includes\(parsed\.version\)/);
 assert.match(css,/\.punch-annotation-layer\.is-drawing\{[^}]*touch-action:none/);
 assert.match(html,/id="annotate-pin"/);
 assert.match(html,/id="annotate-zone"/);
 assert.match(html,/id="annotate-mode"/);
});
