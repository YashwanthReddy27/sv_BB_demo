// Global shell shared by every page: announcement bar, nav, registration pop-up, closing band, footer,
// scroll reveals, count-ups and SVG draw-ons. Pages import the helpers they need from here.

const cache = {};
export function getJSON(name) {
  cache[name] ??= fetch(`/data/${name}.json`).then((r) => {
    if (!r.ok) throw new Error(`/data/${name}.json: ${r.status}`);
    return r.json();
  });
  return cache[name];
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// "[placeholder]" text is shown highlighted so it is easy to spot and fill in.
export function ph(s) {
  return esc(s).replace(/\[([^\]]+)\]/g, '<span class="ph">[$1]</span>');
}

// Headlines in data use *word* for the one italic serif emphasis word.
export function headline(s) {
  return ph(s).replace(/\*([^*]+)\*/g, '<em class="s">$1</em>');
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

export function fmtDate(iso, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', opts);
}
export function fmtTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

const NAV = [
  ['About', '/pages/about.html'],
  ['Train With Us', '/pages/training.html'],
  ['Academy', '/pages/academy.html'],
  ['Teams', '/pages/training.html#team'],
  ['My Feedback', '/pages/athlete.html?id=demo'],
  ['Contact', '/pages/contact.html'],
];

function renderAnnouncement(ann) {
  if (!ann?.bar || sessionStorageGet('sv-ann-hidden')) return;
  const bar = document.createElement('div');
  bar.className = 'announce';
  bar.innerHTML = `<div class="wrap"><a href="${esc(ann.bar.href)}">${ph(ann.bar.text)} →</a>
    <button class="x" type="button" aria-label="Dismiss announcement">×</button></div>`;
  bar.querySelector('.x').addEventListener('click', () => {
    bar.remove();
    sessionStorageSet('sv-ann-hidden', '1');
  });
  document.body.prepend(bar);
}

function renderNav(site) {
  const here = location.pathname.replace(/index\.html$/, '');
  const nav = document.createElement('header');
  nav.className = 'nav';
  nav.innerHTML = `<div class="wrap">
    <a class="brand" href="/"><img src="/img/logo-dark.png" alt="${esc(site.brand)} home" width="146" height="32"></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-links" aria-label="Menu"><span></span><span></span><span></span></button>
    <ul class="nav-links" id="nav-links">
      ${NAV.map(([t, h]) => `<li><a href="${h}"${h.split(/[?#]/)[0] === here && !h.includes('#') ? ' aria-current="page"' : ''}>${t}</a></li>`).join('')}
    </ul>
    <a class="btn btn-primary" href="/pages/schedule.html">View Schedule</a>
  </div>`;
  const toggle = nav.querySelector('.nav-toggle');
  const links = nav.querySelector('.nav-links');
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  links.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { links.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
  });
  const skip = document.createElement('a');
  skip.className = 'skip';
  skip.href = '#main';
  skip.textContent = 'Skip to content';
  document.body.prepend(nav);
  document.body.prepend(skip);
  return nav;
}

function renderClosing() {
  if (document.body.dataset.noClosing != null) return;
  const band = document.createElement('section');
  band.className = 'closing on-dark';
  band.setAttribute('aria-label', 'Get started');
  band.innerHTML = `<div class="wrap">
    <h2>LET'S GET TO <em class="s">WORK.</em></h2>
    <a class="btn btn-light" href="/pages/schedule.html">View Schedule</a></div>`;
  document.body.append(band);
}

function renderFooter(site) {
  const f = document.createElement('footer');
  f.className = 'footer';
  const socials = Object.entries(site.socials || {});
  f.innerHTML = `<div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="/"><img src="/img/logo-light.png" alt="${esc(site.brand)} home" width="164" height="36" loading="lazy"></a>
        <p style="margin-top:16px;max-width:36ch">${ph(site.about)}</p>
      </div>
      <div><h3>Visit</h3><ul>
        <li>${ph(site.address)}</li>
        <li><a href="tel:${esc(site.phone)}">${ph(site.phone)}</a></li>
        <li><a href="mailto:${esc(site.email)}">${ph(site.email)}</a></li></ul></div>
      <div><h3>Follow</h3><ul>${socials.map(([k, v]) => `<li><a href="${esc(v.replace(/[[\]]/g, ''))}" rel="noopener">${k}</a></li>`).join('')}</ul></div>
      <div><h3>Links</h3><ul>
        <li><a href="/pages/schedule.html">Schedule</a></li>
        <li><a href="/pages/training.html">Programs</a></li>
        <li><a href="/pages/academy.html">Academy</a></li>
        <li><a href="/pages/upload.html">Coach upload</a></li>
        <li><a href="${esc(site.links?.waiver)}">Waiver of Liability</a></li>
        <li><a href="${esc(site.links?.policies)}">Policies</a></li>
        <li><a href="${esc(site.links?.privacy)}">Privacy</a></li></ul></div>
    </div>
    <div class="footer-bottom"><span>© ${new Date().getFullYear()} ${esc(site.brand)}</span><span>Every session filmed · Powered by SportsVision</span></div>
  </div>`;
  document.body.append(f);
}

function storage(kind) {
  try { return window[kind]; } catch { return null; }
}
function localGet(k) { try { return storage('localStorage')?.getItem(k); } catch { return null; } }
function localSet(k, v) { try { storage('localStorage')?.setItem(k, v); } catch { /* private mode */ } }
function sessionStorageGet(k) { try { return storage('sessionStorage')?.getItem(k); } catch { return null; } }
function sessionStorageSet(k, v) { try { storage('sessionStorage')?.setItem(k, v); } catch { /* private mode */ } }
export const store = { get: localGet, set: localSet };

// Registration pop-up: once per visitor, after a delay, never on a phone's first page load.
function schedulePopup(ann, config) {
  if (!ann?.featured?.length || localGet('sv-popup-seen')) return;
  if (document.body.dataset.noPopup != null) return;
  const isPhone = matchMedia('(max-width: 640px)').matches;
  if (isPhone && !sessionStorageGet('sv-visited')) { sessionStorageSet('sv-visited', '1'); return; }
  setTimeout(() => {
    if (document.querySelector('dialog[open]')) return;
    const d = document.createElement('dialog');
    d.setAttribute('aria-labelledby', 'popup-title');
    d.innerHTML = `<div class="dialog-body">
      <button class="dialog-close" type="button" aria-label="Close">×</button>
      <span class="label">Upcoming</span>
      <h3 id="popup-title" style="font-size:32px;letter-spacing:-0.04em;margin-bottom:12px">Grab a spot <em class="s">before</em> it fills.</h3>
      <p class="muted" style="margin-bottom:12px">Every session is filmed, and every athlete gets a feedback report.</p>
      ${ann.featured.slice(0, 3).map((e) => `<div class="event-row"><div><h4>${ph(e.title)}</h4>
        <p class="meta" style="margin-top:4px">${ph(e.dates)} · ${ph(e.ages)}</p></div>
        <a class="btn btn-primary btn-sm" href="${esc(e.href)}">Register</a></div>`).join('')}
    </div>`;
    document.body.append(d);
    const close = () => { d.close(); localSet('sv-popup-seen', '1'); };
    d.querySelector('.dialog-close').addEventListener('click', close);
    d.addEventListener('cancel', () => localSet('sv-popup-seen', '1'));
    d.addEventListener('click', (e) => { if (e.target === d) close(); });
    d.showModal();
  }, config.popupDelayMs ?? 6000);
}

// ---------- motion ----------
export function countUp(el) {
  const end = parseFloat(el.dataset.count);
  const dec = Number(el.dataset.decimals || 0);
  if (reducedMotion() || Number.isNaN(end)) { el.textContent = end.toFixed(dec); return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 900);
    el.textContent = (end * (1 - Math.pow(1 - k, 3))).toFixed(dec);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function prepDraw(svg) {
  svg.querySelectorAll('path, line, polyline, circle, ellipse').forEach((p) => {
    try { p.style.setProperty('--len', Math.ceil(p.getTotalLength()) + 2); } catch { /* not rendered */ }
  });
}

let io;
export function observe(root = document) {
  io ??= 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      io.unobserve(el);
      if (el.classList.contains('reveal')) el.classList.add('in');
      if (el.dataset.count != null) countUp(el);
      if (el.classList.contains('draw')) { prepDraw(el); requestAnimationFrame(() => el.classList.add('drawn')); }
    });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;
  root.querySelectorAll('.reveal, [data-count], svg.draw').forEach((el) => {
    if (el.dataset.observed) return;
    el.dataset.observed = '1';
    if (el.classList.contains('draw')) prepDraw(el);
    if (io) io.observe(el);
    else { el.classList.add('in', 'drawn'); if (el.dataset.count != null) countUp(el); }
  });
}

// Pause looping background videos when the user prefers reduced motion.
function calmVideos() {
  if (!reducedMotion()) return;
  document.querySelectorAll('video[autoplay]').forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });
}

function favicon() {
  if (document.querySelector('link[rel="icon"]')) return;
  const l = document.createElement('link');
  l.rel = 'icon'; l.type = 'image/png'; l.href = '/img/favicon.png';
  document.head.append(l);
}

export async function boot() {
  favicon();
  const [site, ann, config] = await Promise.all([getJSON('site'), getJSON('announcements'), getJSON('config')]);
  renderNav(site);
  renderAnnouncement(ann);
  if (!document.querySelector('main')?.id) document.querySelector('main')?.setAttribute('id', 'main');
  renderClosing();
  renderFooter(site);
  schedulePopup(ann, config);
  calmVideos();
  observe();
  return { site, ann, config };
}
