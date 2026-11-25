// The living face of the orb. Every part is a closed outline with the same number of points, so any
// expression can turn softly into any other. Units: the 1024 pt app icon, from the centre of its ball.
"use strict";

const FACE_N = 22, BALL_R = 361.5;

/// An outline along a middle line: `mid(u)` is the line, `half(u)` half its thickness.
function ribbon(mid, half, flat) {
  const top = [], low = [];
  for (let i = 0; i <= FACE_N; i++) {
    const u = (1 - Math.cos(Math.PI * i / FACE_N)) / 2, [x, y] = mid(u), h = half(u);
    let nx = 0, ny = 1;
    if (!flat) {
      const a = mid(Math.max(0, u - 0.01)), b = mid(Math.min(1, u + 0.01)), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      nx = -(b[1] - a[1]) / l; ny = (b[0] - a[0]) / l;
    }
    top.push([x - nx * h, y - ny * h]);
    low.push([x + nx * h, y + ny * h]);
  }
  return [...top, ...low.reverse()];
}
const round = (u) => Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2));
/// Round ends of a line: k = how much of the line one end takes.
const caps = (u, k) => { const d = Math.abs(2 * u - 1) - (1 - k); return d <= 0 ? 1 : Math.sqrt(Math.max(0, 1 - (d / k) ** 2)); };
const oval = (x, y, w, h) => ribbon((u) => [x + (u - 0.5) * w, y], (u) => h / 2 * round(u), true);
/// Part of a circle: way 1 hangs (sleeping eye, smile), way -1 stands (happy eye).
function arc(x, y, r, w, from, to, way = 1) {
  const rad = Math.PI / 180, more = w / 2 / r, a = from * rad - more, b = to * rad + more;
  const drop = (r + r * Math.sin(Math.min(from, 180 - to) * rad)) / 2, k = w / (r * (b - a));
  return ribbon((u) => { const t = a + (b - a) * u; return [x - Math.cos(t) * r, y + way * (Math.sin(t) * r - drop)]; }, (u) => w / 2 * caps(u, k));
}
const line = (ax, ay, cx, cy, bx, by, w) => {
  const k = w / Math.hypot(bx - ax, by - ay);
  return ribbon((u) => [(1 - u) ** 2 * ax + 2 * u * (1 - u) * cx + u * u * bx, (1 - u) ** 2 * ay + 2 * u * (1 - u) * cy + u * u * by], (u) => w / 2 * caps(u, k));
};
const wave = (x, y, w, h, t) => ribbon((u) => [x + (u - 0.5) * w, y + h * Math.sin(u * Math.PI * 3)], (u) => t / 2 * caps(u, t / w));
/// Open laughing mouth: straight on top, round below.
const laugh = (x, y, w, h) => ribbon((u) => [x + (u - 0.5) * w, y + h / 2 * round(u) ** 0.8 + 5 * (1 - (2 * u - 1) ** 2)], (u) => h / 2 * round(u) ** 0.8, true);
const none = (x, y) => oval(x, y, 60, 0);

const EX = 168, EY = 100, MY = 196;
const eyes = (make) => [make(-EX, -1), make(EX, 1)];
const open = (w, h) => eyes((x) => oval(x, EY, w, h));
const noBrows = eyes((x) => none(x, EY - 78));
const EMOTIONS = {
  sleepy: [...eyes((x) => arc(x, EY + 5, 40, 20, 16, 164)), arc(0, MY + 4, 35, 19, 28, 152), ...noBrows],
  smile: [...open(52, 88), arc(0, MY - 2, 56, 20, 32, 148), ...noBrows],
  joy: [...open(54, 92), laugh(0, MY - 36, 108, 78), ...noBrows],
  bliss: [...eyes((x) => arc(x, EY, 42, 21, 18, 162, -1)), laugh(0, MY - 36, 112, 82), ...noBrows],
  wink: [oval(-EX, EY, 52, 88), arc(EX, EY + 4, 42, 21, 22, 158, -1), arc(6, MY - 2, 58, 20, 30, 150), ...noBrows],
  curious: [...open(54, 86), oval(0, MY, 40, 34), ...eyes((x) => arc(x, EY - 82, 58, 17, 48, 132, -1))],
  worry: [...open(48, 76), wave(0, MY + 2, 116, 10, 19), line(-EX - 44, EY - 62, -EX + 2, EY - 88, EX * -1 + 46, EY - 92, 17), line(EX - 46, EY - 92, EX - 2, EY - 88, EX + 44, EY - 62, 17)],
  wow: [...open(60, 78), oval(0, MY + 10, 70, 84), ...eyes((x) => arc(x, EY - 90, 58, 17, 44, 136, -1))]
};

/// The face now: glides to the wanted expression, blinks, looks around.
class LivingFace {
  constructor() {
    this.parts = EMOTIONS.sleepy.map((p) => p.map((q) => q.slice()));
    this.name = "sleepy";
    this.gaze = [0, 0];
    this.blinkAt = 3;
    this.time = 0;
  }
  step(dt, name, aim) {
    this.time += dt;
    this.name = name;
    const f = 1 - Math.exp(-dt * 13), to = EMOTIONS[name];
    for (let i = 0; i < to.length; i++) {
      for (let k = 0; k < to[i].length; k++) {
        this.parts[i][k][0] += (to[i][k][0] - this.parts[i][k][0]) * f;
        this.parts[i][k][1] += (to[i][k][1] - this.parts[i][k][1]) * f;
      }
    }
    for (let i = 0; i < 2; i++) { this.gaze[i] += (aim[i] - this.gaze[i]) * (1 - Math.exp(-dt * 9)); }
    if (this.time > this.blinkAt + 0.2) { this.blinkAt = this.time + (Math.random() < 0.2 ? 0.12 : 2 + Math.random() * 3.6); }
  }
  /// SVG path in a 200 × 200 box around the centre. `turn`: how far the ball is turned (radians, y up).
  path(turn) {
    if (Math.abs(turn[0]) > 2.6 || Math.abs(turn[1]) > 2.6) { return ""; }
    const b = (this.time - this.blinkAt) / 0.2, shut = b > 0 && b < 1 && !["sleepy", "bliss"].includes(this.name) ? 1 - 0.92 * Math.sin(Math.PI * b) : 1;
    return this.parts.map((part, i) => {
      const eye = i < 2, gx = this.gaze[0] * (eye ? 34 : i === 2 ? 22 : 28), gy = this.gaze[1] * (eye ? 26 : i === 2 ? 16 : 22);
      return "M" + part.map(([x, y]) => {
        if (eye) { y = EY + (y - EY) * shut; }
        x = (x + gx) / BALL_R; y = (y + gy) / BALL_R;
        const l = Math.max(0.0001, Math.hypot(x, y)), k = Math.asin(Math.min(1, l)) / l;
        const ax = x * k + turn[0], ay = y * k - turn[1], d = Math.max(0.0001, Math.hypot(ax, ay)), s = Math.sin(Math.min(Math.PI / 2, d)) / d;
        return (ax * s * 100).toFixed(2) + " " + (ay * s * 100).toFixed(2);
      }).join("L") + "Z";
    }).join("");
  }
}
