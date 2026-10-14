import { boot, ph, esc, $, observe, fmtDate } from '../site.js';
import { loadAll, buildSession, progressChart, withUnit, targetText, miss } from '../report-data.js';

await boot();
const root = $('#athlete-root');
const id = new URLSearchParams(location.search).get('id') || 'demo';

let all;
try { all = await loadAll(); } catch { all = null; }

if (!all || all.report.athlete.id !== id || !all.sessions.length) {
  root.innerHTML = `<section class="page-hero"><div class="wrap empty">
    <span class="label">My Feedback</span>
    <h1>We can't find that <em class="s">profile.</em></h1>
    <p class="lead">The link may be old or mistyped. Use the link from your latest session email, or ask your coach to resend it.</p>
    <div class="btn-row"><a class="btn btn-primary" href="/pages/athlete.html?id=demo">See a sample profile</a><a class="btn btn-secondary" href="/pages/contact.html">Contact us</a></div>
  </div></section>`;
  root.removeAttribute('aria-busy');
} else {
  render();
}

function render() {
  const { report, defs, sessions } = all;
  const a = report.athlete;
  const views = sessions.map((s) => buildSession(all, s.id));
  const latest = views[views.length - 1];
  const first = views[0];

  // ---------- monthly review ----------
  const month = latest.session.date.slice(0, 7);
  const monthName = fmtDate(`${month}-01`, { month: 'long', year: 'numeric' });
  const inMonth = sessions.filter((s) => s.date.startsWith(month)).length;
  const moves = latest.rows.map((r) => {
    const f = first.byKey[r.key];
    if (r.value == null || f?.value == null) return null;
    return { r, f, gain: miss(r.def, f.value) - miss(r.def, r.value) };
  }).filter(Boolean).sort((x, y) => y.gain - x.gain);
  const best = moves[0]?.gain > 0 ? moves[0] : null;
  const next = latest.workOn[0];

  // ---------- past reports, newest first ----------
  const rows = [...views].reverse().map((v) => {
    const s = v.session;
    const pr = v.workOn[0] ? v.workOn[0].def.short : 'All on target';
    const st = v.onTarget / v.total >= 0.75 ? 'good' : 'bad';
    const href = `/pages/report.html?id=${encodeURIComponent(s.id)}`;
    return `<tr>
      <td data-label="Date"><a class="row-link" href="${href}">${esc(fmtDate(s.date, { month: 'short', day: 'numeric', year: 'numeric' }))}</a></td>
      <td data-label="Program"><span>${ph(s.program)} <span class="muted">· ${ph(s.level)}</span></span></td>
      <td data-label="Top priority">${esc(pr)}</td>
      <td data-label="On target"><span class="ontarget"><span class="dot ${st}" aria-hidden="true"></span>${v.onTarget}/${v.total}<span class="sr-only"> metrics on target</span></span></td>
      <td class="go"><a class="link-arrow" href="${href}" aria-label="Open report from ${esc(fmtDate(s.date, { month: 'long', day: 'numeric' }))}">View report →</a></td>
    </tr>`;
  }).join('');

  // ---------- progress charts (headline metrics) ----------
  const charts = latest.headline.map((r) => `<article class="card chart-card reveal">
      <div class="chart-head">
        <div><h3>${esc(r.def.short)}</h3><p class="meta">Target ${esc(targetText(r.def))}</p></div>
        <div class="chart-now"><span class="chart-val">${esc(withUnit(r.def, r.value))}</span>
          <span class="status ${r.status}"><span class="dot ${r.status}" aria-hidden="true"></span>${r.status === 'good' ? 'On target' : 'Work on'}</span></div>
      </div>
      ${progressChart(r.def, r.history)}
      <p class="muted chart-why">${esc(r.def.why || '')}</p>
    </article>`).join('');

  root.innerHTML = `
  <section class="page-hero">
    <div class="wrap">
      <span class="label">My Feedback · Athlete profile</span>
      <h1 class="ath-name">${ph(a.name)}'s <em class="s">progress.</em></h1>
      <div class="profile hgrid">
        <div><p class="meta">Level · Program</p><p class="pv">${ph(a.level)} · ${ph(a.program)}</p></div>
        <div><p class="meta">Coach</p><p class="pv">${ph(a.coach)}</p></div>
        <div><p class="meta">Membership</p><p class="pv">${ph(a.pass)}</p></div>
        <div class="focus"><p class="meta">Working on</p><p class="hand">${ph(a.focus)}</p></div>
      </div>
      <div class="btn-row hero-cta">
        <a class="btn btn-primary" href="/pages/report.html?id=${encodeURIComponent(latest.session.id)}">Open latest report</a>
        <a class="btn btn-secondary" href="/pages/schedule.html">Book next session</a>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="review-h">
    <div class="wrap">
      <span class="label">01 — Monthly progress review</span>
      <div class="card card-dark review on-dark reveal">
        <div class="review-head">
          <h2 id="review-h">${esc(monthName)}, at a <em class="s">glance.</em></h2>
          <p class="meta">For academy and members · updated after every session</p>
        </div>
        <dl class="review-grid">
          <div><dt>Sessions this month</dt><dd><span class="big" data-count="${inMonth}">${inMonth}</span></dd></div>
          <div><dt>Metrics on target</dt><dd><span class="big">${latest.onTarget}<small>/${latest.total}</small></span>
            <span class="was">first session: ${first.onTarget}/${first.total}</span></dd></div>
          <div><dt>Biggest improvement</dt><dd>${best
            ? `<span class="mid">${esc(best.r.def.short)}</span><span class="was">${esc(withUnit(best.r.def, best.f.value))} → ${esc(withUnit(best.r.def, best.r.value))}</span>`
            : '<span class="mid">Holding steady</span>'}</dd></div>
          <div><dt>Next focus</dt><dd><span class="mid">${next ? esc(next.def.short) : ph(a.focus)}</span>
            ${next ? `<span class="was">now ${esc(withUnit(next.def, next.value))}, target ${esc(targetText(next.def))}</span>` : ''}</dd></div>
        </dl>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="charts-h">
    <div class="wrap">
      <div class="section-head">
        <div><span class="label">02 — Progress</span>
          <h2 id="charts-h">Moving toward the <em class="s">target.</em></h2></div>
        <p class="lead">Grey band = target range. Green dots are on target, red dots still need work.</p>
      </div>
      <div class="grid grid-3 charts">${charts}</div>
    </div>
  </section>

  <section class="section" aria-labelledby="reports-h">
    <div class="wrap">
      <div class="section-head">
        <div><span class="label">03 — Past reports</span>
          <h2 id="reports-h">Every session, on <em class="s">file.</em></h2></div>
        <p class="meta">${sessions.length} report${sessions.length === 1 ? '' : 's'} · newest first</p>
      </div>
      <div class="table-wrap reports">
        <table>
          <caption class="sr-only">Past session reports, newest first</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">Program</th><th scope="col">Top priority</th><th scope="col">On target</th><th scope="col"><span class="sr-only">Open</span></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </section>`;
  root.removeAttribute('aria-busy');
  observe(root);
}
