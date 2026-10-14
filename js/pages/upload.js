import { boot, getJSON, ph, esc, $, $$, observe, fmtDate } from '../site.js';
import { createJob, pollJob, STEPS } from '../jobs.js';

const { config } = await boot();
const [report, programs] = await Promise.all([getJSON('sample-report'), getJSON('programs').catch(() => ({ levels: [] }))]);
const a = report.athlete;
const up = config.upload || { formats: ['.mp4', '.mov', '.avi'], maxMb: 200 };
const PROGRAMS = ['Small Group', 'Private', 'Team', 'Academy', 'Camps'];
const levels = (programs.levels || []).map((l) => l.name);
const today = new Date().toISOString().slice(0, 10);
const demos = ['s1', 's2', 'f1'].map((id) => report.sessions.find((s) => s.id === id)).filter(Boolean);
const OUTPUTS = [
  ['Pose skeleton overlay', 'Joints and limbs drawn on every frame of the shot.', 'video'],
  ['Ball trajectory and predicted flight', 'The ball tracked from the hand, with the predicted path to the rim.', 'tracking'],
  ['Player tracking', 'Shot chart, score and accuracy across the clip.', 'tracking'],
  ['Joint-path charts', 'Shoulder, elbow and wrist paths, left and right.', 'joint-paths'],
  ['Made vs missed comparison', 'Each mechanic measured against its target band.', 'metrics'],
  ['Written feedback', 'Consistency, posture and technique in plain words.', 'written-feedback'],
  ['Injury-risk assessment', 'Ankle, knee and landing mechanics flagged early.', 'injury-risk'],
  ['Training plan', 'Warm-up, drills and conditioning for the next block.', 'training-plan'],
];

const opt = (v, sel) => `<option${v === sel ? ' selected' : ''}>${esc(v)}</option>`;

$('#upload-root').innerHTML = `
<section class="page-hero">
  <div class="wrap">
    <span class="label">Coach tools · Session analysis</span>
    <h1>Upload a <em class="s">session.</em></h1>
    <p class="lead">Drop in a clip of the shot. The analysis detects the player, tracks the ball, measures the mechanics and builds the athlete's report.</p>
  </div>
</section>

<section class="section up-section" aria-label="Upload and analyse">
  <div class="wrap up-grid">
    <form class="card up-form" id="up-form" novalidate>
      <fieldset class="up-fs">
        <legend><span class="label">01 — The clip</span></legend>
        <label class="drop" id="drop" for="file">
          <input class="sr-only" type="file" id="file" name="file" accept="${esc(up.formats.join(','))}" aria-describedby="file-hint file-err">
          <svg class="drop-icon" viewBox="0 0 48 48" aria-hidden="true"><path class="chalk" d="M24 32 L24 10 M15 18 L24 9 L33 18"/><path class="chalk-accent" d="M8 30 C8 36 9 39 14 39 L34 39 C39 39 40 36 40 30"/></svg>
          <span class="drop-title" id="drop-title">Drag a clip here, or <u>browse files</u></span>
          <span class="meta" id="file-hint">${esc(up.formats.join(' · ').toUpperCase())} · up to ${esc(up.maxMb)} MB</span>
        </label>
        <p class="err up-err" id="file-err" role="alert"></p>

        <p class="or"><span>or use a demo clip</span></p>
        <div class="demos" role="radiogroup" aria-label="Demo clips">
          ${demos.map((s) => `<label class="demo">
            <input type="radio" name="demo" value="${esc(s.id)}">
            <img src="${esc(s.poster)}" alt="" width="320" height="180" loading="lazy">
            <span class="demo-text"><strong>${esc(s.clip)}</strong><span class="meta">${esc(fmtDate(s.date, { month: 'short', day: 'numeric' }))} · analysed</span></span>
          </label>`).join('')}
        </div>
        <p class="meta demo-note">The live model isn't hosted yet, so uploads run as a demo and open a sample report.</p>
      </fieldset>

      <fieldset class="up-fs">
        <legend><span class="label">02 — Athlete and session</span></legend>
        <div class="field">
          <label for="athlete">Athlete</label>
          <select id="athlete" name="athlete"><option value="${esc(a.id)}">${esc(a.name)}</option></select>
        </div>
        <div class="form-row">
          <div class="field"><label for="program">Program</label>
            <select id="program" name="program">${PROGRAMS.map((p) => opt(p, a.program)).join('')}</select></div>
          <div class="field"><label for="level">Level</label>
            <select id="level" name="level">${levels.map((l) => opt(l, a.level)).join('')}</select></div>
        </div>
        <div class="field"><label for="date">Session date</label>
          <input id="date" name="date" type="date" value="${today}" max="${today}"></div>
      </fieldset>

      <div class="up-foot">
        <button class="btn btn-primary" type="submit" id="go">Analyse clip</button>
        <p class="meta" id="choice" aria-live="polite">No clip chosen yet</p>
      </div>
    </form>

    <aside class="card up-status" aria-labelledby="status-h">
      <span class="label">03 — Analysis</span>
      <h2 id="status-h" class="status-h">Waiting for a <em class="s">clip.</em></h2>
      <p class="muted" id="status-text" aria-live="polite">Choose a clip and press Analyse. Each step lights up as it finishes.</p>
      <ol class="stepper" id="steps">${STEPS.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <div class="status-actions" id="status-actions"></div>
    </aside>
  </div>
</section>

<section class="section" aria-labelledby="out-h">
  <div class="wrap">
    <div class="section-head">
      <div><span class="label">04 — What the analysis produces</span>
        <h2 id="out-h">One clip, eight <em class="s">outputs.</em></h2></div>
      <p class="lead">Each one lands in the athlete's report. Open the sample to see them.</p>
    </div>
    <ul class="hgrid outputs">
      ${OUTPUTS.map(([t, d, anchor], i) => `<li class="reveal"><a href="/pages/report.html?id=s2#${anchor}">
        <span class="meta">${String(i + 1).padStart(2, '0')}</span>
        <h3>${esc(t)}</h3><p class="muted">${esc(d)}</p><span class="link-arrow">See it in a report →</span></a></li>`).join('')}
    </ul>
  </div>
</section>`;

// ---------- clip choice ----------
const form = $('#up-form');
const file = $('#file');
const drop = $('#drop');
const errEl = $('#file-err');
let chosen = null; // File | demo id string

function setErr(msg) {
  errEl.textContent = msg;
  drop.classList.toggle('invalid', !!msg);
  file.setAttribute('aria-invalid', msg ? 'true' : 'false');
}

function pickFile(f) {
  if (!f) return;
  const ext = (f.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
  if (!up.formats.includes(ext)) { setErr(`${f.name} isn't a supported video. Use ${up.formats.join(', ')}.`); chosen = null; return refresh(); }
  if (f.size > up.maxMb * 1024 * 1024) { setErr(`${f.name} is ${(f.size / 1048576).toFixed(0)} MB. The limit is ${up.maxMb} MB; trim the clip to the shot.`); chosen = null; return refresh(); }
  setErr('');
  chosen = f;
  $$('input[name="demo"]').forEach((r) => { r.checked = false; });
  refresh();
}

function refresh() {
  const t = $('#drop-title');
  if (chosen instanceof File) {
    t.innerHTML = `<strong>${esc(chosen.name)}</strong> · ${(chosen.size / 1048576).toFixed(1)} MB <u>change</u>`;
    drop.classList.add('has-file');
    $('#choice').textContent = `Ready: ${chosen.name}`;
  } else {
    t.innerHTML = 'Drag a clip here, or <u>browse files</u>';
    drop.classList.remove('has-file');
    $('#choice').textContent = chosen ? `Ready: demo clip ${demos.find((d) => d.id === chosen)?.clip}` : 'No clip chosen yet';
  }
}

file.addEventListener('change', () => pickFile(file.files[0]));
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
drop.addEventListener('drop', (e) => { e.preventDefault(); pickFile(e.dataTransfer.files[0]); });
$$('input[name="demo"]').forEach((r) => r.addEventListener('change', () => {
  chosen = r.value; file.value = ''; setErr(''); refresh();
}));

// ---------- job ----------
const stepsEl = $('#steps');
const go = $('#go');

function paint(job) {
  $$('li', stepsEl).forEach((li, i) => {
    const done = job.status === 'done' || i < job.step;
    li.classList.toggle('done', done);
    li.classList.toggle('active', !done && i === job.step && job.status !== 'error');
    li.setAttribute('aria-current', !done && i === job.step ? 'step' : 'false');
  });
  $('#status-text').textContent = job.status === 'done'
    ? 'Report ready. Opening it now.'
    : `Step ${job.step + 1} of ${STEPS.length}: ${STEPS[job.step]}.`;
}

async function run() {
  if (!chosen) {
    setErr('Choose a video file or one of the demo clips first.');
    file.focus();
    return;
  }
  go.disabled = true;
  $('#status-actions').innerHTML = '';
  $('#status-h').innerHTML = 'Analysing the <em class="s">shot.</em>';
  paint({ status: 'queued', step: 0 });
  const meta = Object.fromEntries(new FormData(form));
  delete meta.file; delete meta.demo;
  try {
    const { job_id } = await createJob(chosen, meta);
    const job = await pollJob(job_id, paint);
    $('#status-h').innerHTML = 'Report <em class="s">ready.</em>';
    const href = `/pages/report.html?id=${encodeURIComponent(job.report_id)}`;
    $('#status-actions').innerHTML = `<a class="btn btn-primary" href="${href}">Open report</a>`;
    setTimeout(() => { location.href = href; }, 900);
  } catch (e) {
    $$('li.active', stepsEl).forEach((li) => li.classList.remove('active'));
    $('#status-h').innerHTML = 'Something went <em class="s">wrong.</em>';
    $('#status-text').textContent = `${e.message || 'The analysis failed'}. Check the clip and try again.`;
    $('#status-actions').innerHTML = '<button class="btn btn-secondary" type="button" id="retry">Retry</button>';
    $('#retry').addEventListener('click', run);
    $('#retry').focus();
    go.disabled = false;
  }
}

form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
observe();
