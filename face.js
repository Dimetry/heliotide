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
const brows = (lift, from, to) => eyes((x) => arc(x, EY - lift, 58, 17, from, to, -1));
const slant = (inner, outer, w = 17) => [line(-EX - 42, EY - outer, -EX + 2, EY - (inner + outer) / 2 - 6, -EX + 44, EY - inner, w), line(EX - 44, EY - inner, EX - 2, EY - (inner + outer) / 2 - 6, EX + 42, EY - outer, w)];
const EMOTIONS = {
  sleepy: [...eyes((x) => arc(x, EY + 5, 40, 20, 16, 164)), arc(0, MY + 4, 35, 19, 28, 152), ...noBrows],
  yawn: [...eyes((x) => arc(x, EY + 6, 46, 20, 34, 146)), oval(0, MY + 12, 78, 98), ...brows(66, 56, 124)],
  smile: [...open(52, 88), arc(0, MY - 2, 56, 20, 32, 148), ...noBrows],
  content: [...eyes((x) => arc(x, EY + 2, 42, 21, 20, 160, -1)), arc(0, MY, 50, 20, 30, 150), ...noBrows],
  smirk: [...open(52, 84), line(-34, MY + 6, 14, MY + 22, 48, MY - 10, 20), line(-EX - 40, EY - 70, -EX, EY - 74, -EX + 40, EY - 68, 16), line(EX - 42, EY - 84, EX, EY - 104, EX + 42, EY - 84, 16)],
  joy: [...open(54, 92), laugh(0, MY - 36, 108, 78), ...noBrows],
  bliss: [...eyes((x) => arc(x, EY, 42, 21, 18, 162, -1)), laugh(0, MY - 36, 112, 82), ...noBrows],
  wink: [oval(-EX, EY, 52, 88), arc(EX, EY + 4, 42, 21, 22, 158, -1), arc(6, MY - 2, 58, 20, 30, 150), ...noBrows],
  curious: [...open(54, 86), oval(0, MY, 40, 34), ...brows(82, 48, 132)],
  worry: [...open(48, 76), wave(0, MY + 2, 116, 10, 19), ...slant(92, 60)],
  scared: [...open(64, 92), wave(0, MY + 8, 130, 13, 22), ...slant(112, 78)],
  wow: [...open(60, 78), oval(0, MY + 10, 70, 84), ...brows(90, 44, 136)],
  grumpy: [...open(48, 66), arc(0, MY + 6, 50, 20, 34, 146, -1), ...slant(48, 82)],
  squeeze: [...eyes((x) => arc(x, EY + 4, 60, 22, 52, 128, -1)), oval(0, MY + 2, 46, 26), ...noBrows],
  air: [...open(58, 98), laugh(0, MY - 34, 92, 92), ...brows(94, 46, 134)]
};
/// The mouth of somebody who looks up: a little open.
const AGAPE = oval(0, MY - 2, 50, 36);

/// A spring: the thing behind every movement of the orb. `k` stiffness, `d` damping.
class Spring {
  constructor(k, d, x = 0) { this.k = k; this.d = d; this.x = x; this.v = 0; }
  step(dt, to = 0) {
    for (let t = dt; t > 1e-6; t -= 1 / 240) {
      const h = Math.min(t, 1 / 240);
      this.v += (this.k * (to - this.x) - this.d * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}

/// The face now: glides to the wanted expression, blinks, looks around.
class LivingFace {
  constructor() {
    this.parts = EMOTIONS.sleepy.map((p) => p.map((q) => [q[0], q[1], 0, 0]));
    this.name = "sleepy";
    this.eye = [new Spring(360, 31), new Spring(360, 31)];     // the eyes are quick
    this.head = [new Spring(130, 18), new Spring(130, 18)];      // the ball follows, a touch too far and back
    this.blinkAt = 3;
    this.time = 0;
  }
  step(dt, name, aim) {
    this.time += dt;
    if (name !== this.name && !["sleepy", "yawn"].includes(this.name) && Math.random() < 0.5) { this.blinkAt = Math.min(this.blinkAt, this.time); }
    this.name = name;
    const to = EMOTIONS[name], up = ["smile", "curious", "smirk"].includes(name) ? clamp(-this.eye[1].x * 1.3 - 0.25, 0, 1) : 0;
    const h = Math.min(dt, 0.034), steps = 3;
    for (let n = 0; n < steps; n++) {
      for (let i = 0; i < to.length; i++) {
        for (let k = 0; k < to[i].length; k++) {
          const p = this.parts[i][k], q = to[i][k];
          let tx = q[0], ty = q[1];
          if (i === 2 && up) { tx = mix(tx, AGAPE[k][0], up); ty = mix(ty, AGAPE[k][1], up); }
          // Each point is a spring too: an expression arrives with a tiny overshoot, like skin.
          p[2] += ((tx - p[0]) * 720 - p[2] * 43) * h / steps;
          p[3] += ((ty - p[1]) * 720 - p[3] * 43) * h / steps;
          p[0] += p[2] * h / steps;
          p[1] += p[3] * h / steps;
        }
      }
    }
    if (dt >= 1) { for (let i = 0; i < to.length; i++) { for (let k = 0; k < to[i].length; k++) { this.parts[i][k] = [...to[i][k], 0, 0]; } } }
    for (let i = 0; i < 2; i++) { this.eye[i].step(Math.min(dt, 0.05), aim[i]); this.head[i].step(Math.min(dt, 0.05), aim[i]); }
    if (this.time > this.blinkAt + 0.26) { this.blinkAt = this.time + (Math.random() < 0.18 ? 0.1 : 1.8 + Math.random() * 3.6); }
  }
  blink() { this.blinkAt = this.time; }
  /// How closed the eyes are: quick down, a moment, softly up.
  get shut() {
    const b = (this.time - this.blinkAt) / 0.2;
    if (b <= 0 || b >= 1 || ["sleepy", "yawn", "bliss", "content", "squeeze"].includes(this.name)) { return 1; }
    return b < 0.28 ? 1 - 0.93 * ease(b / 0.28) : b < 0.42 ? 0.07 : 0.07 + 0.93 * ease((b - 0.42) / 0.58);
  }
  /// SVG path in a 200 × 200 box around the centre. `turn`: how far the ball is turned (radians, y up).
  path(turn) {
    const t = turn.map((v) => Math.atan2(Math.sin(v), Math.cos(v)));
    if (Math.abs(t[0]) > 2.3 || Math.abs(t[1]) > 2.3) { return ""; }
    const shut = this.shut, gx = this.eye[0].x, gy = this.eye[1].x;
    return this.parts.map((part, i) => {
      // Looking up, the eyes rise only a little: the whole ball turns up instead.
      const sx = gx * (i < 2 ? 34 : i === 2 ? 22 : 28), sy = gy < 0 ? gy * (i < 2 ? 15 : i === 2 ? 8 : 24) : gy * (i < 2 ? 26 : i === 2 ? 16 : 22);
      return "M" + part.map(([x, y]) => {
        if (i < 2) { y = EY + (y - EY) * shut; }
        x = (x + sx) / BALL_R; y = (y + sy) / BALL_R;
        const l = Math.max(0.0001, Math.hypot(x, y)), k = Math.asin(Math.min(1, l)) / l;
        const ax = x * k + t[0], ay = y * k - t[1], d = Math.max(0.0001, Math.hypot(ax, ay)), s = Math.sin(Math.min(Math.PI / 2, d)) / d;
        return (ax * s * 100).toFixed(2) + " " + (ay * s * 100).toFixed(2);
      }).join("L") + "Z";
    }).join("");
  }
}
