/**
 * Punch-owned positional annotation geometry. The responsive frames belong to
 * Atelier; coordinates belong to the actual Punch content element inside them.
 * Values are normalized (0..1) so markers follow resizing, zoom and rotation.
 */
export const ANNOTATION_SPACE='screen-content-relative-v1';
const clamp=n=>Math.min(1,Math.max(0,n));
const round=n=>Math.round(n*1e6)/1e6;

export function pointInScreen(clientX,clientY,bounds){
 if(!bounds||!(bounds.width>0)||!(bounds.height>0)||
  !Number.isFinite(clientX)||!Number.isFinite(clientY))
  throw new TypeError('Position de la capture invalide.');
 return {
  x:round(clamp((clientX-bounds.left)/bounds.width)),
  y:round(clamp((clientY-bounds.top)/bounds.height))
 };
}

export function rectangleInScreen(start,end){
 if(!isPoint(start)||!isPoint(end))throw new TypeError('Zone de capture invalide.');
 let x=Math.min(start.x,end.x),y=Math.min(start.y,end.y);
 let width=Math.abs(end.x-start.x),height=Math.abs(end.y-start.y);
 // A tap without a drag still produces a visible editable region.
 if(width<0.015||height<0.015){
  width=0.12;height=0.08;
  x=Math.min(x,1-width);y=Math.min(y,1-height);
 }
 return {x:round(x),y:round(y),width:round(width),height:round(height)};
}

export function isPoint(value){
 return value&&typeof value==='object'&&
  Number.isFinite(value.x)&&Number.isFinite(value.y)&&
  value.x>=0&&value.x<=1&&value.y>=0&&value.y<=1;
}

export function isGeometry(kind,geometry){
 if(kind==='pin')return isPoint(geometry);
 if(kind==='rect')return isPoint(geometry)&&
  Number.isFinite(geometry.width)&&Number.isFinite(geometry.height)&&
  geometry.width>0&&geometry.height>0&&geometry.width<=1&&geometry.height<=1&&
  geometry.x+geometry.width<=1+0.000002&&
  geometry.y+geometry.height<=1+0.000002;
 return false;
}

export function sourceDimensions(bounds){
 if(!bounds||!Number.isFinite(bounds.width)||!Number.isFinite(bounds.height)||
  bounds.width<1||bounds.height<1)throw new TypeError('Écran introuvable.');
 return {width:Math.round(bounds.width),height:Math.round(bounds.height)};
}
