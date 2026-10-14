// Feedback report: /pages/report.html?id=<session id>. ?job=<id> shows the processing stepper first.
import { boot, esc, ph, $, observe, toast, fmtDate, store } from '../site.js';
import { board } from '../boards.js';
import { loadAll, buildSession, withUnit, targetText, rangeBar, sparkline, progressChart, fmt, unit } from '../report-data.js';

const STEPS = ['Uploaded', 'Detecting players', 'Tracking ball', 'Measuring mechanics', 'Building report'];
const params = new URLSearchParams(location.search);
const stateEl = $('#report-state');

function setState(html) {
  stateEl.innerHTML = html;
  stateEl.hidden = !html;
}

function stateCard(label, title, text, actions = '') {
  return `<div class="state card"><span class="label">${label}</span><h1 class="r-h2">${title}</h1>
    <p class="lead" style="margin:16px 0 28px">${text}</p><div class="btn-row">${actions}</div></div>`;
}

async function runJob(jobId) {
  setState(`<div class="state card"><span class="label">Processing</span>
    <h1 class="r-h2">Building your <em class="s">report</em></h1>
    <p class="lead" style="margin:16px 0 28px">This page updates on its own. It usually takes a few minutes.</p>
    <ol class="stepper" id="job-steps" aria-live="polite">${STEPS.map((s) => `<li>${s}</li>`).join('')}</ol></div>`);
  const paint = (step) => document.querySelectorAll('#job-steps li').forEach((li, i) => {
    li.className = i < step ? 'done' : i === step ? 'active' : '';
  });
  let jobs = null;
  try { jobs = await import('../jobs.js'); } catch { /* demo fallback below */ }
  return new Promise((resolve, reject) => {
    if (jobs?.pollJob) {
      jobs.pollJob(jobId, (j) => {
        paint(j.step ?? 0);
        if (j.status === 'done') resolve(j.report_id);
        if (j.status === 'error') reject(new Error(j.error || 'Analysis failed'));
      });
    } else {
      let step = 0;
      const t = setInterval(() => { paint(++step); if (step >= STEPS.length) { clearInterval(t); resolve(params.get('id') || null); } }, 1000);
      paint(0);
    }
  });
}

function delta(r) {
  if (r.delta == null) return '<span class="meta">First session</span>';
  const d = r.delta, def = r.def;
  if (Math.abs(d) < Math.pow(10, -(def.decimals ?? 1))) return '<span class="meta">Same as last session</span>';
  const [lo, hi] = def.target;
  const mid = (lo + hi) / 2;
  const prev = r.value - d;
  const better = Math.abs(r.value - mid) < Math.abs(prev - mid);
  return `<span class="delta ${better ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${fmt(def, Math.abs(d))}${unit(def)}</span>
    <span class="meta">vs last session · ${better ? 'closer to target' : 'further from target'}</span>`;
}

function clipBtn(r, text = 'Watch clip') {
  if (!r.event) return '';
  return `<button type="button" class="btn btn-secondary btn-sm seek no-print" data-t="${r.event.t}">${text} <span class="meta">${r.event.t.toFixed(2)}s</span></button>`;
}

function render(m) {
  const s = m.session;
  document.title = `${m.athlete.name.replace(/[[\]]/g, '')} · ${s.program} · ${fmtDate(s.date)} · Feedback Report`;
  $('#r-athlete').innerHTML = `${ph(m.athlete.name)}`;
  $('#r-facts').innerHTML = [
    ['Session', `${esc(s.program)} · ${esc(s.level)}`],
    ['Date', fmtDate(s.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })],
    ['Coach', ph(s.coach)],
    ['Clip', `${esc(s.shot.clip)} · ${s.shot.result === 'made' ? 'Made shot' : 'Missed shot'}`],
  ].map(([k, v]) => `<div><dt class="meta">${k}</dt><dd>${v}</dd></div>`).join('');
  $('#r-switch').innerHTML = [...m.sessions].reverse().map((x) =>
    `<option value="${x.id}"${x.id === s.id ? ' selected' : ''}>${fmtDate(x.date)} · ${esc(x.program)} · ${esc(x.shot.clip)}</option>`).join('');

  // summary
  $('#r-summary').textContent = s.summary;
  $('#r-ontarget').textContent = `${m.onTarget} of ${m.total} metrics on target`;
  $('#r-headline').innerHTML = m.headline.map((r) => `<div class="hl">
      <p class="meta">${esc(r.def.short)}</p>
      <p class="big"><span data-count="${r.value}" data-decimals="${r.def.decimals ?? 0}">${fmt(r.def, r.value)}</span><span class="u">${esc(unit(r.def).trim())}</span></p>
      <p class="status ${r.status}"><span class="dot ${r.status}"></span>${r.status === 'good' ? 'On target' : 'Needs work'}</p>
      <p class="hl-delta">${delta(r)}</p>
      <p class="meta">Target ${targetText(r.def)}</p></div>`).join('');

  // a) went well
  $('#r-well').innerHTML = m.wentWell.length ? m.wentWell.map((r) => `<li>
      <div class="item-top"><h3 class="item-h"><span class="dot good" aria-hidden="true"></span>${esc(r.def.short)}</h3>
      <p class="item-v">${withUnit(r.def, r.value)}</p></div>
      <p class="meta">Target ${targetText(r.def)}</p>
      <p class="muted item-why">${esc(r.def.why)}</p>${clipBtn(r)}</li>`).join('')
    : '<li><p class="muted">Nothing on target yet this session. The priorities below are where the next gains are.</p></li>';

  // b) work on
  $('#r-work').innerHTML = m.workOn.length ? m.workOn.map((r, i) => `<li>
      <div class="item-top"><h3 class="item-h"><span class="rank">${i + 1}</span>${esc(r.def.label)}</h3>
      <p class="item-v bad">${withUnit(r.def, r.value)}</p></div>
      ${rangeBar(r.def, r.value)}
      <p class="item-why"><strong>Why it matters:</strong> ${esc(r.def.why)}</p>${clipBtn(r, 'See it at')}</li>`).join('')
    : '<li><p class="muted">Everything measured was on target. Keep stacking reps.</p></li>';

  // c) drills
  $('#r-drills').innerHTML = m.drills.map((d) => `<li class="drill">
      <div class="board drill-board">${board(d.diagram, `Drill diagram: ${d.name}`)}</div>
      <div><p class="meta">For: ${esc(d.forLabel)}</p><h3 class="item-h">${esc(d.name)}</h3>
      <p class="meta">Reps: ${ph(d.reps)}</p><p class="cue">“${esc(d.cue)}”</p></div></li>`).join('')
    || '<li><p class="muted">No drills needed: keep your current routine.</p></li>';
  const levelKey = { 'Youth': 'youth', 'Middle School': 'middle', 'High School': 'high', 'College': 'college', 'Adult': 'adult' }[s.level] || '';
  $('#r-book').href = `/pages/schedule.html?program=${encodeURIComponent(s.program.toLowerCase().replace(/\s+/g, '-'))}&level=${levelKey}`;

  renderVideo(m);

  // full metrics table
  $('#r-table').innerHTML = m.rows.map((r) => `<tr>
      <th scope="row"><span class="t-label">${esc(r.def.label)}</span><span class="t-why">${esc(r.def.why)}</span></th>
      <td class="num">${withUnit(r.def, r.value)}</td><td class="num">${targetText(r.def)}</td>
      <td><span class="status ${r.status}"><span class="dot ${r.status}"></span>${r.status === 'good' ? 'On target' : 'Needs work'}</span></td>
      <td>${sparkline(r.def, r.history)}</td></tr>`).join('');

  // progress charts for the headline metrics
  $('#r-progress').innerHTML = m.headline.map((r) => `<figure class="card chart-card">
      <figcaption><h3 class="r-h4">${esc(r.def.short)}</h3><p class="meta">Target ${targetText(r.def)} · ${r.history.length} sessions</p></figcaption>
      ${progressChart(r.def, r.history)}</figure>`).join('');

  // coach notes, saved per report
  const notes = $('#r-notes');
  notes.value = store.get(`sv-note-${s.id}`) ?? '';
  notes.oninput = () => store.set(`sv-note-${s.id}`, notes.value);

  // existing app content
  $('#r-tracking').innerHTML = m.tracking.map((t) => `<figure class="card track-card">
      <div class="media"><video src="${t.src}" controls playsinline preload="none" poster=""></video></div>
      <figcaption><h3 class="r-h4" style="margin-top:16px">${esc(t.title)}</h3></figcaption></figure>`).join('');
  const textCards = (items) => items.map((x, i) => `<div><p class="meta">${String(i + 1).padStart(2, '0')}</p><h3 class="r-h4">${esc(x.title)}</h3><p class="muted">${esc(x.text)}</p></div>`).join('');
  $('#r-written').innerHTML = textCards(m.feedback);
  $('#r-injury').innerHTML = textCards(m.injuryRisk);
  $('#r-plan').innerHTML = m.trainingPlan.map((p) => {
    const [h, ...rest] = p.split(':');
    return `<li><strong>${esc(h)}</strong>${rest.length ? ':' + esc(rest.join(':')) : ''}</li>`;
  }).join('');
  $('#r-glossary').innerHTML = m.glossary.map((g) => `<details class="acc"><summary>${esc(g.term)}</summary><div class="acc-body">${esc(g.text)}</div></details>`).join('');

  observe($('#report'));
}

function renderVideo(m) {
  const s = m.session;
  const video = $('#r-video');
  const orig = $('#v-orig'), ana = $('#v-ana');
  let view = 'analysis';
  video.poster = s.poster;
  video.src = s.analysis;
  const setView = (v) => {
    if (v === view) return;
    const t = video.currentTime, playing = !video.paused;
    view = v;
    video.src = v === 'analysis' ? s.analysis : s.video;
    video.addEventListener('loadedmetadata', () => { video.currentTime = t; if (playing) video.play().catch(() => {}); }, { once: true });
    orig.setAttribute('aria-pressed', v === 'original');
    ana.setAttribute('aria-pressed', v === 'analysis');
    $('#v-note').textContent = v === 'analysis' ? 'Analysis view: pose skeleton, ball path and release markers.' : 'Original footage, no overlays.';
  };
  orig.onclick = () => setView('original');
  ana.onclick = () => setView('analysis');

  // events coloured by the status of the metrics measured at that moment
  const evStatus = (key) => {
    const rs = m.rows.filter((r) => r.def.event === key);
    if (!rs.length) return 'neutral';
    return rs.some((r) => r.status === 'bad') ? 'bad' : 'good';
  };
  const dur = s.shot.frames / s.shot.fps;
  $('#tl-marks').innerHTML = m.events.map((e) => `<button type="button" class="tl-mark ${evStatus(e.key)} seek" data-t="${e.t}"
      style="left:${(e.t / dur) * 100}%" aria-label="${esc(e.label)} at ${e.t.toFixed(2)} seconds"></button>`).join('');
  $('#tl-list').innerHTML = m.events.map((e) => `<li><button type="button" class="tl-item seek" data-t="${e.t}">
      <span class="dot ${evStatus(e.key)}"></span><span class="meta">${e.t.toFixed(2)}s</span> ${esc(e.label)}</button></li>`).join('');
  video.ontimeupdate = () => { $('#tl-progress').style.width = `${Math.min(100, (video.currentTime / (video.duration || dur)) * 100)}%`; };
}

function seekTo(t) {
  const video = $('#r-video');
  const go = () => { video.currentTime = t; video.pause(); };
  if (video.readyState >= 1) go(); else video.addEventListener('loadedmetadata', go, { once: true });
  $('#video').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  video.focus({ preventScroll: true });
}

async function mountShots(all) {
  const host = $('#r-shots');
  const go = async () => {
    try {
      const { shotAnalysis } = await import('../sportsvision/sportsvision.js');
      const shots = all.sessions.map((x) => ({
        label: `${x.shot.clip} · ${x.shot.result === 'made' ? 'made' : 'missed'}`, raw: x.video, overlay: x.analysis, data: x.pose,
      }));
      host.innerHTML = '';
      shotAnalysis(host, { shots });
    } catch (e) {
      host.innerHTML = `<div class="card"><p class="muted">Charts could not load: ${esc(e.message)}</p></div>`;
    }
  };
  // Plotly is heavy: only load it when the section comes near the viewport
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: '400px' });
    io.observe(host);
  } else go();
}

async function main() {
  await boot();
  let id = params.get('id');
  if (params.get('job')) {
    try { id = (await runJob(params.get('job'))) || id; history.replaceState(null, '', `/pages/report.html?id=${id}`); }
    catch (e) {
      setState(stateCard('Error', 'Analysis <em class="s">failed</em>', esc(e.message), '<a class="btn btn-primary" href="/pages/upload.html">Try again</a>'));
      return;
    }
  }
  let all;
  try { all = await loadAll(); }
  catch (e) {
    setState(stateCard('Error', 'Report could not <em class="s">load</em>', `Something went wrong loading this report (${esc(e.message)}). Refresh to try again.`, '<button class="btn btn-primary" type="button" onclick="location.reload()">Retry</button>'));
    return;
  }
  if (!all.sessions.length) {
    setState(stateCard('No reports yet', 'Nothing on film <em class="s">yet</em>', 'Reports appear here after a filmed session has been analysed.', '<a class="btn btn-primary" href="/pages/schedule.html">Book a session</a>'));
    return;
  }
  const m = buildSession(all, id);
  if (!m) {
    setState(stateCard('Not found', 'We couldn’t find that <em class="s">report</em>', 'The link may be old or mistyped. Here are the latest ones instead.',
      `<a class="btn btn-primary" href="/pages/report.html">Open latest report</a><a class="btn btn-secondary" href="/pages/athlete.html?id=demo">All my reports</a>`));
    return;
  }
  setState('');
  $('#report').hidden = false;
  render(m);
  mountShots(all);

  document.addEventListener('click', (e) => {
    const b = e.target.closest('.seek');
    if (b) seekTo(parseFloat(b.dataset.t));
  });
  $('#r-switch').onchange = (e) => { location.search = `?id=${e.target.value}`; };
  $('#r-pdf').onclick = () => window.print();
  $('#r-share').onclick = async () => {
    const url = `${location.origin}${location.pathname}?id=${m.session.id}`;
    try {
      if (navigator.share && matchMedia('(max-width: 640px)').matches) await navigator.share({ title: document.title, url });
      else { await navigator.clipboard.writeText(url); toast('Link copied. Send it to a parent.'); }
    } catch { toast(url); }
  };
}

main();
