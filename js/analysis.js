// Presentation layer over the existing analysis output (pose keypoints per frame). No model code here:
// it only reads the CSVs, finds the shot phases from the wrists and compares joints between shots.
//
// Measure: height of a joint above the hip centre, in pixels, scaled so every clip has a 100 px torso
// (the clips are filmed from different distances). Up is positive.

export const FPS = 24;
export const TORSO = 100;
export const JOINTS = [
  { key: 'left_shoulder', col: 'Left_Shoulder', name: 'Left shoulder' },
  { key: 'right_shoulder', col: 'Right_Shoulder', name: 'Right shoulder' },
  { key: 'left_elbow', col: 'Left_Elbow', name: 'Left elbow' },
  { key: 'right_elbow', col: 'Right_Elbow', name: 'Right elbow' },
  { key: 'left_wrist', col: 'Left_Wrist', name: 'Left wrist' },
  { key: 'right_wrist', col: 'Right_Wrist', name: 'Right wrist' },
];
const WINDOW = 0.5; // seconds either side of release used to score differences
const TOL = 6;      // px (scaled) of slack before a joint counts as outside the makes' range

const col = (rows, name, axis) => rows.map((r) => Number(r[`${name}_Keypoint_${axis}_coordinate`]));
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

export function buildShot(meta, rows) {
  const n = rows.length;
  const hipY = col(rows, 'Left_Hip', 'Y').map((v, i) => (v + col(rows, 'Right_Hip', 'Y')[i]) / 2);
  const shY = col(rows, 'Left_Shoulder', 'Y').map((v, i) => (v + col(rows, 'Right_Shoulder', 'Y')[i]) / 2);
  const torso = median(hipY.map((h, i) => h - shY[i]));
  const scale = TORSO / torso;
  const series = {};
  for (const j of JOINTS) {
    const ys = col(rows, j.col, 'Y');
    series[j.key] = ys.map((y, i) => (y > 0 ? Math.round((hipY[i] - y) * scale * 10) / 10 : null));
  }
  // phases from the wrists: release = highest wrist, set = lowest wrist before it, follow-through = end
  const wrist = series.left_wrist.map((v, i) => Math.max(v ?? -1e9, series.right_wrist[i] ?? -1e9));
  let release = 0;
  wrist.forEach((v, i) => { if (v > wrist[release]) release = i; });
  let set = release;
  for (let i = release; i >= Math.max(0, release - Math.round(1.5 * FPS)); i--) if (wrist[i] < wrist[set]) set = i;
  const shoulder = series.left_shoulder.map((v, i) => Math.max(v ?? -1e9, series.right_shoulder[i] ?? -1e9));
  let follow = n - 1;
  for (let i = release + 1; i < n; i++) if (wrist[i] < shoulder[i]) { follow = i; break; }
  return { ...meta, n, fps: FPS, duration: n / FPS, torsoPx: Math.round(torso), series,
    phases: { set, release, follow }, shootingSide: series.left_wrist[release] > series.right_wrist[release] ? 'left' : 'right' };
}

// Value of a joint at k frames from release (null where the clip has no frame).
const at = (shot, joint, k) => shot.series[joint][shot.phases.release + k] ?? null;

// Grid of frames around release covered by at least one clip.
export function grid(shots, seconds = 1.2) {
  const K = Math.round(seconds * FPS);
  const ks = [];
  for (let k = -K; k <= K; k++) if (shots.some((s) => at(s, 'left_wrist', k) != null)) ks.push(k);
  return ks;
}

// Band of the reference shots (min, max, mean) for one joint on the grid.
export function band(refs, joint, ks) {
  return ks.map((k) => {
    const v = refs.map((s) => at(s, joint, k)).filter((x) => x != null);
    if (!v.length) return { k, min: null, max: null, mean: null };
    return { k, min: Math.min(...v), max: Math.max(...v), mean: v.reduce((a, b) => a + b, 0) / v.length };
  });
}

// Compare one shot with reference shots (the makes, or for a make, the other makes).
export function compare(shot, refs) {
  const ks = grid([shot, ...refs]).filter((k) => Math.abs(k) <= WINDOW * FPS);
  return JOINTS.map((j) => {
    const b = band(refs, j.key, ks);
    let sum = 0, cnt = 0, inside = 0, peak = null;
    b.forEach(({ k, min, max, mean }) => {
      const v = at(shot, j.key, k);
      if (v == null || mean == null) return;
      const d = v - mean;
      sum += Math.abs(d); cnt++;
      if (v >= min - TOL && v <= max + TOL) inside++;
      if (!peak || Math.abs(d) > Math.abs(peak.d)) peak = { k, d, v, min, max, mean };
    });
    const score = cnt ? sum / cnt : 0;
    const outside = peak ? peak.v < peak.min - TOL || peak.v > peak.max + TOL : false;
    return { ...j, score, consistency: cnt ? inside / cnt : 0, peak, status: outside ? 'bad' : 'good',
      frame: peak ? shot.phases.release + peak.k : shot.phases.release, t: peak ? peak.k / FPS : 0 };
  }).sort((a, b) => b.score - a.score);
}

export function when(k) {
  if (k < -2) return 'before release';
  if (k > 2) return 'after release';
  return 'at release';
}

// Plain-language line for one joint difference, e.g. "Left shoulder sits higher before release".
export function phrase(row) {
  if (!row.peak) return `${row.name} matches`;
  return `${row.name} sits ${row.peak.d > 0 ? 'higher' : 'lower'} ${when(row.peak.k)}`;
}

export function summary(shot, rows) {
  const top = rows.slice(0, 2).map((r) => r.name.toLowerCase());
  const around = when(rows[0]?.peak?.k ?? 0);
  if (shot.result === 'miss') return `Your miss differs most from your makes at the ${top[0]} and ${top[1]}, ${around}.`;
  return `This make tracks closely with your other makes. The most variation is at the ${top[0]} and ${top[1]}, ${around}.`;
}
