// Shot analysis page: shot picker, synced player with phases, coaching feedback, 2D charts, compare view.
import { poseChart, loadCsv } from '../sportsvision/sportsvision.js';
import { nav, $, $$, esc, json, params, results, loadShots, refsFor, shareLink, fromShare, toast, fmtDate } from '../app.js';
import { FPS, compare, phrase, summary, when } from './analysis.js';
import { player } from './player.js';
import { jointChart, chartLegend, drillIcon } from './charts.js';

nav();
const shared = params.get('view') ? fromShare(params.get('view')) : null;
const record = shared ? shared.r : results.get(params.get('id'));
const shots = await loadShots();
const drills = (await json('../drills.json')).joints;
const makes = shots.filter((s) => s.result === 'make');
const miss = shots.find((s) => s.result === 'miss');
let current = shared?.shot || params.get('shot') || (miss ? miss.id : shots[0].id);
let pl = null;

if (record && !shared && !record.viewed) results.save({ ...record, viewed: true });

// ---------- header ----------
$('#kind').textContent = shared ? 'Session feedback · read-only' : 'Session feedback';
const nMake = makes.length, nMiss = shots.length - nMake;
$('#meta').innerHTML = [
  record ? `<span><strong>${esc(record.athlete)}</strong></span>` : '<span>Example session</span>',
  record ? `<span>${fmtDate(record.date)}</span>` : '',
  record ? `<span>${esc(record.type)}</span>` : '',
  record ? `<span>${esc(record.level)}</span>` : '',
  `<span class="num">${shots.length} shots · ${nMake} makes · ${nMiss} miss${nMiss === 1 ? '' : 'es'}</span>`,
].filter(Boolean).join('') + (!record ? ' <a href="upload.html" style="margin-left:6px">Upload film to assign an athlete</a>' : '');

// ---------- notes ----------
function getNote(shotId) {
  if (shared) return shared.notes?.[shotId] || '';
  if (record) return record.notes?.[shotId] || '';
  try { return JSON.parse(localStorage.getItem('sv-example-notes') || '{}')[shotId] || ''; } catch { return ''; }
}
function setNote(shotId, text) {
  if (record) {
    const r = results.get(record.id) || record;
    r.notes = { ...(r.notes && typeof r.notes === 'object' ? r.notes : {}), [shotId]: text };
    results.save(r); record.notes = r.notes;
  } else {
    try { const all = JSON.parse(localStorage.getItem('sv-example-notes') || '{}'); all[shotId] = text; localStorage.setItem('sv-example-notes', JSON.stringify(all)); } catch { /* private mode */ }
  }
}

// ---------- picker ----------
function renderPicker() {
  $('#picker').innerHTML = shots.map((s) => `<button type="button" class="shot-card" data-shot="${s.id}" aria-pressed="${current === s.id}">
      <img src="${s.thumb}" alt="" width="480" height="270" loading="lazy">
      <span class="row"><strong>${s.label}</strong><span class="chip ${s.result}">${s.result === 'make' ? 'Make' : 'Miss'}</span></span>
      <span class="row"><span class="label">${s.duration.toFixed(1)} s · ${s.n} frames</span></span></button>`).join('')
    + (miss && makes.length ? `<button type="button" class="shot-card compare" data-shot="compare" aria-pressed="${current === 'compare'}">
      <span class="cmp-icon" aria-hidden="true"><i></i><i></i></span><strong>Compare: Miss vs Makes</strong>
      <span class="label">Aligned at release</span></button>` : '');
  $$('#picker .shot-card').forEach((b) => b.addEventListener('click', () => {
    current = b.dataset.shot;
    const u = new URL(location.href); u.searchParams.set('shot', current); history.replaceState(null, '', u);
    render();
  }));
}

// ---------- helpers ----------
const px = (v) => `${Math.round(Math.abs(v))}`;
const signWord = (d) => (d > 0 ? 'higher' : 'lower');
const tFromRelease = (k) => `${k > 0 ? '+' : k < 0 ? '−' : ''}${Math.abs(k / FPS).toFixed(2)}s`;
const seekBtn = (frame, k) => `<button type="button" class="seek-link" data-frame="${frame}">Frame ${frame} · ${tFromRelease(k)} from release</button>`;

function rangeBar(row, shot) {
  const pk = row.peak;
  const lo = Math.min(pk.min, pk.v) - 15, hi = Math.max(pk.max, pk.v) + 15;
  const pct = (v) => ((v - lo) / (hi - lo)) * 100;
  return `<div class="range" role="img" aria-label="${esc(row.name)}: ${Math.round(pk.v)} px, makes range ${Math.round(pk.min)} to ${Math.round(pk.max)} px">
    <div class="range-track"></div>
    <div class="range-band" style="left:${pct(pk.min)}%;width:${Math.max(0.8, pct(pk.max) - pct(pk.min))}%"></div>
    <div class="range-mark ${row.status === 'good' ? 'good' : ''}" style="left:${pct(pk.v)}%"></div></div>
    <div class="range-legend"><span>Grey: ${shot.result === 'miss' ? 'makes' : 'other make'} ${Math.round(pk.min)}–${Math.round(pk.max)} px</span><span>${shot.label}: ${Math.round(pk.v)} px</span></div>`;
}

// ---------- shot view ----------
function renderShot(shot) {
  const refs = refsFor(shot, shots);
  const rows = compare(shot, refs);
  const top = rows.slice(0, 3);
  const isMiss = shot.result === 'miss';
  const wentWell = isMiss
    ? rows.filter((r) => !top.includes(r) && r.consistency >= 0.6).sort((a, b) => b.consistency - a.consistency).slice(0, 3)
    : [...rows].reverse().slice(0, 3);
  const seen = new Set();
  const drillList = top.flatMap((r) => (drills[r.key]?.drills || []).slice(0, 2).map((d) => ({ ...d, joint: r.name, icon: drills[r.key].icon })))
    .filter((d) => !seen.has(d.name) && seen.add(d.name)).slice(0, 6);
  const topPhrase = isMiss ? phrase(top[0]) : `${top[0].name} position ${when(top[0].peak.k)}`;

  $('#view').innerHTML = `
    <section class="card" aria-labelledby="pl-h">
      <div class="card-head"><h2 class="h3" id="pl-h">${shot.label} <span class="chip ${shot.result}" style="margin-left:6px">${isMiss ? 'Miss' : 'Make'}</span></h2>
        <span class="label">Original + pose tracking, synced</span></div>
      <div id="player"></div>
    </section>

    <section aria-labelledby="fb-h" style="display:grid;gap:24px">
      <div class="card">
        <p class="label" id="fb-h">Summary</p>
        <p class="summary-line">${esc(summary(shot, rows))}</p>
        <div class="tiles">${top.map((r) => `<div class="tile">
          <p class="label" style="margin:0">${esc(r.name)}</p>
          <p class="big" style="margin:0">${px(r.peak.d)}<small>px ${signWord(r.peak.d)}</small></p>
          <span class="status-line ${r.status}"><i></i>${r.status === 'good' ? (isMiss ? 'Within makes range' : 'Consistent') : (isMiss ? 'Outside makes range' : 'Varies from other make')}</span>
          ${seekBtn(r.frame, r.peak.k)}</div>`).join('')}</div>
      </div>

      <div class="fb-grid">
        <div class="card">
          <p class="label">What went well</p>
          <h2 class="h2">${isMiss ? 'Stayed with your makes' : 'Matches your other make'}</h2>
          <ol class="items">${wentWell.length ? wentWell.map((r) => `<li>
            <div class="item-top"><h3 class="item-h"><span class="ok-dot" aria-hidden="true"></span>${esc(r.name)} ${isMiss ? 'stays with your makes' : 'matches your other make'}</h3></div>
            <p class="muted" style="margin:0">Inside the ${isMiss ? 'makes’' : 'other make’s'} range for <span class="num">${Math.round(r.consistency * 100)}%</span> of the half-second around release.</p>
            ${seekBtn(shot.phases.release, 0)}</li>`).join('') : '<li><p class="muted" style="margin:0">No joint stays inside the makes’ range for most of the release window on this shot.</p></li>'}</ol>
        </div>
        <div class="card">
          <p class="label">What to work on</p>
          <h2 class="h2">${isMiss ? 'Biggest differences from your makes' : 'Where this make varies most'}</h2>
          <ol class="items">${top.map((r, i) => `<li>
            <div class="item-top"><h3 class="item-h"><span class="rank">${i + 1}</span>${esc(isMiss ? phrase(r) : `${r.name} varies ${when(r.peak.k)}`)}</h3>
              <span class="num" style="color:${r.status === 'bad' ? 'var(--bad)' : 'var(--ink)'}">${px(r.peak.d)} px ${signWord(r.peak.d)}</span></div>
            ${rangeBar(r, shot)}
            <p class="muted" style="margin:0">${esc(drills[r.key]?.why || '')}</p>
            ${seekBtn(r.frame, r.peak.k)}</li>`).join('')}</ol>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div><p class="label">Drills for next session</p><h2 class="h2">Work on this</h2></div><span class="chip neutral">TODO: coach to review</span></div>
        <div class="drills">${drillList.map((d) => `<article class="drill">
          ${drillIcon(d.icon)}<p class="label" style="margin:0">For: ${esc(d.joint)}</p>
          <h3 class="h3">${esc(d.name)}</h3><p class="muted" style="margin:0">${esc(d.howto)}</p>
          <p class="cue" style="margin:0">“${esc(d.cue)}”</p><p class="label" style="margin:0">Reps: <span class="num">${esc(d.reps)}</span></p></article>`).join('')}</div>
      </div>

      <div class="card">
        <div class="card-head"><div><p class="label">Coach notes</p><h2 class="h2">Notes on ${shot.label}</h2></div>
          ${shared ? '' : '<button type="button" class="btn btn-primary" id="share">Share</button>'}</div>
        <label class="sr-only" for="note">Coach notes for ${shot.label}</label>
        <textarea class="coach-note" id="note" ${shared ? 'readonly' : ''} placeholder="Write a note for the athlete">${esc(getNote(shot.id))}</textarea>
        <p class="label" id="note-status" style="margin:10px 0 0">${shared ? 'Read-only' : record ? 'Saved with this result' : 'Saved in this browser'}</p>
      </div>

      ${shared ? '' : `<div class="prompt"><p><span class="label">Next step</span>Schedule a session to work on ${esc(topPhrase.toLowerCase())}</p>
        <a class="btn btn-primary" href="schedule.html?new=1&focus=${encodeURIComponent(topPhrase)}${record ? `&athlete=${encodeURIComponent(record.athlete)}&type=${encodeURIComponent(record.type)}&level=${encodeURIComponent(record.level)}` : ''}">Schedule session</a></div>`}
    </section>

    <section class="card" aria-labelledby="ch-h">
      <div class="card-head"><div><p class="label">Charts</p><h2 class="h2" id="ch-h">How each joint moved</h2></div>
        <label class="toggle"><input type="checkbox" id="adv"> Advanced: 3D keypoints</label></div>
      <div id="charts2d">${chartLegend(shot)}<div class="multiples">${rows.map((r) => `<figure class="mchart">
        <h3>${esc(r.name)}: position vs ${isMiss ? 'makes' : 'other make'}</h3>
        <p class="cap">Height above hip centre, px (scaled to a 100 px torso) · time from release, s</p>
        ${jointChart(shot, refs, r.key)}</figure>`).join('')}</div></div>
      <div id="charts3d" hidden></div>
    </section>`;

  pl = player($('#player'), {
    left: { src: shot.raw, label: 'Original', poster: shot.thumb },
    right: { src: shot.overlay, label: 'Pose tracking' },
    phases: shot.phases, n: shot.n,
  });

  const note = $('#note');
  if (!shared) {
    let t;
    note.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { setNote(shot.id, note.value); $('#note-status').textContent = 'Saved'; }, 400); });
    $('#share').addEventListener('click', async () => {
      const notes = Object.fromEntries(shots.map((s) => [s.id, getNote(s.id)]));
      const url = shareLink({ r: record || null, notes, shot: shot.id });
      try { await navigator.clipboard.writeText(url); toast('Read-only link copied'); } catch { prompt('Copy this link', url); }
    });
  }

  $('#adv').addEventListener('change', async (e) => {
    $('#charts2d').hidden = e.target.checked;
    const box = $('#charts3d');
    box.hidden = !e.target.checked;
    if (e.target.checked && !box.dataset.done) {
      box.dataset.done = '1';
      box.innerHTML = '<div class="sv-grid-2" id="c3"></div>';
      const rowsCsv = await loadCsv(shot.data);
      for (const joint of ['Shoulder', 'Elbow', 'Wrist']) for (const side of ['Left', 'Right']) {
        const card = document.createElement('div'); card.className = 'sv-card'; $('#c3').append(card);
        poseChart(card, { rows: rowsCsv, joint, side });
      }
    }
  });
}

// ---------- compare view ----------
function renderCompare(makeId) {
  const make = shots.find((s) => s.id === makeId) || makes[0];
  const rows = compare(miss, makes);
  $('#view').innerHTML = `
    <section class="card" aria-labelledby="cmp-h">
      <div class="card-head"><div><p class="label">Compare</p><h2 class="h2" id="cmp-h">Miss vs Makes, aligned at release</h2></div>
        <div class="seg-btns" role="group" aria-label="Make to compare">${makes.map((m) => `<button type="button" data-make="${m.id}" aria-pressed="${m.id === make.id}">${m.label}</button>`).join('')}</div></div>
      <div id="player"></div>
      <p class="label" style="margin:12px 0 0">Both clips show the pose overlay. The right clip dims when it has no frame at that moment.</p>
    </section>
    <section class="card" aria-labelledby="mm-h">
      <div class="card-head"><div><p class="label">Every tracked joint</p><h2 class="h2" id="mm-h">Where the miss leaves the makes</h2></div></div>
      ${chartLegend(miss)}
      <div class="multiples">${rows.map((r) => `<figure class="mchart">
        <h3>${esc(r.name)}: position vs makes</h3>
        <p class="cap">Height above hip centre, px (scaled to a 100 px torso) · time from release, s · biggest gap ${Math.round(Math.abs(r.peak.d))} px</p>
        ${jointChart(miss, makes, r.key)}</figure>`).join('')}</div>
    </section>`;
  pl = player($('#player'), {
    left: { src: miss.overlay, label: `${miss.label} · miss`, poster: miss.thumb },
    right: { src: make.overlay, label: `${make.label} · make` },
    phases: miss.phases, n: miss.n,
    align: { leftAt: miss.phases.release / FPS, rightAt: make.phases.release / FPS },
  });
  $$('[data-make]').forEach((b) => b.addEventListener('click', () => renderCompare(b.dataset.make)));
}

function render() {
  pl?.destroy();
  renderPicker();
  if (current === 'compare') renderCompare(makes[0]?.id);
  else renderShot(shots.find((s) => s.id === current) || shots[0]);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('.seek-link');
  if (b && pl) { pl.seekFrame(Number(b.dataset.frame)); $('#player').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); }
});
render();
