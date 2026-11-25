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

const field = shaderCanvas($("#clouds"), FIELD), ball = shaderCanvas(document.createElement("canvas"), ORB);
const inside = shaderCanvas(document.createElement("canvas"), FIELD);   // the clouds on the screens of the devices
if (!field) { $("#clouds").remove(); }
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

let W = 0, H = 0, big = 100, cloudW = 0, cloudH = 0;
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
  cloudW = W; cloudH = $("#clouds")?.clientHeight ?? H;
  field?.resize(cloudW / 3, cloudH / 3);
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

// ---- The body of the orb: a soft glass ball with weight ----

const body = {
  x: new Spring(150, 15), y: new Spring(150, 15),          // away from its place
  squash: new Spring(330, 13),                             // + flat, − long; the volume stays the same
  tilt: new Spring(120, 10),                               // which way it is squashed
  spin: [new Spring(26, 7.2), new Spring(26, 7.2)], goal: [0, 0],   // turning; the goal is always a full turn
  air: false, held: null, charge: 0, hits: [],
  /// A push: it jumps, turns away from the finger and lands with weight.
  jump(power, side) {
    this.air = true;
    this.y.v = -power;
    this.x.v += -side * power * 0.16;
    this.squash.v -= 5.5;
    this.goal[0] += (side < 0 ? 1 : -1) * 2 * Math.PI;
    this.spin[0].v += (side < 0 ? 1 : -1) * 2.5;
    this.tilt.v += side * 2;
  },
  step(dt, R) {
    const g = R * 26;
    if (this.held) {
      // Pulled: the farther, the heavier (rubber band); it gets long in the direction of the pull.
      const [dx, dy] = this.held.pull, far = Math.hypot(dx, dy), k = far ? R * 1.1 * (1 - 1 / (far * 0.62 / (R * 1.1) + 1)) / far : 0;
      this.x.k = this.y.k = 420; this.x.d = this.y.d = 34;
      this.x.step(dt, dx * k); this.y.step(dt, dy * k);
      this.charge = Math.min(1, this.charge + dt * 2.2);
      this.squash.step(dt, far > 8 ? -Math.min(0.22, Math.hypot(this.x.x, this.y.x) / R * 0.2) : 0.1 + 0.1 * this.charge);
      this.tilt.step(dt, far > 8 ? Math.atan2(dx, -dy) : 0);
    } else if (this.air) {
      for (let t = dt; t > 1e-6; t -= 1 / 240) {
        const h = Math.min(t, 1 / 240);
        this.y.v += g * h;
        this.y.x += this.y.v * h;
        if (this.y.x > 0 && this.y.v > 0) {
          const v = this.y.v;
          this.y.x = 0;
          this.squash.v += clamp(v / R, 0, 14) * 0.95;      // the hit flattens it
          this.spin[0].v *= 0.6;
          face.blink();
          if (v < R * 2.6) { this.air = false; this.y.v = v * 0.15; } else { this.y.v = -v * 0.46; }
        }
      }
      this.x.k = 60; this.x.d = 9;
      this.x.step(dt, 0);
      this.squash.step(dt, -clamp(Math.abs(this.y.v) / R * 0.012, 0, 0.12));   // long while it flies
      this.tilt.step(dt, clamp(Math.atan2(this.x.v, Math.abs(this.y.v) + R), -0.5, 0.5));
    } else {
      this.x.k = this.y.k = 150; this.x.d = this.y.d = 13;
      this.x.step(dt, 0); this.y.step(dt, 0);
      this.squash.step(dt, -clamp(Math.hypot(this.x.v, this.y.v) / R * 0.016, 0, 0.18));
      this.tilt.step(dt, Math.hypot(this.x.v, this.y.v) > R * 0.6 ? clamp(Math.atan(this.x.v / (Math.abs(this.y.v) + 1)), -1.2, 1.2) : 0);
    }
    for (let i = 0; i < 2; i++) { this.spin[i].step(dt, this.goal[i]); }
  }
};

/// Which face: what happens to it comes first, then the level of the day; asleep when nobody is there.
const OF_LEVEL = [["smile"], ["curious", "joy", "smirk"], ["worry", "grumpy", "worry"], ["wow", "scared", "wow"]];
function feeling() {
  if (body.held) { return body.held.far ? "wow" : "squeeze"; }
  if (body.air) { return "air"; }
  if (mood && now_ < moodUntil) { return mood; }
  const l = level(), idle = now_ - awake;
  if ((!inStage || stageDay === 0) && l === 0) {
    if (idle > 15) { return "sleepy"; }
    if (idle > 13.2) { return "yawn"; }
    if (idle > 9) { return "content"; }
    if (idle > 6.5) { return "smirk"; }
    return "smile";
  }
  if (inStage && stageDay === 1) { return Math.floor(now_ / 4) % 3 === 2 ? "content" : "smile"; }
  return OF_LEVEL[l][Math.floor(now_ / 3.4) % OF_LEVEL[l].length];
}
/// Where it looks: at the pointer; without one (a phone) it looks around by itself, where the page goes, and at taps.
function looking(x, y, dt) {
  scrollLook *= Math.exp(-dt * 3);
  const fresh = now_ - awake;
  if (pointer && fresh < (touch.matches ? 2.2 : 6)) {
    const dx = pointer[0] - x, dy = pointer[1] - y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 240);
    return [dx / d * k, dy / d * k];
  }
  if (now_ > glanceAt) {
    const a = Math.random() * Math.PI * 2, far = Math.random() < 0.35 ? 0 : 0.35 + Math.random() * 0.55;
    glance = [Math.cos(a) * far, Math.sin(a) * far * 0.8];
    glanceAt = now_ + 0.7 + Math.random() * 2.4;
  }
  return Math.abs(scrollLook) > 0.15 ? [glance[0] * 0.3, clamp(scrollLook, -0.9, 0.9)] : glance;
}

function drawOrb(dt) {
  findOwner();
  const rect = owner.el.getBoundingClientRect(), R = Math.max(8, rect.width / 2), inBar = owner.name === "bar";
  let turn = [0, 0], x = 0, y = 0, size = 1, alpha = 1;
  scrollLook = clamp(scrollLook + (scrollY - lastScroll) / 260, -1.2, 1.2);
  lastScroll = scrollY;
  let aim = still.matches ? [0, 0] : looking(rect.left + R, rect.top + R, dt);
  if (!landed) {
    filmTime += dt;
    const f = entrance(filmTime, W, H);
    x = f.x; y = f.y; size = f.scale; turn = f.turn; alpha = f.alpha;
    aim = [0, 0];
    if (f.over || scrollY > H * 0.3) { arrived(); }
  } else if (!still.matches) {
    if (!inBar) { body.step(dt, R); }
    x = body.x.x;
    y = body.y.x + (body.air || body.held || inBar ? 0 : Math.sin(now_ * 1.15) * R * 0.022);   // it breathes in the air
    const up = face.head[1].x;
    turn = [body.spin[0].x + face.head[0].x * 0.2 + Math.sin(now_ * 0.7) * 0.03, body.spin[1].x - up * (up < 0 ? 0.3 : 0.14)];
  }
  const target = [0.1, 0.25, 0.5, 0.75][level()] + (body.air || body.held ? 0.35 : 0);
  orbEnergy += (target - orbEnergy) * (1 - Math.exp(-dt / (target > orbEnergy ? 0.25 : 1)));
  orbTime += dt * (0.55 + orbEnergy * 1.1);
  ball?.draw({ time: orbTime, energy: orbEnergy, roll: turn, cMain: look.ballMain, cLow: look.ballLow, cMid: look.ballMid, cHigh: look.ballHigh });
  face.step(still.matches ? 1 : dt, landed ? feeling() : "content", aim);
  const d = face.path(turn), q = clamp(body.squash.x, -0.3, 0.34), sy = 1 - q, sx = 1 / Math.sqrt(sy), a = body.tilt.x;
  for (const v of views) {
    const mine = v === owner;
    if (still.matches) { v.grow.x = mine ? 1 : 0; } else { v.grow.step(dt, mine ? 1 : 0); }
    const g = Math.max(0, v.grow.x);
    if (g < 0.01) { if (v.on !== false) { v.on = false; v.el.style.visibility = "hidden"; } continue; }
    if (v.on !== true) { v.on = true; v.el.style.visibility = "visible"; }
    if (ball) { v.ctx.clearRect(0, 0, v.canvas.width, v.canvas.height); v.ctx.drawImage(ball.canvas, 0, 0, v.canvas.width, v.canvas.height); }
    v.path.setAttribute("d", d);
    if (mine && !inBar) {
      const sink = !body.held && q > 0 ? R * q : 0;      // squashed on the ground: the lowest point stays where it is
      v.button.style.transform = `translate(${x.toFixed(2)}px, ${(y + sink).toFixed(2)}px) rotate(${a.toFixed(4)}rad) scale(${(g * size * sx).toFixed(4)}, ${(g * size * sy).toFixed(4)}) rotate(${(-a).toFixed(4)}rad)`;
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
/// Clouds only behind the states: a part of that section, so they lie under the bars of the browser too.
/// The horizon stands high, as in a header.
let stageSeen = false;
new IntersectionObserver((list) => { stageSeen = list[list.length - 1].isIntersecting; dirty = true; }, { rootMargin: "20%" }).observe(stage);
function drawClouds() {
  if (!field || !stageSeen) { return; }
  const over = (cloudH - stage.clientHeight) / 2, edge = over + Math.max(96, stage.clientHeight * 0.17);
  const y = 0.5 + (edge / cloudH - 0.5) / 1.03, zoom = W > H ? 2.6 : ZOOM, top = 1 - y - (0.33 + 0.16 * look.energy + (zoom - 1) * 0.5) / zoom;   // sizes of the app: upright, on its side
  field.draw(cloudValues(Math.max(top, 0), zoom));
}
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

let last = performance.now() / 1000, sinceClouds = 1, sinceScreens = 1;
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
    drawClouds(); drawScreens(); stepCharts(1, day().curve, true); drawOrb(0);
    return;
  }
  glide(real);
  cloudTime += dt * look.speed;
  sinceClouds += real; sinceScreens += real;
  if (sinceClouds >= 1 / 31) { sinceClouds = 0; drawClouds(); }
  if (sinceScreens >= 1 / 21) { sinceScreens = 0; drawScreens(); }
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
    v.button.setPointerCapture(e.pointerId);
    body.held = { from: [e.clientX, e.clientY], pull: [0, 0], far: false };
    body.air = false;
    body.charge = 0;
  });
  v.button.addEventListener("pointermove", (e) => {
    if (!body.held) { return; }
    body.held.pull = [e.clientX - body.held.from[0], e.clientY - body.held.from[1]];
    if (Math.hypot(...body.held.pull) > 8) { body.held.far = true; }
  });
  v.button.addEventListener("pointerup", () => release(v));
  v.button.addEventListener("pointercancel", () => { body.held = null; });   // the finger scrolls the page
  v.button.addEventListener("click", (e) => { if (e.detail === 0 && landed && !still.matches) { body.jump(v.el.clientWidth * 3.3, 0.4); mood = "joy"; moodUntil = now_ + 2.4; } });   // keyboard
}
function release(v) {
  const held = body.held;
  if (!held) { return; }
  body.held = null;
  const r = v.el.getBoundingClientRect(), R = r.width / 2, side = clamp((held.from[0] - r.left - R) / R, -1, 1);
  if (held.far) {
    // Let go: it shoots back over its place, rings out and rolls with the speed.
    body.spin[0].v += clamp(-body.x.x / R * 9, -14, 14);
    body.spin[1].v += clamp(body.y.x / R * 6, -10, 10);
    mood = "bliss"; moodUntil = now_ + 1.3;
    return;
  }
  body.hits = [...body.hits.filter((t) => now_ - t < 3), now_];
  body.jump(R * (6.2 + 3.6 * body.charge), Math.abs(side) < 0.12 ? (Math.random() < 0.5 ? -0.4 : 0.4) : side);
  mood = body.hits.length > 4 ? "grumpy" : ["bliss", "wink", "joy", "content"][Math.floor(Math.random() * 4)];
  moodUntil = now_ + 2.6;
}
for (const b of document.querySelectorAll(".store")) {
  b.addEventListener("pointerenter", () => { mood = "joy"; moodUntil = now_ + 60; });
  b.addEventListener("pointerleave", () => { moodUntil = now_ + 0.4; });
}

// ---- Status: right now, then four example days; they change by themselves ----

let stageDay = 0;                                 // 0 = right now, 1...4 = example days
let inStage = false, handsUntil = 0;
let liveDay = null;                               // filled by NOAA
const day = () => inStage && stageDay ? DAYS[stageDay - 1] : liveDay ?? DAYS[0];
const buttons = [...document.querySelectorAll("#status .segments button")];
const WHEN = ["Right now", "On a quiet day", "On an active day", "During a storm", "During a severe storm"];
const MEANS = ["The Sun is calm. Nothing unusual is on its way.", "The Sun is restless. Near the poles the sky may light up tonight.",
               "Aurora may be seen farther from the poles than usual. GPS and radio may be less accurate.", "A rare, strong storm. Aurora may be seen far from the poles, and GPS and radio can fail for a while."];
function showStage() {
  const d = day();
  stageLevel = inStage && stageDay ? d.level : null;
  showScreens(d);
  dirty = true;
  put($("#when"), WHEN[stageDay]);
  put($("#kp"), d.kp);
  put($("#state"), d.state);
  put($("#means"), MEANS[d.level]);
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
  stageDay = (stageDay + 1) % 5;
  autoAt = now_ + 2.9;
  showStage();
}, 200);
// The person plays: the page waits a while before it goes on.
buttons.forEach((b, i) => b.addEventListener("click", () => { stageDay = i; inStage = true; handsUntil = now_ + 15; showStage(); }));

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
