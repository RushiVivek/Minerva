// KOReader Sync identifies books and passwords by MD5, which Web Crypto does
// not offer. This is a plain RFC 1321 implementation; do not use it for security.

const SHIFTS = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const SINES = Array.from({ length: 64 }, (_, index) =>
  Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32),
);

export function md5(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const paddedLength = (((bytes.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, (bytes.length << 3) >>> 0, true);
  view.setUint32(paddedLength - 4, Math.floor(bytes.length / 2 ** 29), true);

  const state = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  for (let offset = 0; offset < paddedLength; offset += 64) {
    let [a, b, c, d] = state;
    for (let i = 0; i < 64; i += 1) {
      const round = i >> 4;
      const mix = [(b & c) | (~b & d), (d & b) | (~d & c), b ^ c ^ d, c ^ (b | ~d)][round];
      const word = [i, 5 * i + 1, 3 * i + 5, 7 * i][round] % 16;
      const sum = (a + mix + SINES[i] + view.getUint32(offset + word * 4, true)) >>> 0;
      const shift = SHIFTS[round * 4 + (i % 4)];
      [a, d, c, b] = [d, c, b, (b + ((sum << shift) | (sum >>> (32 - shift)))) >>> 0];
    }
    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
  }

  const digest = new DataView(new ArrayBuffer(16));
  state.forEach((word, index) => digest.setUint32(index * 4, word, true));
  return Array.from(new Uint8Array(digest.buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * KOReader's "partial MD5" document id, which Readest also uses: 1 KiB samples
 * at offsets 0, 1K, 4K, 16K … 1G, so a large file never has to be read whole.
 */
export function partialMd5(file: Uint8Array): string {
  const samples: Uint8Array[] = [];
  for (let i = -1; i <= 10; i += 1) {
    const start = i < 0 ? 0 : 1024 * 4 ** i;
    if (start >= file.length) break;
    samples.push(file.subarray(start, start + 1024));
  }
  const joined = new Uint8Array(samples.reduce((total, sample) => total + sample.length, 0));
  let offset = 0;
  for (const sample of samples) {
    joined.set(sample, offset);
    offset += sample.length;
  }
  return md5(joined);
}
