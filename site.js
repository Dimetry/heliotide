"use strict";
const $ = (q) => document.querySelector(q);
const still = matchMedia("(prefers-reduced-motion: reduce)");
const darkMode = matchMedia("(prefers-color-scheme: dark)");
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mix = (a, b, k) => a + (b - a) * k;
const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

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

// ---- The sleepy face, lying on the ball ----

const FACE = [[-172, 105, 40, 20, 16, 164], [172, 105, 40, 20, 16, 164], [0, 200, 35, 19, 28, 152]].map(([mx, my, radius, width, from, to]) => {
  const rad = Math.PI / 180, n = 28, caps = 8, steps = Array.from({ length: n + 1 }, (_, i) => i / n);
  const drop = (radius + radius * Math.sin(Math.min(from, 180 - to) * rad)) / 2;
  const point = (u, side) => {
    const t = (from + (to - from) * u) * rad, half = width / 2 * (0.88 + 0.12 * Math.sin(Math.PI * u));
    return [mx - Math.cos(t) * (radius + half * side), my + Math.sin(t) * (radius + half * side) - drop];
  };
  const cap = (u, sign) => {
    const a = point(u, sign), b = point(u, -sign), c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], r = [a[0] - c[0], a[1] - c[1]];
    return Array.from({ length: caps - 1 }, (_, i) => {
      const k = (i + 1) / caps * Math.PI;
      return [c[0] + r[0] * Math.cos(k) + r[1] * Math.sin(k), c[1] - r[0] * Math.sin(k) + r[1] * Math.cos(k)];
    });
  };
  return [...steps.map((u) => point(u, 1)), ...cap(1, 1), ...steps.slice().reverse().map((u) => point(u, -1)), ...cap(0, -1)]
    .map((p) => [p[0] / 361.5, p[1] / 361.5]);
});
function facePath(turn) {
  if (Math.abs(turn[0]) > 2.6 || Math.abs(turn[1]) > 2.6) { return ""; }
  return FACE.map((line) => "M" + line.map(([x, y]) => {
    const l = Math.max(0.0001, Math.hypot(x, y)), k = Math.asin(Math.min(1, l)) / l;
    const ax = x * k + turn[0], ay = y * k - turn[1], d = Math.max(0.0001, Math.hypot(ax, ay)), s = Math.sin(Math.min(Math.PI / 2, d)) / d;
    return (ax * s * 100).toFixed(2) + " " + (ay * s * 100).toFixed(2);
  }).join("L") + "Z").join("");
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
if (!field) { $("#clouds").remove(); }
if (!ball) { $("#orb").remove(); document.documentElement.classList.add("no-orb"); }
const orb = $("#orb"), face = $("#orb path"), bar = $("#bar");
const hero = $("#hero .slot"), stage = $("#levels"), stageSlot = $("#levels .slot"), story = $("#story");

let W = 0, H = 0, big = 100, dpr = 1;
function measure() {
  W = document.documentElement.clientWidth; H = innerHeight;
  big = hero.clientWidth / 2;
  dpr = Math.min(2, devicePixelRatio || 1);
  if (field) { field.resize(W / 3, H / 3); }
  if (ball) { ball.resize(big / 0.48 * dpr, big / 0.48 * dpr); }
  orb.style.width = orb.style.height = big / 0.48 + "px";
  dirty = true;
}

let cloudTime = 20, filmTime = 0, dirty = true, landed = still.matches;
let rolled = 0, lastX = null, lastY = null;       // rolling that comes from moving over the page
let aim = [0, 0], look2 = [0, 0];                  // the orb looks a little towards the pointer
let hop = null;                                    // a tap: one small jump
const SMALL = 17;                                  // radius in the bar

/// Where the page wants the orb: centre, radius, and how far it has gone into the bar (0...1).
function place() {
  const r = hero.getBoundingClientRect(), cx = W / 2, by = 30;
  const out = ease(scrollY / (H * 0.62));
  let x = cx, y = mix(r.top + r.height / 2, by, out), radius = mix(big, SMALL, out), inBar = out;
  const s = stage.getBoundingClientRect(), t = stageSlot.getBoundingClientRect();
  const on = ease((H * 0.75 - s.top) / (H * 0.6)) * ease((s.bottom - H * 0.35) / (H * 0.55));
  if (on > 0) {
    y = mix(y, t.top + t.height / 2, on);
    radius = mix(radius, t.width / 2, on);
    inBar = mix(inBar, 0, on);
  }
  return { x, y, radius, inBar };
}

function drawOrb(dt, now) {
  const p = place();
  let turn = [0, 0], scale = p.radius / big, x = p.x, y = p.y;
  if (!landed) {
    filmTime += Math.min(0.05, dt);
    const f = entrance(filmTime, W, H, big);
    x += f.x; y += f.y; scale *= f.scale; turn = f.turn;
    orb.style.opacity = f.shown ? 1 : 0;
    if (f.over || scrollY > H * 0.3) { landed = true; document.documentElement.classList.add("landed"); orb.style.opacity = 1; }
  } else if (!still.matches) {
    if (lastY !== null) { rolled += (y - lastY) / Math.max(40, p.radius) * 0.6; }
    lastY = y;
    rolled *= Math.exp(-dt * 3.2);                 // it always comes back to show its face
    for (let i = 0; i < 2; i++) { look2[i] += (aim[i] - look2[i]) * (1 - Math.exp(-dt * 5)); }
    turn = [look2[0], look2[1] - clamp(rolled, -2.4, 2.4)];
    if (hop !== null) {
      hop += dt;
      const u = hop / 0.62;
      if (u >= 1) { hop = null; }
      else { y -= Math.sin(Math.PI * u) * p.radius * 0.85; turn[0] += 2 * Math.PI * (u < 0.5 ? 0 : 1) - 2 * Math.PI * ease(u); }
    }
  }
  // A full turn: the face is drawn for the nearest way round.
  const near = [Math.atan2(Math.sin(turn[0]), Math.cos(turn[0])), turn[1]];
  const half = big / 0.48 / 2;
  orb.style.transform = `translate3d(${(x - half).toFixed(2)}px, ${(y - half).toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
  bar.style.opacity = ease((p.inBar - 0.6) / 0.4);
  if (ball) {
    ball.draw({ time: 43.5 + now * 0.12, energy: 0.12, roll: [3.892 + near[0], 3.819 + near[1]],
                cMain: look.ballMain, cLow: look.ballLow, cMid: look.ballMid, cHigh: look.ballHigh });
  }
  face.setAttribute("d", facePath(near));
}

/// The clouds stand lower on the first screen and rise to the bar behind the rest, as in the app.
function drawClouds() {
  if (!field) { return; }
  const y = 0.5 + (60 / H - 0.5) / 1.03, top = 1 - y - (0.33 + 0.16 * look.energy + (ZOOM - 1) * 0.5) / ZOOM;
  const away = story.getBoundingClientRect().top;
  const lift = mix(LIFT, Math.max(top, LIFT), ease((H - away) / H));
  field.draw({ time: cloudTime, energy: look.energy, zoom: ZOOM, lift, dark: darkMode.matches ? 1 : 0,
               cMain: look.main, cLow: look.low, cMid: look.mid, cHigh: look.high,
               deep: look.deep, dmid: look.dmid, glow: look.glow, skyShift: look.skyShift });
}

let last = 0, sinceClouds = 1, clock = 0;
function frame(ms) {
  requestAnimationFrame(frame);
  const now = ms / 1000, dt = clamp(now - last, 0, 0.05);
  last = now;
  if (still.matches) {
    // Nothing moves by itself: draw only when something has changed.
    if (!dirty) { return; }
    dirty = false;
    look = copy(LOOKS[level()]);
    drawClouds();
    drawOrb(0, 0);
    return;
  }
  clock += dt;
  glide(dt);
  cloudTime += dt * look.speed;
  sinceClouds += dt;
  if (sinceClouds >= 1 / 31) { sinceClouds = 0; drawClouds(); }
  drawOrb(dt, clock);
}

addEventListener("resize", measure);
addEventListener("scroll", () => { dirty = true; stageScroll(); }, { passive: true });
darkMode.addEventListener("change", () => { dirty = true; });
still.addEventListener("change", () => { landed = true; document.documentElement.classList.add("landed"); dirty = true; });
addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse") { return; }
  const r = orb.getBoundingClientRect();
  aim = [clamp((e.clientX - r.left - r.width / 2) / W, -0.5, 0.5) * 0.9, clamp(-(e.clientY - r.top - r.height / 2) / H, -0.5, 0.5) * 0.7];
});
document.addEventListener("pointerleave", () => { aim = [0, 0]; });
orb.addEventListener("click", () => {
  if (place().inBar > 0.5) { scrollTo({ top: 0, behavior: still.matches ? "auto" : "smooth" }); }
  else if (landed && !still.matches && hop === null) { hop = 0; }
});

// ---- Four colours ----

const tabs = [...document.querySelectorAll("#levels button")];
function stageScroll() {
  const r = stage.getBoundingClientRect(), way = r.height - H;
  const on = r.top < H * 0.45 && r.bottom > H * 0.55;
  const next = on ? clamp(Math.floor(clamp(-r.top / way, 0, 0.999) * 4), 0, 3) : null;
  if (next === stageLevel) { return; }
  stageLevel = next;
  dirty = true;
  if (next !== null) {
    tabs.forEach((b, i) => b.setAttribute("aria-pressed", i === next));
    $("#levels .thumb").style.transform = `translateX(${next * 100}%)`;
  }
}
tabs.forEach((b, i) => b.addEventListener("click", () => {
  const way = stage.offsetHeight - H;
  scrollTo({ top: stage.offsetTop + way * (i + 0.5) / 4, behavior: still.matches ? "auto" : "smooth" });
}));

// ---- The phone next to the texts ----

const shots = [...document.querySelectorAll("#story .desk img")];
const steps = [...document.querySelectorAll("#story .step")];
const watch = new IntersectionObserver((list) => {
  for (const e of list) { if (e.isIntersecting) { shots.forEach((s, i) => s.classList.toggle("on", i === steps.indexOf(e.target))); } }
}, { rootMargin: "-50% 0px -50% 0px" });
steps.forEach((s) => watch.observe(s));
const appear = new IntersectionObserver((list) => {
  for (const e of list) { if (e.isIntersecting) { e.target.classList.add("seen"); appear.unobserve(e.target); } }
}, { rootMargin: "0px 0px -12% 0px" });
document.querySelectorAll(".soft").forEach((e) => appear.observe(e));

// ---- Live numbers from NOAA, the same rule as in the app: the highest measured signal wins ----

const SWPC = "https://services.swpc.noaa.gov/";
const load = (path) => fetch(SWPC + path, { referrerPolicy: "no-referrer", signal: AbortSignal.timeout?.(10000) }).then((r) => r.ok ? r.json() : null).catch(() => null);
const kpLevel = (kp) => { kp = Math.round(kp); return kp < 4 ? 0 : kp < 5 ? 1 : kp < 7 ? 2 : 3; };
const scaleLevel = (s) => s < 1 ? 0 : s < 3 ? 1 : s < 4 ? 2 : 3;

async function live() {
  const [rows, scales, flares, field_] = await Promise.all([
    load("products/noaa-planetary-k-index-forecast.json"), load("products/noaa-scales.json"),
    load("json/goes/primary/xray-flares-latest.json"), load("products/summary/solar-wind-mag-field.json")]);
  if (!Array.isArray(rows)) { return; }
  const points = rows.map((r) => ({ at: Date.parse(String(r.time_tag).replace(" ", "T").replace(/Z?$/, "Z")), kp: Number(r.kp), seen: r.observed !== "predicted" }))
    .filter((p) => isFinite(p.at) && isFinite(p.kp)).sort((a, b) => a.at - b.at);
  const now = Date.now(), current = points.filter((p) => p.seen && p.at <= now).pop();
  if (!current) { return; }

  const s = scales?.["0"] ?? {}, scale = (k) => Number(s[k]?.Scale) || 0, g = scale("G");
  const flare = String(flares?.[0]?.current_class ?? "")[0], bz = Number(field_?.[0]?.bz_gsm ?? 0);
  liveLevel = Math.max(kpLevel(current.kp), flare === "X" ? 2 : flare === "M" ? 1 : 0, scaleLevel(scale("R")), scaleLevel(scale("S")), scaleLevel(g),
                       bz <= -20 ? 2 : bz <= -10 ? 1 : 0);
  $("#kp").textContent = Math.round(current.kp);
  $("#state").textContent = ["Space weather is quiet now", "Space weather is active now",
    g > 0 ? "Magnetic storm now" : "Space weather storm now", g > 0 ? "Severe magnetic storm now" : "Severe space weather now"][liveLevel];
  chart(points, now);
  $("#now").classList.add("ready");
  dirty = true;
}

/// Soft line through the points, no overshoot; the forecast is fainter.
function chart(points, now) {
  const H36 = 36 * 3600e3, w = 1000, h = 150, pad = 14;
  const near = points.filter((p) => p.at + 5400e3 > now - H36 - 4 * 3600e3 && p.at < now + H36 + 4 * 3600e3)
    .map((p) => [(p.at + 5400e3 - now) / H36 * w / 2 + w / 2, p.kp]);
  const top = Math.max(4, ...near.map((p) => p[1]));
  const P = near.map(([x, k]) => [x, h - pad - k / top * (h - 2 * pad)]), n = P.length;
  if (n < 3) { return; }
  const d = [], m = [];
  for (let i = 0; i < n - 1; i++) { d[i] = (P[i + 1][1] - P[i][1]) / (P[i + 1][0] - P[i][0]); }
  for (let i = 0; i < n; i++) { m[i] = i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2; }
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], q = a * a + b * b;
    if (q > 9) { const t = 3 / Math.sqrt(q); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  let path = `M${P[0][0]} ${P[0][1]}`, y = h / 2;
  for (let i = 0; i < n - 1; i++) {
    const dx = (P[i + 1][0] - P[i][0]) / 3;
    path += `C${P[i][0] + dx} ${P[i][1] + m[i] * dx} ${P[i + 1][0] - dx} ${P[i + 1][1] - m[i + 1] * dx} ${P[i + 1][0]} ${P[i + 1][1]}`;
    if (P[i][0] <= w / 2 && P[i + 1][0] >= w / 2) {
      const t = (w / 2 - P[i][0]) / (dx * 3), t2 = t * t, t3 = t2 * t;
      y = (2 * t3 - 3 * t2 + 1) * P[i][1] + (t3 - 2 * t2 + t) * dx * 3 * m[i] + (3 * t2 - 2 * t3) * P[i + 1][1] + (t3 - t2) * dx * 3 * m[i + 1];
    }
  }
  document.querySelectorAll("#now path").forEach((e) => e.setAttribute("d", path));
  $("#now .dot").style.top = y / h * 100 + "%";
}

if (landed) { document.documentElement.classList.add("landed"); }
measure();
stageScroll();
requestAnimationFrame(frame);
live();
setInterval(() => { if (!document.hidden) { live(); } }, 5 * 60e3);
