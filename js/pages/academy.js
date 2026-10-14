// Academy: hero facts from /data/academy.json, pillars, a year-on-film timeline beside a sample
// progress dashboard built from the sample report (/js/report-data.js), and the FAQ.
import { boot, getJSON, esc, ph, $, observe } from '../site.js';
import { board, markerArrow } from '../boards.js';
import { loadAll, buildSession, progressChart, withUnit, targetText } from '../report-data.js';

const { site } = await boot();
const [ac, faq] = await Promise.all([getJSON('academy'), getJSON('faq').catch(() => [])]);

// ---------- hero ----------
$('#ac-facts').innerHTML = [
  ['Applications open for', ac.season || site.season],
  ['Ages', ac.ages],
  ['Deadline', ac.deadline],
].map(([k, v]) => `<div><dt class="meta">${k}</dt><dd>${ph(v)}</dd></div>`).join('');
$('#ac-cta').innerHTML = `<a class="btn btn-primary" href="${esc(site.links?.academyApply || '#')}">Apply</a>
  <a class="btn btn-secondary" href="${esc(site.links?.academyBrochure || '#')}">Download brochure</a>`;
$('#ac-board').innerHTML = `${board('feedback', 'Whiteboard: a progress line climbing over the season')}
  <span class="note ac-note">month 1 → month 12</span>
  <span class="ac-arrow">${markerArrow(70, 40, true)}</span>`;

// ---------- intro + pillars ----------
$('#ac-intro').innerHTML = ph(ac.intro);
$('#pillars').innerHTML = (ac.pillars || []).map((p, i) => `<li class="pillar reveal" style="transition-delay:${i * 60}ms">
  <span class="pillar-n">${String(i + 1).padStart(2, '0')}</span>
  <h3>${ph(p.name)}</h3>
  <p class="muted">${ph(p.text)}</p></li>`).join('');

// ---------- timeline ----------
$('#timeline').innerHTML = `<svg class="draw tl-line" viewBox="0 0 12 600" preserveAspectRatio="none" aria-hidden="true">
    <path class="chalk-accent" d="M6 4 C7 120 5 240 6 360 C7 470 5 540 6 596"/></svg>
  ${(ac.timeline || []).map((t) => `<li class="tl-item reveal">
    <span class="tl-dot" aria-hidden="true"></span>
    <p class="meta tl-when">${ph(t.when)}</p>
    <h3>${ph(t.title)}</h3>
    <p class="muted">${ph(t.text)}</p></li>`).join('')}
  <li class="tl-links"><a class="link-arrow" href="/pages/report.html">See a full sample report →</a>
    <a class="link-arrow" href="/pages/athlete.html?id=demo">My Feedback →</a></li>`;

// ---------- sample dashboard ----------
async function dashboard() {
  const el = $('#dash');
  try {
    const all = await loadAll();
    const r = buildSession(all);
    if (!r) throw new Error('no sessions');
    const charts = ['release_elbow_angle', 'launch_angle'].map((k) => r.byKey[k]).filter(Boolean);
    const focus = r.workOn[0];
    el.innerHTML = `<div class="dash-head">
        <span class="dash-tag">Sample dashboard</span>
        <p class="meta">${ph(r.athlete.name)} · ${esc(r.athlete.level)} · ${r.sessions.length} sessions</p>
      </div>
      <div class="dash-grid">
        ${charts.map((row) => `<figure class="dash-card">
          <figcaption><h3>${esc(row.def.label)}</h3>
            <p class="meta">Latest ${withUnit(row.def, row.value)} · target ${targetText(row.def)}</p></figcaption>
          ${progressChart(row.def, row.history)}
        </figure>`).join('')}
        <article class="dash-card dash-review" aria-labelledby="review-title">
          <h3 id="review-title">Monthly progress review</h3>
          <p class="review-score"><span class="review-n">${r.onTarget}</span><span class="review-of">/ ${r.total}</span></p>
          <p class="meta">Metrics on target</p>
          <div class="review-bar" role="img" aria-label="${r.onTarget} of ${r.total} metrics on target"><span style="width:${(r.onTarget / r.total) * 100}%"></span></div>
          <dl class="review-list">
            <div><dt class="meta">Focus</dt><dd>${ph(r.athlete.focus)}</dd></div>
            ${r.wentWell.length ? `<div><dt class="meta">On target</dt><dd>${r.wentWell.map((w) => `<span class="status good"><span class="dot good"></span>${esc(w.def.short)}</span>`).join('')}</dd></div>` : ''}
            ${r.workOn.length ? `<div><dt class="meta">Work on</dt><dd>${r.workOn.map((w) => `<span class="status bad"><span class="dot bad"></span>${esc(w.def.short)}</span>`).join('')}</dd></div>` : ''}
          </dl>
          ${focus?.def?.drill?.name ? `<p class="hand review-note">Next: ${esc(focus.def.drill.name)}</p>` : ''}
        </article>
      </div>`;
  } catch (err) {
    console.warn('[academy] sample dashboard unavailable', err);
    el.innerHTML = `<div class="dash-head"><span class="dash-tag">Sample dashboard</span></div>
      <p class="muted">The sample dashboard could not load. <a href="/pages/report.html">See a full sample report →</a></p>`;
  }
  observe(el);
}

// ---------- FAQ ----------
$('#faq').innerHTML = (faq || []).map((f) => `<details class="acc"><summary>${ph(f.q)}</summary>
  <div class="acc-body">${ph(f.a)}</div></details>`).join('');

await dashboard();
observe();
