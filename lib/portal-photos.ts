// Private photo storage stays in D1; the authenticated photo route is the only reader.
export const MAX_PHOTO_BYTES = 256 * 1024;
export const MAX_PHOTO_STORAGE_BYTES = 40 * 1024 * 1024;
const MAX_DIMENSION = 4096;
type PhotoBytes = ArrayBuffer | ArrayBufferView;
type PhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';

export class PhotoValidationError extends Error {
  readonly status = 400;
  constructor(message = 'Choose a valid JPG, PNG or WebP photo, up to 4096 × 4096 pixels.') { super(message); this.name = 'PhotoValidationError'; }
}
export class PhotoQuotaError extends Error {
  readonly status = 413;
  constructor(message = 'Photo storage is full. Remove an existing photo and retry.') { super(message); this.name = 'PhotoQuotaError'; }
}
export interface PhotoStore {
  get(key: string): Promise<{body: ArrayBuffer; httpMetadata: {contentType: string}} | null>;
  put(key: string, value: PhotoBytes, options?: {httpMetadata?: {contentType?: string}}): Promise<void>;
  delete(key: string | string[]): Promise<void>;
}
function invalid(): never { throw new PhotoValidationError(); }
function dimensions(width: number, height: number) { if (!width || !height || width > MAX_DIMENSION || height > MAX_DIMENSION) invalid(); }
function join(parts: Uint8Array[]) { const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let offset = 0; for (const p of parts) { result.set(p, offset); offset += p.length; } return result; }
function text(bytes: Uint8Array, start: number, length: number) { return String.fromCharCode(...bytes.subarray(start, start + length)); }
function view(bytes: Uint8Array) { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
function crc32(bytes: Uint8Array) { let crc = 0xffffffff; for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }

function png(bytes: Uint8Array) {
  const data = view(bytes), parts = [bytes.subarray(0, 8)];
  let offset = 8, color = -1, depth = 0, palette = 0, idat = false, idatEnded = false, transparency = false, ended = false;
  while (offset < bytes.length) {
    if (bytes.length - offset < 12) invalid();
    const length = data.getUint32(offset), end = offset + 12 + length;
    if (end > bytes.length) invalid();
    const type = text(bytes, offset + 4, 4), body = offset + 8;
    if (!/^[A-Za-z]{4}$/.test(type) || (bytes[offset + 6] & 32) || data.getUint32(end - 4) !== crc32(bytes.subarray(offset + 4, end - 4))) invalid();
    if (offset === 8 && type !== 'IHDR') invalid();
    if (type === 'IHDR') {
      if (offset !== 8 || length !== 13) invalid();
      dimensions(data.getUint32(body), data.getUint32(body + 4)); depth = bytes[body + 8]; color = bytes[body + 9];
      const depths: Record<number, number[]> = {0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16]};
      if (!depths[color]?.includes(depth) || bytes[body + 10] !== 0 || bytes[body + 11] !== 0 || bytes[body + 12] > 1) invalid();
    } else if (type === 'PLTE') {
      if (palette || idat || transparency || !length || length % 3 || length > 768 || color === 0 || color === 4 || (color === 3 && length / 3 > 2 ** depth)) invalid();
      palette = length / 3;
    } else if (type === 'tRNS') {
      if (transparency || idat || !length || !((color === 0 && length === 2) || (color === 2 && length === 6) || (color === 3 && palette > 0 && length <= palette))) invalid();
      transparency = true;
    } else if (type === 'IDAT') {
      if (idatEnded || (color === 3 && !palette)) invalid();
      idat = true;
    } else if (type === 'IEND') {
      if (length || !idat || end !== bytes.length) invalid();
      ended = true;
    } else if (!(bytes[offset + 4] & 32)) invalid(); // Unknown critical chunk.
    if (idat && type !== 'IDAT') idatEnded = true;
    if (['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND'].includes(type)) parts.push(bytes.subarray(offset, end));
    offset = end;
  }
  if (!ended) invalid();
  const result = join(parts);
  // IDAT must contain a zlib stream (rather than an empty collection of chunks).
  const payloads = parts.filter(p => text(p, 4, 4) === 'IDAT').map(p => p.subarray(8, -4));
  const compressed = join(payloads);
  if (compressed.length < 6 || (compressed[0] & 15) !== 8 || (compressed[0] >>> 4) > 7 || ((compressed[0] << 8) + compressed[1]) % 31 || (compressed[1] & 32)) invalid();
  return result;
}

function jpeg(bytes: Uint8Array) {
  const data = view(bytes), parts = [bytes.subarray(0, 2)], quant = new Set<number>();
  let offset = 2, frame = false, progressive = false, scanned = false, ended = false;
  const componentIds = new Set<number>(), componentQuant: number[] = [];
  while (offset < bytes.length) {
    const start = offset;
    if (bytes[offset++] !== 0xff) invalid();
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9) { if (!frame || !scanned || offset !== bytes.length) invalid(); parts.push(bytes.subarray(start, offset)); ended = true; break; }
    if (marker === undefined || ![0xc0, 0xc2, 0xc4, 0xdb, 0xdd, 0xda, 0xfe].includes(marker) && !(marker >= 0xe0 && marker <= 0xef)) invalid();
    if (offset + 2 > bytes.length) invalid();
    const length = data.getUint16(offset), end = offset + length, body = offset + 2;
    if (length < 2 || end > bytes.length) invalid();
    if (marker === 0xc0 || marker === 0xc2) {
      if (frame || length < 8 || bytes[body] !== 8) invalid();
      dimensions(data.getUint16(body + 3), data.getUint16(body + 1));
      const count = bytes[body + 5];
      if (![1, 3].includes(count) || length !== 8 + count * 3) invalid();
      for (let i = 0; i < count; i++) { const p = body + 6 + i * 3, sample = bytes[p + 1]; if (componentIds.has(bytes[p]) || !(sample >> 4) || (sample >> 4) > 4 || !(sample & 15) || (sample & 15) > 4 || bytes[p + 2] > 3) invalid(); componentIds.add(bytes[p]); componentQuant.push(bytes[p + 2]); }
      frame = true; progressive = marker === 0xc2;
    } else if (marker === 0xdb) {
      let p = body;
      while (p < end) { const precision = bytes[p] >> 4, id = bytes[p++] & 15; if (precision > 1 || id > 3) invalid(); p += 64 * (precision + 1); if (p > end) invalid(); quant.add(id); }
      if (p === body) invalid();
    } else if (marker === 0xc4) {
      let p = body;
      while (p < end) { const table = bytes[p++]; if ((table >> 4) > 1 || (table & 15) > 3 || p + 16 > end) invalid(); let count = 0; for (let i = 0; i < 16; i++) count += bytes[p++]; if (!count || count > 256 || p + count > end) invalid(); p += count; }
      if (p === body) invalid();
    } else if (marker === 0xdd && length !== 4) invalid();
    else if (marker === 0xda) {
      if (!frame || componentQuant.some(id => !quant.has(id))) invalid();
      const count = bytes[body];
      if (!count || count > componentIds.size || length !== 6 + count * 2) invalid();
      const ids = new Set<number>();
      for (let i = 0; i < count; i++) { const p = body + 1 + i * 2; if (!componentIds.has(bytes[p]) || ids.has(bytes[p]) || (bytes[p + 1] >> 4) > 3 || (bytes[p + 1] & 15) > 3) invalid(); ids.add(bytes[p]); }
      const ss = bytes[end - 3], se = bytes[end - 2], approx = bytes[end - 1];
      if (ss > se || se > 63 || (approx >> 4) > 13 || (approx & 15) > 13 || (!progressive && (ss !== 0 || se !== 63 || approx !== 0))) invalid();
    }
    if (!(marker >= 0xe0 && marker <= 0xef) && marker !== 0xfe) parts.push(bytes.subarray(start, end));
    offset = end;
    if (marker === 0xda) {
      const scanStart = offset;
      while (offset < bytes.length) { if (bytes[offset] !== 0xff) { offset++; continue; } let next = offset + 1; while (bytes[next] === 0xff) next++; const code = bytes[next]; if (code === 0 || code >= 0xd0 && code <= 0xd7) { offset = next + 1; continue; } break; }
      if (offset === scanStart || offset >= bytes.length) invalid();
      parts.push(bytes.subarray(scanStart, offset)); scanned = true;
    }
  }
  if (!ended) invalid();
  return join(parts);
}

function webp(bytes: Uint8Array) {
  const data = view(bytes);
  if (data.getUint32(4, true) !== bytes.length - 8) invalid();
  const parts: Uint8Array[] = [], seen = new Set<string>();
  let offset = 12, width = 0, height = 0, canvasWidth = 0, canvasHeight = 0, declaredFlags = 0, extended: Uint8Array | null = null, alpha = false;
  while (offset < bytes.length) {
    if (bytes.length - offset < 8) invalid();
    const type = text(bytes, offset, 4), length = data.getUint32(offset + 4, true), body = offset + 8, end = body + length + (length % 2);
    if (end > bytes.length || (length % 2 && bytes[end - 1] !== 0) || seen.has(type)) invalid();
    seen.add(type);
    if (type === 'VP8X') {
      if (offset !== 12 || length !== 10 || bytes[body] & ~0x3e || bytes[body] & 2 || bytes[body + 1] || bytes[body + 2] || bytes[body + 3]) invalid();
      canvasWidth = 1 + bytes[body + 4] + (bytes[body + 5] << 8) + (bytes[body + 6] << 16); canvasHeight = 1 + bytes[body + 7] + (bytes[body + 8] << 8) + (bytes[body + 9] << 16); dimensions(canvasWidth, canvasHeight);
      declaredFlags = bytes[body]; extended = bytes.slice(offset, end); extended[8] &= 0x10; parts.push(extended);
    } else if (type === 'VP8 ') {
      if (width || length < 10 || bytes[body] & 1 || !(bytes[body] & 0x10) || ((bytes[body] >> 1) & 7) > 3 || bytes[body + 3] !== 0x9d || bytes[body + 4] !== 1 || bytes[body + 5] !== 0x2a) invalid();
      const partition = (bytes[body] + (bytes[body + 1] << 8) + (bytes[body + 2] << 16)) >>> 5;
      if (partition < 7 || partition + 3 > length) invalid();
      width = data.getUint16(body + 6, true) & 0x3fff; height = data.getUint16(body + 8, true) & 0x3fff; parts.push(bytes.subarray(offset, end));
    } else if (type === 'VP8L') {
      if (width || seen.has('ALPH') || length <= 5 || bytes[body] !== 0x2f) invalid();
      const bits = data.getUint32(body + 1, true); if (bits >>> 29) invalid();
      width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1; alpha = Boolean(bits & 0x10000000); parts.push(bytes.subarray(offset, end));
    } else if (type === 'ALPH') {
      if (!extended || width || length < 2 || bytes[body] & 0xc0 || (bytes[body] & 3) > 1 || ((bytes[body] >> 4) & 3) > 1) invalid();
      if (!(bytes[body] & 3) && length !== canvasWidth * canvasHeight + 1) invalid();
      alpha = true; parts.push(bytes.subarray(offset, end));
    } else {
      if (!['ICCP', 'EXIF', 'XMP '].includes(type) || !extended || !length) invalid();
      if (type === 'ICCP' ? width > 0 || seen.has('ALPH') : !width) invalid();
    }
    offset = end;
  }
  dimensions(width, height);
  if (extended && (canvasWidth !== width || canvasHeight !== height)) invalid();
  if (seen.has('ALPH') && !seen.has('VP8 ')) invalid();
  if (extended) {
    const expectedFlags = (seen.has('ICCP') ? 0x20 : 0) | (alpha ? 0x10 : 0) | (seen.has('EXIF') ? 8 : 0) | (seen.has('XMP ') ? 4 : 0);
    if (declaredFlags !== expectedFlags) invalid();
    extended[8] = alpha ? 0x10 : 0;
  }
  const result = join([bytes.subarray(0, 12), ...parts]); view(result).setUint32(4, result.length - 8, true); return result;
}

export function sanitizePhoto(value: PhotoBytes): {bytes: Uint8Array; mime: PhotoMime} {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (bytes.byteLength > MAX_PHOTO_BYTES) throw new PhotoQuotaError('Each photo must be 256 KiB or smaller.');
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return {bytes: jpeg(bytes), mime: 'image/jpeg'};
  if (bytes.length >= 8 && text(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') return {bytes: png(bytes), mime: 'image/png'};
  if (bytes.length >= 12 && text(bytes, 0, 4) === 'RIFF' && text(bytes, 8, 4) === 'WEBP') return {bytes: webp(bytes), mime: 'image/webp'};
  return invalid();
}

export function createPhotoStore(database: D1Database): PhotoStore {
  return {
    async get(key) {
      const row = await database.prepare('SELECT body,mime FROM portal_photos WHERE key=?').bind(key).first<{body: ArrayBuffer | number[]; mime: string}>();
      if (!row) return null;
      const body = row.body instanceof ArrayBuffer ? row.body : Uint8Array.from(row.body).buffer;
      return {body, httpMetadata: {contentType: row.mime}};
    },
    async put(key, value) {
      const photo = sanitizePhoto(value), body = photo.bytes.slice().buffer;
      // The quota check and write are one SQLite statement, including replacement credit.
      // D1 serializes this statement: concurrent uploads cannot pass a stale SUM check.
      const result = await database.prepare(`INSERT INTO portal_photos(key,body,mime,size)
        SELECT ?,?,?,? WHERE COALESCE((SELECT SUM(size) FROM portal_photos),0)
        - COALESCE((SELECT size FROM portal_photos WHERE key=?),0) + ? <= ?
        ON CONFLICT(key) DO UPDATE SET body=excluded.body,mime=excluded.mime,size=excluded.size`)
        .bind(key, body, photo.mime, body.byteLength, key, body.byteLength, MAX_PHOTO_STORAGE_BYTES).run();
      if (result.meta.changes !== 1) throw new PhotoQuotaError();
    },
    async delete(keys) {
      const list = typeof keys === 'string' ? [keys] : keys;
      if (list.length) await database.batch(list.map(key => database.prepare('DELETE FROM portal_photos WHERE key=?').bind(key)));
    },
  };
}
