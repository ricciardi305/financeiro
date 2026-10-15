// Generates the app icons in assets/images (pure Node, no image library). Run: node scripts/make-icons.js
const fs = require("fs");
const zlib = require("zlib");

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};
const png = (w, h, rgba) => {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const BARS = [
  { x: 267, w: 130, h: 200, color: "#60a5fa" },
  { x: 447, w: 130, h: 340, color: "#3b82f6" },
  { x: 627, w: 130, h: 480, color: "#4ade80" },
];
const BASE = 770;
const R = 40;

// Inside test for a rounded-top bar (bottom corners square-ish via same radius for a soft look).
const inBar = (b, px, py) => {
  const top = BASE - b.h;
  if (px < b.x || px > b.x + b.w || py < top || py > BASE) return false;
  const cx = px < b.x + R ? b.x + R : px > b.x + b.w - R ? b.x + b.w - R : px;
  const cy = py < top + R ? top + R : py > BASE - R ? BASE - R : py;
  return (px - cx) ** 2 + (py - cy) ** 2 <= R * R;
};

/** mode: "full" gradient bg + bars, "bg" gradient only, "fg" bars on transparent, "mono" white bars on transparent. */
const render = (size, mode) => {
  const out = Buffer.alloc(size * size * 4);
  const s = 1024 / size;
  const A = hex("#0b1220");
  const B = hex("#1e3a8a");
  const SS = 3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) * s;
          const py = (y + (sy + 0.5) / SS) * s;
          let c = null;
          if (mode !== "bg") {
            const bar = BARS.find((bb) => inBar(bb, px, py));
            if (bar) c = mode === "mono" ? [255, 255, 255] : hex(bar.color);
          }
          if (!c && (mode === "full" || mode === "bg")) {
            const t = (px + py) / 2048;
            c = A.map((v, i) => v + (B[i] - v) * t);
          }
          if (c) {
            r += c[0]; g += c[1]; b += c[2]; a += 1;
          }
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      if (a) {
        out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; out[o + 3] = Math.round((a / n) * 255);
      }
    }
  }
  return png(size, size, out);
};

const dir = "assets/images/";
fs.writeFileSync(dir + "icon.png", render(1024, "full"));
fs.writeFileSync(dir + "android-icon-background.png", render(1024, "bg"));
fs.writeFileSync(dir + "android-icon-foreground.png", render(1024, "fg"));
fs.writeFileSync(dir + "android-icon-monochrome.png", render(1024, "mono"));
fs.writeFileSync(dir + "splash-icon.png", render(512, "fg"));
fs.writeFileSync(dir + "favicon.png", render(48, "full"));
console.log("ok");
