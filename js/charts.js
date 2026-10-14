// Inline-SVG charts. Ink for the main series, #4A4E55 secondary, accent only for the highlight.
import { FPS, grid, band } from './analysis.js';

const INK = '#0E0F11', INK2 = '#4A4E55', LABEL = '#7A7E85', HAIR = '#E3E1DA', BAND = '#E6E3DA', ACCENT = '#FF5A1F';
const MISS = '#B4232A', MAKE = '#1F8A4C';
const txt = (x, y, s, a = 'middle') => `<text x="${x}" y="${y}" text-anchor="${a}" font-family="Geist Mono, monospace" font-size="10" fill="${LABEL}">${s}</text>`;

// One joint over time around release: makes band (min–max) + mean, this shot as a line.
export function jointChart(shot, refs, joint, { w = 360, h = 190 } = {}) {
  const ks = grid([shot, ...refs], 1.2);
  const b = band(refs, joint, ks);
  const line = ks.map((k) => ({ k, v: shot.series[joint][shot.phases.release + k] ?? null }));
  const vals = [...b.flatMap((p) => [p.min, p.max]), ...line.map((p) => p.v)].filter((v) => v != null);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const padV = (hi - lo) * 0.08 || 5; lo -= padV; hi += padV;
  const p = { l: 40, r: 10, t: 10, b: 26 };
  const k0 = ks[0], k1 = ks[ks.length - 1];
  const X = (k) => p.l + ((k - k0) / (k1 - k0 || 1)) * (w - p.l - p.r);
  const Y = (v) => p.t + (1 - (v - lo) / (hi - lo)) * (h - p.t - p.b);
  const seg = (pts) => {
    // split into runs where values exist
    const runs = []; let cur = [];
    pts.forEach((q) => { if (q.v == null) { if (cur.length) runs.push(cur); cur = []; } else cur.push(q); });
    if (cur.length) runs.push(cur);
    return runs;
  };
  const bandRuns = seg(b.map((q) => ({ k: q.k, v: q.min, max: q.max })));
  const area = bandRuns.map((r) => `<path d="M${r.map((q) => `${X(q.k).toFixed(1)},${Y(q.max).toFixed(1)}`).join('L')}L${[...r].reverse().map((q) => `${X(q.k).toFixed(1)},${Y(q.v).toFixed(1)}`).join('L')}Z" fill="${BAND}"/>`).join('');
  const meanRuns = seg(b.map((q) => ({ k: q.k, v: q.mean })));
  const mean = meanRuns.map((r) => `<polyline points="${r.map((q) => `${X(q.k).toFixed(1)},${Y(q.v).toFixed(1)}`).join(' ')}" fill="none" stroke="${INK}" stroke-width="1" />`).join('');
  const color = shot.result === 'miss' ? MISS : INK;
  const main = seg(line).map((r) => `<polyline points="${r.map((q) => `${X(q.k).toFixed(1)},${Y(q.v).toFixed(1)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>`).join('');
  const ticksX = [-1, -0.5, 0, 0.5, 1].filter((s) => s * FPS >= k0 && s * FPS <= k1);
  const ticksY = [lo + padV, (lo + hi) / 2, hi - padV];
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${joint.replace('_', ' ')} height over time around release">
    ${ticksY.map((v) => `<line x1="${p.l}" x2="${w - p.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${HAIR}"/>${txt(p.l - 6, Y(v) + 3, Math.round(v), 'end')}`).join('')}
    ${area}${mean}
    <line x1="${X(0)}" x2="${X(0)}" y1="${p.t}" y2="${h - p.b}" stroke="${ACCENT}" stroke-width="1.5"/>
    ${main}
    ${ticksX.map((s) => txt(X(s * FPS), h - 8, `${s > 0 ? '+' : ''}${s}s`)).join('')}
  </svg>`;
}

export const chartLegend = (shot) => `<div class="legend">
  <span><i style="background:${BAND};height:10px"></i>Makes range</span>
  <span><i style="background:${INK};height:1px"></i>Makes average</span>
  <span><i style="background:${shot.result === 'miss' ? MISS : INK};height:3px"></i>${shot.label}</span>
  <span><i style="background:${ACCENT};width:2px;height:12px"></i>Release</span></div>`;

// Trend across sessions: one line per series. series = [{ name, points: [{ d, v }] }]
export function trendChart(series, unit, { w = 520, h = 200 } = {}) {
  const all = series.flatMap((s) => s.points.map((q) => q.v));
  let lo = Math.min(...all), hi = Math.max(...all);
  if (lo === hi) { lo -= 5; hi += 5; }
  const n = Math.max(...series.map((s) => s.points.length));
  const p = { l: 40, r: 14, t: 14, b: 28 };
  const X = (i) => p.l + (n < 2 ? (w - p.l - p.r) / 2 : (i * (w - p.l - p.r)) / (n - 1));
  const Y = (v) => p.t + (1 - (v - lo) / (hi - lo)) * (h - p.t - p.b);
  const colors = [INK, INK2];
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Trend across ${n} sessions">
    ${[lo, hi].map((v) => `<line x1="${p.l}" x2="${w - p.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${HAIR}"/>${txt(p.l - 6, Y(v) + 3, Math.round(v), 'end')}`).join('')}
    ${series.map((s, si) => `<polyline points="${s.points.map((q, i) => `${X(i)},${Y(q.v)}`).join(' ')}" fill="none" stroke="${colors[si % 2]}" stroke-width="2" ${si ? 'stroke-dasharray="5 4"' : ''}/>
      ${s.points.map((q, i) => `<circle cx="${X(i)}" cy="${Y(q.v)}" r="${i === s.points.length - 1 ? 5 : 3.5}" fill="${i === s.points.length - 1 ? ACCENT : colors[si % 2]}"><title>${q.d}: ${Math.round(q.v)} ${unit}</title></circle>`).join('')}`).join('')}
    ${(series[0]?.points || []).map((q, i) => txt(X(i), h - 8, q.d.slice(5))).join('')}
  </svg>`;
}

// Small hand-drawn style icons for drills (wobbly single strokes).
const ICONS = {
  shoulder: '<path d="M10 34 C16 22 26 18 34 18 C42 18 50 22 54 30"/><circle cx="32" cy="12" r="5"/><path d="M20 44 C26 40 38 40 44 44"/>',
  elbow: '<path d="M14 48 C18 36 22 30 30 28"/><path d="M30 28 C36 24 40 16 42 8"/><path d="M38 12 L42 7 L46 12"/>',
  wrist: '<path d="M16 46 C22 34 28 26 34 22"/><path d="M34 22 C40 20 46 22 48 28"/><circle cx="46" cy="12" r="6"/>',
  feet: '<path d="M14 48 C14 40 18 36 24 36"/><path d="M40 48 C40 40 44 36 50 36"/><path d="M10 54 L54 54"/>',
};
export function drillIcon(kind) {
  return `<svg class="drill-icon" viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[kind] || ICONS.wrist}</g></svg>`;
}
