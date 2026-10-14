// Synced side-by-side player. The left video is the master; the right one follows it, offset so both
// clips line up at a chosen moment (for the compare view: release).
const FPS = 24;
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;

export function player(root, { left, right, phases, n, align = null }) {
  // align: { leftAt, rightAt } in seconds; right.time = left.time - leftAt + rightAt
  root.innerHTML = `
    <div class="pl-screens">
      <figure class="pl-screen"><video src="${left.src}" muted playsinline preload="auto"${left.poster ? ` poster="${left.poster}"` : ''}></video><figcaption>${left.label}</figcaption></figure>
      <figure class="pl-screen"><video src="${right.src}" muted playsinline preload="auto"${right.poster ? ` poster="${right.poster}"` : ''}></video><figcaption>${right.label}</figcaption></figure>
    </div>
    <div class="pl-controls">
      <button type="button" class="pl-btn pl-play" aria-label="Play">▶</button>
      <button type="button" class="pl-btn" data-step="-1" aria-label="Back 1 frame">◀ 1</button>
      <button type="button" class="pl-btn" data-step="1" aria-label="Forward 1 frame">1 ▶</button>
      <div class="pl-track">
        <input type="range" class="pl-scrub" min="0" max="1000" value="0" aria-label="Seek">
        <div class="pl-marks" aria-hidden="true"></div>
      </div>
      <span class="pl-time num" aria-live="off">0:00.00</span>
    </div>
    <div class="pl-phases" role="group" aria-label="Shot phases"></div>
    <div class="pl-controls pl-controls-2">
      <button type="button" class="btn btn-secondary pl-release">Jump to release</button>
      <label class="pl-opt">Speed <select class="pl-speed input"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option></select></label>
      <label class="pl-opt"><input type="checkbox" class="pl-loop" checked> Loop</label>
      <span class="label pl-frame">Frame 0 / ${n - 1}</span>
    </div>`;
  const [a, b] = root.querySelectorAll('video');
  const scrub = root.querySelector('.pl-scrub');
  const play = root.querySelector('.pl-play');
  const dur = () => a.duration || n / FPS;
  const follow = () => {
    const t = align ? a.currentTime - align.leftAt + align.rightAt : a.currentTime;
    const ok = t >= 0 && t <= (b.duration || 1e9);
    b.style.opacity = ok ? '1' : '.35';
    const target = Math.max(0, Math.min(t, (b.duration || t) - 0.001));
    if (Math.abs(b.currentTime - target) > 0.06 || a.paused) b.currentTime = target;
    if (!a.paused && ok && b.paused) b.play().catch(() => {});
    if (!ok && !b.paused) b.pause();
  };
  const paint = () => {
    scrub.value = Math.round((a.currentTime / dur()) * 1000);
    root.querySelector('.pl-time').textContent = fmt(a.currentTime);
    root.querySelector('.pl-frame').textContent = `Frame ${Math.min(n - 1, Math.round(a.currentTime * FPS))} / ${n - 1}`;
  };
  const seekFrame = (f) => {
    a.pause(); b.pause();
    a.currentTime = Math.max(0, Math.min(n - 1, f)) / FPS + 0.001;
    follow(); paint(); setPlay(false);
  };
  const setPlay = (on) => { play.textContent = on ? '❚❚' : '▶'; play.setAttribute('aria-label', on ? 'Pause' : 'Play'); };

  const PH = [['set', 'SET'], ['release', 'RELEASE'], ['follow', 'FOLLOW-THROUGH']];
  root.querySelector('.pl-marks').innerHTML = PH.map(([k]) => `<i class="pl-tick pl-tick-${k}" style="left:${(phases[k] / (n - 1)) * 100}%"></i>`).join('');
  root.querySelector('.pl-phases').innerHTML = PH.map(([k, l]) => `<button type="button" class="pl-phase pl-phase-${k}" data-frame="${phases[k]}">
    <i class="pl-dot"></i>${l}<span class="num">${fmt(phases[k] / FPS)}</span></button>`).join('');
  root.querySelectorAll('.pl-phase').forEach((m) => m.addEventListener('click', () => seekFrame(Number(m.dataset.frame))));
  root.querySelectorAll('[data-step]').forEach((s) => s.addEventListener('click', () => seekFrame(Math.round(a.currentTime * FPS) + Number(s.dataset.step))));
  root.querySelector('.pl-release').addEventListener('click', () => seekFrame(phases.release));
  play.addEventListener('click', () => { if (a.paused) { a.play(); setPlay(true); } else { a.pause(); b.pause(); setPlay(false); } });
  scrub.addEventListener('input', () => { a.currentTime = (scrub.value / 1000) * dur(); follow(); paint(); });
  root.querySelector('.pl-speed').addEventListener('change', (e) => { a.playbackRate = b.playbackRate = Number(e.target.value); });
  const loop = root.querySelector('.pl-loop');
  a.addEventListener('timeupdate', () => { follow(); paint(); });
  a.addEventListener('ended', () => { if (loop.checked) { a.currentTime = 0; a.play(); } else { setPlay(false); b.pause(); } });
  a.addEventListener('pause', () => b.pause());
  a.addEventListener('loadedmetadata', () => { follow(); paint(); });
  return { seekFrame, destroy: () => { a.pause(); b.pause(); root.innerHTML = ''; } };
}
