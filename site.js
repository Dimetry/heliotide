"use strict";
// ---- Colours of the app, per level: quiet, active, storm, severe ----

const LIGHT = [["#F4FAE2", "#DFEED4", "#9DDD8B", "#CDE8B5"], ["#EEF7F2", "#93E3FD", "#00E7E7", "#C1E3EA"],
               ["#FFF2D6", "#F7C43A", "#F7A945", "#F6DADA"], ["#FFE0EF", "#FF96FE", "#8B85F4", "#F0F1F6"]];   // high, main, mid, low
const DARK = [["#0C150B", "#0C4E0F", "#71A54A"], ["#00323A", "#1C8687", "#4BC6FF"],
              ["#340C04", "#901414", "#B8420E"], ["#341C3C", "#AB296E", "#FF42A9"]];                           // deep, mid, glow
const DARK_SKY = ["#295B29", "#366980", "#8E260D", "#5F0076"];
const SPEED = [0.49, 0.84, 1.64, 2.14], ENERGY = [0, 0.07, 0.36, 0.52];
const BALL = [["#F4FAE2", "#B5E06A", "#D9E36A", "#8FCB52"], ["#E6F2FF", "#B3D9FF", "#80B3FF", "#6699E6"],
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

// ---- The orb's way in: thrown from below, hops, then the face comes round (the app's start) ----

const HOPS = [[0.36, 1], [0.23, 0.7], [0.15, 0.5], [0.09, 0.4]], LEAD = 0.25, TURN = 0.62;
const LANDED = LEAD + HOPS.reduce((s, h) => s + h[0], 0);
const arrive = (u, over) => { const x = clamp(u, 0, 1) - 1; return 1 + (over + 1) * x * x * x + over * x * x; };
function entrance(t, w, h, big) {
  const small = big * 0.62, start = [0.2 * Math.min(w, h), h * 0.62 + big], whole = HOPS.reduce((s, x) => s + x[0] * x[1], 0);
  const g = 12000 * clamp(h / 874, 0.5, 1.2);
  let way = 0, lift = 0, s = t - LEAD;
  for (const [time, speed] of HOPS) {
    if (s <= 0) { break; }
    const x = Math.min(s, time);
    way += x * speed / whole;
    lift = g / 2 * x * (time - x);
    s -= time;
  }
  const left = 1 - Math.min(1, way), px = start[0] * left, py = start[1] * left, after = t - LANDED;
  return { x: px, y: py - lift, scale: mix(small, big, after > 0 ? arrive(after / 0.42, 1.1) : 0) / big,
           turn: [px / small * 0.4 + 3.6 * (1 - (after > 0 ? arrive(after / TURN, 0.6) : 0)), -py / small * 0.4], shown: t > LEAD, over: after > TURN };
}

// ---- Scene ----

const field = shaderCanvas($("#clouds"), FIELD), ball = shaderCanvas($("#orb canvas"), ORB);
const inside = shaderCanvas(document.createElement("canvas"), FIELD);   // the clouds on the screens of the devices
if (!field) { $("#clouds").remove(); }
if (!ball) { document.documentElement.classList.add("no-orb"); }
const orb = $("#orb"), facePath = $("#orb path"), bar = $("#bar"), stage = $("#status");
const slots = { hero: $("#hero .slot"), stage: $("#status .slot"), end: $("#end .slot"), bar: $("#bar .o") };
const face = new LivingFace();
const screens = [...document.querySelectorAll("canvas[data-bg]")];
const onScreen = new Set();
const seen = new IntersectionObserver((list) => { for (const e of list) { e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target); } }, { rootMargin: "80px" });
screens.forEach((c) => seen.observe(c));

let W = 0, H = 0, big = 100;
function measure() {
  W = document.documentElement.clientWidth; H = innerHeight;
  big = Math.max(slots.hero.clientWidth, slots.stage.clientWidth, slots.end.clientWidth) / 2;
  const dpr = Math.min(2, devicePixelRatio || 1);
  field?.resize(W / 3, H / 3);
  ball?.resize(big / 0.48 * dpr, big / 0.48 * dpr);
  orb.style.width = orb.style.height = big / 0.48 + "px";
  for (const c of screens) { c.width = c.dataset.bg === "tall" ? 132 : 240; c.height = c.dataset.bg === "tall" ? 286 : 168; }
  dirty = true;
}

let cloudTime = 20, orbTime = 20, orbEnergy = 0, filmTime = 0, dirty = true, landed = still.matches;
let rolled = 0, lastY = null, hop = null;
let pointer = null, awake = 0, mood = null, moodUntil = 0, now_ = 0;

/// Where the page wants the orb: centre, radius, and how far it is in the bar (0...1).
function place() {
  const c = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2, top: r.top, bottom: r.bottom }; };
  const b = c(slots.bar), h = c(slots.hero);
  let at = { x: b.x, y: b.y, radius: b.r, inBar: 1, rest: 1 };
  const to = (p, k) => { at = { x: mix(at.x, p.x, k), y: mix(at.y, p.y, k), radius: mix(at.radius, p.r, k), inBar: mix(at.inBar, 0, k), rest: 1 }; };
  to(h, 1 - ease((H * 0.02 + scrollY) / Math.max(120, h.top + scrollY + h.r * 2 - 70)));
  const s = stage.getBoundingClientRect();
  to(c(slots.stage), ease((H * 0.8 - s.top) / (H * 0.55)) * ease((s.bottom - H * 0.5) / (H * 0.4)));
  // The last place: it goes into the bar's O and comes out below, it never flies over the content.
  const e = c(slots.end), k = ease((H * 0.86 - e.top) / (H * 0.3));
  at.rest = 1 - k;
  if (k > 0) { at = k < 0.5 ? { ...at, radius: at.radius * (1 - 2 * k) } : { x: e.x, y: e.y, radius: e.r * (2 * k - 1), inBar: 0, rest: 1 - k }; }
  return at;
}

/// Which face: a tap or a hover first, then the level of the day, asleep when nobody is there.
function feeling() {
  if (mood && now_ < moodUntil) { return mood; }
  const l = level();
  if (stageDay === null && l === 0 && now_ - awake > 9) { return "sleepy"; }
  return ["smile", "curious", "worry", "wow"][l];
}

function drawOrb(dt) {
  const p = place();
  let turn = [0, 0], scale = p.radius / big, x = p.x, y = p.y;
  let aim = [0, 0];
  if (pointer && now_ - awake < 9) {
    const dx = pointer[0] - x, dy = pointer[1] - y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260);
    aim = [dx / d * k, dy / d * k];
  }
  if (!landed) {
    filmTime += dt;
    const f = entrance(filmTime, W, H, big);
    x += f.x; y += f.y; scale *= f.scale; turn = f.turn;
    orb.style.opacity = f.shown ? 1 : 0;
    if (f.over || scrollY > H * 0.3) { arrived(); }
  } else if (!still.matches) {
    if (lastY !== null && Math.abs(y - lastY) < 160) { rolled = clamp(rolled + (y - lastY) / Math.max(40, p.radius) * 0.5, -1.3, 1.3); }
    lastY = y;
    rolled *= Math.exp(-dt * 3.4);                 // it always comes back to show its face
    turn = [face.gaze[0] * 0.2, -face.gaze[1] * 0.14 - rolled];
    if (hop !== null) {
      hop += dt;
      const u = hop / 0.62;
      if (u >= 1) { hop = null; }
      else { y -= Math.sin(Math.PI * u) * p.radius * 0.7; turn[0] += Math.sin(2 * Math.PI * u) * 0.7 * (1 - u); }
    }
  }
  const half = big / 0.48 / 2;
  orb.style.transform = `translate3d(${(x - half).toFixed(2)}px, ${(y - half).toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
  orb.setAttribute("aria-label", p.inBar > 0.5 ? "Back to the top" : "Heliotide");
  bar.style.setProperty("--in", ease((p.inBar - 0.5) / 0.5).toFixed(3));
  bar.style.setProperty("--rest", p.rest.toFixed(3));
  bar.style.setProperty("--glass", ease((scrollY - 40) / 160).toFixed(3));
  const target = [0.1, 0.25, 0.5, 0.75][level()] + (mood && now_ < moodUntil ? 0.35 : 0);
  orbEnergy += (target - orbEnergy) * (1 - Math.exp(-dt / (target > orbEnergy ? 0.25 : 1)));
  orbTime += dt * (0.55 + orbEnergy * 1.1);
  ball?.draw({ time: orbTime, energy: orbEnergy, roll: turn, cMain: look.ballMain, cLow: look.ballLow, cMid: look.ballMid, cHigh: look.ballHigh });
  face.step(still.matches ? 1 : dt, landed ? feeling() : "sleepy", aim);
  facePath.setAttribute("d", face.path(turn));
}
function arrived() {
  if (document.documentElement.classList.contains("landed")) { return; }
  landed = true;
  orb.style.opacity = 1;
  document.documentElement.classList.add("landed");
  setTimeout(() => { awake = Math.max(awake, now_); }, 900);
}

/// The clouds stand lower on the first screen and rise to the bar behind the rest, as in the app.
const cloudValues = (lift) => ({ time: cloudTime, energy: look.energy, zoom: ZOOM, lift, dark: darkMode.matches ? 1 : 0, cMain: look.main, cLow: look.low, cMid: look.mid, cHigh: look.high,
                                deep: look.deep, dmid: look.dmid, glow: look.glow, skyShift: look.skyShift });
function drawClouds() {
  if (!field) { return; }
  const y = 0.5 + (60 / H - 0.5) / 1.03, top = 1 - y - (0.33 + 0.16 * look.energy + (ZOOM - 1) * 0.5) / ZOOM;
  const s = stage.getBoundingClientRect(), colour = ease((s.bottom - H * 0.25) / (H * 0.6));
  // The first screens are in the colour of the day; behind the rest the page is plain white or black.
  document.documentElement.style.setProperty("--colour", colour.toFixed(3));
  if (colour <= 0) { return; }
  field.draw(cloudValues(mix(LIFT, Math.max(top, LIFT), ease((H * 0.2 - s.bottom + H * 0.8) / (H * 0.6)))));
}
/// The same clouds on the devices that are on screen: drawn once per shape, copied to every device.
function drawScreens() {
  if (!inside) { return; }
  for (const kind of ["tall", "wide"]) {
    const list = screens.filter((c) => c.dataset.bg === kind && onScreen.has(c));
    if (!list.length) { continue; }
    inside.resize(list[0].width, list[0].height);
    inside.draw(cloudValues(LIFT));
    for (const c of list) { c.getContext("2d").drawImage(inside.canvas, 0, 0); }
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
addEventListener("scroll", () => { dirty = true; stageScroll(); }, { passive: true });
darkMode.addEventListener("change", () => { dirty = true; showWidgets(DAYS[widgetDay]); });
addEventListener("pointermove", aimAt, { passive: true });
addEventListener("pointerdown", aimAt, { passive: true });
document.addEventListener("pointerleave", () => { pointer = null; });
orb.addEventListener("click", () => {
  if (place().inBar > 0.5) { scrollTo({ top: 0, behavior: still.matches ? "auto" : "smooth" }); return; }
  if (!landed) { return; }
  if (!still.matches && hop === null) { hop = 0; }
  mood = ["bliss", "wink", "joy"][Math.floor(Math.random() * 3)]; moodUntil = now_ + 1.5; dirty = true;
});
for (const b of document.querySelectorAll(".store")) {
  b.addEventListener("pointerenter", () => { mood = "joy"; moodUntil = now_ + 60; });
  b.addEventListener("pointerleave", () => { moodUntil = now_ + 0.4; });
}

// ---- Status: right now, then four example days ----

let stageDay = null;                              // null: not on this part of the page; 0 = right now, 1...4 = example days
let liveDay = null;                               // filled by NOAA
const day = () => stageDay ? DAYS[stageDay - 1] : liveDay ?? DAYS[0];
const buttons = [...document.querySelectorAll("#status .segments button")];
const WHEN = ["Right now", "On a quiet day", "On an active day", "During a storm", "During a severe storm"];
const MEANS = ["The Sun is calm. Nothing unusual is on its way.", "The Sun is restless. Near the poles the sky may light up tonight.",
               "Aurora may be seen farther from the poles than usual. GPS and radio may be less accurate.", "A rare, strong storm. Aurora may be seen far from the poles, and GPS and radio can fail for a while."];
function showStage() {
  const d = day();
  put($("#when"), WHEN[stageDay ?? 0]);
  put($("#kp"), d.kp);
  put($("#state"), d.state);
  put($("#means"), MEANS[d.level]);
  showScreens(d);
  buttons.forEach((b, i) => b.setAttribute("aria-pressed", i === (stageDay ?? 0)));
  $("#status .thumb").style.transform = `translateX(${(stageDay ?? 0) * 100}%)`;
  stageLevel = stageDay ? d.level : null;
  dirty = true;
}
function stageScroll() {
  const r = stage.getBoundingClientRect(), way = r.height - H, on = r.top < H * 0.45 && r.bottom > H * 0.55;
  const next = on ? clamp(Math.floor(clamp(-r.top / way, 0, 0.999) * 5), 0, 4) : null;
  if (next === stageDay) { return; }
  stageDay = next;
  showStage();
}
buttons.forEach((b, i) => b.addEventListener("click", () => {
  scrollTo({ top: stage.offsetTop + (stage.offsetHeight - H) * (i + 0.5) / 5, behavior: still.matches ? "auto" : "smooth" });
}));

// ---- Loops and soft entrances ----

let widgetDay = 0;
showWidgets(DAYS[0]);
note(0); note(1);
for (let i = 0; i < 3; i++) { say(); }
let noted = 2;
const loops = new Map([["#widgets", false], ["#talk", false], ["#devices", false]]);
const loopWatch = new IntersectionObserver((list) => { for (const e of list) { loops.set("#" + e.target.id, e.isIntersecting); } });
for (const id of loops.keys()) { loopWatch.observe($(id)); }
setInterval(() => {
  if (document.hidden || still.matches || !(loops.get("#widgets") || loops.get("#talk") || loops.get("#devices"))) { return; }
  widgetDay = (widgetDay + 1) % 4;
  showWidgets(DAYS[widgetDay]);
}, 3600);
setInterval(() => { if (!document.hidden && !still.matches && loops.get("#talk")) { note(noted++); } }, 3800);
setInterval(() => { if (!document.hidden && !still.matches && loops.get("#talk")) { say(); } }, 2100);
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
    feel: FEEL[clamp(Math.round(kp), 0, 9)],
    m: percent(odds?.[0]?.m_class_1_day), x: percent(odds?.[0]?.x_class_1_day), flare: cls ?? "–", flareWord: cls ? { X: "Strong", M: "Medium", C: "Moderate" }[cls[0]] ?? "Low" : "",
    wind: isFinite(speed) ? Math.round(speed) : "–", windWord: !isFinite(speed) ? "" : speed < 400 ? "Calm" : speed < 600 ? "Raised" : "High", bz: isFinite(bz) ? Math.round(bz) : "–" };
  showStage();
}
const FEEL = ["Nothing to feel right now", "Most people feel nothing", "Most people will not feel anything", "Very few people may feel it", "Some people may notice it",
              "Sensitive people may feel it", "Some people may feel a bit off", "Some people may feel tired", "Some people may sleep lighter", "Very rare. Some people may feel it"];

if (landed) { document.documentElement.classList.add("landed"); }
measure();
stageScroll();
showStage();
requestAnimationFrame(frame);
live();
// A slow device must not hold the words back.
setTimeout(arrived, 4000);
setInterval(() => { if (!document.hidden) { live(); } }, 5 * 60e3);
