/* SportsVision reusable components. Plain ES module: works from a
 <script type="module"> tag and from a bundler (Vite / Lovable) alike.

 comparePlayer(el, { sources: [{ label, src }, { label, src }] })
 poseChart(el, { rows, joint: 'Shoulder', side: 'Left' })
 shotAnalysis(el, { shots: [{ label, raw, overlay, data }] })
 loadCsv(url) -> Promise<Array<Object>>

 Every component returns { destroy() }. Pair with sportsvision.css.
 Plotly.js is loaded from the CDN on first chart unless window.Plotly exists. */

var global = window;
var PLOTLY_URL = 'https://cdn.plot.ly/plotly-2.35.2.min.js';
var plotlyPromise = null;

function ensurePlotly() {
  if (global.Plotly) return Promise.resolve(global.Plotly);
  if (!plotlyPromise) {
    plotlyPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = PLOTLY_URL;
      script.onload = function () { resolve(global.Plotly); };
      script.onerror = function () {
        plotlyPromise = null;
        reject(new Error('Could not load Plotly.js'));
      };
      document.head.appendChild(script);
    });
  }
  return plotlyPromise;
}

var ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
var ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';

function el(tag, className, html) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function token(node, name) {
  return getComputedStyle(node).getPropertyValue(name).trim();
}

function formatTime(seconds) {
  if (!isFinite(seconds)) seconds = 0;
  var m = Math.floor(seconds / 60);
  var s = seconds - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}

/* ---------- data ---------- */

function parseCsv(text) {
  var lines = text.trim().split(/\r?\n/);
  var header = lines.shift().split(',');
  return lines.map(function (line) {
    var cells = line.split(',');
    var row = {};
    header.forEach(function (key, i) {
      row[key.trim()] = Number(cells[i]);
    });
    return row;
  });
}

function loadCsv(url) {
  return fetch(url).then(function (res) {
    if (!res.ok) throw new Error('Could not load ' + url + ' (' + res.status + ')');
    return res.text();
  }).then(parseCsv);
}

/* ---------- synced compare player ----------
   The first source is the master clock. The second follows it by playback
   progress, so clips with different lengths or frame rates stay aligned. */

function comparePlayer(root, options) {
  var sources = options.sources;
  root.classList.add('sv-compare');
  root.innerHTML = '';

  var screens = el('div', 'sv-compare-screens');
  var videos = sources.map(function (source, i) {
    var figure = el('figure', 'sv-compare-screen');
    var video = document.createElement('video');
    video.src = source.src;
    video.preload = 'metadata';
    video.playsInline = true;
    video.muted = i > 0;
    video.addEventListener('error', function () {
      figure.appendChild(el('div', 'sv-compare-error', 'Could not load ' + escapeHtml(source.label)));
    });
    figure.appendChild(video);
    figure.appendChild(el('figcaption', '', escapeHtml(source.label)));
    screens.appendChild(figure);
    return video;
  });
  var master = videos[0];
  var follower = videos[1];

  var controls = el('div', 'sv-compare-controls');
  var playBtn = el('button', 'sv-btn', ICON_PLAY);
  playBtn.type = 'button';
  playBtn.setAttribute('aria-label', 'Play');
  var scrub = el('input', 'sv-scrub');
  scrub.type = 'range';
  scrub.min = 0;
  scrub.max = 1000;
  scrub.value = 0;
  scrub.setAttribute('aria-label', 'Seek');
  var time = el('span', 'sv-time', '0:00.0 / 0:00.0');
  var speed = el('select', 'sv-select',
    '<option value="0.25">0.25x</option><option value="0.5">0.5x</option><option value="1" selected>1x</option>');
  speed.setAttribute('aria-label', 'Playback speed');
  var loopLabel = el('label', 'sv-check', '<input type="checkbox" checked> Loop');
  var loop = loopLabel.querySelector('input');
  [playBtn, scrub, time, speed, loopLabel].forEach(function (node) { controls.appendChild(node); });

  root.appendChild(screens);
  root.appendChild(controls);

  var raf = 0;
  var scrubbing = false;

  function ratio() {
    return follower && isFinite(follower.duration) && master.duration
      ? follower.duration / master.duration : 1;
  }

  function syncFollower(hard) {
    if (!follower || !isFinite(follower.duration)) return;
    var target = Math.min(master.currentTime * ratio(), Math.max(follower.duration - 0.05, 0));
    if (hard || Math.abs(follower.currentTime - target) > 0.12) follower.currentTime = target;
  }

  function applyRate() {
    var rate = Number(speed.value);
    master.playbackRate = rate;
    if (follower) follower.playbackRate = Math.min(Math.max(rate * ratio(), 0.0625), 16);
  }

  function render() {
    var duration = master.duration || 0;
    if (!scrubbing) scrub.value = duration ? Math.round((master.currentTime / duration) * 1000) : 0;
    time.textContent = formatTime(master.currentTime) + ' / ' + formatTime(duration);
  }

  function setPlayingUi(playing) {
    playBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  function tick() {
    syncFollower(false);
    render();
    raf = requestAnimationFrame(tick);
  }

  function play() {
    if (master.ended || master.currentTime >= master.duration - 0.05) master.currentTime = 0;
    applyRate();
    syncFollower(true);
    master.play();
    if (follower) follower.play().catch(function () {});
  }

  function pause() {
    master.pause();
    if (follower) follower.pause();
  }

  playBtn.addEventListener('click', function () {
    if (master.paused) play(); else pause();
  });
  master.addEventListener('play', function () {
    setPlayingUi(true);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  });
  master.addEventListener('pause', function () {
    setPlayingUi(false);
    cancelAnimationFrame(raf);
    if (follower) follower.pause();
    render();
  });
  master.addEventListener('ended', function () {
    if (loop.checked) play();
  });
  master.addEventListener('loadedmetadata', function () {
    if (master.videoWidth && master.videoHeight) {
      var aspect = master.videoWidth + ' / ' + master.videoHeight;
      Array.prototype.forEach.call(screens.children, function (figure) {
        figure.style.aspectRatio = aspect;
      });
    }
    render();
  });
  master.addEventListener('seeked', render);
  scrub.addEventListener('input', function () {
    scrubbing = true;
    if (master.duration) master.currentTime = (scrub.value / 1000) * master.duration;
    syncFollower(true);
    render();
  });
  scrub.addEventListener('change', function () { scrubbing = false; });
  speed.addEventListener('change', applyRate);

  return {
    play: play,
    pause: pause,
    destroy: function () {
      cancelAnimationFrame(raf);
      videos.forEach(function (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      });
      root.innerHTML = '';
    }
  };
}

/* ---------- 3D pose chart ----------
   Path of one joint through the clip: X across, frame number in depth, Y up. */

function poseChart(root, options) {
  var rows = options.rows;
  var joint = options.joint;
  var side = options.side;
  var invertY = options.invertY !== false;
  var prefix = side + '_' + joint + '_Keypoint_';
  var title = options.title || side + ' ' + joint + ' Deviation';

  root.classList.add('sv-chart');
  root.innerHTML = '';
  var colorVar = side === 'Right' ? '--sv-right' : '--sv-left';
  var head = el('h4', 'sv-chart-head',
    '<span class="sv-swatch" style="background: var(' + colorVar + ')"></span>' + escapeHtml(title));
  var sub = el('p', 'sv-chart-sub', 'Keypoint position per frame, in pixels. Drag to rotate, scroll to zoom.');
  var plot = el('div', 'sv-chart-plot');
  root.appendChild(head);
  root.appendChild(sub);
  root.appendChild(plot);

  var destroyed = false;
  var ready = false;

  var frames = rows.map(function (r) { return r.Frame_No; });
  var xs = rows.map(function (r) { return r[prefix + 'X_coordinate']; });
  var ys = rows.map(function (r) { return r[prefix + 'Y_coordinate']; });
  var last = rows.length - 1;
  var framePad = Math.max(2, rows.length * 0.06);

  function draw() {
    var color = token(root, colorVar);
    var surface = token(root, '--sv-surface');
    var grid = token(root, '--sv-grid');
    var muted = token(root, '--sv-muted');
    var text2 = token(root, '--sv-text-2');
    var text = token(root, '--sv-text');

    function axis(label, extra) {
      var base = {
        title: { text: label, font: { size: 12, color: text2 } },
        tickfont: { size: 10, color: muted },
        showbackground: true,
        backgroundcolor: surface,
        gridcolor: grid,
        zerolinecolor: grid,
        linecolor: grid,
        showspikes: false
      };
      for (var key in extra) base[key] = extra[key];
      return base;
    }

    var traces = [{
      type: 'scatter3d',
      mode: 'lines',
      x: xs, y: frames, z: ys,
      line: { color: color, width: 5 },
      hovertemplate: 'Frame %{y}<br>X %{x} px<br>Y %{z} px<extra></extra>'
    }, {
      type: 'scatter3d',
      mode: 'markers+text',
      x: [xs[0], xs[last]], y: [frames[0], frames[last]], z: [ys[0], ys[last]],
      text: ['Start', 'End'],
      textposition: 'top center',
      textfont: { size: 11, color: text2 },
      marker: { size: 4, color: color },
      hoverinfo: 'skip'
    }];

    var layout = {
      margin: { l: 0, r: 0, t: 0, b: 0 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      showlegend: false,
      font: { family: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: text },
      hoverlabel: { bgcolor: surface, bordercolor: grid, font: { color: text, size: 12 } },
      scene: {
        xaxis: axis('X (px)'),
        // padded so the End label is not clipped by the back wall
        yaxis: axis('Frame', { range: [frames[0] - framePad, frames[last] + framePad] }),
        zaxis: axis('Y (px)', invertY ? { autorange: 'reversed' } : {}),
        aspectmode: 'manual',
        aspectratio: { x: 1, y: 1.6, z: 0.9 },
        camera: { eye: { x: 2.0, y: -1.1, z: 0.7 }, center: { x: 0, y: 0, z: -0.15 } }
      }
    };

    global.Plotly.react(plot, traces, layout, {
      displaylogo: false,
      responsive: true,
      modeBarButtonsToRemove: ['resetCameraLastSave3d', 'hoverClosest3d', 'orbitRotation', 'tableRotation']
    });
  }

  function redraw() {
    if (ready && !destroyed) draw();
  }

  ensurePlotly().then(function () {
    if (destroyed) return;
    ready = true;
    draw();
  }).catch(function (error) {
    if (!destroyed) plot.appendChild(el('div', 'sv-chart-msg', escapeHtml(error.message)));
  });

  // Re-read the tokens when the host page switches theme.
  var observer = new MutationObserver(redraw);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  return {
    destroy: function () {
      destroyed = true;
      observer.disconnect();
      if (ready) global.Plotly.purge(plot);
      root.innerHTML = '';
    }
  };
}

/* ---------- shot analysis ----------
   Tabs over shots; each shot is a compare player plus a grid of pose charts.
   Only the selected shot is mounted, which keeps the page within the browser's
   WebGL context limit. */

function shotAnalysis(root, options) {
  var shots = options.shots;
  var joints = options.joints || ['Shoulder', 'Elbow', 'Wrist'];
  var sides = options.sides || ['Left', 'Right'];
  var cache = {};
  var mounted = [];
  var current = -1;

  root.classList.add('sv-stack');
  root.innerHTML = '';
  var tabs = el('div', 'sv-tabs');
  tabs.setAttribute('role', 'tablist');
  var playerCard = el('div', 'sv-card');
  var charts = el('div', 'sv-grid-2');
  root.appendChild(tabs);
  root.appendChild(playerCard);
  root.appendChild(charts);

  var buttons = shots.map(function (shot, i) {
    var button = el('button', 'sv-tab', escapeHtml(shot.label));
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.addEventListener('click', function () { select(i); });
    tabs.appendChild(button);
    return button;
  });

  function unmount() {
    mounted.forEach(function (component) { component.destroy(); });
    mounted = [];
    charts.innerHTML = '';
  }

  function select(index) {
    if (index === current) return;
    current = index;
    var shot = shots[index];
    buttons.forEach(function (button, i) {
      button.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
    unmount();

    mounted.push(comparePlayer(playerCard, {
      sources: [
        { label: options.rawLabel || 'Original', src: shot.raw },
        { label: options.overlayLabel || 'Pose tracking', src: shot.overlay }
      ]
    }));

    if (!cache[index]) cache[index] = loadCsv(shot.data);
    cache[index].then(function (rows) {
      if (current !== index) return;
      joints.forEach(function (joint) {
        sides.forEach(function (side) {
          var card = el('div', 'sv-card');
          charts.appendChild(card);
          mounted.push(poseChart(card, { rows: rows, joint: joint, side: side }));
        });
      });
    }).catch(function (error) {
      if (current !== index) return;
      var card = el('div', 'sv-card');
      card.appendChild(el('div', 'sv-chart-msg', escapeHtml(error.message)));
      charts.appendChild(card);
    });
  }

  select(0);

  return {
    select: select,
    destroy: function () {
      unmount();
      root.innerHTML = '';
    }
  };
}

export { loadCsv, comparePlayer, poseChart, shotAnalysis };
