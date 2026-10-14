// Train With Us: one section per program in /data/programs.json (hidden when show:false),
// a sticky jump bar, membership tiers, camps and team training.
import { boot, getJSON, esc, ph, headline, $, $$, observe } from '../site.js';
import { board } from '../boards.js';

const { site } = await boot();
const [data, tiers] = await Promise.all([getJSON('programs'), getJSON('memberships')]);
const programs = data.programs.filter((p) => p.show !== false);
const levels = data.levels || [];

const num = (i) => String(i + 1).padStart(2, '0');
const plain = (s) => String(s ?? '').replace(/\*/g, '');

const PASS = {
  'Single session': 'One session',
  '5-pack': 'Five sessions',
  '10-pack': 'Ten sessions',
  Membership: 'Weekly sessions, monthly price',
  'Season package': 'Sessions for the whole season',
};

function head(p, i, extra = '') {
  return `<span class="label">${num(i)} — ${esc(p.name)}</span>
    <h2 id="${esc(p.key)}-title">${headline(p.title)}</h2>${extra}`;
}

function facts(p) {
  const f = [['Duration', p.duration], ['Group size', p.groupSize], ['Ages / levels', p.ages]].filter(([, v]) => v);
  return `<dl class="facts">${f.map(([k, v]) => `<div><dt class="meta">${k}</dt><dd>${ph(v)}</dd></div>`).join('')}</dl>`;
}

function booking(p) {
  if (!p.booking?.length) return '';
  return `<div class="book">
    <h3 class="sub">How to book</h3>
    <ul class="book-list">${p.booking.map((b) => `<li><span class="book-name">${esc(b)}</span>${PASS[b] ? `<span class="book-note">${esc(PASS[b])}</span>` : ''}</li>`).join('')}</ul>
  </div>`;
}

function onFilm(p) {
  if (!p.onFilm?.length) return '';
  return `<div class="film">
    <h3 class="sub">What’s on film</h3>
    <ul class="film-list">${p.onFilm.map((t) => `<li>${ph(t)}</li>`).join('')}</ul>
  </div>`;
}

function visual(p) {
  if (p.visual === 'photo' || !p.visual) {
    return `<div class="slot tr-photo" role="img" aria-label="Photo placeholder: ${esc(p.name)} session">[Photo: ${esc(p.name)} session]</div>`;
  }
  return `<figure class="board tr-board">${board(p.visual, `Whiteboard: ${p.name} drill`)}
    <figcaption class="meta">Whiteboard · ${esc(p.name)}</figcaption></figure>`;
}

function levelCards(p) {
  return `<div class="levels">
    <h3 class="sub">Schedule by age group</h3>
    <ul class="hgrid level-grid" role="list">${levels.map((l) => `<li class="level">
      <h4>${esc(l.name)}</h4>
      <p class="meta">${ph(l.ages)}</p>
      <a class="btn btn-secondary btn-sm" href="/pages/schedule.html?program=${encodeURIComponent(p.key)}&amp;level=${encodeURIComponent(l.key)}"
        aria-label="Schedule ${esc(p.name)} for ${esc(l.name)}">Schedule Now</a>
    </li>`).join('')}</ul>
  </div>`;
}

function programSection(p, i) {
  return `<section class="section prog reveal" id="${esc(p.key)}" aria-labelledby="${esc(p.key)}-title">
    <div class="wrap">
      <div class="prog-grid">
        <div class="prog-copy">
          ${head(p, i)}
          <p class="lead">${ph(p.description)}</p>
          ${facts(p)}
          <div class="prog-cols">${booking(p)}${onFilm(p)}</div>
        </div>
        <div class="prog-visual">${visual(p)}</div>
      </div>
      ${levelCards(p)}
    </div>
  </section>`;
}

const PERKS = ['Feedback report after every session', 'Monthly progress review'];

function membershipSection(p, i) {
  return `<section class="section prog reveal" id="${esc(p.key)}" aria-labelledby="${esc(p.key)}-title">
    <div class="wrap">
      <div class="section-head"><div>${head(p, i, `<p class="lead">Pick how often you train. Every tier is filmed, reported and reviewed with a coach each month.</p>`)}</div></div>
      <ul class="tiers" role="list">${tiers.map((t) => `<li class="card tier${t.featured ? ' card-dark on-dark tier-featured' : ''}">
        ${t.featured ? '<span class="tier-flag">Featured</span>' : ''}
        <h3>${ph(t.name)}</h3>
        <p class="tier-week">${ph(t.perWeek)}</p>
        <p class="tier-price"><span class="tier-amt">${ph(t.price)}</span><span class="tier-per">/ month</span></p>
        <p class="tier-for">${ph(t.for)}</p>
        <ul class="tier-perks">${PERKS.map((x) => `<li>${x}</li>`).join('')}</ul>
        <a class="btn ${t.featured ? 'btn-primary' : 'btn-secondary'}" href="/pages/schedule.html"
          aria-label="Schedule Now, ${esc(plain(t.name).replace(/[[\]]/g, ''))} membership">Schedule Now</a>
      </li>`).join('')}</ul>
    </div>
  </section>`;
}

function campsSection(p, i) {
  const camps = data.camps || [];
  return `<section class="section prog reveal" id="${esc(p.key)}" aria-labelledby="${esc(p.key)}-title">
    <div class="wrap">
      <div class="section-head"><div>${head(p, i, `<p class="lead">Seasonal camps and short clinics. Filmed like every other session, with a report at the end.</p>`)}</div>
        <a class="link-arrow" href="/pages/schedule.html?program=camps">All camp sessions →</a></div>
      ${camps.length ? `<ul class="camps" role="list">${camps.map((c) => {
        const low = c.spotsLeft != null && c.spotsLeft < 3;
        return `<li class="camp card">
          <div class="camp-main">
            <h3>${ph(c.title)}</h3>
            <p class="camp-meta"><span>${ph(c.dates)}</span><span>${ph(c.ages)}</span></p>
          </div>
          <p class="camp-price">${ph(c.price)}</p>
          <p class="camp-spots${low ? ' low' : ''}">${c.spotsLeft != null ? `${c.spotsLeft} ${c.spotsLeft === 1 ? 'spot' : 'spots'} left` : ''}</p>
          <a class="btn btn-primary btn-sm" href="${esc(c.href || '/pages/schedule.html?program=camps')}" aria-label="Register for ${esc(c.title.replace(/[[\]]/g, ''))}">Register</a>
        </li>`;
      }).join('')}</ul>` : '<p class="muted">[No camps announced yet]</p>'}
    </div>
  </section>`;
}

function teamSection(p, i) {
  return `<section class="section prog reveal" id="${esc(p.key)}" aria-labelledby="${esc(p.key)}-title">
    <div class="wrap">
      <div class="prog-grid">
        <div class="prog-copy">
          ${head(p, i)}
          <p class="lead">${ph(p.description)}</p>
          <p class="cred">Trained <span class="cred-n">${ph(site.teamCredibility)}</span> programs</p>
          ${facts(p)}
          <div class="prog-cols">${booking(p)}${onFilm(p)}</div>
          <div class="btn-row team-cta">
            <a class="btn btn-primary" href="/pages/contact.html?interest=Team">Contact Us</a>
            <a class="btn btn-secondary" href="tel:${esc(site.phone)}">Call ${ph(site.phone)}</a>
          </div>
        </div>
        <div class="prog-visual">${visual(p)}</div>
      </div>
    </div>
  </section>`;
}

const render = { memberships: membershipSection, camps: campsSection, team: teamSection };
$('#programs').innerHTML = programs.map((p, i) => (render[p.key] || programSection)(p, i)).join('');

// ---------- sticky jump bar ----------
const bar = $('#jumpbar');
bar.innerHTML = programs.map((p) => `<li><a href="#${esc(p.key)}">${esc(p.name)}</a></li>`).join('');
const links = Object.fromEntries($$('a', bar).map((a) => [a.hash.slice(1), a]));
const setCurrent = (key) => {
  Object.entries(links).forEach(([k, a]) => (k === key ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
  const a = links[key];
  if (a) {
    const list = bar;
    const left = a.offsetLeft - 16;
    if (left < list.scrollLeft || a.offsetLeft + a.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollTo({ left, behavior: 'smooth' });
  }
};
if ('IntersectionObserver' in window) {
  const spy = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((e) => setCurrent(e.target.id));
  }, { rootMargin: '-140px 0px -60% 0px' });
  programs.forEach((p) => { const s = document.getElementById(p.key); if (s) spy.observe(s); });
}

// Deep links (e.g. /pages/training.html#team from the nav) land after the content has rendered.
if (location.hash) {
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) requestAnimationFrame(() => { target.classList.add('in'); target.scrollIntoView(); });
}

observe();
