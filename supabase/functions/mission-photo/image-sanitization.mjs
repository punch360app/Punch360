import { identifyMissionPhoto, MAX_PHOTO_BYTES } from './image-validation.mjs';

// Remove camera GPS, EXIF, XMP, comments and private metadata BEFORE Storage.
// This parses image containers; it is not a pixel decoder or antivirus.
const MAX_PIXELS = 120_000_000;
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
const crcTable = Uint32Array.from({length: 256}, (_, i) => {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  return c >>> 0;
});
function pngCrc(bytes, start, end) {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function invalid(format) { throw new Error(format + ' invalide ou tronqué.'); }
function join(parts, total) {
  if (total < 16 || total > MAX_PHOTO_BYTES) throw new Error('Image trop volumineuse ou invalide.');
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}
function stripPng(input) {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  if (!pngSignature.every((v, i) => input[i] === v)) invalid('PNG');
  const parts = [input.subarray(0, 8)];
  let pos = 8, total = 8, chunks = 0, image = false, finished = false;
  const safe = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'sRGB', 'gAMA', 'cHRM']);
  while (pos < input.length) {
    if (pos + 12 > input.length) invalid('PNG');
    const length = view.getUint32(pos), end = pos + 12 + length;
    if (length > MAX_PHOTO_BYTES || end > input.length) invalid('PNG');
    const type = String.fromCharCode(...input.subarray(pos + 4, pos + 8));
    if (!/^[A-Za-z]{4}$/.test(type)) invalid('PNG');
    if (pngCrc(input, pos + 4, pos + 8 + length) !== view.getUint32(pos + 8 + length)) invalid('PNG (CRC)');
    if (chunks === 0) {
      if (type !== 'IHDR' || length !== 13) invalid('PNG');
      const width = view.getUint32(pos + 8), height = view.getUint32(pos + 12);
      if (!width || !height || width * height > MAX_PIXELS) invalid('PNG (dimensions)');
    } else if (type === 'IHDR') invalid('PNG');
    if (type === 'IDAT') image = true;
    if (type === 'IEND') {
      if (length !== 0 || !image || end !== input.length) invalid('PNG');
      finished = true;
    }
    // Unknown critical chunks cannot be removed safely.
    if (!safe.has(type) && type[0] === type[0].toUpperCase()) invalid('PNG (section inconnue)');
    if (safe.has(type)) { parts.push(input.subarray(pos, end)); total += end - pos; }
    pos = end;
    chunks++;
    if (finished) break;
  }
  if (!finished) invalid('PNG');
  return join(parts, total);
}
function orientationOnly(app1) {
  if (app1.length < 24 || String.fromCharCode(...app1.subarray(0, 4)) !== 'Exif' || app1[4] !== 0 || app1[5] !== 0) return null;
  const offset = 6, little = app1[6] === 0x49 && app1[7] === 0x49;
  if (!little && !(app1[6] === 0x4d && app1[7] === 0x4d)) return null;
  const view = new DataView(app1.buffer, app1.byteOffset, app1.byteLength);
  if (view.getUint16(offset + 2, little) !== 42) return null;
  const dir = offset + view.getUint32(offset + 4, little);
  if (dir < 14 || dir + 2 > app1.length) return null;
  const count = view.getUint16(dir, little);
  if (count > 128 || dir + 2 + count * 12 > app1.length) return null;
  for (let i = 0; i < count; i++) {
    const p = dir + 2 + i * 12;
    if (view.getUint16(p, little) === 0x0112 && view.getUint16(p + 2, little) === 3 && view.getUint32(p + 4, little) === 1) {
      const angle = view.getUint16(p + 8, little);
      return angle >= 2 && angle <= 8 ? angle : null;
    }
  }
  return null;
}
function cleanOrientationSegment(value) {
  // Synthetic EXIF contains ONLY TIFF orientation: no GPS, camera, date or serial.
  const out = new Uint8Array([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,0,0,0,0,0,0,0,0]);
  out[28] = value;
  return out;
}
function stripJpeg(input) {
  if (input[0] !== 255 || input[1] !== 216) invalid('JPEG');
  const parts = [input.subarray(0, 2)];
  let total = 2, pos = 2, scan = false, hasFrame = false, hasScan = false, finished = false, orientation = null;
  while (pos < input.length) {
    if (scan) {
      const begin = pos;
      while (pos < input.length) {
        if (input[pos] !== 255) { pos++; continue; }
        let next = pos + 1;
        while (next < input.length && input[next] === 255) next++;
        if (next >= input.length) invalid('JPEG');
        const marker = input[next];
        if (marker === 0 || (marker >= 0xd0 && marker <= 0xd7)) { pos = next + 1; continue; }
        break;
      }
      parts.push(input.subarray(begin, pos)); total += pos - begin;
      scan = false;
      if (pos >= input.length) invalid('JPEG');
    }
    if (input[pos] !== 255) invalid('JPEG');
    const start = pos;
    while (pos < input.length && input[pos] === 255) pos++;
    if (pos >= input.length) invalid('JPEG');
    const marker = input[pos++];
    if (marker === 0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) invalid('JPEG');
    if (marker === 0xd9) {
      if (!hasFrame || !hasScan || pos !== input.length) invalid('JPEG');
      parts.push(Uint8Array.of(255, 217)); total += 2; finished = true; break;
    }
    if (marker === 0x01) { parts.push(input.subarray(start, pos)); total += pos - start; continue; }
    if (pos + 2 > input.length) invalid('JPEG');
    const length = input[pos] * 256 + input[pos + 1];
    if (length < 2 || pos + length > input.length) invalid('JPEG');
    const end = pos + length;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      if (length < 8) invalid('JPEG');
      const height = input[pos + 3] * 256 + input[pos + 4];
      const width = input[pos + 5] * 256 + input[pos + 6];
      if (!height || !width || width * height > MAX_PIXELS) invalid('JPEG (dimensions)');
      hasFrame = true;
    }
    if (marker === 0xda) { if (!hasFrame || length < 6) invalid('JPEG'); hasScan = true; scan = true; }
    // APP0-APP15 and COM may carry camera data even between progressive scans.
    const metadata = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (marker === 0xe1 && orientation === null) orientation = orientationOnly(input.subarray(pos + 2, end));
    if (!metadata) { parts.push(input.subarray(start, end)); total += end - start; }
    pos = end;
  }
  if (!finished) invalid('JPEG');
  if (orientation) {
    const segment = cleanOrientationSegment(orientation);
    parts.splice(1, 0, segment); total += segment.length;
  }
  return join(parts, total);
}
function stripWebp(input) {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  if (input.length < 20 || view.getUint32(4, true) !== input.length - 8) invalid('WebP');
  const parts = [], safe = new Set(['VP8X', 'ICCP', 'ALPH', 'ANIM', 'ANMF', 'VP8 ', 'VP8L']);
  let pos = 12, total = 12, frame = false, extended = false;
  while (pos < input.length) {
    if (pos + 8 > input.length) invalid('WebP');
    const length = view.getUint32(pos + 4, true), end = pos + 8 + length + (length & 1);
    if (length > MAX_PHOTO_BYTES || end > input.length) invalid('WebP');
    const type = String.fromCharCode(...input.subarray(pos, pos + 4));
    if (type === 'VP8X') {
      if (extended || pos !== 12 || length !== 10) invalid('WebP');
      extended = true;
      const width = 1 + input[pos + 12] + (input[pos + 13] << 8) + (input[pos + 14] << 16);
      const height = 1 + input[pos + 15] + (input[pos + 16] << 8) + (input[pos + 17] << 16);
      if (width * height > MAX_PIXELS) invalid('WebP (dimensions)');
      const chunk = input.slice(pos, end);
      chunk[8] &= ~0x0c; // RFC 9649: EXIF bit 3 and XMP bit 2.
      parts.push(chunk); total += chunk.length;
    } else if (safe.has(type)) {
      parts.push(input.subarray(pos, end)); total += end - pos;
    }
    // Drop EXIF, XMP and unknown application chunks.
    if (type === 'VP8 ' || type === 'VP8L' || type === 'ANMF') frame = true;
    pos = end;
  }
  if (pos !== input.length || !frame) invalid('WebP');
  const out = join([input.subarray(0, 12), ...parts], total);
  new DataView(out.buffer).setUint32(4, out.length - 8, true);
  return out;
}
export function sanitizeMissionPhoto(input) {
  const original = identifyMissionPhoto(input);
  const bytes = original.mime === 'image/png' ? stripPng(input)
    : original.mime === 'image/jpeg' ? stripJpeg(input) : stripWebp(input);
  const result = identifyMissionPhoto(bytes);
  if (result.mime !== original.mime) throw new Error('Image transformée invalide.');
  return {bytes, mime: result.mime, extension: result.extension};
}
