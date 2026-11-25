"use strict";
// ---- Colours of the app, per level: quiet, active, storm, severe ----

const LIGHT = [["#F4FAE2", "#DFEED4", "#9DDD8B", "#CDE8B5"], ["#EEF7F2", "#93E3FD", "#00E7E7", "#C1E3EA"],
               ["#FFF2D6", "#F7C43A", "#F7A945", "#F6DADA"], ["#FFE0EF", "#FF96FE", "#8B85F4", "#F0F1F6"]];   // high, main, mid, low
const DARK = [["#0C150B", "#0C4E0F", "#71A54A"], ["#00323A", "#1C8687", "#4BC6FF"],
              ["#340C04", "#901414", "#B8420E"], ["#341C3C", "#AB296E", "#FF42A9"]];                           // deep, mid, glow
const DARK_SKY = ["#295B29", "#366980", "#8E260D", "#5F0076"];
const SPEED = [0.49, 0.84, 1.64, 2.14], ENERGY = [0, 0.07, 0.36, 0.52];
const BALL = [["#F4FAE2", "#B5E06A", "#D9E36A", "#8FCB52"], ["#EEF9FD", "#93E3FD", "#34D3EC", "#7CCBEA"],
              ["#FFF0CF", "#F7C43A", "#F08A24", "#F59A38"], ["#FDDFF3", "#F07AC8", "#C05CF0", "#F5607A"]];

/// What the dark ramp makes of the plain sky.
function rampSky(high, main, low, ramp, energy) {
  const lum = (v) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  const sky = main.map((m, i) => clamp(m + (high[i] - m) * energy * 0.1, 0, 1));
  const lo = lum(main.map((m, i) => Math.max(0, m + low[i] - 1))), hi = lum(high);
  const t = ease((lum(sky) - lo) / Math.max(hi - lo, 0.05));
  const [a, b, k] = t < 0.5 ? [ramp[0], ramp[1], t * 2] : [ramp[1], ramp[2], (t - 0.5) * 2];
  return a.map((x, i) => mix(x, b[i], k));
}
const LOOKS = LIGHT.map((row, i) => {
  const [high, main, mid, low] = row.map(rgb), ramp = DARK[i].map(rgb), sky = rampSky(high, main, low, ramp, ENERGY[i]);
  const ball = BALL[i].map(rgb);
  return { high, main, mid, low, deep: ramp[0], dmid: ramp[1], glow: ramp[2], skyShift: rgb(DARK_SKY[i]).map((x, k) => x - sky[k]),
           energy: ENERGY[i], speed: SPEED[i], ballHigh: ball[0], ballMain: ball[1], ballMid: ball[2], ballLow: ball[3] };
});
const ZOOM = 3.08, LIFT = 0.22;

// ---- Which level is shown ----

let liveLevel = 0;      // what NOAA says now
let stageLevel = null;  // the level of the four-colours part, while it is on screen
const level = () => stageLevel ?? liveLevel;

const copy = (look) => Object.fromEntries(Object.entries(look).map(([k, v]) => [k, Array.isArray(v) ? v.slice() : v]));
let look = copy(LOOKS[0]);
function glide(dt) {
  const to = LOOKS[level()], f = 1 - Math.exp(-dt * 1.8);
  for (const k in to) {
    if (Array.isArray(to[k])) { for (let i = 0; i < 3; i++) { look[k][i] += (to[k][i] - look[k][i]) * f; } }
    else { look[k] += (to[k] - look[k]) * f; }
  }
}

// ---- The orb's way in: it glides in calmly from below and turns to us ----

const LEAD = 0.2, WAY = 1.5;
function entrance(t, w, h) {
  const u = clamp((t - LEAD) / WAY, 0, 1), k = 1 - Math.pow(1 - u, 4);          // fast at first, a long soft arrival
  return { x: -0.1 * Math.min(w, 900) * (1 - k), y: 0.2 * h * (1 - k), scale: mix(0.55, 1, k), turn: [-1.9 * (1 - k), 0.9 * (1 - k)], alpha: ease(u * 2.6), over: u >= 1 };
}

// ---- Scene ----

const ball = shaderCanvas(document.createElement("canvas"), ORB);
const inside = shaderCanvas(document.createElement("canvas"), FIELD);   // the clouds on the screens of the devices
if (!ball) { document.documentElement.classList.add("no-orb"); }
const bar = $("#bar"), stage = $("#status");
const face = new LivingFace();

/// The orb lives in several places of the page. Each place scrolls with the page by itself (nothing follows the scroll
/// with a delay); the orb is shown in one place at a time and grows out of it softly.
const views = [...document.querySelectorAll("[data-orb]")].map((el) => {
  el.innerHTML = `<button class="orb" type="button" aria-label="${el.dataset.orb === "bar" ? "Back to the top" : "Heliotide"}"><canvas></canvas><svg viewBox="-100 -100 200 200" aria-hidden="true"><path d=""/></svg></button>`;
  const button = el.querySelector("button"), canvas = el.querySelector("canvas");
  return { el, name: el.dataset.orb, button, canvas, ctx: canvas.getContext("2d"), path: el.querySelector("path"), grow: new Spring(el.dataset.orb === "bar" ? 300 : 190, el.dataset.orb === "bar" ? 24 : 21, 0) };
});
const viewOf = (name) => views.find((v) => v.name === name);
let owner = viewOf("hero");
owner.grow.x = 1;

const screens = [...document.querySelectorAll("canvas[data-bg]")];
const onScreen = new Set();
const seen = new IntersectionObserver((list) => { for (const e of list) { e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target); } }, { rootMargin: "80px" });
screens.forEach((c) => seen.observe(c));

let W = 0, H = 0, big = 100;
/// Only a new width makes new canvases: the browser bars of a phone change the height all the time while one scrolls.
function measure() {
  H = innerHeight;
  const w = document.documentElement.clientWidth;
  if (w === W) { return; }
  W = w;
  const dpr = Math.min(2, devicePixelRatio || 1);
  big = Math.max(...views.map((v) => v.el.clientWidth)) / 2;
  ball?.resize(big / 0.48 * dpr, big / 0.48 * dpr);
  for (const v of views) { const side = Math.round(v.el.clientWidth / 0.96 * Math.min(3, devicePixelRatio || 1)); if (v.canvas.width !== side) { v.canvas.width = v.canvas.height = side; } }
  for (const c of screens) { const [cw, ch] = c.dataset.bg === "tall" ? [132, 286] : [240, 168]; if (c.width !== cw) { c.width = cw; c.height = ch; } }
  foldScreens();
  dirty = true;
}

let cloudTime = 20, orbTime = 20, orbEnergy = 0, filmTime = 0, dirty = true, landed = still.matches;
let pointer = null, awake = 0, now_ = 0, mood = null, moodUntil = 0, glance = [0, 0], glanceAt = 0, scrollLook = 0, lastScroll = scrollY;
const touch = matchMedia("(hover: none)");

/// Who shows the orb: the big place in the middle of the screen, or the O of the bar.
function findOwner() {
  let best = null, near = 1e9;
  for (const v of views) {
    if (v.name === "bar") { continue; }
    const r = v.el.getBoundingClientRect(), y = r.top + r.height / 2, room = v === owner ? 0.02 : 0.1;
    if (y > H * room && y < H * (1 - room)) { const d = Math.abs(y - H * 0.45); if (d < near) { near = d; best = v; } }
  }
  const next = best ?? viewOf("bar");
  if (next !== owner) { owner = next; body.held = null; body.air = false; for (const p of [body.x, body.y, body.squash, body.tilt]) { p.x = p.v = 0; } }
  bar.classList.toggle("shown", owner.name !== "hero" || scrollY > 90);
  bar.classList.toggle("docked", owner.name === "bar");
}

// ---- The body of the orb: a soft ball that floats, weightless. No ground, no fall: a push sends it off, it turns,
// trembles like jelly and slowly drifts home ----

const body = {
  x: new Spring(17, 3.1), y: new Spring(17, 3.1),          // away from its place: a long soft string pulls it home
  squash: new Spring(230, 7.5),                            // + flat, − long; the volume stays the same
  tilt: new Spring(90, 14),                                // along which direction
  spin: [new Spring(8.5, 2.9), new Spring(8.5, 2.9)], goal: [0, 0],   // turning; the goal is always a full turn
  air: false, held: null, charge: 0, hits: [],
  /// A push at the point (px, py) of the ball (−1...1 from its middle, y down), as a finger in zero gravity does it.
  push(R, px, py, power) {
    const far = Math.hypot(px, py), ux = far > 0.12 ? px / far : 0, uy = far > 0.12 ? py / far : 1;   // in the middle: upwards
    this.x.v -= ux * power * R;
    this.y.v -= uy * power * R * (far > 0.12 ? 0.9 : 1);
    this.tilt.x = this.wrap(Math.atan2(ux, -uy));
    this.tilt.v = 0;
    this.squash.v += 1.1 + power * 0.16;
    // Off the middle it turns, the more the farther out; a quick series of taps adds up.
    const turns = far > 0.12 ? 1 : 0;
    if (turns && Math.abs(ux) >= Math.abs(uy)) { this.goal[0] -= Math.sign(ux) * 2 * Math.PI; this.spin[0].v -= ux * 3.2; }
    else { this.goal[1] += (turns ? Math.sign(uy) : 1) * 2 * Math.PI; this.spin[1].v += (turns ? uy : 1) * 3.2; }
  },
  wrap(a) { return a > Math.PI / 2 ? a - Math.PI : a < -Math.PI / 2 ? a + Math.PI : a; },   // a squash has no front and back
  step(dt, R) {
    if (this.held) {
      // Pulled: the farther, the heavier (rubber band); it gets long in the direction of the pull.
      const [dx, dy] = this.held.pull, far = Math.hypot(dx, dy), k = far ? R * 1.3 * (1 - 1 / (far * 0.62 / (R * 1.3) + 1)) / far : 0;
      this.x.k = this.y.k = 190; this.x.d = this.y.d = 20;
      this.x.step(dt, dx * k); this.y.step(dt, dy * k);
      this.charge = Math.min(1, this.charge + dt * 2.2);
      if (far > 8) { this.tilt.step(dt, this.wrap(Math.atan2(dx, -dy))); this.squash.step(dt, -Math.min(0.085, Math.hypot(this.x.x, this.y.x) / R * 0.07)); }
      else { this.squash.step(dt, 0.025 + 0.035 * this.charge); }
      this.air = false;
    } else {
      this.x.k = this.y.k = 17; this.x.d = this.y.d = 3.1;
      this.x.step(dt, 0); this.y.step(dt, 0);
      const speed = Math.hypot(this.x.v, this.y.v) / R;
      this.squash.step(dt, -clamp(speed * 0.007, 0, 0.04));
      if (speed > 0.9) { this.tilt.step(dt, this.tilt.x + this.wrap(Math.atan2(this.x.v, -this.y.v) - this.tilt.x) * 0.4); }
      this.air = speed > 0.9;
    }
    for (let i = 0; i < 2; i++) {
      this.spin[i].step(dt, this.goal[i]);
      if (Math.abs(this.goal[i]) > 40 && Math.abs(this.spin[i].x - this.goal[i]) < 0.01) { this.spin[i].x -= this.goal[i]; this.goal[i] = 0; }
    }
  }
};

/// What it does belongs to what its face says. With closed eyes it never looks around and keeps still;
/// open eyes look, and every feeling has its own small movement.
const SHUT = new Set(["sleepy", "yawn", "content", "bliss", "squeeze"]);
const OF_LEVEL = [["smile", "content"], ["curious", "smile", "curious", "smirk"], ["worry", "worry", "grumpy"], ["wow", "scared"]];
const act = { name: "smile", since: 0, tilt: new Spring(60, 9), lean: new Spring(90, 10), stretch: new Spring(120, 11), shakeX: 0, shakeTurn: 0, wokeAt: -9 };
const watching = () => pointer && now_ - awake < (touch.matches ? 2.2 : 4);

function feeling() {
  if (body.held) { return body.held.far ? "wow" : "squeeze"; }
  if (body.air) { return "air"; }
  if (mood && now_ < moodUntil) { return mood; }
  const l = level(), idle = now_ - awake;
  if (now_ - act.wokeAt < 1.1) { return "curious"; }                 // just woken: "oh, somebody is here"
  if (!inStage && l === 0) {
    if (watching()) { return "smile"; }
    if (idle > 17) { return "sleepy"; }
    if (idle > 14.6) { return "yawn"; }
    if (idle > 9.5 && idle < 12) { return "content"; }
    return "smile";
  }
  const list = OF_LEVEL[l], name = list[Math.floor(now_ / 3.6) % list.length];
  return watching() && SHUT.has(name) ? "smile" : name;              // it does not close its eyes while it watches you
}
/// Where it looks: at the pointer; without one (a phone) it looks around by itself, where the page goes, and at taps.
function looking(x, y, dt) {
  scrollLook *= Math.exp(-dt * 3);
  if (watching()) {
    const dx = pointer[0] - x, dy = pointer[1] - y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 240);
    return [dx / d * k, dy / d * k];
  }
  if (Math.abs(scrollLook) > 0.15) { return [glance[0] * 0.3, clamp(scrollLook, -0.9, 0.9)]; }
  if (now_ > glanceAt) {
    const a = Math.random() * Math.PI * 2, far = Math.random() < 0.4 ? 0 : 0.35 + Math.random() * 0.5;
    glance = [Math.cos(a) * far, Math.sin(a) * far * 0.75];
    glanceAt = now_ + 0.9 + Math.random() * 2.2;
    if (far > 0.6) { face.blink(); }                                  // people blink when they look somewhere else
  }
  return glance;
}
function acting(name, dt, R) {
  if (name !== act.name) {
    if ((act.name === "sleepy" || act.name === "yawn") && name === "smile" && watching()) { act.wokeAt = now_; name = "curious"; }
    if (name === "wow") { body.y.v -= R * 1.1; act.stretch.v -= 1.2; }          // a start
    if (name === "joy" || name === "bliss") { act.stretch.v -= 0.9; }
    if (name === "curious" && act.name !== "curious") { act.tiltTo = (Math.random() < 0.5 ? -1 : 1) * 0.13; }
    act.name = name;
    act.since = now_;
  }
  const t = now_ - act.since;
  act.tilt.step(dt, { curious: act.tiltTo ?? 0.12, smirk: -0.09, worry: 0.05, yawn: 0, sleepy: 0.1 }[name] ?? 0);
  act.stretch.step(dt, { yawn: -0.05 * Math.sin(Math.PI * clamp(t / 2.4, 0, 1)), sleepy: 0.022 * Math.sin(now_ * 1.7), worry: 0.03, scared: 0.045, grumpy: 0.035, content: 0.012 * Math.sin(now_ * 2.1) }[name] ?? 0);
  act.lean.step(dt, { worry: 0.12, sleepy: 0.16 }[name] ?? 0);                    // the head hangs a little
  act.shakeX = name === "scared" ? Math.sin(now_ * 46) * R * 0.012 : name === "worry" ? Math.sin(now_ * 24) * R * 0.004 : 0;
  act.shakeTurn = name === "grumpy" ? Math.sin(t * 9) * 0.16 * Math.exp(-t * 1.6) : 0;   // "no"
  return name;
}

function drawOrb(dt) {
  findOwner();
  tones();
  const rect = owner.el.getBoundingClientRect(), R = Math.max(8, rect.width / 2), inBar = owner.name === "bar";
  let turn = [0, 0], x = 0, y = 0, size = 1, alpha = 1, tilt = 0, stretch = 0;
  scrollLook = clamp(scrollLook + (scrollY - lastScroll) / 260, -1.2, 1.2);
  lastScroll = scrollY;
  let name = landed ? feeling() : "content", aim = [0, 0];
  if (!landed) {
    filmTime += dt;
    const f = entrance(filmTime, W, H);
    x = f.x; y = f.y; size = f.scale; turn = f.turn; alpha = f.alpha;
    if (f.over || scrollY > H * 0.3) { arrived(); }
  } else if (!still.matches) {
    name = acting(name, dt, R);
    if (!SHUT.has(name)) { aim = looking(rect.left + R, rect.top + R, dt); }
    if (!inBar) { body.step(dt, R); }
    const calm = SHUT.has(name) ? 0.35 : 1;
    x = body.x.x + act.shakeX;
    // Weightless: it drifts a little in slow loops, never quite still.
    const drift = inBar ? 0 : R * 0.03 * calm * (body.held ? 0 : 1);
    x += Math.sin(now_ * 0.53) * drift * 0.8;
    y = body.y.x + Math.sin(now_ * 0.81 + 0.6) * drift + Math.sin(now_ * 1.9) * drift * 0.22;
    const up = face.head[1].x;
    turn = [body.spin[0].x + face.head[0].x * 0.2 + act.shakeTurn, body.spin[1].x - up * (up < 0 ? 0.3 : 0.14) - act.lean.x];
    tilt = act.tilt.x;
    stretch = act.stretch.x;
  }
  const target = [0.1, 0.25, 0.5, 0.75][level()] + (body.air || body.held ? 0.35 : 0);
  orbEnergy += (target - orbEnergy) * (1 - Math.exp(-dt / (target > orbEnergy ? 0.25 : 1)));
  orbTime += dt * (0.55 + orbEnergy * 1.1) * (name === "sleepy" ? 0.5 : 1);
  ball?.draw({ time: orbTime, energy: orbEnergy, roll: turn, cMain: look.ballMain, cLow: look.ballLow, cMid: look.ballMid, cHigh: look.ballHigh });
  face.step(still.matches ? 1 : dt, name, aim);
  const d = face.path(turn), q = clamp(body.squash.x, -0.1, 0.1), sy = (1 - q) * (1 - stretch), sx = 1 / Math.sqrt(sy), a = body.tilt.x;
  for (const v of views) {
    const mine = v === owner;
    if (still.matches) { v.grow.x = mine ? 1 : 0; } else { v.grow.step(dt, mine ? 1 : 0); }
    const g = Math.max(0, v.grow.x);
    if (g < 0.01) { if (v.on !== false) { v.on = false; v.el.style.visibility = "hidden"; } continue; }
    if (v.on !== true) { v.on = true; v.el.style.visibility = "visible"; }
    if (ball) { v.ctx.clearRect(0, 0, v.canvas.width, v.canvas.height); v.ctx.drawImage(ball.canvas, 0, 0, v.canvas.width, v.canvas.height); }
    v.path.setAttribute("d", d);
    if (mine && !inBar) {
      v.button.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${(a + tilt).toFixed(4)}rad) scale(${(g * size * sx).toFixed(4)}, ${(g * size * sy).toFixed(4)}) rotate(${(-a).toFixed(4)}rad)`;
      v.button.style.opacity = alpha;
    } else {
      v.button.style.transform = `scale(${g.toFixed(4)})`;
      v.button.style.opacity = 1;
    }
  }
}
function arrived() {
  if (document.documentElement.classList.contains("landed")) { return; }
  landed = true;
  document.documentElement.classList.add("landed");
  awake = Math.max(awake, now_);
}

/// The clouds stand lower on the first screen and rise to the bar behind the rest, as in the app.
const cloudValues = (lift, zoom = ZOOM) => ({ time: cloudTime, energy: look.energy, zoom, lift, dark: darkMode.matches ? 1 : 0, cMain: look.main, cLow: look.low, cMid: look.mid, cHigh: look.high,
                                deep: look.deep, dmid: look.dmid, glow: look.glow, skyShift: look.skyShift });
/// The same clouds on the devices that are on screen: drawn once per shape, copied to every device.
function drawScreens() {
  if (!inside) { return; }
  for (const kind of ["tall", "wide"]) {
    // In the strip of devices the picture stands still: drawn once per level and theme.
    const key = level() + "" + darkMode.matches;
    const list = screens.filter((c) => c.dataset.bg === kind && onScreen.has(c) && (!c.closest("[data-still]") || c.dataset.key !== key));
    if (!list.length) { continue; }
    inside.resize(list[0].width, list[0].height);
    inside.draw(kind === "wide" ? cloudValues(0.34, 2.6) : cloudValues(LIFT));
    for (const c of list) { c.dataset.key = key; c.getContext("2d").drawImage(inside.canvas, 0, 0); }
  }
}

let last = performance.now() / 1000, sinceScreens = 1;
function frame(ms) {
  requestAnimationFrame(frame);
  const now = ms / 1000, real = clamp(now - last, 0, 0.25), dt = Math.min(real, 0.05);
  last = now;
  now_ += real;
  if (still.matches) {
    // Nothing moves by itself: draw only when something has changed.
    if (!dirty) { return; }
    dirty = false;
    look = copy(LOOKS[level()]);
    drawScreens(); stepCharts(1, day().curve, true); drawOrb(0);
    return;
  }
  glide(real);
  cloudTime += dt * look.speed;
  sinceScreens += real;
  if (sinceScreens >= 1 / 31) { sinceScreens = 0; drawScreens(); }
  stepCharts(real, day().curve);
  drawOrb(landed ? dt : Math.min(real, 0.1));
}

function aimAt(e) { pointer = [e.clientX, e.clientY]; awake = now_; }
addEventListener("resize", measure);
addEventListener("load", measure);
addEventListener("scroll", () => { dirty = true; if (now_ - awake > 3) { awake = now_ - 3; } }, { passive: true });
darkMode.addEventListener("change", () => { dirty = true; showWidgets(DAYS[widgetDay]); });
addEventListener("pointermove", aimAt, { passive: true });
addEventListener("pointerdown", aimAt, { passive: true });
document.addEventListener("pointerleave", () => { pointer = null; });

// Press, pull and let go.
for (const v of views) {
  if (v.name === "bar") { v.button.addEventListener("click", () => scrollTo({ top: 0, behavior: still.matches ? "auto" : "smooth" })); continue; }
  v.button.addEventListener("pointerdown", (e) => {
    if (!landed || v !== owner || still.matches) { return; }
    e.preventDefault();
    body.held = { id: e.pointerId, view: v, from: [e.clientX, e.clientY], pull: [0, 0], far: false };
    body.air = false;
    body.charge = 0;
  });
  v.button.addEventListener("dragstart", (e) => e.preventDefault());
  v.button.addEventListener("contextmenu", (e) => { if (touch.matches) { e.preventDefault(); } });
  v.button.addEventListener("click", (e) => { if (e.detail === 0 && landed && !still.matches) { body.push(v.el.clientWidth / 2, 0.4, 0.5, 3.4); mood = "joy"; moodUntil = now_ + 2.4; } });   // keyboard
}
// Everything that can end a pull is listened to on the whole window, so the orb can never stay in the hand.
addEventListener("pointermove", (e) => {
  const held = body.held;
  if (!held || e.pointerId !== held.id) { return; }
  if (e.pointerType === "mouse" && e.buttons === 0) { release(held.view); return; }
  held.pull = [e.clientX - held.from[0], e.clientY - held.from[1]];
  if (Math.hypot(...held.pull) > 8) { held.far = true; }
}, { passive: true });
addEventListener("pointerup", (e) => { if (body.held && e.pointerId === body.held.id) { release(body.held.view); } });
for (const name of ["pointercancel", "blur"]) { addEventListener(name, () => { body.held = null; }); }
document.addEventListener("visibilitychange", () => { body.held = null; });
document.addEventListener("pointerleave", () => { if (body.held) { release(body.held.view); } });
function release(v) {
  const held = body.held;
  if (!held) { return; }
  body.held = null;
  const r = v.button.getBoundingClientRect(), R = v.el.clientWidth / 2;
  if (held.far) {
    // Let go: it flies back over its place, rings out and rolls with the speed.
    body.x.v -= body.x.x * 3.2;
    body.y.v -= body.y.x * 3.2;
    body.squash.v += 0.7;
    body.goal[0] += Math.abs(body.x.x) > R * 0.6 ? -Math.sign(body.x.x) * 2 * Math.PI : 0;
    body.goal[1] += Math.abs(body.y.x) > R * 0.6 ? Math.sign(body.y.x) * 2 * Math.PI : 0;
    mood = "bliss"; moodUntil = now_ + 1.6;
    return;
  }
  body.hits = [...body.hits.filter((t) => now_ - t < 3), now_];
  body.push(R, clamp((held.from[0] - r.left - r.width / 2) / R, -1, 1), clamp((held.from[1] - r.top - r.height / 2) / R, -1, 1), 3 + 2.2 * body.charge);
  mood = body.hits.length > 4 ? "grumpy" : ["bliss", "wink", "joy", "content"][Math.floor(Math.random() * 4)];
  moodUntil = now_ + 2.8;
}
for (const b of document.querySelectorAll(".store")) {
  b.addEventListener("pointerenter", () => { mood = "joy"; moodUntil = now_ + 60; });
  b.addEventListener("pointerleave", () => { moodUntil = now_ + 0.4; });
}

// ---- Status: right now, then four example days; they change by themselves ----

let stageDay = 0;                                 // the example day: quiet, active, storm, severe
let inStage = false, handsUntil = 0;
let liveDay = null;                               // filled by NOAA
const day = () => inStage ? DAYS[stageDay] : liveDay ?? DAYS[0];
const buttons = [...document.querySelectorAll("#status .segments button")];
const WHEN = ["On a quiet day", "On an active day", "During a storm", "During a severe storm"];
const MEANS = ["The Sun is calm. Nothing unusual is on its way.", "The Sun is restless. Near the poles the sky may light up tonight.",
               "Aurora may be seen farther from the poles than usual. GPS and radio may be less accurate.", "A rare, strong storm. Aurora may be seen far from the poles, and GPS and radio can fail for a while."];
function showStage() {
  stageLevel = inStage ? stageDay : null;
  showScreens(day());
  dirty = true;
  const d = DAYS[stageDay];
  stage.dataset.level = stageDay;
  put($("#when"), WHEN[stageDay]);
  put($("#kp"), d.kp);
  put($("#state"), d.state);
  put($("#means"), MEANS[stageDay]);
  buttons.forEach((b, i) => b.setAttribute("aria-pressed", i === stageDay));
  $("#status .thumb").style.transform = `translateX(${stageDay * 100}%)`;
}
new IntersectionObserver((list) => {
  if (!list[list.length - 1].isIntersecting || inStage) { return; }
  inStage = true; stageDay = 0; autoAt = now_ + 3;
  showStage();
}, { rootMargin: "-40% 0px -40% 0px" }).observe(stage);
// It goes back to today's colour only when nothing of it can be seen any more.
new IntersectionObserver((list) => {
  if (list[list.length - 1].isIntersecting || !inStage) { return; }
  inStage = false; stageDay = 0; handsUntil = 0;
  look = copy(LOOKS[liveLevel]);
  showStage();
}, { rootMargin: "16%" }).observe(stage);
let autoAt = 0;
setInterval(() => {
  if (!inStage || document.hidden || still.matches || now_ < handsUntil || now_ < autoAt) { return; }
  stageDay = (stageDay + 1) % 4;
  autoAt = now_ + 2.9;
  showStage();
}, 200);
// The person plays: the page waits a while before it goes on.
buttons.forEach((b, i) => b.addEventListener("click", () => { stageDay = i; inStage = true; handsUntil = now_ + 15; showStage(); }));

// ---- The wordmark in the bar: every letter is black or white, by what lies under it ----

const letters = [...document.querySelectorAll("#bar .word > span")];
let toneAt = 0;
function tones() {
  if (now_ < toneAt || !bar.classList.contains("shown")) { return; }
  toneAt = now_ + 0.08;
  for (const l of letters) {
    const r = l.getBoundingClientRect(), under = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).find((e) => !bar.contains(e));
    const tone = under?.closest("[data-tone]")?.dataset.tone ?? (darkMode.matches ? "dark" : "light");
    if (l.dataset.on !== tone) { l.dataset.on = tone; }
  }
}

// ---- Loops and soft entrances ----

let widgetDay = 0, noted = 1;
showWidgets(DAYS[0]);
note(0);
for (let i = 0; i < 5; i++) { say(true); }
const loops = new Map([["#widgets", false], ["#chat", false], ["#devices", false]]);
const loopWatch = new IntersectionObserver((list) => { for (const e of list) { loops.set("#" + e.target.id, e.isIntersecting); } });
for (const id of loops.keys()) { loopWatch.observe($(id)); }
const every = (ms, id, run) => setInterval(() => { if (!document.hidden && !still.matches && id.some((i) => loops.get(i))) { run(); } }, ms);
every(3600, ["#widgets", "#devices"], () => { widgetDay = (widgetDay + 1) % 4; showWidgets(DAYS[widgetDay]); });
every(4200, ["#widgets"], () => note(noted++));
every(1700, ["#chat"], () => say());
const rooms = [...document.querySelectorAll("#chat .segments button")];
rooms.forEach((b, i) => b.addEventListener("click", () => openRoom(i)));
openRoom(1);

// The strip of devices.
const strip = $("#strip"), slides = [...strip.children], dots = $("#dots");
dots.innerHTML = slides.map(() => "<i></i>").join("");
let slide = 0;
const toSlide = (i) => { const s = slides[clamp(i, 0, slides.length - 1)]; strip.scrollTo({ left: s.offsetLeft - (strip.clientWidth - s.clientWidth) / 2, behavior: still.matches ? "auto" : "smooth" }); };
function onStrip() {
  const mid = strip.scrollLeft + strip.clientWidth / 2;
  slide = slides.reduce((b, s, i) => Math.abs(s.offsetLeft + s.clientWidth / 2 - mid) < Math.abs(slides[b].offsetLeft + slides[b].clientWidth / 2 - mid) ? i : b, 0);
  slides.forEach((s, i) => s.classList.toggle("on", i === slide));
  [...dots.children].forEach((d, i) => d.classList.toggle("on", i === slide));
  $("#prev").disabled = slide === 0; $("#next").disabled = slide === slides.length - 1;
}
strip.addEventListener("scroll", onStrip, { passive: true });
$("#prev").addEventListener("click", () => toSlide(slide - 1));
$("#next").addEventListener("click", () => toSlide(slide + 1));
onStrip();

const appear = new IntersectionObserver((list) => {
  for (const e of list) { if (e.isIntersecting) { e.target.classList.add("seen"); appear.unobserve(e.target); } }
}, { rootMargin: "0px 0px -10% 0px" });
document.querySelectorAll(".soft").forEach((e) => appear.observe(e));

// ---- Live numbers from NOAA, the same rule as in the app: the highest measured signal wins ----

const SWPC = "https://services.swpc.noaa.gov/";
const load = (path) => fetch(SWPC + path, { referrerPolicy: "no-referrer", signal: AbortSignal.timeout?.(10000) }).then((r) => r.ok ? r.json() : null).catch(() => null);
const percent = (v) => v === undefined || v === null || !isFinite(Number(v)) ? "–" : Math.round(Number(v)) + "%";
const kpLevel = (kp) => { kp = Math.round(kp); return kp < 4 ? 0 : kp < 5 ? 1 : kp < 7 ? 2 : 3; };
const scaleLevel = (s) => s < 1 ? 0 : s < 3 ? 1 : s < 4 ? 2 : 3;
async function live() {
  const [rows, scales, flares, field_, wind, odds] = await Promise.all([
    load("products/noaa-planetary-k-index-forecast.json"), load("products/noaa-scales.json"),
    load("json/goes/primary/xray-flares-latest.json"), load("products/summary/solar-wind-mag-field.json"), load("products/summary/solar-wind-speed.json"), load("json/solar_probabilities.json")]);
  if (!Array.isArray(rows)) { return; }
  const points = rows.map((r) => ({ at: Date.parse(String(r.time_tag).replace(" ", "T").replace(/Z?$/, "Z")), kp: Number(r.kp), seen: r.observed !== "predicted" }))
    .filter((p) => isFinite(p.at) && isFinite(p.kp)).sort((a, b) => a.at - b.at);
  const past = points.filter((p) => p.seen && p.at <= Date.now()).slice(-12);
  if (past.length < 12) { return; }
  const next = points.filter((p) => p.at > past[11].at).slice(0, 12);
  while (next.length < 12) { next.push(next[next.length - 1] ?? past[11]); }
  const s = scales?.["0"] ?? {}, scale = (k) => Number(s[k]?.Scale) || 0, g = scale("G"), kp = past[11].kp;
  const cls = flares?.[0]?.current_class ?? null, bz = Number(field_?.[0]?.bz_gsm ?? NaN), speed = Number(wind?.[0]?.proton_speed ?? NaN);
  const l = Math.max(kpLevel(kp), cls?.[0] === "X" ? 2 : cls?.[0] === "M" ? 1 : 0, scaleLevel(scale("R")), scaleLevel(scale("S")), scaleLevel(g), bz <= -20 ? 2 : bz <= -10 ? 1 : 0);
  liveLevel = l;
  liveDay = { level: l, kp: Math.round(kp), curve: [...past, ...next].map((p) => p.kp),
    state: ["Space weather is quiet now", "Space weather is active now", g > 0 ? "Magnetic storm now" : "Space weather storm now", g > 0 ? "Severe magnetic storm now" : "Severe space weather now"][l],
    condition: ["Quiet space weather", "Active space weather", g > 0 ? "Magnetic storm" : "Stormy space weather", g > 0 ? "Severe magnetic storm" : "Severe space weather"][l],
    watch: ((p) => p >= 5 ? "Storm possible" : p >= 4 ? "Unsettled" : "Calm next 24 hours")(Math.round(Math.max(...next.slice(0, 8).map((p) => p.kp)))),
    feel: FEEL[clamp(Math.round(kp), 0, 9)],
    m: percent(odds?.[0]?.m_class_1_day), x: percent(odds?.[0]?.x_class_1_day), flare: cls ?? "–", flareWord: cls ? { X: "Strong", M: "Medium", C: "Moderate" }[cls[0]] ?? "Low" : "",
    wind: isFinite(speed) ? Math.round(speed) : "–", windWord: !isFinite(speed) ? "" : speed < 400 ? "Calm" : speed < 600 ? "Raised" : "High", bz: isFinite(bz) ? Math.round(bz) : "–" };
  showStage();
}
const FEEL = ["Nothing to feel right now", "Most people feel nothing", "Most people will not feel anything", "Very few people may feel it", "Some people may notice it",
              "Sensitive people may feel it", "Some people may feel a bit off", "Some people may feel tired", "Some people may sleep lighter", "Very rare. Some people may feel it"];

if (landed) { document.documentElement.classList.add("landed"); }
measure();
showStage();
requestAnimationFrame(frame);
live();
// A slow device must not hold the words back.
setTimeout(arrived, 4000);
setInterval(() => { if (!document.hidden) { live(); } }, 5 * 60e3);
