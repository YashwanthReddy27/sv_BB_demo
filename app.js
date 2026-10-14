// Shared helpers for the upload, results, history and schedule screens.
// Everything is stored in the browser (localStorage); there is no server.
import { loadCsv } from './sportsvision/sportsvision.js';

// The clips the existing analysis has already processed. Uploads are matched to one of these.
export const SHOTS = {
  'success-1': { label: 'Success 1', raw: '../media/1-success.mp4', overlay: '../media/1-success-analysis.mp4', data: '../media/1-success-pose.csv' },
  'success-2': { label: 'Success 2', raw: '../media/2-success.mp4', overlay: '../media/2-success-analysis.mp4', data: '../media/2-success-pose.csv' },
  'failed-1': { label: 'Failed 1', raw: '../media/1-failed.mp4', overlay: '../media/1-failed-analysis.mp4', data: '../media/1-failed-pose.csv' },
};
export const SESSION_TYPES = ['Individual', 'Small group', 'Team'];
const JOINTS = [['Left', 'Shoulder'], ['Right', 'Shoulder'], ['Left', 'Elbow'], ['Right', 'Elbow'], ['Left', 'Wrist'], ['Right', 'Wrist']];

export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const params = new URLSearchParams(location.search);
export const json = (name) => fetch(name).then((r) => r.json());

// ---------- storage ----------
function read(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { toast('Could not save in this browser'); } }
export const results = {
  all: () => read('sv-results'),
  get: (id) => read('sv-results').find((r) => r.id === id),
  save(r) { const all = read('sv-results').filter((x) => x.id !== r.id); all.push(r); write('sv-results', all); },
  byAthlete: (name) => read('sv-results').filter((r) => r.athlete.trim().toLowerCase() === name.trim().toLowerCase()).sort((a, b) => a.date.localeCompare(b.date) || a.created - b.created),
};
export const sessions = {
  all: () => read('sv-sessions').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
  get: (id) => read('sv-sessions').find((s) => s.id === id),
  save(s) { const all = read('sv-sessions').filter((x) => x.id !== s.id); all.push(s); write('sv-sessions', all); },
  remove(id) { write('sv-sessions', read('sv-sessions').filter((x) => x.id !== id)); },
};
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- key metrics: vertical travel of each tracked joint (from the pose data) ----------
export async function keyMetrics(shotKey) {
  const rows = await loadCsv(SHOTS[shotKey].data);
  return JOINTS.map(([side, joint]) => {
    const ys = rows.map((r) => Number(r[`${side}_${joint}_Keypoint_Y_coordinate`])).filter((v) => v > 0);
    return { key: `${side}_${joint}`, label: `${side} ${joint} Deviation`, value: Math.round(Math.max(...ys) - Math.min(...ys)), unit: 'px' };
  });
}

// ---------- share: a read-only link carrying the result + notes ----------
export function shareLink(r) {
  const data = btoa(unescape(encodeURIComponent(JSON.stringify(r))));
  return `${location.origin}${location.pathname.replace(/[^/]*$/, '')}results.html?view=${encodeURIComponent(data)}`;
}
export function fromShare(v) {
  try { return JSON.parse(decodeURIComponent(escape(atob(v)))); } catch { return null; }
}

export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.append(t); setTimeout(() => t.remove(), 2600);
}
export const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ---------- nav ----------
export function nav() {
  const here = location.pathname.split('/').pop() || 'index.html';
  const links = [['index.html', 'Analysis'], ['upload.html', 'Upload'], ['history.html', 'Athlete history'], ['schedule.html', 'Schedule']];
  const h = document.createElement('header');
  h.className = 'topnav';
  h.innerHTML = `<div class="wrap"><a class="brand" href="index.html">SportsVision.AI</a><nav aria-label="Main">${links
    .map(([href, t]) => `<a href="${href}"${href === here ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav></div>`;
  document.body.prepend(h);
}

// Line chart of one metric across sessions (inline SVG): ink line, accent on the latest value.
export function lineChart(points, unit) {
  const w = 320, h = 120, p = { l: 36, r: 12, t: 12, b: 24 };
  const vs = points.map((x) => x.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (lo === hi) { lo -= 1; hi += 1; }
  const X = (i) => p.l + (points.length < 2 ? (w - p.l - p.r) / 2 : (i * (w - p.l - p.r)) / (points.length - 1));
  const Y = (v) => p.t + (h - p.t - p.b) * (1 - (v - lo) / (hi - lo));
  const pts = points.map((x, i) => `${X(i)},${Y(x.v)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${points.length} sessions">
    <line x1="${p.l}" x2="${w - p.r}" y1="${Y(lo)}" y2="${Y(lo)}" stroke="#E3E1DA"/><line x1="${p.l}" x2="${w - p.r}" y1="${Y(hi)}" y2="${Y(hi)}" stroke="#E3E1DA"/>
    <text x="${p.l - 6}" y="${Y(hi) + 4}" text-anchor="end" font-family="Geist Mono" font-size="10" fill="#7A7E85">${Math.round(hi)}</text>
    <text x="${p.l - 6}" y="${Y(lo) + 4}" text-anchor="end" font-family="Geist Mono" font-size="10" fill="#7A7E85">${Math.round(lo)}</text>
    <polyline points="${pts}" fill="none" stroke="#0E0F11" stroke-width="2"/>
    ${points.map((x, i) => `<circle cx="${X(i)}" cy="${Y(x.v)}" r="${i === points.length - 1 ? 5 : 3.5}" fill="${i === points.length - 1 ? '#FF5A1F' : '#4A4E55'}"><title>${x.d}: ${x.v} ${unit}</title></circle>
      <text x="${X(i)}" y="${h - 6}" text-anchor="middle" font-family="Geist Mono" font-size="10" fill="#7A7E85">${x.d.slice(5)}</text>`).join('')}
  </svg>`;
}
