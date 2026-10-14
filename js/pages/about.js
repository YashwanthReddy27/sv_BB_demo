import { boot, getJSON, ph, esc, $, observe } from '../site.js';
import { board } from '../boards.js';

const { site } = await boot();
const coaches = await getJSON('coaches').catch(() => []);

$('#hero-board').innerHTML = `${board('shooting', 'Whiteboard: five-spot shooting drill with the shot path marked')}
  <p class="hand board-note">every rep on film</p>`;

// Founder story: the placeholder may hold several paragraphs separated by blank lines.
const paras = String(site.founderStory || '').split(/\n{2,}/).filter(Boolean);
$('#story').innerHTML = paras.map((p) => `<p>${ph(p)}</p>`).join('');

const steps = [
  ['evaluate', 'Evaluate', 'A first session sets the baseline: shooting form, footwork and movement, measured on film.'],
  ['train', 'Train', 'Small groups and privates built around the one or two things that matter most right now.'],
  ['film', 'Film', 'Every session is recorded. The analysis tracks the ball, the player and the shooting mechanics.'],
  ['feedback', 'Feedback', 'Athletes and parents get a report: what went well, what to work on, and the drills that fix it.'],
];
$('#how').innerHTML = steps.map(([k, t, d], i) => `<li class="how-step reveal">
  <div class="how-art">${board(k, `Whiteboard sketch: ${t.toLowerCase()}`)}</div>
  <span class="meta">Step ${String(i + 1).padStart(2, '0')}</span>
  <h3>${t}</h3><p class="muted">${d}</p></li>`).join('');

$('#coaches').innerHTML = coaches.map((c) => `<article class="card coach reveal">
  ${c.photo ? `<img class="coach-photo" src="${esc(c.photo)}" alt="${esc(c.name)}" loading="lazy">`
    : `<div class="slot coach-photo"><span>Photo: ${ph(c.name)}</span></div>`}
  <h3>${ph(c.name)}</h3>
  <p class="meta coach-role">${ph(c.role)}</p>
  <p class="muted">${ph(c.bio)}</p></article>`).join('');

const facility = ['Main court', 'Shooting machine lane', 'Baseline camera rig', 'Film review room', 'Strength area', 'Lobby and front desk'];
$('#facility').innerHTML = facility.map((f, i) => `<div class="slot fac-${i + 1} reveal"><span>Facility photo: ${ph(`[${f}]`)}</span></div>`).join('');

observe();
