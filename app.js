// Shared helpers for every page: shot catalogue, browser storage, nav, share links.
// Everything is stored in the browser (localStorage); there is no server.
import { loadCsv } from './sportsvision/sportsvision.js';
import { buildShot, compare, phrase } from './js/analysis.js';

// The clips the existing analysis has processed, in the original order. Make/miss comes from the clip name.
export const SHOTS = [
  { id: 'shot-1', label: 'Shot 1', clip: '1 Success', result: 'make', raw: '../media/1-success.mp4', overlay: '../media/1-success-analysis.mp4', data: '../media/1-success-pose.csv', thumb: '../img/1-success-thumb.jpg' },
  { id: 'shot-2', label: 'Shot 2', clip: '2 Success', result: 'make', raw: '../media/2-success.mp4', overlay: '../media/2-success-analysis.mp4', data: '../media/2-success-pose.csv', thumb: '../img/2-success-thumb.jpg' },
  { id: 'shot-3', label: 'Shot 3', clip: '1 Failed', result: 'miss', raw: '../media/1-failed.mp4', overlay: '../media/1-failed-analysis.mp4', data: '../media/1-failed-pose.csv', thumb: '../img/1-failed-thumb.jpg' },
];
export const SESSION_TYPES = ['Individual', 'Small group', 'Team'];

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const params = new URLSearchParams(location.search);
export const json = (name) => fetch(name).then((r) => r.json());
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- analysis data ----------
let shotsPromise;
export function loadShots() {
  shotsPromise ??= Promise.all(SHOTS.map(async (s) => buildShot(s, await loadCsv(s.data))));
  return shotsPromise;
}
export const refsFor = (shot, all) => all.filter((s) => s.result === 'make' && s.id !== shot.id);
export function feedbackFor(shot, all) {
  const rows = compare(shot, refsFor(shot, all));
  return { rows, workOn: rows.slice(0, 3), top: rows[0] ? phrase(rows[0]) : '' };
}
// The miss drives the session's top "work on" item; with no miss, the least consistent make does.
export async function sessionTop() {
  const all = await loadShots();
  const miss = all.find((s) => s.result === 'miss') || all[0];
  return feedbackFor(miss, all).workOn;
}

// ---------- storage ----------
function read(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { toast('Could not save in this browser'); } }
export const results = {
  all: () => read('sv-results'),
  get: (id) => read('sv-results').find((r) => r.id === id),
  save(r) { const all = read('sv-results').filter((x) => x.id !== r.id); all.push(r); write('sv-results', all); },
  byAthlete: (name) => read('sv-results').filter((r) => r.athlete.trim().toLowerCase() === name.trim().toLowerCase())
    .sort((a, b) => a.date.localeCompare(b.date) || a.created - b.created),
};
export const sessions = {
  all: () => read('sv-sessions').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
  get: (id) => read('sv-sessions').find((s) => s.id === id),
  save(s) { const all = read('sv-sessions').filter((x) => x.id !== s.id); all.push(s); write('sv-sessions', all); },
  remove(id) { write('sv-sessions', read('sv-sessions').filter((x) => x.id !== id)); },
};
export function sessionStatus(s) {
  const r = s.resultId && results.get(s.resultId);
  if (!r) return { key: 'scheduled', label: 'Scheduled' };
  return r.viewed ? { key: 'ready', label: 'Feedback ready' } : { key: 'uploaded', label: 'Film uploaded' };
}

// ---------- share: a read-only link carrying the result + notes ----------
export function shareLink(data) {
  const v = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  return `${location.origin}${location.pathname.replace(/[^/]*$/, '')}index.html?view=${encodeURIComponent(v)}`;
}
export function fromShare(v) {
  try { return JSON.parse(decodeURIComponent(escape(atob(v)))); } catch { return null; }
}

export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.append(t); setTimeout(() => t.remove(), 2600);
}
export const fmtDate = (iso, o = { month: 'short', day: 'numeric', year: 'numeric' }) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', o);
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ---------- nav + footer ----------
export function nav() {
  const here = location.pathname.split('/').pop() || 'index.html';
  const links = [['index.html', 'Shot analysis'], ['upload.html', 'Upload'], ['history.html', 'Athlete history'], ['schedule.html', 'Schedule']];
  const h = document.createElement('header');
  h.className = 'topnav';
  h.innerHTML = `<div class="wrap">
    <a class="brand" href="index.html" aria-label="SportsVision LAMP home"><img src="../img/logo.png" alt="SportsVision" width="120" height="26"><span class="lamp">LAMP</span></a>
    <nav aria-label="Main">${links.map(([href, t]) => `<a href="${href}"${href === here ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav></div>`;
  document.body.prepend(h);
  const f = document.createElement('footer');
  f.className = 'foot';
  f.innerHTML = `<div class="wrap"><p>LAMP: Limitless Analytics for Mastering Performance</p><p class="label">Train Smarter . Perform Better . Win Bigger</p></div>`;
  document.body.append(f);
  if (!document.querySelector('link[rel=icon]')) {
    const l = document.createElement('link'); l.rel = 'icon'; l.href = '../img/favicon.png'; document.head.append(l);
  }
}
