import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeMissionPhoto} from '../supabase/functions/mission-photo/image-sanitization.mjs';

// Real 20x12 images with SYNTHETIC location and camera metadata.
const fixtures = {
  jpeg: '/9j/4AAQSkZJRgABAQAAAQABAAD/4QBYRXhpZgAATU0AKgAAAAgAAgEOAAIAAAAdAAAAJgEPAAIAAAALAAAARAAAAABncHM6NDYuNzcsLTcxLjMyIFtzeW50aGV0aWNdAABDYW1lcmFUZXN0AAD/4QBPaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8R1BTTG9jYXRpb24+c3ludGhldGljIGNvb3JkaW5hdGVzPC9HUFNMb2NhdGlvbj7/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAMABQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDn6KKK2P00KKKKAP/Z',
  png: 'iVBORw0KGgoAAAANSUhEUgAAABQAAAAMCAIAAADtbgqsAAAAIXRFWHRHUFNMb2NhdGlvbgBzeW50aGV0aWMgY29vcmRpbmF0ZXMEgYZnAAAAGUlEQVR4nGO8JZ/LQC5gIlvnqOZRzTTXDAAisQF+bra80AAAAABJRU5ErkJggg==',
  webp: 'UklGRuQAAABXRUJQVlA4WAoAAAAMAAAAEwAACwAAVlA4IDYAAACwAgCdASoUAAwAPm0skUWkIqGYBABABsSgC7ADKUAA/u1NwTdh3//aWf/9tD//20P+XMV8AABFWElGUAAAAE1NACoAAAAIAAIBDgACAAAAHQAAACYBDwACAAAACwAAAEQAAAAAZ3BzOjQ2Ljc3LC03MS4zMiBbc3ludGhldGljXQAAQ2FtZXJhVGVzdAAAWE1QIDAAAAA8R1BTTG9jYXRpb24+c3ludGhldGljIGNvb3JkaW5hdGVzPC9HUFNMb2NhdGlvbj4='
};
const bytes = type => new Uint8Array(Buffer.from(fixtures[type], 'base64'));
const has = (raw, text) => Buffer.from(raw).includes(Buffer.from(text));

test('JPEG: strip camera/GPS/XMP without changing the encoded proof format', () => {
  const before = bytes('jpeg');
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
