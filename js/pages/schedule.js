// Schedule: filter chips (program, age group, coach, day), list and week views, register modal.
// ?program=<key>&level=<levelKey> pre-filters (used by Train With Us and the feedback report).
import { boot, getJSON, esc, ph, fmtDate, fmtTime, $, $$, observe } from '../site.js';
import { registerControl, wireRegister, spotsLeft } from '../register.js';

const { config } = await boot();
const [sched, programs] = await Promise.all([getJSON('schedule'), getJSON('programs')]);

const todayISO = (() => { const d = new Date(); return iso(d); })();
function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const dateOf = (s) => new Date(s + 'T12:00:00');
const dow = (s) => (dateOf(s).getDay() + 6) % 7; // 0 = Monday

let all = [...sched.sessions].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
const upcoming = all.filter((s) => s.date >= todayISO);
if (upcoming.length) all = upcoming; // sample data may be in the past; then show everything
const byId = Object.fromEntries(all.map((s) => [s.id, s]));

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const progList = programs.programs.filter((p) => p.show !== false && p.key !== 'memberships');
const coaches = [...new Set(all.map((s) => s.coach))].sort();

const GROUPS = [
  { key: 'program', label: 'Program', options: progList.map((p) => [p.key, p.name]) },
  { key: 'level', label: 'Age group', options: programs.levels.map((l) => [l.key, l.name]) },
  { key: 'coach', label: 'Coach', options: coaches.map((c) => [c, c]) },
  { key: 'day', label: 'Day', options: DAYS.map((d, i) => [String(i), d]) },
];

const params = new URLSearchParams(location.search);
const state = { program: '', level: '', coach: '', day: '', view: 'list', week: null };
for (const g of GROUPS) {
  const v = params.get(g.key);
  if (v && g.options.some(([k]) => k === v)) state[g.key] = v;
}
if (params.get('view') === 'week') state.view = 'week';

// ---------- filters ----------
const filtersEl = $('#filters');
filtersEl.innerHTML = GROUPS.map((g) => `<div class="fgroup" role="group" aria-labelledby="fl-${g.key}">
    <span class="meta fgroup-label" id="fl-${g.key}">${g.label}</span>
    <div class="chips">
      <button class="chip" type="button" data-group="${g.key}" data-value="" aria-pressed="false">All</button>
      ${g.options.map(([k, t]) => `<button class="chip" type="button" data-group="${g.key}" data-value="${esc(k)}" aria-pressed="false">${ph(t)}</button>`).join('')}
    </div>
  </div>`).join('') + `<button class="link-arrow sc-reset" type="button" id="reset">Clear all filters</button>`;

filtersEl.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip[data-group]');
  if (chip) {
    state[chip.dataset.group] = chip.dataset.value;
    state.week = null;
    update();
  }
});
$('#reset').addEventListener('click', () => {
  Object.assign(state, { program: '', level: '', coach: '', day: '', week: null });
  update();
});

const filtered = () => all.filter((s) =>
  (!state.program || s.program === state.program) &&
  (!state.level || s.level === state.level) &&
  (!state.coach || s.coach === state.coach) &&
  (state.day === '' || dow(s.date) === Number(state.day)));

// ---------- shared bits ----------
function spots(s) {
  const left = spotsLeft(s);
  const pct = s.capacity ? Math.round((s.booked / s.capacity) * 100) : 0;
  const cls = left === 0 ? 'full' : left < 3 ? 'low' : '';
  const text = left === 0 ? 'Full' : `${left} of ${s.capacity} ${s.capacity === 1 ? 'spot' : 'spots'} left`;
  return `<div class="spots ${cls}">
    <span class="spots-text">${text}</span>
    <span class="spots-bar" role="img" aria-label="${s.booked} of ${s.capacity} booked"><span style="width:${pct}%"></span></span>
  </div>`;
}

function emptyState() {
  const p = progList.find((x) => x.key === state.program);
  const team = state.program === 'team';
  return `<div class="sc-empty card">
    <h2 class="sc-empty-title">No sessions <em class="s">match</em> yet.</h2>
    <p class="muted">${team ? 'Team training is booked directly with the coaching staff.' : `Try another day or age group${p ? `, or see every ${esc(p.name)} session` : ''}.`}</p>
    <div class="btn-row">
      ${team ? '<a class="btn btn-primary" href="/pages/contact.html?interest=Team">Contact Us</a>' : ''}
      <button class="btn btn-secondary" type="button" data-clear>Clear filters</button>
    </div>
  </div>`;
}

// ---------- list view ----------
function renderList(list) {
  const el = $('#panel-list');
  if (!list.length) { el.innerHTML = emptyState(); return; }
  const days = {};
  list.forEach((s) => (days[s.date] ??= []).push(s));
  el.innerHTML = Object.entries(days).map(([date, rows]) => `<section class="day" aria-labelledby="d-${date}">
    <h2 class="day-head" id="d-${date}"><span>${fmtDate(date, { weekday: 'long' })}</span> <span class="day-date">${fmtDate(date, { month: 'long', day: 'numeric' })}</span>${date === todayISO ? ' <span class="meta">Today</span>' : ''}</h2>
    <ul class="rows" role="list">${rows.map((s) => `<li class="row${spotsLeft(s) === 0 ? ' is-full' : ''}">
      <p class="row-time"><span>${fmtTime(s.start)}</span><span class="row-end">– ${fmtTime(s.end)}</span></p>
      <div class="row-what"><h3>${esc(s.programName)}</h3><p class="row-level">${esc(s.levelName)}</p></div>
      <p class="row-who"><span>${ph(s.coach)}</span><span>${ph(s.location)}</span></p>
      ${spots(s)}
      <p class="row-price">${ph(s.price)}</p>
      <div class="row-cta">${registerControl(s, config)}</div>
    </li>`).join('')}</ul>
  </section>`).join('');
}

// ---------- week view ----------
function mondayOf(isoDate) {
  const d = dateOf(isoDate);
  d.setDate(d.getDate() - dow(isoDate));
  return iso(d);
}
function addDays(isoDate, n) { const d = dateOf(isoDate); d.setDate(d.getDate() + n); return iso(d); }

function renderWeek(list) {
  const el = $('#panel-week');
  const first = list[0]?.date || all[0]?.date || todayISO;
  state.week ??= mondayOf(first);
  const days = Array.from({ length: 7 }, (_, i) => addDays(state.week, i));
  const end = days[6];
  const inWeek = list.filter((s) => s.date >= state.week && s.date <= end);
  const hasPrev = list.some((s) => s.date < state.week);
  const hasNext = list.some((s) => s.date > end);
  el.innerHTML = `<div class="week-nav">
      <button class="btn btn-secondary btn-sm" type="button" data-week="-7" ${hasPrev ? '' : 'disabled'} aria-label="Previous week">← Prev</button>
      <h2 class="week-title" aria-live="polite">${fmtDate(state.week, { month: 'short', day: 'numeric' })} – ${fmtDate(end, { month: 'short', day: 'numeric' })}</h2>
      <button class="btn btn-secondary btn-sm" type="button" data-week="7" ${hasNext ? '' : 'disabled'} aria-label="Next week">Next →</button>
    </div>
    ${list.length ? '' : emptyState()}
    <div class="week">${days.map((d, i) => {
      const ss = inWeek.filter((s) => s.date === d);
      return `<section class="wday${d === todayISO ? ' is-today' : ''}" aria-label="${DAYS_LONG[i]} ${fmtDate(d, { month: 'long', day: 'numeric' })}">
        <h3 class="wday-head"><span>${DAYS[i]}</span> <span class="wday-num">${fmtDate(d, { day: 'numeric' })}</span></h3>
        ${ss.length ? `<ul class="wlist" role="list">${ss.map((s) => `<li class="wcard${spotsLeft(s) === 0 ? ' is-full' : ''}">
          <p class="wtime">${fmtTime(s.start)} – ${fmtTime(s.end)}</p>
          <h4>${esc(s.programName)}</h4>
          <p class="wmeta">${esc(s.levelName)}</p>
          <p class="wmeta">${ph(s.coach)} · ${ph(s.location)}</p>
          ${spots(s)}
          <div class="wcta"><span class="wprice">${ph(s.price)}</span>${registerControl(s, config)}</div>
        </li>`).join('')}</ul>` : '<p class="wnone">No sessions</p>'}
      </section>`;
    }).join('')}</div>`;
}

$('#panel-week').addEventListener('click', (e) => {
  const b = e.target.closest('[data-week]');
  if (!b) return;
  state.week = addDays(state.week, Number(b.dataset.week));
  renderWeek(filtered());
  $(`[data-week="${b.dataset.week}"]`)?.focus();
});
document.addEventListener('click', (e) => { if (e.target.closest('[data-clear]')) $('#reset').click(); });

// ---------- view tabs ----------
const tabs = $$('[role=tab]');
function setView(v, focus = false) {
  state.view = v;
  tabs.forEach((t) => {
    const on = t.id === `tab-${v}`;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus();
  });
  $('#panel-list').hidden = v !== 'list';
  $('#panel-week').hidden = v !== 'week';
  update();
}
tabs.forEach((t) => {
  t.addEventListener('click', () => setView(t.id.replace('tab-', '')));
  t.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = tabs.indexOf(t);
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    setView(tabs[n].id.replace('tab-', ''), true);
  });
});

// ---------- update ----------
function syncURL() {
  const p = new URLSearchParams();
  ['program', 'level', 'coach', 'day'].forEach((k) => state[k] !== '' && p.set(k, state[k]));
  if (state.view === 'week') p.set('view', 'week');
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function update() {
  $$('.chip[data-group]', filtersEl).forEach((c) => c.setAttribute('aria-pressed', String(state[c.dataset.group] === c.dataset.value)));
  const active = ['program', 'level', 'coach', 'day'].some((k) => state[k] !== '');
  $('#reset').hidden = !active;
  const list = filtered();
  $('#count').textContent = `${list.length} ${list.length === 1 ? 'session' : 'sessions'}${active ? ' match your filters' : ' coming up'}`;
  if (state.view === 'list') renderList(list); else renderWeek(list);
  syncURL();
  observe();
}

wireRegister($('.sc-body'), (id) => byId[id]);
setView(state.view);
