import { boot, ph, esc, $, observe } from '../site.js';

const { site, config } = await boot();

// ---------- visit details ----------
$('#map').innerHTML = `<span>Map: ${ph(site.address)}</span>`;
const hours = (site.hours || []).map((h) => `<li>${ph(h)}</li>`).join('');
$('#details').innerHTML = `
  <div><dt class="meta">Address</dt><dd>${ph(site.address)}</dd></div>
  <div><dt class="meta">Phone</dt><dd><a href="tel:${esc(String(site.phone).replace(/[^\d+]/g, ''))}">${ph(site.phone)}</a></dd></div>
  <div><dt class="meta">Email</dt><dd><a href="mailto:${esc(String(site.email).replace(/[[\]]/g, ''))}">${ph(site.email)}</a></dd></div>
  <div><dt class="meta">Hours</dt><dd><ul class="hours">${hours}</ul></dd></div>`;

// ---------- form ----------
const form = $('#contact-form');
const sel = $('#interest');

// ?interest=academy, ?interest=small-group etc. preselect the dropdown
const want = (new URLSearchParams(location.search).get('interest') || '').toLowerCase().replace(/[-_+]/g, ' ').trim();
if (want) {
  const opt = [...sel.options].find((o) => {
    const v = o.value.toLowerCase();
    return v && (v === want || v.startsWith(want) || want.startsWith(v));
  });
  if (opt) sel.value = opt.value;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const rules = {
  name: (v) => (v.trim() ? '' : 'Please enter your name.'),
  email: (v) => (!v.trim() ? 'Please enter your email.' : EMAIL.test(v.trim()) ? '' : 'That email doesn’t look right. Check for a typo.'),
  phone: (v) => (!v.trim() || /^[\d\s()+.-]{7,}$/.test(v.trim()) ? '' : 'Use digits only, for example (555) 123-4567.'),
  interest: () => '',
  message: (v) => (v.trim().length >= 5 ? '' : 'Tell us a little about what you’re looking for.'),
};

const fieldOf = (n) => $(`#f-${n}`);
function check(name) {
  const input = form.elements[name];
  const msg = rules[name](input.value);
  fieldOf(name).setAttribute('aria-invalid', msg ? 'true' : 'false');
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  $(`#${name}-err`).textContent = msg;
  return !msg;
}

Object.keys(rules).forEach((n) => {
  const input = form.elements[n];
  const invalid = () => fieldOf(n).getAttribute('aria-invalid') === 'true';
  input.addEventListener('blur', () => { if (input.value || invalid()) check(n); });
  input.addEventListener('input', () => { if (invalid()) check(n); });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const bad = Object.keys(rules).filter((n) => !check(n));
  if (bad.length) { form.elements[bad[0]].focus(); return; }

  const btn = $('#send');
  btn.disabled = true;
  btn.textContent = 'Sending…';
  const data = Object.fromEntries(new FormData(form));
  let ok = false;
  try {
    const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    ok = r.ok && (await r.json().catch(() => ({}))).ok !== false;
  } catch { ok = false; }

  if (ok || config.apiMode === 'demo') {
    $('#sent-email').textContent = data.email;
    $('#form-wrap').hidden = true;
    const sent = $('#sent');
    sent.hidden = false;
    sent.focus();
  } else {
    btn.disabled = false;
    btn.textContent = 'Send message';
    $('#message-err').textContent = `Sorry, that didn’t send. Please try again, or email ${String(site.email).replace(/[[\]]/g, '')}.`;
  }
});

observe();
