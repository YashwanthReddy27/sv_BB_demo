// Builds report view-models from /data/sample-report.json (sessions + written feedback),
// /data/derived-metrics.json (values measured by tools/derive_metrics.py) and /data/metrics.json
// (labels, targets, wording). In live mode the same shape would come from GET /api/jobs/{id}.
import { getJSON } from './site.js';

export async function loadAll() {
  const [report, derived, defs] = await Promise.all([getJSON('sample-report'), getJSON('derived-metrics'), getJSON('metrics')]);
  const byClip = Object.fromEntries(derived.shots.map((s) => [s.clip, s]));
  const sessions = report.sessions
    .map((s) => ({ ...s, shot: byClip[s.clip] }))
    .filter((s) => s.shot)
    .sort((a, b) => a.date.localeCompare(b.date));
  return { report, defs, sessions };
}

export function statusOf(def, v) {
  if (v == null) return 'neutral';
  return v >= def.target[0] && v <= def.target[1] ? 'good' : 'bad';
}

// How far outside the target band, as a share of the scale. 0 when on target.
export function miss(def, v) {
  const span = def.scale[1] - def.scale[0];
  if (v < def.target[0]) return (def.target[0] - v) / span;
  if (v > def.target[1]) return (v - def.target[1]) / span;
  return 0;
}

export function fmt(def, v) {
  if (v == null) return '–';
  return Number(v).toFixed(def.decimals ?? 1);
}
export function unit(def) {
  return def.unit === '°' ? '°' : def.unit === 's' ? 's' : ` ${def.unit}`;
}
export function withUnit(def, v) {
  return `${fmt(def, v)}${unit(def)}`;
}
export function targetText(def) {
  return `${fmt(def, def.target[0])}–${fmt(def, def.target[1])}${unit(def)}`;
}

export function buildSession(all, id) {
  const { report, defs, sessions } = all;
  const idx = id ? sessions.findIndex((s) => s.id === id) : sessions.length - 1;
  if (idx < 0) return null;
  const s = sessions[idx];
  const prev = sessions[idx - 1];
  const events = Object.fromEntries(s.shot.events.map((e) => [e.key, e]));
  const rows = defs.order.filter((k) => defs.metrics[k]).map((key) => {
    const def = defs.metrics[key];
    const value = s.shot.metrics[key];
    const prevValue = prev?.shot.metrics[key];
    return {
      key, def, value,
      status: statusOf(def, value),
      miss: miss(def, value),
      delta: prevValue == null || value == null ? null : value - prevValue,
      prevStatus: prev ? statusOf(def, prevValue) : null,
      history: sessions.slice(0, idx + 1).map((h) => ({ date: h.date, id: h.id, v: h.shot.metrics[key] })),
      event: events[def.event],
    };
  });
  const good = rows.filter((r) => r.status === 'good');
  const bad = rows.filter((r) => r.status === 'bad').sort((a, b) => b.miss - a.miss);
  // went well: prefer the headline metrics, then whatever else is on target
  const isHead = (r) => (defs.headline.includes(r.key) ? 1 : 0);
  const wentWell = [...good].sort((a, b) => isHead(b) - isHead(a)).slice(0, 3);
  const workOn = bad.slice(0, 3);
  const seen = new Set();
  const drills = workOn.map((r) => ({ ...r.def.drill, forKey: r.key, forLabel: r.def.short }))
    .filter((d) => d.name && !seen.has(d.name) && seen.add(d.name));
  return {
    session: s, index: idx, prev, sessions, athlete: report.athlete,
    rows, byKey: Object.fromEntries(rows.map((r) => [r.key, r])),
    headline: defs.headline.map((k) => rows.find((r) => r.key === k)).filter(Boolean),
    wentWell, workOn, drills,
    events: s.shot.events.filter((e) => e.t != null),
    onTarget: good.length, total: rows.length,
    feedback: report.feedback, injuryRisk: report.injuryRisk, trainingPlan: report.trainingPlan,
    tracking: report.tracking, glossary: defs.glossary,
  };
}

// ---------- tiny inline-SVG charts ----------

export function sparkline(def, history, w = 120, h = 32) {
  const [lo, hi] = def.scale;
  const X = (i) => (history.length < 2 ? w / 2 : 4 + (i * (w - 8)) / (history.length - 1));
  const Y = (v) => h - 3 - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (h - 6);
  const band = `<rect x="0" y="${Y(def.target[1])}" width="${w}" height="${Math.max(1, Y(def.target[0]) - Y(def.target[1]))}" fill="#ECEAE3"/>`;
  const pts = history.filter((p) => p.v != null);
  const line = pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${def.short} over ${pts.length} sessions">
    ${band}<polyline points="${line}" fill="none" stroke="#0E0F11" stroke-width="1.5"/>
    ${last ? `<circle cx="${X(pts.length - 1)}" cy="${Y(last.v)}" r="3" fill="#FF5A1F"/>` : ''}</svg>`;
}

// Line chart across sessions with the target band shaded.
export function progressChart(def, history, { w = 520, h = 220 } = {}) {
  const pad = { l: 44, r: 16, t: 16, b: 34 };
  const [lo, hi] = def.scale;
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const X = (i) => pad.l + (history.length < 2 ? iw / 2 : (i * iw) / (history.length - 1));
  const Y = (v) => pad.t + ih - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * ih;
  const ticks = [lo, def.target[0], def.target[1], hi];
  const pts = history.map((p, i) => ({ ...p, x: X(i), y: Y(p.v) }));
  const d = `<rect x="${pad.l}" y="${Y(def.target[1])}" width="${iw}" height="${Y(def.target[0]) - Y(def.target[1])}" fill="#ECEAE3"/>
    <text x="${pad.l + iw - 4}" y="${Y(def.target[1]) + 14}" text-anchor="end" class="ct">target</text>
    ${ticks.map((t) => `<line x1="${pad.l}" x2="${pad.l + iw}" y1="${Y(t)}" y2="${Y(t)}" stroke="#E3E1DA"/><text x="${pad.l - 8}" y="${Y(t) + 4}" text-anchor="end" class="ct">${Number(t).toFixed(def.decimals ?? 1)}</text>`).join('')}
    <polyline class="draw-line" points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="#0E0F11" stroke-width="2"/>
    ${pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="${statusOf(def, p.v) === 'good' ? '#1F8A4C' : '#B4232A'}" stroke="#fff" stroke-width="2"><title>${p.date}: ${fmt(def, p.v)}${unit(def)}</title></circle>
      <text x="${p.x}" y="${h - 10}" text-anchor="middle" class="ct">${new Date(p.date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</text>`).join('')}`;
  return `<svg class="progress-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${def.label} across ${history.length} sessions, target ${targetText(def)}">
    <style>.ct{font:400 11px 'Geist Mono',monospace;fill:#7A7E85}</style>${d}</svg>`;
}

export function rangeBar(def, v) {
  const [lo, hi] = def.scale;
  const pct = (x) => ((Math.min(hi, Math.max(lo, x)) - lo) / (hi - lo)) * 100;
  return `<div class="range" role="img" aria-label="${def.short}: ${withUnit(def, v)}, target ${targetText(def)}">
      <div class="range-track"></div>
      <div class="range-band" style="left:${pct(def.target[0])}%;width:${pct(def.target[1]) - pct(def.target[0])}%"></div>
      <div class="range-mark" style="left:${pct(v)}%" data-v="${withUnit(def, v)}"></div>
    </div>
    <div class="range-legend"><span>${fmt(def, lo)}</span><span>target ${targetText(def)}</span><span>${fmt(def, hi)}</span></div>`;
}
