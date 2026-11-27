"use strict";
// ---- Colours of the app, per level: quiet, active, storm, severe ----

const LIGHT = [["#F4FAE2", "#DFEED4", "#9DDD8B", "#CDE8B5"], ["#EEF7F2", "#93E3FD", "#00E7E7", "#C1E3EA"],
               ["#FFF2D6", "#F7C43A", "#F7A945", "#F6DADA"], ["#FFE0EF", "#FF96FE", "#8B85F4", "#F0F1F6"]];   // high, main, mid, low
const DARK = [["#0C150B", "#0C4E0F", "#71A54A"], ["#00323A", "#1C8687", "#4BC6FF"],
              ["#340C04", "#901414", "#B8420E"], ["#341C3C", "#AB296E", "#FF42A9"]];                           // deep, mid, glow
const DARK_SKY = ["#295B29", "#366980", "#8E260D", "#5F0076"];
const rgbOf = (v) => v.map((x) => Math.round(clamp(x, 0, 1) * 255)).join(" ");
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
/// Where the app puts the clouds in the chat: their edge at the navigation bar (CloudBackground.lift; bar 116 of 874 pt).
const CHAT_LIFT = 1 - (0.5 + (116 / 874 - 0.5) / 1.03) - (0.33 + (ZOOM - 1) * 0.5) / ZOOM;

// ---- Which level is shown ----

let liveLevel = 0;      // what NOAA says now
let stageLevel = null;  // the level of the four-colours part, while it is on screen
const level = () => stageLevel ?? liveLevel;

const copy = (look) => Object.fromEntries(Object.entries(look).map(([k, v]) => [k, Array.isArray(v) ? v.slice() : v]));
// Two looks, so nothing outside the Kp part ever takes its example colours: the live one (today's level) and the
// one of the Kp part. The orb and the phone of a part always read the same one, so their colours change together.
let liveLook = copy(LOOKS[0]), stageLook = copy(LOOKS[0]), heroLook = copy(LOOKS[0]);
function glideTo(look, to, f) {
  for (const k in to) {
    if (Array.isArray(to[k])) { for (let i = 0; i < 3; i++) { look[k][i] += (to[k][i] - look[k][i]) * f; } }
    else { look[k] += (to[k] - look[k]) * f; }
  }
}
function glide(dt) {
  const f = 1 - Math.exp(-dt * 3.2);
  glideTo(liveLook, LOOKS[liveLevel], f);
  glideTo(stageLook, LOOKS[inStage ? stageDay : liveLevel], f);
  glideTo(heroLook, LOOKS[typeof heroTint === "number" ? heroTint : liveLevel], 1 - Math.exp(-dt * 2.4));
}
const orbStage = () => owner?.name === "status" && inStage;

// ---- The orb's way in: it glides in calmly from below and turns to us ----

const LEAD = 0.1, WAY = 0.95;
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
  el.innerHTML = `<button class="orb" type="button" aria-label="${el.dataset.orb === "bar" ? "Back to the top" : "Heliotide"}"><canvas></canvas><svg viewBox="-100 -100 200 200" aria-hidden="true"><path d=""/></svg></button>${el.dataset.orb === "bar" ? "" : '<i class="zz" aria-hidden="true"><b>Z</b><b>z</b><b>z</b></i>'}`;
  const button = el.querySelector("button"), canvas = el.querySelector("canvas");
  return { el, look: el.dataset.look ? document.querySelector(el.dataset.look) : null, feel: el.dataset.feel?.split(" "), roam: "roam" in el.dataset, name: el.dataset.orb, button, canvas, ctx: canvas.getContext("2d"), path: el.querySelector("path"), grow: new Spring(el.dataset.orb === "bar" ? 620 : 430, el.dataset.orb === "bar" ? 40 : 34, 0) };
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
  for (const v of views) { const side = Math.round(v.el.clientWidth / 0.96 * Math.min(touch.matches ? 2 : 3, devicePixelRatio || 1)); if (v.canvas.width !== side || v.canvas.height !== side) { v.canvas.width = v.canvas.height = side; } }
  for (const c of screens) { const [cw, ch] = c.dataset.bg !== "wide" ? [132, 286] : [240, 168]; if (c.width !== cw) { c.width = cw; c.height = ch; } }
  dirty = true;
}

const ORB_PACE = SPEED.map((v) => Math.sqrt(v / SPEED[0]));   // 1, 1.31, 1.83, 2.09
let orbSpeed = 0.9;
let cloudTime = 20, stageTime = 20, orbTime = 20, filmTime = 0, dirty = true, landed = still.matches;
let pointer = null, awake = 0, now_ = 0, mood = null, moodUntil = 0, glance = [0, 0], glanceAt = 0, scrollLook = 0, lastScroll = scrollY;
const touch = matchMedia("(hover: none)");
// ?place: the orb stays where it is dropped, and a label says where, so Dima can show the right place in each part.
const placing = new URLSearchParams(location.search).has("place"), placed = {};
const placeLabel = placing ? Object.assign(document.body.appendChild(document.createElement("div")), { id: "place" }) : null;
function showPlace(v) {
  const r = v.el.getBoundingClientRect();
  placeLabel.textContent = `${v.name}: ${Math.round(body.home[0])} px, ${Math.round(body.home[1])} px (${Math.round(body.home[0] / r.width * 100)} %, ${Math.round(body.home[1] / r.height * 100)} % of its size)`;
}

/// Who shows the orb: the big place in the middle of the screen, or the O of the bar.
function findOwner() {
  if (body.held) { return; }                       // in the hand it stays where it is
  let best = null, near = 1e9;
  for (const v of views) {
    if (v.name === "bar") { continue; }
    const r = v.el.getBoundingClientRect();
    if (!r.width) { continue; }
    const y = r.top + r.height / 2, x = r.left + r.width / 2, room = v === owner ? 0.02 : 0.1;
    if (y > H * room && y < H * (1 - room) && x > 10 && x < W - 10) { const d = Math.abs(y - H * 0.45); if (d < near) { near = d; best = v; } }
  }
  const next = best ?? viewOf("bar");
  if (next !== owner) { owner = next; body.held = null; body.air = false; body.home = placed[owner.name] ?? [0, 0]; for (const p of [body.x, body.y, body.squash, body.tilt]) { p.x = p.v = 0; } }
  bar.classList.toggle("shown", owner.name !== "end");
  bar.classList.toggle("docked", owner.name === "bar");
}

// ---- The body of the orb: a soft ball that floats, weightless. No ground, no fall: a push sends it off, it turns,
// trembles like jelly and slowly drifts home ----

const body = {
  x: new Spring(46, 7), y: new Spring(46, 7),          // away from its place: a long soft string pulls it home
  squash: new Spring(430, 13),                            // + flat, − long; the volume stays the same
  tilt: new Spring(160, 20),                                // along which direction
  spin: [new Spring(34, 7.6), new Spring(34, 7.6)], goal: [0, 0],   // turning; the goal is always a full turn
  air: false, held: null, charge: 0, hits: [], home: [0, 0],
  /// A push at the point (px, py) of the ball (−1...1 from its middle, y down), as a finger in zero gravity does it.
  push(R, px, py, power) {
    const far = Math.hypot(px, py), ux = far > 0.12 ? px / far : 0, uy = far > 0.12 ? py / far : 1;   // in the middle: upwards
    this.x.v -= ux * power * R;
    this.y.v -= uy * power * R * (far > 0.12 ? 0.9 : 1);
    this.tilt.x = this.wrap(Math.atan2(ux, -uy));
    this.tilt.v = 0;
    this.squash.v += 1.1 + power * 0.16;
    // Off the middle it turns, the more the farther out; a quick series of taps adds up.
    if (far > 0.12) { this.roll(-ux, uy, 6); } else { this.roll(0, 1, 6); }
  },
  /// One full turn along one line: (rx, ry) is the way the face moves (x right, y up). The goal is always a whole
  /// number of turns along that line, so the ball ends exactly as it began and never tumbles across.
  roll(rx, ry, speed) {
    const l = Math.hypot(rx, ry) || 1, u = [rx / l, ry / l], now = this.spin[0].x * u[0] + this.spin[1].x * u[1];
    const n = Math.round(now / (2 * Math.PI)) + 1;
    for (let i = 0; i < 2; i++) { this.goal[i] = u[i] * n * 2 * Math.PI; this.spin[i].v += u[i] * speed; }
  },
  wrap(a) { return a > Math.PI / 2 ? a - Math.PI : a < -Math.PI / 2 ? a + Math.PI : a; },   // a squash has no front and back
  step(dt, R) {
    if (this.held) {
      // Pulled: the farther, the heavier (rubber band); it gets long in the direction of the pull.
      // Held: it goes where the finger or the cursor goes, with a little soft lag.
      const [dx, dy] = this.held.pull, far = Math.hypot(dx, dy);
      this.x.k = this.y.k = 420; this.x.d = this.y.d = 34;
      this.x.step(dt, dx + this.home[0]); this.y.step(dt, dy + this.home[1]);
      this.charge = Math.min(1, this.charge + dt * 2.2);
      if (far > 8) { this.tilt.step(dt, this.wrap(Math.atan2(dx, -dy))); this.squash.step(dt, -Math.min(0.085, Math.hypot(this.x.x, this.y.x) / R * 0.07)); }
      else { this.squash.step(dt, 0.025 + 0.035 * this.charge); }
      this.air = false;
    } else {
      this.x.k = this.y.k = 46; this.x.d = this.y.d = 10;
      this.x.step(dt, this.home[0]); this.y.step(dt, this.home[1]);
      const speed = Math.hypot(this.x.v, this.y.v) / R;
      this.squash.step(dt, -clamp(speed * 0.007, 0, 0.04));
      if (speed > 0.9) { this.tilt.step(dt, this.tilt.x + this.wrap(Math.atan2(this.x.v, -this.y.v) - this.tilt.x) * 0.4); }
      this.air = speed > 1.4;
    }
    for (let i = 0; i < 2; i++) { this.spin[i].step(dt, this.goal[i]); }
    // Home again after a turn: count from nought again (the goal is whole turns along one line, so nothing jumps).
    if (Math.hypot(...this.goal) > 0 && Math.hypot(this.spin[0].x - this.goal[0], this.spin[1].x - this.goal[1]) < 0.01 && Math.hypot(this.spin[0].v, this.spin[1].v) < 0.05) {
      for (let i = 0; i < 2; i++) { this.spin[i].x -= this.goal[i]; this.goal[i] = 0; }
    }
  }
};

/// What it does belongs to what its face says. With closed eyes it never looks around and keeps still;
/// open eyes look, and every feeling has its own small movement.
const SHUT = new Set(["sleepy", "yawn", "content", "bliss", "squeeze"]);
const OF_LEVEL = [["smile", "content"], ["curious", "smile", "curious", "smirk"], ["worry", "worry", "grumpy"], ["wow", "scared"]];
const follow = new Spring(60, 15);
let sleeping = false, heroTint = 0, heroRound = 0;
const act = { name: "smile", since: 0, tilt: new Spring(140, 16), lean: new Spring(150, 17), stretch: new Spring(240, 18), shakeX: 0, shakeTurn: 0, wokeAt: -9 };
const watching = () => pointer && now_ - awake < (touch.matches ? 2.4 : 14);

function feeling() {
  if (body.held) { return body.held.far ? "wow" : "squeeze"; }
  if (body.air) { return "air"; }
  // Asleep it stays asleep: only a cursor move or a scroll wakes it (not a nod, a new level or anything else).
  if (sleeping && !touch.matches) { return "sleepy"; }
  if (mood && now_ < moodUntil) { return mood; }
  const l = orbStage() ? stageDay : 0, idle = now_ - awake;   // outside the Kp part: always our happy green day
  if (owner.feel) { return owner.feel[Math.floor(now_ / 3.2) % owner.feel.length]; }
  if (now_ - act.wokeAt < 1.1) { return "curious"; }                 // just woken: "oh, somebody is here"
  // A phone has no cursor: the first orb plays a calm little show by itself (Fable, 11-26), and starts again.
  if (touch.matches && owner.name === "hero") {
    heroTint = idle > 8 && idle < 15.2 ? (1 + heroRound % 3) % 4 : 0;
    if (idle < 8) { return "smile"; }
    if (idle < 15.2) { return "curious"; }
    if (idle > 16 && idle < 19) { return "content"; }
    if (idle > 21 && idle < 21.8) { return "wink"; }
    if (idle > 25 && idle < 27.4) { return "yawn"; }
    if (idle >= 27.4 && idle < 37.4) { return "sleepy"; }
    if (idle >= 37.4) { awake = now_; heroRound++; act.wokeAt = now_; return "curious"; }
    return "smile";
  }
  // Nobody moves for a long while: it yawns and falls asleep, on any day. Only a cursor move or a scroll wakes it.
  if (!orbStage() && !watching()) {
    if (idle > 17) { sleeping = true; return "sleepy"; }
    if (idle > 14.6) { return "yawn"; }
  }
  if (!orbStage() && l === 0) {
    if (watching()) { return "smile"; }
    if (idle > 9.5 && idle < 12) { return "content"; }
    return "smile";
  }
  const list = OF_LEVEL[l], name = list[Math.floor(now_ / 3.6) % list.length];
  return watching() && SHUT.has(name) ? "smile" : name;              // it does not close its eyes while it watches you
}
/// Where it looks: at the pointer; without one (a phone) it looks around by itself, where the page goes, and at taps.
function looking(x, y, dt) {
  scrollLook *= Math.exp(-dt * 3);
  if (watching() && !owner.el.hasAttribute("data-nofollow")) {
    // Close by it still looks clearly that way (the hero orb has little room on its left).
    const dx = pointer[0] - x, dy = pointer[1] - y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, 0.35 + d / 160);
    return [dx / d * k, dy / d * k];
  }
  // Next to a screen it watches the screen, with a short look at us from time to time.
  const at = owner.look && Math.floor(now_ / 1.7) % 4 !== 3 ? owner.look.getBoundingClientRect() : null;
  if (at) {
    const dx = at.left + at.width * (0.5 + 0.22 * Math.sin(now_ * 0.9)) - x, dy = at.top + at.height * (0.4 + 0.2 * Math.sin(now_ * 0.63)) - y, d = Math.hypot(dx, dy) || 1;
    return [dx / d * 0.95, dy / d * 0.95];
  }
  if (owner.look) { return [0, 0.05]; }
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

/// The glow around the orb (dark theme) takes the orb's own colours; written only when they change.
let glowKey = "";
function glowColours(l) {
  const key = rgbOf(l.ballMain) + rgbOf(l.ballMid) + rgbOf(l.ballHigh);
  if (key === glowKey) { return; }
  glowKey = key;
  const st = document.documentElement.style;
  st.setProperty("--g1", rgbOf(l.ballMain)); st.setProperty("--g2", rgbOf(l.ballMid)); st.setProperty("--g3", rgbOf(l.ballLow));
}
/// "Yes, go on!": quick nods while the App Store button is under the cursor (on a phone: when the end comes in).
let nod = 0, nodFrom = -9, storeHover = false;
function nodding() {
  if (storeHover && now_ - nodFrom > 2.4) { nodFrom = now_; }
  const t = now_ - nodFrom;
  nod = t < 1.3 ? 0.22 * Math.sin(2 * Math.PI * 3.2 * t) * Math.exp(-1.1 * t) : 0;
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
    nodding();
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
    if (owner.roam) { x += (Math.sin(now_ * 0.43) * 0.42 + Math.sin(now_ * 1.07 + 2) * 0.1) * R; y += (Math.sin(now_ * 0.61 + 1) * 0.36 + Math.sin(now_ * 0.97) * 0.08) * R; }
    if (up < 0) { y += up * R * 0.07; }
    y -= Math.abs(nod) * R * 0.18;                        // it stretches its neck to look up
    // The slow idle sway is as big as a look, so it fades out while the orb follows the cursor.
    follow.step(dt, watching() && !owner.el.hasAttribute("data-nofollow") ? 1 : 0);
    const sway = 1 - 0.85 * clamp(follow.x, 0, 1), headK = 0.22 + 0.12 * clamp(follow.x, 0, 1);
    turn = [body.spin[0].x + face.head[0].x * headK + act.shakeTurn + 0.25 * Math.sin(now_ * 0.21) * sway, body.spin[1].x - up * (up < 0 ? 0.46 : 0.16) - act.lean.x + 0.18 * Math.sin(now_ * 0.17) * sway - nod];
    tilt = act.tilt.x;
    stretch = act.stretch.x;
  }
  // The clouds inside turn faster at a higher level (as the app's background: quiet slowest, severe fastest), and the
  // speed glides on a switch; the swirl itself never changes (no distortion, Dima 11-26).
  orbSpeed += ((name === "sleepy" ? 0.35 : 0.9) * ORB_PACE[orbStage() ? stageDay : 0] - orbSpeed) * Math.min(1, dt * 2.5);
  orbTime += dt * orbSpeed;
  // The ball is drawn only as big as the place that shows it now (a small O in the bar costs almost nothing).
  const need = Math.max(24, Math.round(owner.el.clientWidth / 0.96 * Math.min(touch.matches ? 1.5 : 2, devicePixelRatio || 1)));
  if (ball && (ball.canvas.width !== need || ball.canvas.height !== need)) { ball.resize(need, need); }
  const heroShow = touch.matches && owner.name === "hero";
  // Outside the Kp part the orb is always our green one, whatever the Sun does now (Dima, 11-26).
  const ol = orbStage() ? stageLook : heroShow ? heroLook : LOOKS[0];
  const lv = orbStage() ? stageDay : 0;
  // A strong drag of the page: a short "wow".
  if (touch.matches && Math.abs(scrollLook) > 0.8 && !(mood && now_ < moodUntil)) { mood = "wow"; moodUntil = now_ + 0.6; }
  glowColours(ol);
  ball?.draw({ time: orbTime, energy: 0.1, roll: turn, cMain: ol.ballMain, cLow: ol.ballLow, cMid: ol.ballMid, cHigh: ol.ballHigh });
  face.step(still.matches ? 1 : dt, name, aim);
  const d = face.path(turn), q = clamp(body.squash.x, -0.1, 0.1), sy = (1 - q) * (1 - stretch), sx = 1 / Math.sqrt(sy), a = body.tilt.x;
  const asleep = landed && !inBar && name === "sleepy" && !still.matches;
  for (const v of views) {
    const mine = v === owner;
    if (v.el.classList.contains("asleep") !== (mine && asleep)) { v.el.classList.toggle("asleep", mine && asleep); }
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
// ---- Four friends in the chat, the four icon colours: one by one they come out from behind the phone, two on each side, and talk ----

const palBall = ball ? shaderCanvas(document.createElement("canvas"), ORB) : null;
palBall?.resize(112, 112);
const pals = [...document.querySelectorAll(".pal")].map((el, i) => {
  el.innerHTML = '<canvas width="112" height="112"></canvas><svg viewBox="-100 -100 200 200" aria-hidden="true"><path d=""/></svg>';
  const c = BALL[[0, 1, 3, 2][i] ?? 0].map(rgb);
  el.style.setProperty("--g", rgbOf(c[1]));
  return { el, ctx: el.querySelector("canvas").getContext("2d"), path: el.querySelector("path"), face: new LivingFace(), c, out: new Spring(9, 5.6), t: 5 * i, talk: 0, at: [0.3, 0.95, 1.6, 2.25][i] ?? 1, k: 0, side: i < 2 ? 1 : -1 };
});
let palsOn = false, palDrawn = 0, palsSince = 0, palPhone = null;
if (pals.length) {
  new IntersectionObserver(([e]) => { if (e.isIntersecting && !palsOn) { palsSince = now_; } palsOn = e.isIntersecting; }, { threshold: 0.4 }).observe($("#chat"));
  // When somebody else writes, one of the friends "says" it: a few quick happy faces and small hops.
  new MutationObserver((list) => {
    for (const m of list) { for (const n of m.addedNodes) { if (n.classList?.contains("bub") && !n.classList.contains("mine") && palsOn) { const on = pals.filter((q) => q.k > 0.9), p = on[Math.floor(Math.random() * on.length)]; if (p) { p.talk = now_ + 1.5; } } } }
  }).observe($(".bubbles"), { childList: true });
}
/// Four characters, by colour (Fable, 11-26): green the calm sleepy host, sky the curious one, pink the dramatic one,
/// orange the little grump. Each has its own cycle of faces (name, seconds), bob, tilt, way of talking and of looking.
const PALS = [
  { cycle: [["smile", 9], ["content", 5], ["smile", 4], ["yawn", 2.4], ["sleepy", 2.6]], bob: [0.8, 3], tilt: 4, talk: ["bliss", "smile", 3], hop: 0, nod: 4, other: "smile" },
  { cycle: [["curious", 5], ["smile", 5], ["wink", 1], ["curious", 3], ["smirk", 3]], bob: [1.3, 3], tilt: 6, talk: ["joy", "smile", 5], hop: 5, other: "curious" },
  { cycle: [["smile", 6], ["wow", 3], ["smile", 5], ["worry", 3.5], ["scared", 1.5]], bob: [1.0, 4], tilt: 0, talk: ["wow", "joy", 4], hop: 7, other: "wow" },
  { cycle: [["grumpy", 8], ["smirk", 4], ["grumpy", 6], ["worry", 3], ["smirk", 3], ["smile", 5]], bob: [0.6, 2], tilt: -5, talk: ["smirk", "smile", 3], hop: 0, shake: 2, other: "smirk" }
];
function palFace(c, t) {
  const all = c.cycle.reduce((n, [, s]) => n + s, 0);
  let k = t % all;
  for (const [name, s] of c.cycle) { if (k < s) { return name; } k -= s; }
  return c.cycle[0][0];
}
function stepPals(dt) {
  if (!pals.length || still.matches) { return; }
  let any = false;
  for (const [i, p] of pals.entries()) {
    const c = PALS[i] ?? PALS[0];
    // One by one: each first slides out from behind the phone and past its edge (behind it), then, once clear of
    // the phone, comes to the front and swings back to its place on a curve. The next starts as this one lands.
    // World: all four; Near me: only the first two stay, the other two fly back behind the phone (and out again).
    const wanted = palsOn && now_ - palsSince - p.at > 0 && (typeof room === "undefined" || room === 1 || i < 2);
    p.k = clamp((p.k ?? 0) + (wanted ? dt / 1.3 : -dt / 1.0), 0, 1);
    if (p.k <= 0) { if (p.el.style.visibility !== "hidden") { p.el.style.visibility = "hidden"; } continue; }
    any = true;
    p.el.style.visibility = "visible";
    p.t += dt; p.ct = (p.ct ?? 20 + i * 7) + dt * 0.72 * ORB_PACE[[0, 1, 3, 2][i] ?? 0];
    const talking = now_ < p.talk, other = pals.find((q) => q !== p && now_ < q.talk);
    // All of them look at the chat: one focal point, the middle of the phone's screen (who is low looks up, who is
    // high looks down). Their places are measured twice a second, not every frame (cheap).
    if (!p.r || now_ - (p.rAt ?? -9) > 0.5) { p.r = p.el.getBoundingClientRect(); p.rAt = now_; palPhone = $("#chat .phone").getBoundingClientRect(); }
    const fx = palPhone.left + palPhone.width / 2 - p.r.left - p.r.width / 2, fy = palPhone.top + palPhone.height * 0.55 - p.r.top - p.r.height / 2, fd = Math.hypot(fx, fy) || 1;
    const aim = [fx / fd, fy / fd];
    const face_ = talking ? (Math.floor(now_ * c.talk[2]) % 2 ? c.talk[0] : c.talk[1]) : palFace(c, p.t);
    p.face.step(dt, face_, aim);
    const nod = talking && c.nod ? Math.sin(Math.min(1, (p.talk - now_) / 1.5) * Math.PI) * 0.25 : 0;
    // The whole face turns to the chat (not only the eyes), with a small calm sway.
    p.look = p.look ?? aim.slice(); for (let k = 0; k < 2; k++) { p.look[k] += (aim[k] - p.look[k]) * Math.min(1, dt * 3); }
    p.path.setAttribute("d", p.face.path([0.55 * p.look[0] + 0.05 * Math.sin(p.t * 0.7), -0.42 * p.look[1] + 0.04 * Math.sin(p.t * 0.53) - nod]));
    const k = p.k, eo = (v) => 1 - (1 - v) ** 3, eio = (v) => v < 0.5 ? 4 * v * v * v : 1 - (-2 * v + 2) ** 3 / 2;
    const e1 = eio(Math.min(1, k / 0.45)), e2 = k < 0.45 ? 0 : eio((k - 0.45) / 0.55);
    const x = p.side * (95 - 175 * e1 + 80 * e2), lift = -Math.sin(Math.PI * Math.min(1, k * 1.1)) * 26;
    const hop = talking && c.hop ? -Math.abs(Math.sin(now_ * 11)) * c.hop : 0, shake = talking && c.shake ? Math.sin(now_ * 30) * c.shake : 0;
    const tilt = c.tilt;
    p.el.style.transform = `translate(calc(${x.toFixed(1)}% + ${shake.toFixed(1)}px), ${(Math.sin(p.t * c.bob[0]) * c.bob[1] + hop + nod * 16 + lift).toFixed(1)}px) rotate(${tilt}deg) scale(${(0.75 + 0.25 * e1).toFixed(3)})`;
    const front = k > 0.45 ? "2" : "0";                       // behind the phone until it is out past the edge
    if (p.el.style.zIndex !== front) { p.el.style.zIndex = front; }
  }
  // Their clouds turn slowly: drawn ten times a second, small.
  palDrawn += dt;
  if (any && palBall && palDrawn > 0.1) {
    palDrawn = 0;
    for (const p of pals) {
      if (!(p.k > 0) || p.ct === undefined) { continue; }   // a hidden friend is not drawn (and never breaks the frame)
      palBall.draw({ time: p.ct, energy: 0.1, roll: [0.3 * Math.sin(p.t * 0.31), 0.2 * Math.sin(p.t * 0.23)], cMain: p.c[1], cLow: p.c[3], cMid: p.c[2], cHigh: p.c[0] });
      p.ctx.clearRect(0, 0, 112, 112); p.ctx.drawImage(palBall.canvas, 0, 0, 112, 112);
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
const cloudValues = (look, time, lift, zoom = ZOOM) => ({ time, energy: look.energy, zoom, lift, dark: darkMode.matches ? 1 : 0, cMain: look.main, cLow: look.low, cMid: look.mid, cHigh: look.high,
                                deep: look.deep, dmid: look.dmid, glow: look.glow, skyShift: look.skyShift });
/// The clouds on the screens of the devices. Only the first screen and the Kp part move; every other screen is one
/// still frame, drawn again only when the level or the theme changes (cheap, and Safari keeps its frame rate).
function drawScreens() {
  if (!inside) { return; }
  const theme = darkMode.matches ? 1 : 0;
  for (const c of screens) {
    if (!onScreen.has(c)) { continue; }
    const kind = c.dataset.bg, stage_ = !!c.closest("#status"), moving = stage_ || !!c.closest("#hero");
    if (!moving) {
      const key = kind + theme;
      if (c.dataset.key === key) { continue; }
      c.dataset.key = key;
    }
    inside.resize(c.width, c.height);
    if (kind === "chat") { inside.draw(cloudValues(LOOKS[0], 34, CHAT_LIFT)); }       // the chat: calm green, the clouds up at the bar (as in the app)
    // Calm clouds at every level: only the colours change, never the speed or the swirl (a phone stays cool, Dima 11-26).
    else if (moving) { inside.draw({ ...cloudValues(stage_ ? stageLook : LOOKS[0], stage_ ? stageTime : cloudTime, kind === "wide" ? 0.34 : LIFT, kind === "wide" ? 2.6 : ZOOM), energy: 0 }); }
    else { inside.draw(cloudValues(LOOKS[0], 20, kind === "wide" ? 0.34 : LIFT, kind === "wide" ? 2.6 : ZOOM)); }
    c.getContext("2d").drawImage(inside.canvas, 0, 0);
  }
}

let last = performance.now() / 1000, sinceScreens = 1;
function frame(ms) {
  requestAnimationFrame(frame);
  // Another window is in front: draw less, the computer needs its power elsewhere.
  // A phone draws at most 30 frames a second (it stays cool); another window in front: draw less still.
  if (ms / 1000 - last < (touch.matches ? 0.03 : document.hasFocus() ? 0.012 : 0.06)) { return; }
  const now = ms / 1000, real = clamp(now - last, 0, 0.25), dt = Math.min(real, 0.05);
  last = now;
  now_ += real;
  if (still.matches) {
    // Nothing moves by itself: draw only when something has changed.
    if (!dirty) { return; }
    dirty = false;
    liveLook = copy(LOOKS[liveLevel]); stageLook = copy(LOOKS[inStage ? stageDay : liveLevel]);
    drawScreens(); stepCharts(1, day().curve, true); drawOrb(0);
    return;
  }
  glide(real);
  cloudTime += dt * SPEED[0];
  stageTime += dt * stageLook.speed;
  sinceScreens += real;
  if (sinceScreens >= 1 / 31) { sinceScreens = 0; drawScreens(); }
  stepCharts(real, day().curve);
  drawOrb(landed ? dt : Math.min(real, 0.1));
  stepPals(dt);
}

function aimAt(e) { pointer = [e.clientX, e.clientY]; awake = now_; sleeping = false; }
addEventListener("resize", measure);
addEventListener("load", measure);
// A scroll wakes it, and it keeps looking at the cursor (the cursor stays where it was on the window).
addEventListener("scroll", () => { dirty = true; sleeping = false; awake = touch.matches ? Math.max(awake, now_ - 1.6) : now_; }, { passive: true });
// A finger: it looks where the finger touches and follows it while the page is dragged (touchmove goes on while
// the page scrolls; pointer events stop there).
addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  if (!t) { return; }
  pointer = [t.clientX, t.clientY]; awake = now_;
  // A tap close to it: a happy face; elsewhere it only looks there, curious.
  const r = owner.el.getBoundingClientRect(), R = r.width / 2, d = Math.hypot(t.clientX - r.left - R, t.clientY - r.top - R);
  if (owner.name !== "bar") { mood = d < R * 1.5 ? "joy" : "curious"; moodUntil = now_ + (d < R * 1.5 ? 0.8 : 0.5); }
}, { passive: true });
addEventListener("touchmove", (e) => { const t = e.touches[0]; if (t) { pointer = [t.clientX, t.clientY]; awake = now_; } }, { passive: true });
darkMode.addEventListener("change", () => { dirty = true; paintAuras(); units.forEach((u) => showWidgets(DAYS[u.day % 4], u.el)); });
addEventListener("pointermove", aimAt, { passive: true });
addEventListener("pointerdown", aimAt, { passive: true });
document.addEventListener("pointerleave", () => { pointer = null; });

// Press, pull and let go.
for (const v of views) {
  if (v.name === "bar") { v.button.addEventListener("click", () => scrollTo({ top: 0, behavior: still.matches ? "auto" : "smooth" })); continue; }
  v.button.addEventListener("pointerdown", (e) => {
    if (!landed || v !== owner || still.matches) { return; }
    if (e.pointerType === "touch" && v.name === "widgets") { return; }      // in the sideways row a finger moves the row, not the orb
    e.preventDefault();
    body.held = { id: e.pointerId, view: v, from: [e.clientX - body.x.x + body.home[0], e.clientY - body.y.x + body.home[1]], pull: [body.x.x - body.home[0], body.y.x - body.home[1]], far: false };
    try { v.button.setPointerCapture(e.pointerId); } catch {}
    v.el.style.zIndex = 9;
    body.air = false;
    body.charge = 0;
  });
  v.button.addEventListener("dragstart", (e) => e.preventDefault());
  v.button.addEventListener("contextmenu", (e) => { if (touch.matches) { e.preventDefault(); } });
  v.button.addEventListener("click", (e) => { if (e.detail === 0 && landed && !still.matches) { body.push(v.el.clientWidth / 2, 0.4, 0.5, 5.4); mood = "joy"; moodUntil = now_ + 2.4; } });   // keyboard
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
document.documentElement.addEventListener("pointerleave", () => { if (body.held) { release(body.held.view); } });
function release(v) {
  const held = body.held;
  if (!held) { return; }
  body.held = null;
  const r = v.button.getBoundingClientRect(), R = v.el.clientWidth / 2;
  v.el.style.zIndex = "";
  if (held.far) {
    // Let go: it floats home softly and rolls once. With ?place it stays where it was put, for choosing places.
    if (placing) { body.home = [body.x.x, body.y.x]; placed[v.name] = body.home; showPlace(v); }
    body.squash.v += 0.7;
    // It rolls only along the line it flies home on (from where it was let go back to its place).
    if (Math.hypot(body.x.x, body.y.x) > R * 0.6) { body.roll(-body.x.x, body.y.x, 4); }
    mood = "bliss"; moodUntil = now_ + 1.6;
    return;
  }
  body.hits = [...body.hits.filter((t) => now_ - t < 3), now_];
  body.push(R, clamp((held.from[0] - r.left - r.width / 2) / R, -1, 1), clamp((held.from[1] - r.top - r.height / 2) / R, -1, 1), 5.2 + 3 * body.charge);
  mood = body.hits.length > 4 ? "grumpy" : ["bliss", "wink", "joy", "content"][Math.floor(Math.random() * 4)];
  moodUntil = now_ + 2;
}
for (const b of document.querySelectorAll(".store")) {
  b.addEventListener("pointerenter", (e) => { if (e.pointerType === "touch") { return; } storeHover = true; nodFrom = now_ - 9; mood = "joy"; moodUntil = now_ + 60; });
  b.addEventListener("pointerleave", () => { storeHover = false; mood = "curious"; moodUntil = now_ + 1.2; });
}
// On a phone there is no hover: it nods when the end comes in, and again now and then.
let endIn = false;
new IntersectionObserver(([e]) => { endIn = e.isIntersecting; if (endIn && touch.matches) { nodFrom = now_ + 0.6; mood = "joy"; moodUntil = now_ + 1.8; } }, { threshold: 0.6 }).observe($("#end"));
setInterval(() => { if (endIn && touch.matches && !document.hidden) { nodFrom = now_; mood = "joy"; moodUntil = now_ + 1.8; } }, 6000);

// ---- Status: right now, then four example days; they change by themselves ----

let stageDay = 0;                                 // the example day: quiet, active, storm, severe
let inStage = false, handsUntil = 0;
let liveDay = null;                               // filled by NOAA
const day = () => inStage ? DAYS[stageDay] : DAYS[0];   // outside the Kp part: our quiet green day (Dima, 11-26)
const buttons = [...document.querySelectorAll("#status .segments button")];
const MEANS = ["The Sun is calm. Nothing is on its way.", "Aurora is possible near the poles.", "GPS and radio may be less accurate.", "GPS and radio can fail for a while."];
/// The soft light under the phone of the Kp part: three colours of each level (the app's cloud colours).
const auras = [...document.querySelectorAll(".aura i")];
function paintAuras() {
  const dark = darkMode.matches;
  auras.forEach((a, i) => {
    const L = LOOKS[i], set = dark ? [L.dmid, L.glow, rgb(DARK_SKY[i])] : [L.main, L.mid, L.low];
    set.forEach((c, k) => a.style.setProperty("--c" + (k + 1), rgbOf(c)));
  });
}
paintAuras();
function showStage() {
  stageLevel = inStage ? stageDay : null;
  showScreens(day());
  dirty = true;
  const d = DAYS[stageDay];
  put($("#kp"), d.kp);
  put($("#state"), d.state.replace(/ now$/, ""));
  put($("#means"), MEANS[stageDay]);
  buttons.forEach((b, i) => b.setAttribute("aria-pressed", i === stageDay));
  auras.forEach((a, i) => a.classList.toggle("on", i === (inStage ? stageDay : liveLevel)));
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
  stageLook = copy(LOOKS[liveLevel]);
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
buttons.forEach((b, i) => b.addEventListener("click", () => { stageDay = i; inStage = true; handsUntil = now_ + 20; showStage(); }));

// ---- The wordmark in the bar: every letter is black or white, by what lies under it ----

const letters = [...document.querySelectorAll("#bar .word > span")];
let toneAt = 0, toneY = -1;
function tones() {
  if (now_ < toneAt || !bar.classList.contains("shown") || (scrollY === toneY && now_ - toneAt < 1.5)) { return; }
  toneY = scrollY;
  toneAt = now_ + 0.08;
  for (const l of letters) {
    const r = l.getBoundingClientRect(), under = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).find((e) => !bar.contains(e));
    const tone = under?.closest("[data-tone]")?.dataset.tone ?? (darkMode.matches ? "dark" : "light");
    if (l.dataset.on !== tone) { l.dataset.on = tone; }
  }
}

// ---- Loops and soft entrances ----

let noted = 2;
// Every widget and the watch keep their own day and change on their own clock, never two at once.
const units = [...document.querySelectorAll("#widgets [data-widget], #widgets .wt")].map((el, i) => ({ el, day: i, every: [6.7, 5.3, 4.1, 4.7][i] ?? 5, next: 1.5 + i * 1.3 }));
units.forEach((u) => showWidgets(DAYS[u.day % 4], u.el));
let lastWidget = 0;
note(0); note(1);
const loops = new Map([["#widgets", false], ["#alerts", false], ["#chat", false], ["#today", false]]);
const loopWatch = new IntersectionObserver((list) => { for (const e of list) { loops.set("#" + e.target.id, e.isIntersecting); } });
for (const id of loops.keys()) { loopWatch.observe($(id)); }
const every = (ms, id, run) => setInterval(() => { if (!document.hidden && !still.matches && id.some((i) => loops.get(i))) { run(); } }, ms);
every(200, ["#widgets"], () => {
  const u = units.filter((u) => now_ >= u.next).sort((a, b) => a.next - b.next)[0];
  if (!u || now_ - lastWidget < 0.9) { return; }
  u.day++; u.next = now_ + u.every; lastWidget = now_;
  showWidgets(DAYS[u.day % 4], u.el);
});
every(3300, ["#alerts"], () => note(noted++));
every(2600, ["#today"], () => stepToday());
talkLoop(() => loops.get("#chat") && !document.hidden);
const rooms = [...document.querySelectorAll("#chat .segments button")];
rooms.forEach((b, i) => b.addEventListener("click", () => openRoom(i)));
openRoom(1);

// Parts off screen stop their small CSS loops (pins, rain, rings, the caret).
const asleep = new IntersectionObserver((list) => { for (const e of list) { e.target.classList.toggle("off", !e.isIntersecting); } });
document.querySelectorAll(".part").forEach((p) => asleep.observe(p));
function show(el) { el.classList.add("seen"); if (el.dataset.write) { setTimeout(() => el.classList.add("done"), 2600); } }
const appear = new IntersectionObserver((list) => {
  for (const e of list) { if (e.isIntersecting) { show(e.target); appear.unobserve(e.target); } }
}, { rootMargin: "0px 0px -10% 0px" });
// Words: every heading and paragraph is cut into letters or words; they come out of a blur one after another.
for (const el of document.querySelectorAll("[data-write]")) {
  const text = el.textContent.trim(), byLetter = el.dataset.write === "char";
  let n = 0;
  el.setAttribute("aria-label", text);
  if (el.tagName === "P") { el.setAttribute("role", "text"); }
  el.innerHTML = text.split(/\s+/).map((w) => `<span class="nb" aria-hidden="true">${byLetter ? [...w].map((c) => `<span class="u" style="--n:${n++}">${c}</span>`).join("") : `<span class="u" style="--n:${n++}">${w}</span>`}</span>`).join(" ");
  if (!el.closest("#hero")) { appear.observe(el); }
}
document.querySelectorAll(".soft").forEach((e) => appear.observe(e));
// The devices: the whole group is watched (each one starts off screen at the side), then they come in one by one.
document.querySelectorAll(".soft-set").forEach((e) => appear.observe(e));

// ---- The Sun, the solar wind and the aurora: live from NASA and NOAA, as in the app. They move only on screen ----

// Always the same Sun everywhere: SDO's visible-light picture (the orange one, the second page of the app's gallery),
// of this hour; the baked picture stays if NASA does not answer. One small picture, no film.
const im_ = new Image(); im_.referrerPolicy = "no-referrer";
im_.onload = () => document.querySelectorAll(".sunhmi").forEach((e) => { e.src = im_.src; });
im_.src = "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_HMIIC.jpg";
function sunNow() {}

/// NOAA's picture series: the aurora of the last 24 hours, the solar wind model (WSA-Enlil, the disc seen from above,
/// cut as in the app). A few pictures, one melting into the next.
const FILMS = [
  { canvas: $("#aurorafilm"), list: "products/animations/ovation_north_24h.json", count: touch.matches ? 8 : 20 },
  { canvas: $("#windfilm"), list: "products/animations/enlil.json", count: touch.matches ? 6 : 20, crop: [70, 52, 264, 264], circle: 0.468, key: true }
].map((f) => ({ ...f, on: false, asked: false, shots: null, drawn: -1 }));
async function askFilm(f) {
  if (f.asked || navigator.connection?.saveData) { return; }
  f.asked = true;
  const list = await load(f.list);
  if (!Array.isArray(list) || list.length < f.count) { return; }
  const step = (list.length - 1) / (f.count - 1);
  const shots = await Promise.all(Array.from({ length: f.count }, (_, i) => new Promise((done) => {
    const im = new Image();
    im.referrerPolicy = "no-referrer";
    if (f.key) { im.crossOrigin = "anonymous"; }
    im.onload = () => done(f.key ? keyed(f, im) : im);
    im.onerror = () => done(null);
    im.src = SWPC.slice(0, -1) + list[Math.round(i * step)].url;
  })));
  f.shots = shots.filter(Boolean);
}
for (const f of FILMS) { new IntersectionObserver(([e]) => { f.on = e.isIntersecting; if (f.on) { askFilm(f); } }, { rootMargin: "200px" }).observe(f.canvas); }
/// The app's black key (idea 148): alpha = the brightest of R, G, B; black lets the card through, colours stay.
function keyed(f, im) {
  try {
    const side = f.canvas.width, k = document.createElement("canvas");
    k.width = k.height = side;
    const c = k.getContext("2d", { willReadFrequently: true });
    paintShot({ ...f, canvas: k }, im, 1);
    const d = c.getImageData(0, 0, side, side), px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      const m = Math.max(px[i], px[i + 1], px[i + 2]);
      if (m === 0) { px[i + 3] = 0; continue; }
      const a = m / 255 * px[i + 3] / 255;
      px[i] = px[i] / (m / 255); px[i + 1] = px[i + 1] / (m / 255); px[i + 2] = px[i + 2] / (m / 255); px[i + 3] = a * 255;
    }
    c.putImageData(d, 0, 0);
    k.keyed = true;
    return k;
  } catch { return im; }
}
function paintShot(f, im, alpha) {
  const c = f.canvas.getContext("2d"), side = f.canvas.width;
  c.save();
  c.globalAlpha = alpha;
  if (f.circle) { c.beginPath(); c.arc(side / 2, side / 2, side * f.circle, 0, Math.PI * 2); c.clip(); }
  if (im.keyed) { c.drawImage(im, 0, 0); } else if (f.crop) { c.drawImage(im, ...f.crop, 0, 0, side, side); } else { c.drawImage(im, 0, 0, side, side); }
  c.restore();
}
setInterval(() => {
  if (document.hidden || still.matches) { return; }
  for (const f of FILMS) {
    if (!f.on || !f.shots || f.shots.length < Math.min(6, f.count)) { continue; }
    const n = f.shots.length, hold = 5, t = (now_ * 3.2) % (n + hold), i = Math.min(n - 1, Math.floor(t)), k = i < n - 1 ? t - i : 0;
    if (t === f.drawn) { continue; }
    f.drawn = t;
    if (f.circle) { f.canvas.getContext("2d").clearRect(0, 0, f.canvas.width, f.canvas.width); }
    paintShot(f, f.shots[i], 1);
    if (k) { paintShot(f, f.shots[i + 1], k); }
    f.canvas.style.opacity = 1;
  }
}, 66);

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
  sunNow();
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
// The words of the first screen do not wait for the orb.
setTimeout(() => { document.documentElement.classList.add("go"); document.querySelectorAll("#hero [data-write]").forEach(show); }, 60);
measure();
showStage();
requestAnimationFrame(frame);
live();
// A slow device must not hold the words back.
setTimeout(arrived, 4000);
setInterval(() => { if (!document.hidden) { live(); } }, 5 * 60e3);


// ---- The Aurora card: a soft drawn aurora over the whole card, melting into it like the maps (Dima, 11-26).
// Plain 2D canvas, no library: three curtains of thin rays (one small gradient picture each, stretched), green into
// blue, drifting slowly; deeper colours on a light card, brighter ones on a dark card. ----
(() => {
  const c = document.querySelector("#auroraart");
  if (!c) { return; }
  const ctx = c.getContext("2d");
  const ray = (rgb) => {
    const s = document.createElement("canvas"); s.width = 1; s.height = 128;
    const x = s.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.55, `rgba(${rgb},.3)`); g.addColorStop(0.85, `rgba(${rgb},.9)`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 1, 128); return s;
  };
  const SETS = {
    light: [["20,180,110", 1], ["20,130,220", 0.75], ["70,190,80", 0.65]],
    dark: [["90,255,170", 0.85], ["50,200,255", 0.6], ["150,255,140", 0.5]]
  };
  const shape = [{ base: 0.62, amp: 0.10, k: 1.1, sp: 0.04, len: 0.55 }, { base: 0.48, amp: 0.08, k: 1.9, sp: -0.03, len: 0.4 }, { base: 0.72, amp: 0.07, k: 0.8, sp: 0.025, len: 0.45 }];
  const imgs = { light: SETS.light.map(([rgb]) => ray(rgb)), dark: SETS.dark.map(([rgb]) => ray(rgb)) };
  let on = false, last = 0;
  const fit = () => { const r = c.getBoundingClientRect(), k = Math.min(1.5, devicePixelRatio || 1); c.width = Math.max(40, Math.round(r.width * k)); c.height = Math.max(40, Math.round(r.height * k)); };
  new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) { fit(); requestAnimationFrame(draw); } }).observe(c);
  addEventListener("resize", () => { if (on) { fit(); } });
  document.addEventListener("visibilitychange", () => { if (on && !document.hidden) { requestAnimationFrame(draw); } });
  function draw(ms) {
    if (!on || document.hidden) { return; }
    requestAnimationFrame(draw);
    if (ms - last < 40) { return; }
    last = ms;
    const t = ms / 1000, W = c.width, H = c.height, theme = darkMode.matches ? "dark" : "light", set = SETS[theme];
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = theme === "dark" ? "lighter" : "source-over";
    shape.forEach((b, i) => {
      const step = Math.max(2, W / 160);
      for (let x = 0; x < W; x += step) {
        const u = x / W;
        const y = H * (b.base + b.amp * Math.sin(u * b.k * 6.283 + t * b.sp * 6.283) + 0.03 * Math.sin(u * 9 + t * 0.5));
        const len = H * b.len * (0.8 + 0.2 * Math.sin(u * 6 + t * 0.35));
        ctx.globalAlpha = set[i][1] * (0.5 + 0.5 * Math.abs(Math.sin(u * 23 + t * 0.7) * Math.sin(u * 9 - t * 0.4)));
        ctx.drawImage(imgs[theme][i], x, y - len, step * 1.15, len * 1.1);
      }
    });
    ctx.globalAlpha = 1;
  }
})();
