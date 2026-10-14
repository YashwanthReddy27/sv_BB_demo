// Home page: programs, approach boards, report teaser, testimonials, upcoming sessions, media.
import { boot, getJSON, esc, ph, $, $$, observe, fmtDate, fmtTime, reducedMotion } from '../site.js';
import { board, markerArrow } from '../boards.js';
import { loadAll, buildSession, fmt, unit, withUnit, targetText, rangeBar } from '../report-data.js';

const { site } = await boot();

heroVideo();
renderBoards();
await Promise.all([
  renderPrograms().catch(fail('program-cards')),
  renderTeaser().catch(fail('teaser-inner')),
  renderTestimonials().catch(() => $('#testimonials')?.remove()),
  renderSessions().catch(fail('sessions')),
]);
renderMedia(site);
numberSections();
observe();

function fail(id) {
  return (err) => {
    console.error(err);
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<p class="meta">Could not load this section.</p>';
  };
}

// ---------- hero video: load only when motion is welcome, with a pause/play control ----------
function heroVideo() {
  const v = $('#hero-video');
  const btn = $('#hero-toggle');
  if (!v || !btn) return;
  const saveData = navigator.connection?.saveData;
  let playing = false;
  const set = (on) => {
    playing = on;
    btn.setAttribute('aria-pressed', String(!on));
    btn.setAttribute('aria-label', on ? 'Pause background video' : 'Play background video');
    btn.querySelector('.hero-toggle-text').textContent = on ? 'Pause' : 'Play';
    btn.classList.toggle('is-paused', !on);
  };
  const play = () => v.play().then(() => set(true)).catch(() => set(false));
  btn.addEventListener('click', () => {
    if (playing) { v.pause(); set(false); } else play();
  });
  if (reducedMotion() || saveData) { set(false); return; }
  set(true);
  play();
}

// ---------- approach step boards ----------
function renderBoards() {
  const titles = { evaluate: 'Checklist', train: 'Shot path to the rim', film: 'Camera', feedback: 'Report with a rising line' };
  $$('#steps .step').forEach((li) => {
    const k = li.dataset.board;
    li.querySelector('.step-board').innerHTML = board(k, `Whiteboard sketch: ${titles[k]}`);
  });
}

// ---------- how we train ----------
async function renderPrograms() {
  const { programs } = await getJSON('programs');
  const slotText = { 'small-group': 'small group session', private: 'private session', team: 'team training session' };
  const cards = ['small-group', 'private', 'team']
    .map((k) => programs.find((p) => p.key === k && p.show !== false))
    .filter(Boolean);
  $('#program-cards').innerHTML = cards.map((p) => `
    <article class="card program-card reveal">
      <div class="slot">Photo: ${ph(`[${slotText[p.key]}]`)}</div>
      <h3>${ph(p.name)}</h3>
      <p class="muted program-short">${ph(p.short || p.description || '')}</p>
      <p class="meta program-film"><span class="dot rec" aria-hidden="true"></span>Every session filmed + feedback report</p>
      <a class="link-arrow" href="/pages/training.html#${esc(p.key)}">Learn more<span class="sr-only"> about ${esc(p.name)}</span> →</a>
    </article>`).join('');
}

// ---------- sample report teaser ----------
async function renderTeaser() {
  const r = buildSession(await loadAll());
  if (!r) throw new Error('No report session');
  const { session, athlete, headline, workOn } = r;
  const statusText = (s) => (s === 'good' ? 'On target' : 'Work on');
  const delta = (row) => {
    if (row.delta == null) return '';
    const sign = row.delta > 0 ? '+' : row.delta < 0 ? '−' : '±';
    return `${sign}${fmt(row.def, Math.abs(row.delta))}${unit(row.def)}`;
  };
  const focus = workOn[0] || r.rows.find((x) => x.key !== headline[0]?.key);
  const launch = headline.find((h) => h.key === 'launch_angle') || headline[1] || headline[0];

  $('#teaser-inner').innerHTML = `
    <header class="t-head">
      <div>
        <p class="meta">Feedback report · ${esc(fmtDate(session.date, { month: 'short', day: 'numeric', year: 'numeric' }))}</p>
        <h3 class="t-name">${ph(athlete.name)}</h3>
        <p class="meta t-sub">${esc(session.program)} · ${esc(session.level)} · ${ph(session.coach)}</p>
      </div>
      <span class="t-badge meta">${r.onTarget}/${r.total} on target</span>
    </header>
    <div class="t-metrics">
      ${headline.map((h) => `
        <div class="t-metric" data-key="${esc(h.key)}">
          <div class="t-m-label"><p class="t-m-name">${esc(h.def.short)}</p>
            <p class="status ${h.status}"><span class="dot ${h.status}" aria-hidden="true"></span>${statusText(h.status)}</p></div>
          <p class="t-num"><span data-count="${h.value}" data-decimals="${h.def.decimals ?? 1}">${fmt(h.def, h.value)}</span><span class="t-unit">${esc(unit(h.def).trim())}</span></p>
          <p class="meta t-delta">${h.delta != null ? `${delta(h)} vs last` : `target ${esc(targetText(h.def))}`}</p>
        </div>`).join('')}
    </div>
    ${focus ? `
    <div class="t-work">
      <p class="label t-work-label">What to work on</p>
      <div class="t-work-row">
        <div class="t-work-text">
          <h4>${esc(focus.def.label)}</h4>
          <p class="muted">${esc(focus.def.why || '')}</p>
        </div>
      </div>
      <div class="t-work-bar">${rangeBar(focus.def, focus.value)}</div>
      ${focus.def.drill?.name ? `<p class="t-drill"><span class="meta">Next session drill</span> <strong>${esc(focus.def.drill.name)}</strong> <span class="muted">${ph(focus.def.drill.reps || '')}</span></p>` : ''}
    </div>` : ''}
    ${r.wentWell.length ? `<div class="t-well"><p class="label">What went well</p>
      <ul>${r.wentWell.map((w) => `<li><span class="dot good" aria-hidden="true"></span><span>${esc(w.def.label)}</span><span class="meta">${esc(withUnit(w.def, w.value))}</span></li>`).join('')}</ul></div>` : ''}`;

  // Hand-written coach notes. Desktop: in the margin, pointing at the content. Mobile: inline under it.
  const notes = [
    { text: 'your release angle', target: `.t-metric[data-key="${launch?.key}"] .t-num` },
    { text: 'vs last session', target: '.t-metric:last-child .t-delta' },
    { text: 'drill for next session', target: '.t-drill' },
  ].filter((n) => $(n.target, $('#teaser-inner')));

  notes.forEach((n) => {
    const t = $(n.target, $('#teaser-inner'));
    const inline = document.createElement('span');
    inline.className = 'note-inline';
    inline.setAttribute('aria-hidden', 'true');
    inline.textContent = n.text;
    const metric = t.closest('.t-metric');
    if (metric) metric.append(inline); else t.insertAdjacentElement('afterend', inline);
  });

  const box = $('#teaser-notes');
  box.innerHTML = notes.map((n, i) => `<div class="note t-note" data-i="${i}"><span>${esc(n.text)}</span>${markerArrow(96, 44, true)}</div>`).join('');
  const place = () => {
    const wrap = $('#teaser');
    const card = $('.teaser-card', wrap);
    const wr = wrap.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    notes.forEach((n, i) => {
      const el = box.children[i];
      const t = $(n.target, $('#teaser-inner'));
      const tr = t.getBoundingClientRect();
      const top = tr.top - wr.top + tr.height / 2 - 64;
      const visible = tr.top + tr.height / 2 < cr.bottom - 40;
      el.style.top = `${Math.max(0, top)}px`;
      el.style.display = visible ? '' : 'none';
    });
  };
  place();
  addEventListener('resize', place);
  document.fonts?.ready.then(place);
}

// ---------- testimonials: only shown when there is at least one ----------
async function renderTestimonials() {
  const list = await getJSON('testimonials');
  const sec = $('#testimonials');
  if (!Array.isArray(list) || !list.length) { sec.remove(); return; }
  sec.hidden = false;
  const track = $('#carousel-track');
  const count = $('#carousel-count');
  let i = 0;
  const show = () => {
    const q = list[i];
    track.innerHTML = `<figure class="quote" aria-roledescription="slide" aria-label="${i + 1} of ${list.length}">
      <blockquote><p>${ph(q.quote)}</p></blockquote>
      <figcaption><strong>${ph(q.name)}</strong>${q.role ? `<span class="meta">${ph(q.role)}</span>` : ''}</figcaption>
    </figure>`;
    count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}`;
  };
  $$('.carousel-btn', sec).forEach((b) => {
    if (list.length < 2) { b.hidden = true; return; }
    b.addEventListener('click', () => { i = (i + Number(b.dataset.dir) + list.length) % list.length; show(); });
  });
  $('#carousel').addEventListener('keydown', (e) => {
    if (list.length < 2) return;
    if (e.key === 'ArrowLeft') { i = (i - 1 + list.length) % list.length; show(); }
    if (e.key === 'ArrowRight') { i = (i + 1) % list.length; show(); }
  });
  $('#carousel').tabIndex = 0;
  show();
}

// ---------- next 4 sessions ----------
async function renderSessions() {
  const { sessions } = await getJSON('schedule');
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const next = sessions
    .filter((s) => s.date >= today)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .slice(0, 4);
  const ul = $('#sessions');
  if (!next.length) {
    ul.innerHTML = '<li class="session-empty">No sessions are posted yet. <a href="/pages/schedule.html">Check the schedule</a> for new dates.</li>';
    return;
  }
  ul.innerHTML = next.map((s) => {
    const left = Math.max(0, (s.capacity ?? 0) - (s.booked ?? 0));
    const spots = left === 0 ? 'Full' : `${left} spot${left === 1 ? '' : 's'} left`;
    const low = left > 0 && left <= 2;
    return `<li class="session reveal">
      <p class="s-date"><span class="meta">${esc(fmtDate(s.date, { weekday: 'short' }))}</span><span class="s-day">${esc(fmtDate(s.date, { month: 'short', day: 'numeric' }))}</span></p>
      <p class="s-time">${fmtTime(s.start)}<span class="muted"> – ${fmtTime(s.end)}</span></p>
      <div class="s-what"><h3>${ph(s.programName)}</h3><p class="muted">${ph(s.levelName)} · ${ph(s.coach)}</p></div>
      <p class="s-spots meta${left === 0 ? ' full' : low ? ' low' : ''}">${spots}</p>
      <a class="btn ${left === 0 ? 'btn-secondary' : 'btn-primary'} btn-sm s-cta" href="/pages/schedule.html">${left === 0 ? 'Join waitlist' : 'Register'}<span class="sr-only"> for ${esc(s.programName)} on ${esc(fmtDate(s.date))} at ${fmtTime(s.start)}</span></a>
    </li>`;
  }).join('');
}

// ---------- media: Instagram + featured YouTube ----------
function renderMedia(siteData) {
  const insta = siteData?.socials?.Instagram || '';
  const link = $('#insta-link');
  const clean = insta.replace(/[[\]]/g, '');
  if (/^https?:\/\//.test(clean) && !insta.startsWith('[')) link.href = clean;
  else link.href = '#';

  const yt = (siteData?.youtubeFeatured || '').trim();
  const id = yt.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1] || (/^[\w-]{11}$/.test(yt) ? yt : '');
  if (id) {
    $('#yt').innerHTML = `<div class="media yt-frame"><iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}" title="Featured video"
      loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
  }
}

// ---------- "01 — HOW WE TRAIN" numbering, after optional sections are removed ----------
function numberSections() {
  $$('#main [data-sec]').forEach((el, i) => {
    el.textContent = `${String(i + 1).padStart(2, '0')} — ${el.textContent.replace(/^\d+ — /, '')}`;
  });
}
