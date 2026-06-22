import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";

const outDir = join(process.cwd(), "public", "splash", "v3");
const sizes = [
  [1125, 2436],
  [1170, 2532],
  [1179, 2556],
  [1206, 2622],
  [1242, 2208],
  [1242, 2688],
  [1284, 2778],
  [1290, 2796],
  [1320, 2868],
  [640, 1136],
  [750, 1334],
  [828, 1792],
];

const palette = {
  paper: [246, 239, 224],
  dawn: [239, 199, 181],
  morning: [248, 230, 188],
  noon: [244, 240, 226],
  evening: [217, 150, 128],
  night: [134, 145, 164],
  ink: [92, 70, 48],
  wax: [171, 83, 68],
  waxDark: [79, 54, 43],
  fold: [210, 186, 145],
};

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

mkdirSync(outDir, { recursive: true });

for (const [width, height] of sizes) {
  const image = new Uint8Array(width * height * 4);
  const seed = width * 1000003 + height * 9176;

  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const base = dayCyclePaperColor(u, v, x, y, seed);
      const idx = (y * width + x) * 4;
      image[idx] = clamp(base[0]);
      image[idx + 1] = clamp(base[1]);
      image[idx + 2] = clamp(base[2]);
      image[idx + 3] = 255;
    }
  }

  drawEnvelopeMark(image, width, height);

  const filename = join(outDir, `apple-splash-${width}-${height}.png`);
  writeFileSync(filename, encodePng(width, height, image));
  console.log(`wrote ${filename}`);
}

function dayCyclePaperColor(u, v, x, y, seed) {
  let color = mix(palette.paper, palette.noon, 0.35);
  color = addGlow(color, palette.dawn, radial(u, v, 0.13, 0.12, 0.74), 0.42);
  color = addGlow(color, palette.morning, radial(u, v, 0.78, 0.25, 0.62), 0.38);
  color = addGlow(color, palette.noon, radial(u, v, 0.44, 0.45, 0.76), 0.3);
  color = addGlow(color, palette.evening, radial(u, v, 0.18, 0.72, 0.78), 0.26);
  color = addGlow(color, palette.night, radial(u, v, 0.88, 0.88, 0.82), 0.2);

  const verticalWarmth = smoothstep(0.05, 0.95, v);
  color = mix(color, [238, 214, 196], 0.08 * verticalWarmth);

  const fiber =
    (valueNoise(x * 0.035, y * 0.035, seed) - 0.5) * 7 +
    (valueNoise(x * 0.012, y * 0.09, seed + 31) - 0.5) * 4 +
    (valueNoise(x * 0.18, y * 0.018, seed + 89) - 0.5) * 2.5;
  const vignette = radial(u, v, 0.5, 0.5, 0.94);
  const edge = (1 - vignette) * -7;

  return [
    color[0] + fiber + edge,
    color[1] + fiber * 0.88 + edge,
    color[2] + fiber * 0.7 + edge,
  ];
}

function drawEnvelopeMark(image, width, height) {
  const scale = Math.min(width, height) / 900;
  const cx = width / 2;
  const cy = height * 0.52;
  const envelopeW = Math.min(width * 0.48, 390 * scale);
  const envelopeH = envelopeW * 0.62;
  const radius = envelopeW * 0.075;
  const x0 = cx - envelopeW / 2;
  const y0 = cy - envelopeH / 2;
  const x1 = cx + envelopeW / 2;
  const y1 = cy + envelopeH / 2;

  drawSoftShadow(image, width, height, cx, cy + envelopeH * 0.18, envelopeW * 0.64, envelopeH * 0.44, [92, 58, 34, 32]);
  drawRoundedRect(image, width, height, x0, y0, envelopeW, envelopeH, radius, [251, 244, 226, 220]);
  drawPolyline(image, width, height, [
    [x0 + radius, y0 + radius * 0.9],
    [cx, cy + envelopeH * 0.13],
    [x1 - radius, y0 + radius * 0.9],
  ], [190, 160, 116, 52], Math.max(2, 2.1 * scale));
  drawPolyline(image, width, height, [
    [x0 + radius * 0.9, y1 - radius],
    [cx, cy + envelopeH * 0.09],
    [x1 - radius * 0.9, y1 - radius],
  ], [190, 160, 116, 44], Math.max(2, 2.1 * scale));
  drawPolyline(image, width, height, [
    [x0 + radius, y0 + radius],
    [x0 + envelopeW * 0.38, y0 + envelopeH * 0.46],
  ], [216, 194, 157, 36], Math.max(1.2, 1.4 * scale));
  drawPolyline(image, width, height, [
    [x1 - radius, y0 + radius],
    [x1 - envelopeW * 0.38, y0 + envelopeH * 0.46],
  ], [216, 194, 157, 36], Math.max(1.2, 1.4 * scale));

  const sealR = envelopeW * 0.145;
  const sealX = cx;
  const sealY = y0 + envelopeH * 0.61;
  drawWaxSeal(image, width, height, sealX, sealY, sealR, scale);
}

function drawWaxSeal(image, width, height, cx, cy, r, scale) {
  drawCircle(image, width, height, cx, cy, r * 1.08, [146, 69, 55, 46]);
  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * Math.PI * 2;
    const rr = r * (1.01 + 0.075 * Math.sin(i * 2.1));
    drawCircle(
      image,
      width,
      height,
      cx + Math.cos(angle) * r * 0.07,
      cy + Math.sin(angle) * r * 0.07,
      rr * 0.18,
      [palette.wax[0], palette.wax[1], palette.wax[2], 245],
    );
  }
  drawCircle(image, width, height, cx, cy, r, [palette.wax[0], palette.wax[1], palette.wax[2], 247]);
  drawCircleStroke(image, width, height, cx, cy, r * 0.76, [195, 105, 86, 116], Math.max(2, 2.4 * scale));

  const dark = [palette.waxDark[0], palette.waxDark[1], palette.waxDark[2], 220];
  drawEllipse(image, width, height, cx - r * 0.05, cy + r * 0.05, r * 0.58, r * 0.43, dark);
  drawCircle(image, width, height, cx + r * 0.42, cy - r * 0.1, r * 0.28, dark);
  drawTriangle(image, width, height, cx + r * 0.28, cy - r * 0.38, cx + r * 0.4, cy - r * 0.72, cx + r * 0.54, cy - r * 0.36, dark);
  drawTriangle(image, width, height, cx + r * 0.5, cy - r * 0.34, cx + r * 0.72, cy - r * 0.58, cx + r * 0.67, cy - r * 0.19, dark);
  drawPolyline(image, width, height, [
    [cx + r * 0.33, cy - r * 0.01],
    [cx + r * 0.42, cy + r * 0.06],
    [cx + r * 0.56, cy + r * 0.01],
  ], [palette.wax[0], palette.wax[1], palette.wax[2], 180], Math.max(1.4, 1.7 * scale));
  drawPolyline(image, width, height, [
    [cx + r * 0.12, cy + r * 0.24],
    [cx - r * 0.15, cy + r * 0.36],
    [cx - r * 0.5, cy + r * 0.28],
  ], [palette.wax[0], palette.wax[1], palette.wax[2], 150], Math.max(1.4, 1.5 * scale));
}

function drawRoundedRect(image, width, height, x, y, w, h, r, color) {
  const minX = Math.floor(x);
  const maxX = Math.ceil(x + w);
  const minY = Math.floor(y);
  const maxY = Math.ceil(y + h);
  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const dx = Math.max(x + r - px, 0, px - (x + w - r));
      const dy = Math.max(y + r - py, 0, py - (y + h - r));
      const dist = Math.sqrt(dx * dx + dy * dy);
      const alpha = color[3] * smoothstep(1, 0, dist - r);
      blendPixel(image, width, height, px, py, color, alpha / 255);
    }
  }
}

function drawSoftShadow(image, width, height, cx, cy, rx, ry, color) {
  const minX = Math.floor(cx - rx * 1.3);
  const maxX = Math.ceil(cx + rx * 1.3);
  const minY = Math.floor(cy - ry * 1.4);
  const maxY = Math.ceil(cy + ry * 1.4);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const d = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
      const alpha = color[3] * smoothstep(1.25, 0.05, d);
      blendPixel(image, width, height, x, y, color, alpha / 255);
    }
  }
}

function drawCircle(image, width, height, cx, cy, r, color) {
  drawEllipse(image, width, height, cx, cy, r, r, color);
}

function drawEllipse(image, width, height, cx, cy, rx, ry, color) {
  const minX = Math.floor(cx - rx - 2);
  const maxX = Math.ceil(cx + rx + 2);
  const minY = Math.floor(cy - ry - 2);
  const maxY = Math.ceil(cy + ry + 2);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const d = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
      const alpha = color[3] * smoothstep(1.02, 0.94, d);
      if (alpha > 0) blendPixel(image, width, height, x, y, color, alpha / 255);
    }
  }
}

function drawCircleStroke(image, width, height, cx, cy, r, color, lineWidth) {
  const minX = Math.floor(cx - r - lineWidth - 2);
  const maxX = Math.ceil(cx + r + lineWidth + 2);
  const minY = Math.floor(cy - r - lineWidth - 2);
  const maxY = Math.ceil(cy + r + lineWidth + 2);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const d = Math.hypot(x - cx, y - cy);
      const alpha = color[3] * smoothstep(lineWidth, 0, Math.abs(d - r));
      if (alpha > 0) blendPixel(image, width, height, x, y, color, alpha / 255);
    }
  }
}

function drawTriangle(image, width, height, x1, y1, x2, y2, x3, y3, color) {
  const minX = Math.floor(Math.min(x1, x2, x3));
  const maxX = Math.ceil(Math.max(x1, x2, x3));
  const minY = Math.floor(Math.min(y1, y2, y3));
  const maxY = Math.ceil(Math.max(y1, y2, y3));
  const area = edge(x1, y1, x2, y2, x3, y3);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const w1 = edge(x2, y2, x3, y3, x, y) / area;
      const w2 = edge(x3, y3, x1, y1, x, y) / area;
      const w3 = edge(x1, y1, x2, y2, x, y) / area;
      if (w1 >= -0.02 && w2 >= -0.02 && w3 >= -0.02) {
        blendPixel(image, width, height, x, y, color, color[3] / 255);
      }
    }
  }
}

function drawPolyline(image, width, height, points, color, lineWidth) {
  for (let i = 0; i < points.length - 1; i += 1) {
    drawLine(image, width, height, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], color, lineWidth);
  }
}

function drawLine(image, width, height, x1, y1, x2, y2, color, lineWidth) {
  const minX = Math.floor(Math.min(x1, x2) - lineWidth - 2);
  const maxX = Math.ceil(Math.max(x1, x2) + lineWidth + 2);
  const minY = Math.floor(Math.min(y1, y2) - lineWidth - 2);
  const maxY = Math.ceil(Math.max(y1, y2) + lineWidth + 2);
  const vx = x2 - x1;
  const vy = y2 - y1;
  const len2 = vx * vx + vy * vy || 1;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = Math.max(0, Math.min(1, ((x - x1) * vx + (y - y1) * vy) / len2));
      const px = x1 + t * vx;
      const py = y1 + t * vy;
      const d = Math.hypot(x - px, y - py);
      const alpha = color[3] * smoothstep(lineWidth, 0, d);
      if (alpha > 0) blendPixel(image, width, height, x, y, color, alpha / 255);
    }
  }
}

function blendPixel(image, width, height, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= width || y >= height || alpha <= 0) return;
  const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
  const inv = 1 - alpha;
  image[idx] = clamp(image[idx] * inv + color[0] * alpha);
  image[idx + 1] = clamp(image[idx + 1] * inv + color[1] * alpha);
  image[idx + 2] = clamp(image[idx + 2] * inv + color[2] * alpha);
  image[idx + 3] = 255;
}

function addGlow(base, glow, amount, strength) {
  return mix(base, glow, Math.max(0, Math.min(1, amount * strength)));
}

function radial(u, v, cx, cy, r) {
  return Math.max(0, 1 - Math.hypot(u - cx, v - cy) / r);
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = rand2(xi, yi, seed);
  const b = rand2(xi + 1, yi, seed);
  const c = rand2(xi, yi + 1, seed);
  const d = rand2(xi + 1, yi + 1, seed);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function rand2(x, y, seed) {
  let n = x * 374761393 + y * 668265263 + seed * 1442695041;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function edge(x1, y1, x2, y2, x3, y3) {
  return (x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1);
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, rowStart + 1);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr(width, height)),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function ihdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
