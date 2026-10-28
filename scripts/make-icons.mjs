// Rasterises the Health mark (app/icon.svg geometry) into the PNG icons
// the installable app needs:
//   app/apple-icon.png   180x180  (Next serves it as apple-touch-icon)
//   public/icon-512.png  512x512  (manifest icon, "any" and "maskable")
//
// The mark is a flame square with an ink pulse line. It is drawn full-bleed
// because iOS and Android apply their own masks, and the line sits inside
// the central safe zone that maskable icons keep.
//
// Pure Node, no packages:  node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const FLAME = [0xeb, 0x6e, 0x3a];
const INK = [0x14, 0x2b, 0x38];

// The pulse line from app/icon.svg (a 22-unit square), scaled to 512.
const K = 512 / 22;
const POINTS = [[4, 13], [8, 13], [10, 7], [13, 17], [15, 13], [18, 13]];
const STROKES = POINTS.slice(1).map(([x2, y2], i) => {
  const [x1, y1] = POINTS[i];
  return { x1: x1 * K, y1: y1 * K, x2: x2 * K, y2: y2 * K, w: 2 * K, c: INK };
});

function distToSegment(px, py, { x1, y1, x2, y2 }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function raster(size) {
  const s = size / 512;
  const px = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Pixel centre in 512-space.
      const ux = (x + 0.5) / s;
      const uy = (y + 0.5) / s;
      let [r, g, b] = FLAME;
      for (const st of STROKES) {
        const d = distToSegment(ux, uy, st);
        // Round caps fall out of segment distance. 1px anti-alias edge
        // (in OUTPUT pixels, so divide by s when comparing in 512-space).
        const cov = Math.max(0, Math.min(1, (st.w / 2 - d) * s + 0.5));
        if (cov > 0) {
          r = r + (st.c[0] - r) * cov;
          g = g + (st.c[1] - g) * cov;
          b = b + (st.c[2] - b) * cov;
        }
      }
      const i = (y * size + x) * 3;
      px[i] = Math.round(r);
      px[i + 1] = Math.round(g);
      px[i + 2] = Math.round(b);
    }
  }
  return px;
}

// ── Minimal PNG encoder (8-bit RGB, no filter) ──
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePng(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  // raw scanlines, each prefixed with filter byte 0
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, y * size * 3, size * 3).copy(raw, y * (size * 3 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const [size, path] of [
  [180, "app/apple-icon.png"],
  [512, "public/icon-512.png"],
]) {
  writeFileSync(path, encodePng(size, raster(size)));
  console.log(`wrote ${path} (${size}x${size})`);
}
