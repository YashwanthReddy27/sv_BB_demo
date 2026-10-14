// Hand-drawn whiteboard diagrams (inline SVG). Every stroke draws itself on via stroke-dashoffset
// once the SVG scrolls into view (see observe() in site.js). Lines are deliberately a little wobbly.

const court = `
  <path class="chalk-thin" d="M14 18 C120 17 280 19 386 18"/>
  <path class="chalk-thin" d="M150 18 L151 132 C190 133 214 131 250 132 L249 18"/>
  <path class="chalk-thin" d="M151 132 C152 170 248 172 249 132"/>
  <path class="chalk-thin" d="M40 18 C42 150 120 236 200 238 C282 236 358 150 360 18"/>
  <circle class="chalk" cx="200" cy="38" r="9"/>
  <path class="chalk" d="M184 26 L216 26"/>`;

const x = (cx, cy) => `<path class="chalk" d="M${cx - 7} ${cy - 7} L${cx + 7} ${cy + 7} M${cx + 7} ${cy - 7} L${cx - 7} ${cy + 7}"/>`;
const o = (cx, cy) => `<circle class="chalk" cx="${cx}" cy="${cy}" r="8"/>`;
const arrowHead = (x1, y1, ang) => {
  const a = (ang * Math.PI) / 180, l = 11;
  const p = (d) => `${(x1 - l * Math.cos(a + d)).toFixed(1)} ${(y1 - l * Math.sin(a + d)).toFixed(1)}`;
  return `<path class="chalk-accent" d="M${p(0.5)} L${x1} ${y1} L${p(-0.5)}"/>`;
};

const diagrams = {
  // court drills
  shooting: `${court}${x(110, 150)}${x(290, 150)}${x(200, 205)}
    <path class="chalk-accent" d="M110 150 C120 80 160 40 192 40"/>${arrowHead(192, 40, -5)}
    <path class="chalk" stroke-dasharray="4 6" d="M200 205 C196 170 204 120 200 60"/>
    <text x="300" y="200" class="lbl">5 spots × 5</text>`,
  arc: `${court}${x(200, 190)}
    <path class="chalk-accent" d="M200 186 C205 60 210 10 200 38"/>
    <path class="chalk" stroke-dasharray="3 7" d="M200 186 C202 120 203 70 200 46"/>
    <text x="222" y="100" class="lbl">high arc</text><text x="120" y="150" class="lbl">flat</text>`,
  catch: `${court}${o(110, 160)}${x(260, 120)}
    <path class="chalk" d="M118 156 C160 140 210 128 250 122"/>${arrowHead(250, 122, -12)}
    <path class="chalk-accent" d="M260 128 C262 140 258 150 262 160"/>
    <text x="270" y="172" class="lbl">dip → rise</text>`,
  footwork: `${court}${x(200, 170)}
    <path class="chalk" d="M180 200 L184 220 M220 200 L216 220"/>
    <path class="chalk-accent" d="M178 190 C190 186 210 186 222 190"/>
    <text x="232" y="215" class="lbl">land here</text>`,
  form: `${court}${x(200, 120)}
    <path class="chalk-accent" d="M200 120 C200 100 200 80 200 50"/>${arrowHead(200, 50, -90)}
    <path class="chalk" d="M150 230 L250 230"/><text x="212" y="90" class="lbl">1 hand, close</text>`,
  machine: `${court}<rect class="chalk" x="185" y="52" width="30" height="20" rx="3"/>
    ${x(110, 150)}${x(290, 150)}${x(200, 200)}
    <path class="chalk-accent" d="M200 72 C170 100 130 130 112 144"/>${arrowHead(112, 144, 140)}
    <path class="chalk" stroke-dasharray="4 6" d="M200 72 C230 100 270 130 288 144"/>`,
  team: `${court}${o(200, 200)}${o(90, 120)}${o(310, 120)}${o(150, 70)}${o(250, 70)}
    <path class="chalk-accent" d="M200 192 C170 160 120 140 98 126"/>${arrowHead(98, 126, 210)}
    <path class="chalk" d="M150 78 C170 110 220 120 250 78"/>`,
  performance: `<path class="chalk-thin" d="M20 230 L380 230"/>
    <rect class="chalk" x="70" y="170" width="70" height="60" rx="4"/>
    <path class="chalk-accent" d="M60 225 C80 120 140 110 165 165"/>${arrowHead(165, 165, 60)}
    ${x(250, 215)}${x(300, 215)}${x(350, 215)}
    <path class="chalk" d="M250 200 C265 180 285 180 300 200 C315 180 335 180 350 200"/>`,
  // approach steps (icons)
  evaluate: `<rect class="chalk" x="60" y="40" width="120" height="160" rx="10"/><path class="chalk" d="M85 80 L155 80 M85 110 L155 110 M85 140 L130 140"/><path class="chalk-accent" d="M85 170 L98 182 L125 158"/>`,
  train: `${x(80, 180)}<path class="chalk-accent" d="M80 172 C90 100 140 60 180 58"/>${arrowHead(180, 58, 0)}<circle class="chalk" cx="196" cy="58" r="12"/>`,
  film: `<rect class="chalk" x="40" y="70" width="130" height="90" rx="10"/><path class="chalk" d="M170 100 L215 78 L215 152 L170 130"/><circle class="chalk-accent" cx="70" cy="95" r="7"/>`,
  feedback: `<rect class="chalk" x="50" y="40" width="140" height="160" rx="10"/><path class="chalk-thin" d="M70 170 L170 170"/><path class="chalk-accent" d="M70 150 C95 140 110 110 130 115 C150 120 160 80 172 70"/><path class="chalk" d="M70 70 L120 70"/>`,
};

const VIEWBOX = { evaluate: '0 0 240 240', train: '0 0 240 240', film: '0 0 240 240', feedback: '0 0 240 240' };

export function board(kind, title = '') {
  const body = diagrams[kind] || diagrams.shooting;
  return `<svg class="draw" viewBox="${VIEWBOX[kind] || '0 0 400 250'}" role="img" aria-label="${title || 'Whiteboard diagram: ' + kind}">
    <style>.lbl{font:600 17px Caveat,cursive;fill:#C7400F}</style>${body}</svg>`;
}

// A wobbly marker arrow for hand-written coach notes. Points from (0,0) toward (w,h).
export function markerArrow(w = 90, h = 50, flip = false) {
  const d = flip
    ? `M${w - 4} 4 C${w * 0.6} ${h * 0.1} ${w * 0.25} ${h * 0.45} 8 ${h - 6}`
    : `M4 4 C${w * 0.35} ${h * 0.05} ${w * 0.75} ${h * 0.4} ${w - 8} ${h - 6}`;
  const tip = flip ? [8, h - 6, 'M20 ' + (h - 4) + ' L8 ' + (h - 6) + ' L12 ' + (h - 18)] : [w - 8, h - 6, `M${w - 22} ${h - 4} L${w - 8} ${h - 6} L${w - 12} ${h - 19}`];
  return `<svg class="draw" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <path class="chalk-accent" d="${d}"/><path class="chalk-accent" d="${tip[2]}"/></svg>`;
}
