// Session registration: a <dialog> form with inline validation, POST /api/register, a success
// state and an "Add to calendar" .ics download. Reusable from any page:
//
//   import { registerControl, wireRegister } from '../register.js';
//   html += registerControl(session, config);            // button, waitlist button or external link
//   wireRegister(container, (id) => sessionsById[id]);   // opens the modal on click
//
import { getJSON, esc, ph, fmtDate, fmtTime, $ } from './site.js';

const PASSES = [
  ['single', 'Single session'],
  ['5-pack', '5-pack'],
  ['10-pack', '10-pack'],
  ['membership', 'Membership'],
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const spotsLeft = (s) => Math.max(0, (s.capacity ?? 0) - (s.booked ?? 0));

// The register control for one session, as an HTML string.
export function registerControl(s, config = {}, { size = 'btn-sm' } = {}) {
  const label = `${s.programName}, ${fmtDate(s.date)} ${fmtTime(s.start)}`;
  if (config.externalBooking && s.bookingUrl) {
    return `<a class="btn btn-primary ${size}" href="${esc(s.bookingUrl)}" target="_blank" rel="noopener"
      aria-label="Register for ${esc(label)} (opens booking site in a new tab)">Register</a>`;
  }
  if (spotsLeft(s) === 0) {
    return `<button class="btn btn-secondary ${size}" type="button" data-register="${esc(s.id)}" data-waitlist
      aria-label="Join waitlist for ${esc(label)}">Join waitlist</button>`;
  }
  return `<button class="btn btn-primary ${size}" type="button" data-register="${esc(s.id)}"
    aria-label="Register for ${esc(label)}">Register</button>`;
}

// Delegated click handler: any [data-register] inside root opens the modal.
export function wireRegister(root, lookup) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-register]');
    if (!btn || !root.contains(btn)) return;
    const session = lookup(btn.dataset.register);
    if (session) openRegister(session, { waitlist: btn.hasAttribute('data-waitlist'), opener: btn });
  });
}

let dialog;
export async function openRegister(session, { waitlist = false, opener = null } = {}) {
  const [programs, config] = await Promise.all([getJSON('programs'), getJSON('config')]);
  dialog?.remove();
  dialog = document.createElement('dialog');
  dialog.className = 'reg-dialog';
  dialog.setAttribute('aria-labelledby', 'reg-title');
  const when = `${fmtDate(session.date, { weekday: 'long', month: 'long', day: 'numeric' })} · ${fmtTime(session.start)}–${fmtTime(session.end)}`;
  const levels = programs.levels || [];
  dialog.innerHTML = `<div class="dialog-body">
    <button class="dialog-close" type="button" aria-label="Close">×</button>
    <div class="reg-form-view">
      <span class="label">${waitlist ? 'Waitlist' : 'Register'}</span>
      <h3 id="reg-title" class="reg-title">${esc(session.programName)} <em class="s">${esc(session.levelName)}</em></h3>
      <p class="reg-when">${esc(when)}</p>
      <p class="meta reg-sub">${ph(session.coach)} · ${ph(session.location)} · ${ph(session.price)}</p>
      ${waitlist ? '<p class="reg-note">This session is full. Join the waitlist and we will contact you if a spot opens.</p>' : ''}
      <form novalidate>
        <div class="field" data-f="athlete"><label for="reg-athlete">Athlete name</label>
          <input id="reg-athlete" name="athlete" autocomplete="off" required aria-describedby="reg-athlete-err">
          <span class="err" id="reg-athlete-err"></span></div>
        <div class="field" data-f="level"><label for="reg-level">Age group / level</label>
          <select id="reg-level" name="level" required aria-describedby="reg-level-err">
            <option value="">Choose…</option>
            ${levels.map((l) => `<option value="${esc(l.key)}"${l.key === session.level ? ' selected' : ''}>${esc(l.name)} (${esc(l.ages.replace(/[[\]]/g, ''))})</option>`).join('')}
          </select><span class="err" id="reg-level-err"></span></div>
        <div class="form-row">
          <div class="field" data-f="email"><label for="reg-email">Parent email</label>
            <input id="reg-email" name="email" type="email" autocomplete="email" required aria-describedby="reg-email-err">
            <span class="err" id="reg-email-err"></span></div>
          <div class="field" data-f="phone"><label for="reg-phone">Parent phone</label>
            <input id="reg-phone" name="phone" type="tel" autocomplete="tel" required aria-describedby="reg-phone-err">
            <span class="err" id="reg-phone-err"></span></div>
        </div>
        <fieldset class="field reg-pass" data-f="pass"><legend>Pass type</legend>
          <div class="reg-pass-opts">
            ${PASSES.map(([v, t], i) => `<label class="reg-pass-opt"><input type="radio" name="pass" value="${v}"${i === 0 ? ' checked' : ''}><span>${t}</span></label>`).join('')}
          </div><span class="err" id="reg-pass-err"></span></fieldset>
        <div class="field" data-f="notes"><label for="reg-notes">Notes <span class="muted">(optional)</span></label>
          <textarea id="reg-notes" name="notes" maxlength="2000" placeholder="Injuries, goals, anything the coach should know"></textarea></div>
        <button class="btn btn-primary reg-submit" type="submit">${waitlist ? 'Join waitlist' : 'Confirm registration'}</button>
        <p class="meta reg-fine">Every session is filmed. You will get a feedback report after it.</p>
      </form>
    </div>
    <div class="reg-done" hidden tabindex="-1">
      <span class="label">${waitlist ? 'On the waitlist' : 'You are in'}</span>
      <h3 class="reg-title">See you on <em class="s">court.</em></h3>
      <p class="reg-when">${esc(when)}</p>
      <p class="muted reg-done-msg"></p>
      <div class="btn-row">
        ${waitlist ? '' : '<button class="btn btn-primary" type="button" data-ics>Add to calendar</button>'}
        <button class="btn btn-secondary" type="button" data-close>Done</button>
      </div>
    </div>
  </div>`;
  document.body.append(dialog);

  const form = $('form', dialog);
  const close = () => dialog.close();
  dialog.addEventListener('close', () => { opener?.focus?.(); dialog.remove(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  $('.dialog-close', dialog).addEventListener('click', close);
  $('[data-close]', dialog).addEventListener('click', close);
  $('[data-ics]', dialog)?.addEventListener('click', () => downloadICS(session));

  const rules = {
    athlete: (v) => (v.trim().length < 2 ? 'Enter the athlete’s name.' : ''),
    level: (v) => (!v ? 'Choose an age group.' : ''),
    email: (v) => (!v.trim() ? 'Enter a parent email.' : !EMAIL.test(v.trim()) ? 'Enter a valid email, like name@example.com.' : ''),
    phone: (v) => (!v.trim() ? 'Enter a parent phone number.' : v.replace(/\D/g, '').length < 7 ? 'Enter a valid phone number.' : ''),
    pass: (v) => (!v ? 'Choose a pass type.' : ''),
  };
  const valueOf = (name) => (name === 'pass' ? form.querySelector('input[name=pass]:checked')?.value || '' : form.elements[name].value);
  const check = (name) => {
    const msg = rules[name](valueOf(name));
    const f = form.querySelector(`[data-f="${name}"]`);
    f.setAttribute('aria-invalid', msg ? 'true' : 'false');
    f.querySelector('.err').textContent = msg;
    const input = form.elements[name];
    if (input && !(input instanceof RadioNodeList)) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  };
  Object.keys(rules).forEach((name) => {
    const el = form.elements[name];
    if (el && !(el instanceof RadioNodeList)) {
      el.addEventListener('blur', () => { if (el.value || form.dataset.tried) check(name); });
      el.addEventListener('input', () => { if (form.querySelector(`[data-f="${name}"]`).getAttribute('aria-invalid') === 'true') check(name); });
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    form.dataset.tried = '1';
    const bad = Object.keys(rules).filter((n) => !check(n));
    if (bad.length) {
      const first = bad[0] === 'pass' ? form.querySelector('input[name=pass]') : form.elements[bad[0]];
      first.focus();
      return;
    }
    const submit = $('.reg-submit', form);
    submit.disabled = true;
    submit.textContent = 'Sending…';
    const payload = {
      sessionId: session.id, program: session.program, date: session.date, start: session.start,
      waitlist, athlete: valueOf('athlete').trim(), level: valueOf('level'),
      email: valueOf('email').trim(), phone: valueOf('phone').trim(), pass: valueOf('pass'), notes: valueOf('notes').trim(),
    };
    let ok = false;
    try {
      const r = await fetch(`${config.apiBase || ''}/api/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      ok = r.ok;
      if (!ok) console.warn('[register] server responded', r.status);
    } catch (err) {
      console.warn('[register] request failed', err);
    }
    if (!ok && config.apiMode === 'demo') {
      console.info('[register] demo mode: showing success without a backend', payload);
      ok = true;
    }
    if (!ok) {
      submit.disabled = false;
      submit.textContent = waitlist ? 'Join waitlist' : 'Confirm registration';
      const f = form.querySelector('[data-f="notes"]');
      let msg = form.querySelector('.reg-fail');
      if (!msg) { msg = document.createElement('p'); msg.className = 'reg-fail'; msg.setAttribute('role', 'alert'); f.after(msg); }
      msg.textContent = 'We could not send your registration. Please try again or call us.';
      return;
    }
    $('.reg-form-view', dialog).hidden = true;
    const done = $('.reg-done', dialog);
    $('.reg-done-msg', done).textContent = waitlist
      ? `We will email ${payload.email} if a spot opens.`
      : `Registration received for ${payload.athlete}. Their feedback report will follow the session.`;
    done.hidden = false;
    done.focus();
  });

  dialog.showModal();
  $('#reg-athlete', dialog).focus();
}

// ---------- calendar (.ics) ----------
const icsEsc = (s) => String(s ?? '').replace(/[[\]]/g, '').replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
const icsLocal = (date, hhmm) => `${date.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;

export function icsFor(s) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SportsVision//Schedule//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${s.id}-${s.date}@sportsvision`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsLocal(s.date, s.start)}`,
    `DTEND:${icsLocal(s.date, s.end)}`,
    `SUMMARY:${icsEsc(`${s.programName} (${s.levelName}) with ${s.coach}`)}`,
    `LOCATION:${icsEsc(s.location)}`,
    'DESCRIPTION:Every session is filmed. Your feedback report follows the session.',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}

export function downloadICS(s) {
  const url = URL.createObjectURL(new Blob([icsFor(s)], { type: 'text/calendar;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${s.program}-${s.date}.ics` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
