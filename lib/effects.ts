export type EffectId = 'pixel' | 'glass' | 'burn' | 'glitch' | 'hole' | 'melt' | 'slice' | 'blast' | 'matrix' | 'shred';
export interface Frame { ctx: CanvasRenderingContext2D; src: HTMLCanvasElement; w: number; h: number }
export interface Effect { id: EffectId; name: string; blurb: string; draw: (f: Frame, p: number, k: number) => void }

const r = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const cl = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const bg = ({ ctx, w, h }: Frame) => { ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#07070c'; ctx.fillRect(0, 0, w, h); };

const pixel: Effect['draw'] = (f, p, k) => {
  const { ctx, src, w, h } = f; bg(f);
  const B = Math.round(44 - 28 * cl(k / 1.5)); let n = 0;
  for (let y = 0; y < h; y += B) for (let x = 0; x < w; x += B, n++) {
    const t = cl((p - r(n) * 0.6) / 0.4); if (t >= 1) continue;
    const s = B * (1 - t * 0.6);
    ctx.globalAlpha = 1 - t;
    ctx.drawImage(src, x, y, B, B, x + (r(n + 7) - 0.5) * t * 160 * k, y + t * t * 240 * k * (0.3 + r(n + 3)), s, s);
  }
  ctx.globalAlpha = 1;
};

const glass: Effect['draw'] = (f, p, k) => {
  const { ctx, src, w, h } = f; bg(f);
  const C = 12, R = 8, cw = w / C, ch = h / R;
  for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {
    const n = j * C + i, cx = (i + 0.5) * cw, cy = (j + 0.5) * ch;
    const t = cl((p - r(n) * 0.2) / 0.8), e = t * t;
    const dx = cx - w / 2, dy = cy - h / 2, d = Math.hypot(dx, dy) || 1;
    ctx.save();
    ctx.globalAlpha = 1 - cl((t - 0.5) * 2) ** 2;
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 14 * t; ctx.shadowOffsetY = 10 * t;
    ctx.translate(cx + (dx / d) * e * 520 * k * (0.5 + r(n + 2)), cy + (dy / d) * e * 520 * k * (0.5 + r(n + 2)) + e * 380 * k);
    ctx.rotate((r(n + 1) - 0.5) * e * 6 * k); ctx.scale(1 + t * 0.15, 1 + t * 0.15);
    ctx.drawImage(src, i * cw, j * ch, cw + 1, ch + 1, -cw / 2, -ch / 2, cw + 1, ch + 1);
    ctx.shadowColor = 'transparent'; ctx.strokeStyle = `rgba(200,230,255,${0.12 + 0.5 * Math.min(1, p * 8)})`; ctx.lineWidth = 1;
    ctx.strokeRect(-cw / 2, -ch / 2, cw, ch);
    ctx.restore();
  }
};

const burn: Effect['draw'] = (f, p, k) => {
  const { ctx, src, w, h } = f; bg(f);
  const front = (x: number) => h * (1.15 - p * 1.4) + Math.sin(x * 0.02 + p * 6) * 28 * k + r(Math.floor(x / 4)) * 22 * k;
  const g = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, h);
  g.addColorStop(0, `rgba(255,90,10,${0.35 * p})`); g.addColorStop(1, 'transparent');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 4) {
    const y = front(x); if (y <= 0) continue;
    const hh = Math.min(h, y);
    ctx.drawImage(src, x, 0, 4, hh, x, 0, 4, hh);
    const c = ctx.createLinearGradient(0, y - 70, 0, y);
    c.addColorStop(0, 'rgba(0,0,0,0)'); c.addColorStop(0.7, 'rgba(30,8,0,.7)'); c.addColorStop(0.9, 'rgba(255,140,20,.95)'); c.addColorStop(1, 'rgba(255,230,120,1)');
    ctx.fillStyle = c; ctx.fillRect(x, Math.max(0, y - 70), 4, Math.min(70, y));
  }
  if (p > 0 && p < 1) for (let i = 0; i < 70; i++) {
    const x = r(i) * w, life = (p * 3 + r(i + 5)) % 1;
    ctx.fillStyle = `rgba(255,${120 + r(i + 2) * 100},40,${(1 - life) * 0.9})`;
    ctx.beginPath(); ctx.arc(x + Math.sin(life * 9 + i) * 20, front(x) - life * 220 * k, 1 + r(i + 8) * 2.5, 0, 7); ctx.fill();
  }
};

const chans = new WeakMap<HTMLCanvasElement, HTMLCanvasElement[]>();
const channels = (src: HTMLCanvasElement) => {
  let c = chans.get(src); if (c) return c;
  const d = src.getContext('2d')!.getImageData(0, 0, src.width, src.height);
  c = [0, 1, 2].map(ch => {
    const o = document.createElement('canvas'); o.width = src.width; o.height = src.height;
    const ox = o.getContext('2d')!, id = ox.createImageData(src.width, src.height);
    for (let i = 0; i < d.data.length; i += 4) { id.data[i + ch] = d.data[i + ch]; id.data[i + 3] = 255; }
    ox.putImageData(id, 0, 0); return o;
  });
  chans.set(src, c); return c;
};

const glitch: Effect['draw'] = (f, p, k) => {
  const { ctx, src, w, h } = f; bg(f);
  if (p === 0) { ctx.drawImage(src, 0, 0); return; }
  const [R, G, B] = channels(src), fr = Math.floor(p * 70), sh = 16 * p * k;
  ctx.globalAlpha = r(fr) < p * 0.3 ? 0.6 : 1; ctx.globalCompositeOperation = 'lighter';
  for (let y = 0, n = 0; y < h; y += 24, n++) {
    const hit = r(n * 3 + fr) < p * 0.9, ox = hit ? (r(n + fr * 13) - 0.5) * 260 * p * k : 0;
    ([[R, -sh], [G, 0], [B, sh]] as [HTMLCanvasElement, number][]).forEach(([c, s]) => ctx.drawImage(c, 0, y, w, 24, ox + s, y, w, 24));
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
  for (let i = 0; i < p * 260; i++) { ctx.fillStyle = `rgba(${r(i + fr) > 0.5 ? '0,255,255' : '180,60,255'},.6)`; ctx.fillRect(r(i * 2 + fr) * w, r(i * 5 + fr) * h, 2 + r(i) * 40, 2); }
  if (p > 0.85) { ctx.fillStyle = `rgba(7,7,12,${(p - 0.85) / 0.15})`; ctx.fillRect(0, 0, w, h); }
};

const hole: Effect['draw'] = (f, p, k) => {
  const { ctx, src, w, h } = f; bg(f);
  const cx = w / 2, cy = h / 2, N = 28, Rm = Math.hypot(cx, cy) + 4;
  for (let i = N - 1; i >= 0; i--) {
    const q = 1 - i / N, r0 = (Rm * i) / N, r1 = (Rm * (i + 1)) / N + 1;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r1, 0, 7); ctx.arc(cx, cy, r0, 0, 7, true); ctx.clip('evenodd');
    ctx.globalAlpha = 1 - cl((p - 0.6) / 0.4) * (0.4 + q * 0.6);
    ctx.translate(cx, cy); ctx.rotate(p * k * 7 * q * q); const s = 1 - p * 0.85 * q; ctx.scale(s, s); ctx.translate(-cx, -cy);
    ctx.drawImage(src, 0, 0); ctx.restore();
  }
  const rad = 20 + p * 110 * k, g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
  g.addColorStop(0, `rgba(0,0,0,${p > 0 ? 1 : 0})`); g.addColorStop(0.7, `rgba(0,0,0,${p})`); g.addColorStop(0.85, `rgba(140,70,255,${0.7 * p})`); g.addColorStop(1, 'transparent');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
};

const melt: Effect['draw'] = (f, p, k) => {
  const { ctx, src, w, h } = f; bg(f); const W = 6;
  for (let x = 0, i = 0; x < w; x += W, i++) {
    const t = cl((p - r(i) * 0.5) / 0.5);
    ctx.globalAlpha = 1 - cl((t - 0.6) / 0.4);
    ctx.drawImage(src, x, 0, W, h, x + Math.sin(t * 8 + i) * 3 * t, t * t * h * 1.1 * k * (0.5 + r(i + 1)), W, h * (1 + t * 0.5 * k));
  }
  ctx.globalAlpha = 1;
};

const slice: Effect['draw'] = (f, p, k) => {
  const { ctx, src, w, h } = f; bg(f);
  const A = [0, h * 0.75], B = [w, h * 0.25], nl = Math.hypot(h / 2, w), nx = h / 2 / nl, ny = w / nl;
  const t = 1 - (1 - cl(p * 1.4)) ** 3, s = t * Math.hypot(w, h) * 0.6 * k;
  ([[-1, [[0, 0], [w, 0], B, A]], [1, [A, B, [w, h], [0, h]]]] as [number, number[][]][]).forEach(([d, poly]) => {
    ctx.save(); ctx.beginPath(); poly.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.clip();
    ctx.globalAlpha = 1 - cl((p - 0.6) / 0.4);
    ctx.translate(w / 2 + d * nx * s, h / 2 + d * ny * s); ctx.rotate(d * t * 0.12 * k); ctx.translate(-w / 2, -h / 2);
    ctx.drawImage(src, 0, 0); ctx.restore();
  });
  if (p > 0 && p < 1) { ctx.globalAlpha = 1 - t; ctx.strokeStyle = '#22d3ee'; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 20; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
};

const blast: Effect['draw'] = (f, p, k) => {
  const { ctx, src, w, h } = f; bg(f);
  const cx = w / 2, cy = h / 2, N = 30, Rm = Math.hypot(cx, cy) + 4, front = p * Rm * 1.5;
  for (let i = 0; i < N; i++) {
    const r0 = (Rm * i) / N, r1 = (Rm * (i + 1)) / N + 1, d = front - r1, a = d < 0 ? 1 : 1 - cl(d / (Rm * 0.7));
    if (a <= 0) continue;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r1, 0, 7); ctx.arc(cx, cy, r0, 0, 7, true); ctx.clip('evenodd');
    ctx.globalAlpha = a; const s = d < 0 ? 1 : 1 + cl(d / Rm) * 1.2 * k;
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.rotate(d < 0 ? 0 : d * 0.0006 * k); ctx.translate(-cx, -cy);
    ctx.drawImage(src, 0, 0); ctx.restore();
  }
  if (p > 0 && p < 1) {
    ctx.strokeStyle = `rgba(255,220,150,${0.9 * (1 - p)})`; ctx.shadowColor = '#fb923c'; ctx.shadowBlur = 25; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, front, 0, 7); ctx.stroke(); ctx.shadowBlur = 0;
    if (p < 0.15) { ctx.fillStyle = `rgba(255,255,255,${((0.15 - p) / 0.15) * 0.6})`; ctx.fillRect(0, 0, w, h); }
  }
};

const matrix: Effect['draw'] = (f, p, k) => {
  const { ctx, src, w, h } = f; bg(f); const W = 10, fr = Math.floor(p * 40);
  ctx.font = '12px monospace'; ctx.textBaseline = 'top';
  for (let x = 0, i = 0; x < w; x += W, i++) {
    const u = cl((p - r(i) * 0.45) / 0.55), head = u * (h + 160 * k);
    if (head < h) ctx.drawImage(src, x, Math.max(0, head), W, h - Math.max(0, head), x, Math.max(0, head), W, h - Math.max(0, head));
    if (u <= 0) continue;
    const fade = 1 - cl((p - r(i) * 0.45 - 0.55) / 0.3);
    for (let y = head - 160 * k, j = 0; y < head; y += 14, j++) {
      if (y < -14 || y > h) continue;
      const a = ((y - (head - 160 * k)) / (160 * k)) * fade;
      ctx.fillStyle = `rgba(34,${180 + Math.round(a * 75)},90,${a})`;
      ctx.fillText(String.fromCharCode(0x30a0 + Math.floor(r(i * 31 + j + fr) * 90)), x, y);
    }
    if (head > 0 && head < h) { ctx.fillStyle = '#e8fff0'; ctx.fillText(String.fromCharCode(0x30a0 + Math.floor(r(i + fr) * 90)), x, head); }
  }
};

const shred: Effect['draw'] = (f, p, k) => {
  const { ctx, src, w, h } = f; bg(f); const W = 24;
  for (let x = 0, i = 0; x < w; x += W, i++) {
    const t = cl((p - r(i) * 0.45) / 0.55);
    ctx.save(); ctx.translate(x + W / 2 + Math.sin(t * 6 + i) * 10 * t * k, t * t * h * 1.4 * k); ctx.rotate((r(i + 3) - 0.5) * t * 0.9 * k);
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 10 * t;
    ctx.drawImage(src, x, 0, W, h, -W / 2, 0, W, h); ctx.restore();
  }
};

export const EFFECTS: Effect[] = [
  { id: 'pixel', name: 'Pixel Dissolve', blurb: 'Blocks scatter and fall away', draw: pixel },
  { id: 'glass', name: 'Glass Shatter', blurb: 'Shards burst outward with depth', draw: glass },
  { id: 'burn', name: 'Burn Away', blurb: 'A flame front eats the page', draw: burn },
  { id: 'glitch', name: 'Digital Glitch', blurb: 'RGB split, tearing and noise', draw: glitch },
  { id: 'hole', name: 'Black-Hole Vortex', blurb: 'Everything spirals into the void', draw: hole },
  { id: 'melt', name: 'Melt Down', blurb: 'The page drips toward the floor', draw: melt },
  { id: 'slice', name: 'Laser Slice', blurb: 'One clean cut, two halves drift apart', draw: slice },
  { id: 'blast', name: 'Shockwave', blurb: 'A blast ring tears outward from the center', draw: blast },
  { id: 'matrix', name: 'Matrix Rain', blurb: 'Falling code eats the page', draw: matrix },
  { id: 'shred', name: 'Paper Shredder', blurb: 'Strips fall away one by one', draw: shred },
];