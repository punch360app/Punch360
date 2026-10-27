// Mission proof media boundary. Never trust file names, browser MIME, or Content-Length.
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_REQUEST_BYTES = MAX_PHOTO_BYTES + 64 * 1024;
export function identifyMissionPhoto(data) {
  if (!(data instanceof Uint8Array) || data.byteLength < 16 || data.byteLength > MAX_PHOTO_BYTES) {
    throw new Error('Image invalide : taille limitée à 5 Mio.');
  }
  const p = (...bytes) => bytes.every((v, i) => data[i] === v);
  if (p(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    if (data[12] !== 0x49 || data[13] !== 0x48 || data[14] !== 0x44 || data[15] !== 0x52 ||
        data[16] !== 0 || data[17] !== 0 || data[18] === 0 || data[20] !== 0 || data[21] !== 0 || data[22] === 0) {
      throw new Error('PNG invalide.');
    }
    return { mime: 'image/png', extension: 'png' };
  }
  if (p(0xff, 0xd8, 0xff) && data[data.length - 2] === 0xff && data[data.length - 1] === 0xd9) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  if (p(0x52, 0x49, 0x46, 0x46) && data[8] === 0x57 && data[9] === 0x45 &&
      data[10] === 0x42 && data[11] === 0x50 &&
      (data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38)) {
    const len = (data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24)) >>> 0;
    if (len !== data.byteLength - 8) throw new Error('WebP tronqué.');
    return { mime: 'image/webp', extension: 'webp' };
  }
  throw new Error('Seules les images JPEG, PNG et WebP sont acceptées.');
}
export async function boundedRequestBody(body, announcedLength, maxBytes = MAX_REQUEST_BYTES) {
  if (announcedLength != null && Number(announcedLength) > maxBytes) throw new Error('Fichier trop volumineux.');
  if (!body || typeof body.getReader !== 'function') throw new Error('Corps du fichier absent.');
  const reader = body.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error('Flux image invalide.');
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel('limit'); throw new Error('Fichier trop volumineux.'); }
      chunks.push(value);
    }
  } catch (e) {
    try { await reader.cancel('error'); } catch {}
    throw e;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
