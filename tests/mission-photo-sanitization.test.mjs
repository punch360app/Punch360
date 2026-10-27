import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeMissionPhoto} from '../supabase/functions/mission-photo/image-sanitization.mjs';

// Real 20x12 images with SYNTHETIC location and camera metadata.
const fixtures = {
  png: 'iVBORw0KGgoAAAANSUhEUgAAABQAAAAMCAIAAADtbgqsAAAAIXRFWHRHUFNMb2NhdGlvbgBzeW50aGV0aWMgY29vcmRpbmF0ZXMEgYZnAAAAGUlEQVR4nGO8JZ/LQC5gIlvnqOZRzTTXDAAisQF+bra80AAAAABJRU5ErkJggg==',
  webp: 'UklGRuQAAABXRUJQVlA4WAoAAAAMAAAAEwAACwAAVlA4IDYAAACwAgCdASoUAAwAPm0skUWkIqGYBABABsSgC7ADKUAA/u1NwTdh3//aWf/9tD//20P+XMV8AABFWElGUAAAAE1NACoAAAAIAAIBDgACAAAAHQAAACYBDwACAAAACwAAAEQAAAAAZ3BzOjQ2Ljc3LC03MS4zMiBbc3ludGhldGljXQAAQ2FtZXJhVGVzdAAAWE1QIDAAAAA8R1BTTG9jYXRpb24+c3ludGhldGljIGNvb3JkaW5hdGVzPC9HUFNMb2NhdGlvbj4='
};
const bytes = type => new Uint8Array(Buffer.from(fixtures[type], 'base64'));
const has = (raw, text) => Buffer.from(raw).includes(Buffer.from(text));
// Structural JPEG sample with a private APP1 section; actual JPEG decodability
// was checked separately using synthetic 20x12 images and a pixel decoder.
function jpegSample() {
  const segment = (marker, payload) => [255,marker,(payload.length + 2) >>> 8,(payload.length + 2) & 255,...payload];
  return new Uint8Array([255,216,
    ...segment(0xe1,[...new TextEncoder().encode('gps:46.77 CameraTest')]),
    ...segment(0xc0,[8,0,1,0,1,1,1,0x11,0]),
    ...segment(0xda,[1,1,0,0,63,0]),42,52,255,217]);
}

test('JPEG: strip camera/GPS/XMP without changing the encoded proof format', () => {
  const before = jpegSample();
  assert.ok(has(before, 'gps:46.77'));
  const result = sanitizeMissionPhoto(before);
  assert.equal(result.mime, 'image/jpeg');
  assert.ok(result.bytes.length < before.length);
  assert.deepEqual([...result.bytes.subarray(-2)], [255,217]);
  assert.ok(!has(result.bytes, 'gps:46.77') && !has(result.bytes, 'CameraTest') && !has(result.bytes, 'GPSLocation'));
});
test('PNG: drop private metadata and reject corrupted chunks/trailing bytes', () => {
  const before = bytes('png');
  assert.ok(has(before, 'GPSLocation'));
  const result = sanitizeMissionPhoto(before);
  assert.equal(result.mime, 'image/png');
  assert.ok(!has(result.bytes, 'GPSLocation'));
  assert.ok(has(result.bytes, 'IDAT') && has(result.bytes, 'IEND'));
  const corrupt = before.slice(); corrupt[corrupt.length - 1] ^= 1;
  assert.throws(() => sanitizeMissionPhoto(corrupt), /CRC/);
  assert.throws(() => sanitizeMissionPhoto(new Uint8Array([...before, 1])), /PNG invalide/);
});
test('WebP: remove private chunks and repair VP8X flags and RIFF length', () => {
  const before = bytes('webp');
  assert.ok(has(before, 'GPSLocation'));
  const result = sanitizeMissionPhoto(before);
  assert.equal(result.mime, 'image/webp');
  assert.ok(!has(result.bytes, 'GPSLocation') && !has(result.bytes, 'EXIF'));
  assert.equal(result.bytes[20] & 0x0c, 0);
  assert.equal(new DataView(result.bytes.buffer).getUint32(4, true), result.bytes.length - 8);
  const corrupt = before.slice(); corrupt[4]++;
  assert.throws(() => sanitizeMissionPhoto(corrupt), /tronqué|invalide/);
});
test('Reject masquerading image headers before Storage upload', () => {
  const png = new Uint8Array(32); png.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1]);
  assert.throws(() => sanitizeMissionPhoto(png), /PNG/);
  const jpeg = new Uint8Array(18); jpeg.set([255,216,255]); jpeg.set([255,217], 16);
  assert.throws(() => sanitizeMissionPhoto(jpeg), /JPEG/);
  const webp = new Uint8Array(20); webp.set([82,73,70,70,12,0,0,0,87,69,66,80,86,80,56,88]);
  assert.throws(() => sanitizeMissionPhoto(webp), /WebP/);
});
