// The app's screens and widgets, built for the page: the same layouts, words and colours as in the app.
"use strict";

/// Example days: the same samples as in the app's widget gallery.
const DAYS = [
  { level: 0, kp: 2, state: "Space weather is quiet now", feel: "Most people will not feel anything", condition: "Quiet space weather", watch: "Calm next 24 hours", outlook: "Calm", peak: 3, flare: "B6.2", m: "5%", x: "1%", flareWord: "Low", wind: 362, windWord: "Calm", bz: 1, field: "Calm", radio: "Normal", radiation: "Normal",
    curve: [1.3, 1.7, 2, 1.3, 1, 1.7, 2.3, 2, 1.7, 1.3, 2, 2, 2.3, 2.7, 2, 1.7, 1.7, 2, 2.3, 2, 1.7, 1.7, 2, 2] },
  { level: 1, kp: 4, state: "Space weather is active now", feel: "Some people may notice it", condition: "Active space weather", watch: "Storm tomorrow", outlook: "Storm expected", peak: 5, flare: "C4.1", m: "25%", x: "5%", flareWord: "Moderate", wind: 468, windWord: "Raised", bz: -6, field: "Unsettled", radio: "Normal", radiation: "Normal",
    curve: [2, 2.3, 2.7, 3, 2.7, 3.3, 3.7, 3.3, 3, 3.7, 4, 4, 4.3, 4.7, 5, 5.3, 4.7, 4, 3.7, 3.3, 3, 3, 2.7, 2.7] },
  { level: 2, kp: 6, state: "Magnetic storm now", feel: "Some people may feel a bit off", condition: "Magnetic storm", watch: "Storm possible", outlook: "Storm expected", peak: 6, flare: "M1.8", m: "55%", x: "15%", flareWord: "Medium", wind: 612, windWord: "High", bz: -14, field: "Stormy", radio: "Minor issues", radiation: "Normal",
    curve: [3, 3.3, 4, 4.7, 5, 5.7, 6, 6.3, 6, 5.7, 6, 6.3, 6, 5.3, 5, 4.7, 4.3, 4, 3.7, 3.3, 3, 3, 2.7, 2.3] },
  { level: 3, kp: 8, state: "Severe magnetic storm now", feel: "Some people may sleep lighter", condition: "Severe magnetic storm", watch: "Storm today", outlook: "Storm expected", peak: 8, flare: "X2.1", m: "85%", x: "40%", flareWord: "Strong", wind: 925, windWord: "High", bz: -32, field: "Stormy", radio: "Disrupted", radiation: "Raised",
    curve: [4, 5, 6, 7, 7.7, 8, 8.3, 8.7, 8.3, 8, 8, 8.3, 7.7, 7, 6.3, 6, 5.3, 5, 4.7, 4.3, 4, 3.7, 3.3, 3] }
];
const minus = (v) => v < 0 ? "−" + -v : "" + v;

// ---- Text that changes softly ----

/// The old word blurs away upwards while the new one comes out of the blur from below, both at once.
function put(el, text) {
  text = String(text);
  if (el.dataset.text === text) { return; }
  const before = el.dataset.text;
  el.dataset.text = text;
  if (before === undefined || still.matches || !el.animate) { el.textContent = text; return; }
  const fresh = document.createElement("span"), ghost = document.createElement("span");
  fresh.textContent = text;
  ghost.textContent = before;
  ghost.className = "ghost";
  el.classList.add("swap");
  el.replaceChildren(fresh, ghost);
  const big = text.length <= 3, blur = big ? 16 : 7, way = big ? ".22em" : ".35em";
  ghost.animate([{ opacity: 1, filter: "blur(0)", transform: "none" }, { opacity: 0, filter: `blur(${blur}px)`, transform: `translateY(-${way}) scale(${big ? 0.82 : 0.98})` }], { duration: 220, easing: "cubic-bezier(.4, 0, 1, 1)", fill: "forwards" }).onfinish = () => ghost.remove();
  fresh.animate([{ opacity: 0, filter: `blur(${blur}px)`, transform: `translateY(${way}) scale(${big ? 1.12 : 1})` }, { opacity: 1, filter: "blur(0)", transform: "none" }], { duration: 420, delay: 50, easing: "cubic-bezier(.16, 1, .3, 1)", fill: "backwards" });
}

// ---- Charts ----

/// Soft line through 24 values; "now" (the 12th) stands in the middle. Returns the path and the height of "now".
function chartPath(values, w, h, pad, low, top) {
  const n = values.length + 2, all = [values[0], ...values, values[values.length - 1]];
  const P = all.map((k, i) => [w / 2 + (i - 12) * w / 23, h - pad - (k - low) / (top - low) * (h - 2 * pad)]), d = [], m = [];
  for (let i = 0; i < n - 1; i++) { d[i] = (P[i + 1][1] - P[i][1]) / (P[i + 1][0] - P[i][0]); }
  for (let i = 0; i < n; i++) { m[i] = i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2; }
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(d[i]) < 1e-9) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], q = a * a + b * b;
    if (q > 9) { const t = 3 / Math.sqrt(q); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  let s = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const x = (P[i + 1][0] - P[i][0]) / 3;
    s += `C${(P[i][0] + x).toFixed(1)} ${(P[i][1] + m[i] * x).toFixed(1)} ${(P[i + 1][0] - x).toFixed(1)} ${(P[i + 1][1] - m[i + 1] * x).toFixed(1)} ${P[i + 1][0].toFixed(1)} ${P[i + 1][1].toFixed(1)}`;
  }
  return [s, P[12][1]];
}
let clipId = 0;
const chartHTML = () => {
  const a = "c" + ++clipId, b = "c" + ++clipId;
  return `<div class="chart" data-chart aria-hidden="true"><svg viewBox="0 0 400 60" preserveAspectRatio="none"><clipPath id="${a}"><rect x="0" y="-30" width="200" height="120"/></clipPath><clipPath id="${b}"><rect x="200" y="-30" width="200" height="120"/></clipPath><g clip-path="url(#${a})"><path/></g><g clip-path="url(#${b})"><path class="ahead"/></g></svg><i></i><b>Now</b></div>`;
};
function drawChart(el, values) {
  const low = 0, top = Math.max(4.5, ...values) + 0.3, [d, y] = chartPath(values, 400, 60, 5, low, top);
  for (const p of el.querySelectorAll("path")) { p.setAttribute("d", d); }
  el.style.setProperty("--y", (y / 60 * 100).toFixed(2) + "%");
  const peak = Math.max(...values.slice(9, 14));
  el.style.setProperty("--n", ((60 - 5 - (peak - low) / (top - low) * 50) / 60 * 100).toFixed(2) + "%");
}

// ---- Small icons ----

const ICON = {
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3 7 7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3.8 6 3.8 9s-.8 6-3.8 9c-3-3-3.8-6-3.8-9S9 6 12 3Z"/>',
  list: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M7 9h4v4H7zM14 9h3M14 12.5h3M7 16h10"/>',
  chat: '<path d="M4 5.5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z"/><path d="M19.5 9.5h.5a2 2 0 0 1 2 2V16a2 2 0 0 1-2 2v2.6L17 18h-4"/>',
  arrow: '<path fill="currentColor" stroke="none" d="M20.500 3.500 3.800 10.700c-.9.4-.8 1.600.1 1.900l6.400 1.300 1.300 6.400c.2 1 1.500 1.100 1.900.2l7.200-16.600c.1-.3-.1-.5-.2-.4Z"/>',
  right: '<path d="m9.500 5.500 6.500 6.500-6.500 6.500"/>', up: '<path d="m4.500 15.500 7.500-7 7.500 7"/>', down: '<path d="m4.500 8.500 7.500 7 7.500-7"/>',
  wave: '<path d="M2.500 12h2.200l1.300-4 2 9 2-13 2.200 17 2-13 2 9 1.300-5h2"/>', info: '<circle cx="12" cy="12" r="9.300"/><path d="M12 11v5.600M12 7.300v.2"/>',
  flare: '<circle cx="10" cy="11" r="4"/><path d="M10 2.800v2M10 17.200v2M1.800 11h2M4.200 5.200l1.400 1.400M4.200 16.800l1.400-1.400M15.800 5.200l-1.400 1.400M17 13.500l4.200 7.200h-8.400Z"/>',
  wind: '<path d="M2.500 9h11a2.700 2.700 0 1 0-2.700-2.700M2.500 12.500h16a2.700 2.700 0 1 1-2.700 2.700M2.500 16h8.500a2.400 2.400 0 1 1-2.400 2.400"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.4 4.2 4.2 0 0 1 19.5 10c0 5.400-7.500 10-7.500 10Z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2.600v2.400M12 19v2.400M2.600 12H5M19 12h2.400M5.400 5.400 7 7M17 17l1.600 1.600M5.400 18.600 7 17M17 7l1.600-1.600"/>'
};
const icon = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

// ---- Screens of the app ----

const tabs_ = (n) => `<div class="tabs">${[["sun", "Today"], ["globe", "Map"], ["list", "Events"], ["chat", "Chat"]].map(([i, t], k) => `<span class="${k === n ? "on" : ""}">${icon(i)}${t}</span>`).join("")}</div>`;
const hero_ = () => `<div class="place">${icon("arrow")}MY LOCATION${icon("right")}</div><div class="city">Reykjavík</div><div class="kp"><small>Kp</small><span data-d="kp"></span></div><div class="state" data-d="state"></div><div class="feel" data-d="feel"></div>${chartHTML()}<div class="ends"><span>36h ago</span><span>${icon("wave")}<u>K-index</u></span><span>in 36h</span></div>`;
const sun_ = () => `<div class="sun" data-tone="dark">${[0, 1, 2, 3].map((i) => `<img src="img/sun${i}.jpg" alt="" data-sun="${i}"${i ? ' loading="lazy"' : ""}>`).join("")}</div>`;
const flares_ = () => `<div class="card_"><div class="head">${icon("flare")}SOLAR FLARES${icon("info")}<em>${icon("up")}</em></div><div class="val"><span data-d="flare"></span> <small data-d="flareWord"></small></div><div class="xray"><svg viewBox="0 0 340 44" preserveAspectRatio="none" aria-hidden="true"><path d="M0 37 14 36 24 37 40 33 52 35 66 36 80 35 92 30 97 35 120 37 150 36 168 37 196 38 222 37 250 38 284 37 300 36 312 37 320 27 324 34 331 8 336 22 340 18"/></svg><i></i></div><div class="ends x"><span>12h ago</span><span>6h ago</span><b>Now</b></div>${sun_()}<div class="cap">NASA SDO</div><div class="chance"><div class="head">Chance of a flare in the next 24 hours</div><div class="row_"><span>Medium · M</span><span data-d="m"></span></div><div class="row_"><span>Strong · X</span><span data-d="x"></span></div></div></div>`;
const wind_ = () => `<div class="card_"><div class="head">${icon("wind")}SOLAR WIND${icon("info")}<em>${icon("up")}</em></div><div class="val"><span data-d="wind"></span> <small>km/s <span data-d="windWord"></span></small></div><div class="row_"><span>Field direction · Bz</span><span data-d="bz"></span></div><div class="sun" data-tone="dark"><img class="on" src="img/wind.jpg" alt="" loading="lazy"></div><div class="cap">NOAA SWPC · WSA-Enlil</div></div>`;
const status_ = '<div class="status"><b>9:41</b><span><svg viewBox="0 0 66 14" aria-hidden="true"><rect x="0" y="8" width="3" height="5" rx="1"/><rect x="5" y="6" width="3" height="7" rx="1"/><rect x="10" y="3.500" width="3" height="9.500" rx="1"/><rect x="15" y="1" width="3" height="12" rx="1"/><path d="M32 12.600 29.600 10a3.400 3.400 0 0 1 4.800 0ZM27.600 8a6.200 6.200 0 0 1 8.800 0l1.500-1.600a8.400 8.400 0 0 0-11.800 0ZM24.900 5.200a10 10 0 0 1 14.200 0l1.500-1.600a12.200 12.200 0 0 0-17.200 0Z"/><rect x="45" y="1.500" width="19" height="11" rx="3.200"/></svg></span></div>';

const SCREENS = {
  phone: () => `<div class="scr phoneapp"><canvas data-bg="tall"></canvas>${status_}<span class="round l">${icon("heart")}</span><span class="round r">${icon("gear")}</span>${hero_()}${flares_()}${tabs_(0)}</div>`,
  wide: () => `<div class="scr wide"><canvas data-bg="wide"></canvas><span class="round l">${icon("heart")}</span><span class="round r">${icon("gear")}</span><div class="left">${hero_()}</div><div class="cols">${flares_()}${wind_()}</div>${tabs_(0)}</div>`,
  watch: () => `<div class="scr watchapp"><div class="wbg" data-flow="small" data-dark="1"></div><time>9:41</time><div class="place">${icon("arrow")}REYKJAVÍK</div><div class="kp"><small>Kp</small><span data-w="kp"></span></div><div class="state" data-w="condition"></div><div class="feel" data-w="watch"></div><i class="dots"></i></div>`,
  fold: () => `<div class="half l">${SCREENS.wide()}</div><div class="half r">${SCREENS.wide()}</div><div class="foldshade"></div>`,
  face: () => `<div class="scr watchface" data-tone="dark"><div class="wf-top"><div class="ring" data-ring2><span data-w="kp"></span><small>Kp</small></div><div class="wf-time"><span>TUE 24</span>9:41</div></div><div class="wf-rect"><b data-w="condition"></b><span data-w="watch"></span><div class="chart" data-wchart><svg viewBox="0 0 364 52" preserveAspectRatio="none"><path class="ahead"/><path/></svg><i></i></div></div></div>`,
  lock: () => `<div class="scr lock"><canvas data-bg="tall"></canvas><div class="date">Tuesday, 24 November</div><div class="clock">9:41</div><div class="acc"><div class="ring" data-ring><span data-d="kp"></span></div><div class="rect"><b data-d="condition"></b><span data-d="watch"></span></div></div><div class="notes"></div></div>`,
  chat: () => `<div class="scr chatapp"><canvas data-bg="tall"></canvas>${status_}<div class="ctitle"><b>Chat</b><span id="room"></span></div><span class="round r">${icon("globe")}</span><div class="bubbles"></div><div class="field">Message</div></div>`
};
for (const el of document.querySelectorAll("[data-screen]")) { el.innerHTML = SCREENS[el.dataset.screen](); }
// Pictures from the real app (light and dark), no drawing: the strip of devices.
const shot = (n) => `<picture><source media="(prefers-color-scheme: dark)" srcset="img/shot-${n}-dark.jpg"><img class="shot" src="img/shot-${n}-light.jpg" alt="" loading="lazy"></picture>`;
for (const el of document.querySelectorAll("[data-shot]")) {
  el.innerHTML = el.classList.contains("fold") ? `<div class="half l">${shot(el.dataset.shot)}</div><div class="half r">${shot(el.dataset.shot)}</div><div class="foldshade"></div>` : shot(el.dataset.shot);
}
// Frames: Apple's product bezels (Apple Design Resources).
for (const el of document.querySelectorAll(".dev")) {
  const kind = ["phone", "land", "pad", "duo", "fold"].find((k) => el.classList.contains(k));
  if (kind) { el.insertAdjacentHTML("beforeend", `<img class="frame" src="img/frame-${kind === "pad" ? "ipad" : kind}.png" alt="">`); }
}
/// The half-folded Duo: each half of the screen is laid exactly on its half of the frame.
function foldScreens() {
  const solve = (w, h, q) => {                       // rectangle w × h -> four corners (tl, tr, br, bl)
    const [x0, y0] = q[0], [x1, y1] = q[1], [x2, y2] = q[2], [x3, y3] = q[3];
    const dx1 = x1 - x2, dx2 = x3 - x2, sx = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, sy = y0 - y1 + y2 - y3, den = dx1 * dy2 - dx2 * dy1;
    const g = (sx * dy2 - dx2 * sy) / den, k = (dx1 * sy - sx * dy1) / den;
    const m = [x1 - x0 + g * x1, y1 - y0 + g * y1, g, x3 - x0 + k * x3, y3 - y0 + k * y3, k, x0, y0];
    return `matrix3d(${m[0] / w},${m[1] / w},0,${m[2] / w},${m[3] / h},${m[4] / h},0,${m[5] / h},0,0,1,0,${m[6]},${m[7]},0,1)`;
  };
  for (const el of document.querySelectorAll(".dev.fold")) {
    const k = el.clientWidth / 5600, w = 500, h = 703, at = (x, y) => [x * k, y * k];
    el.querySelector(".half.l").style.transform = solve(w, h, [at(203, 148), at(2802, 381), at(2802, 4119), at(203, 4352)]);
    el.querySelector(".half.r").style.transform = solve(w, h, [at(2798, 381), at(5397, 148), at(5397, 4352), at(2798, 4119)]);
  }
}

// ---- Widgets ----

const kpMark = '<div class="km"><small>Kp</small><span data-w="kp"></span></div>';
const WIDGETS = {
  small: `${kpMark}<div class="two"><b data-w="condition"></b><span data-w="watch"></span></div>`,
  medium: `<div class="sig">${[["SOLAR FLARES", "flareWord"], ["SOLAR WIND", "windWord"], ["MAGNETIC FIELD", "field"]].map(([l, k]) => `<div><small>${l}</small><b data-w="${k}"></b></div>`).join("")}</div><div class="side">${kpMark}<div class="two"><b data-w="condition"></b><span data-w="watch"></span></div></div>`,
  large: `<div class="lh"><div class="two"><b data-w="condition"></b><span data-w="watch"></span></div>${kpMark}</div><div class="chart" data-wchart><svg viewBox="0 0 364 52" preserveAspectRatio="none"><path class="ahead"/><path/></svg><i></i><b>Now</b></div><div class="rows">${[["Next 24 hours", "peakText", "outlook"], ["Solar flares", "flare", "flareWord"], ["Solar wind", "windText", "windWord"], ["Magnetic field", "bzText", "field"], ["Radio and GPS", "", "radio"], ["Radiation", "", "radiation"]].map(([l, n, w]) => `<div><span>${l}</span>${n ? `<small data-w="${n}"></small>` : "<small></small>"}<b data-w="${w}"></b></div>`).join("")}</div>`
};
for (const el of document.querySelectorAll("[data-widget]")) {
  el.innerHTML = `<div class="wbg" data-flow="${el.dataset.widget}"></div><div class="wc">${WIDGETS[el.dataset.widget]}</div>`;
}

/// The soft gradient of the widgets (the app's still frame: four colour spots, warped, blurred).
const FLOW = [["#F4FAE2", "#7CC242", "#D9E36A", "#A6D85A"], ["#EEF7F2", "#3A9FC8", "#3FBFB0", "#8FD6C4"], ["#FFF0CF", "#F2B705", "#F08A24", "#E0661B"], ["#FBDDF2", "#F0559F", "#E8305C", "#A865F4"]];
const SPOTS = { small: [[[0.74, 0.30], [0.12, 0.18], [0.22, 0.92], [0.92, 0.88]], [0.55, 1, 1, 1], 1, 57], medium: [[[0.87, 0.32], [0.48, 0.12], [0.70, 1], [0.08, 0.70]], [0.5, 1, 1, 1], 364 / 170, 57], large: [[[0.83, 0.13], [0.15, 0.12], [0.85, 0.80], [0.18, 0.78]], [0.45, 1, 1, 1], 364 / 382, 90] };
const flowCache = {};
function flowImage(kind, level, dark) {
  const key = kind + level + dark;
  if (flowCache[key]) { return flowCache[key]; }
  const [spots, pull, asp, h] = SPOTS[kind], w = Math.round(h * asp), T = 12;
  const fract = (v) => v - Math.floor(v), hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
  const noise = (x, y) => { const i = Math.floor(x), j = Math.floor(y); let a = x - i, b = y - j; a = a * a * (3 - 2 * a); b = b * b * (3 - 2 * b); return mix(mix(hash(i, j), hash(i + 1, j), a), mix(hash(i, j + 1), hash(i + 1, j + 1), a), b); };
  const fbm = (x, y) => { let v = 0, a = 0.5; for (let i = 0; i < 4; i++) { v += a * noise(x, y); x = x * 2.02 + 3.1; y = y * 2.02 + 1.7; a /= 2; } return v; };
  const c = FLOW[level].map(rgb), s = level === 3 ? pull.map((p, i) => p * [1, 1.5, 0.7, 0.55][i]) : pull;
  const at = level === 3 ? spots.map((p, i) => i < 2 ? p : p.map((v) => v < 0.5 ? v - 0.25 : v + 0.25)) : spots;
  if (dark) { c[0] = c[1].map((x) => x * 0.16 + 0.02); }
  const can = document.createElement("canvas");
  can.width = w; can.height = h;
  const ctx = can.getContext("2d"), img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let px = ((x + 0.5) / w - 0.5) * asp, py = 0.5 - (y + 0.5) / h;
      const qx = px * 1.6, qy = py * 1.6, wx = fbm(qx + T * 0.07, qy - T * 0.05) - 0.5, wy = fbm(qx + 5.2 - T * 0.06, qy + 1.3 + T * 0.08) - 0.5;
      px += wx * 0.4; py += wy * 0.4;
      let sum = [0, 0, 0], total = 0;
      for (let i = 0; i < 4; i++) {
        const dx = px - (at[i][0] - 0.5) * asp, dy = py - (0.5 - at[i][1]), k = s[i] / Math.pow(dx * dx + dy * dy + 0.015, 2.2);
        total += k;
        for (let j = 0; j < 3; j++) { sum[j] += c[i][j] * k; }
      }
      sum = sum.map((v) => dark ? v / total * 0.68 : v / total * 0.9 + 0.1);
      const g = 0.2126 * sum[0] + 0.7152 * sum[1] + 0.0722 * sum[2];
      for (let j = 0; j < 3; j++) { img.data[(y * w + x) * 4 + j] = (g + (sum[j] - g) * 1.1) * 255; }
      img.data[(y * w + x) * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return flowCache[key] = can.toDataURL();
}
function paintFlow(el, level) {
  const dark = el.dataset.dark === "1" || darkMode.matches, key = level + "" + dark;
  if (el.dataset.key === key) { return; }
  el.dataset.key = key;
  const layer = document.createElement("div");
  layer.style.backgroundImage = `url(${flowImage(el.dataset.flow, level, dark)})`;
  el.append(layer);
  const old = [...el.children].slice(0, -1);
  if (!old.length || still.matches) { old.forEach((o) => o.remove()); return; }
  layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 520, easing: "cubic-bezier(.25, .1, .25, 1)" }).onfinish = () => old.forEach((o) => o.remove());
}
/// One day on the widgets, the watch and the Lock Screen.
function showWidgets(day) {
  const s = { ...day, peakText: "Kp " + day.peak, windText: day.wind + " km/s", bzText: minus(day.bz) + " nT" };
  for (const el of document.querySelectorAll("[data-w]")) { put(el, s[el.dataset.w]); }
  for (const el of document.querySelectorAll("[data-flow]")) { paintFlow(el, day.level); }
  for (const el of document.querySelectorAll("[data-ring2]")) { el.style.setProperty("--k", day.kp / 9); el.style.color = ["#8fd457", "#4bc6ff", "#ff9d2e", "#ff5fc0"][day.level]; }
  for (const el of document.querySelectorAll("[data-wchart]")) {
    const lo = Math.min(...day.curve) - 0.3, hi = Math.max(...day.curve) + 0.3;
    const P = day.curve.map((v, i) => [-10 + i / 23 * 384, 23 + (1 - (v - lo) / (hi - lo)) * 25]), path = (a, b) => "M" + P.slice(a, b + 1).map((p) => p.map((n) => n.toFixed(1)).join(" ")).join("L");
    const [next, past] = el.querySelectorAll("path");
    next.setAttribute("d", path(11, 23)); past.setAttribute("d", path(0, 11));
    el.style.setProperty("--x", P[11][0] / 364 * 100 + "%"); el.style.setProperty("--y", P[11][1] / 52 * 100 + "%");
  }
}

// ---- Alerts and chat: small loops ----

const NOTES = [["Strong magnetic storm", "Aurora may be seen farther from the poles than usual. GPS and radio may be less accurate."], ["Earthquake near you", "Magnitude 4.8, near Grindavík, Iceland."], ["Aurora possible tonight", "Look north after dark, away from city lights. Best if the sky is clear."], ["Strong solar flare", "Short radio blackouts are possible on the sunlit side of Earth."]];
const NEAR = [["Freyja", "Grindavík", "Did anyone feel that just now?"], ["Óskar", "Reykjavík", "Yes! The lamp was swinging."], ["", "", "4.8, not far from us. It is on the map."], ["Birta", "Keflavík", "The dog woke up before it."], ["Freyja", "Grindavík", "Look north, the sky is green"], ["", "", "Going outside!"], ["Óskar", "Reykjavík", "Clouds here. Enjoy it for me."]];
const WORLD = [["Mateo", "Santiago", "Small one here an hour ago. Nobody else woke up."], ["Yuki", "Sapporo", "Kp 4 already? I have had a headache all day."], ["Amara", "Nairobi", "Nothing here, only a beautiful sunset."], ["Ingrid", "Tromsø", "The aurora is dancing. I wish you all could see it."], ["", "", "Send us some of that sky!"], ["Liam", "Dunedin", "Aurora australis tonight too!"], ["Noor", "Amman", "Slept badly again. Is it the storm or the coffee?"], ["Chloé", "Lyon", "Coffee. But I check the Kp first too."], ["Kenji", "Osaka", "M5.1 off the coast. All fine here."]];
const ROOMS = [{ name: "Reykjavík area · 12 online", talk: NEAR }, { name: "World · 214 online", talk: WORLD }];
let room = 1, said = 0;
function openRoom(i) {
  room = i; said = 0;
  document.querySelectorAll("#chat .segments button").forEach((b, k) => b.setAttribute("aria-pressed", k === i));
  document.querySelector("#chat .thumb").style.transform = `translateX(${i * 100}%)`;
  put(document.querySelector("#room"), ROOMS[i].name);
  document.querySelector(".bubbles").replaceChildren();
  for (let k = 0; k < 5; k++) { say(true); }
}
function note(i) {
  for (const box of document.querySelectorAll(".notes")) {
    const [t, b] = NOTES[i % NOTES.length], el = document.createElement("div"), old = box.firstElementChild;
    el.className = "note";
    el.innerHTML = `<img src="img/icon.png" alt=""><div><b>${t}</b><p>${b}</p></div><time>now</time>`;
    box.append(el);
    if (!old || still.matches) { old?.remove(); continue; }
    old.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.92)" }], { duration: 260, easing: "ease-in", fill: "forwards" }).onfinish = () => old.remove();
    el.animate([{ opacity: 0, transform: "translateY(120%) scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 520, delay: 90, fill: "backwards", easing: "cubic-bezier(.16, 1.15, .3, 1)" });
  }
}
function say(quiet) {
  const box = document.querySelector(".bubbles"), talk = ROOMS[room].talk, [who, from, text] = talk[said++ % talk.length], el = document.createElement("div");
  el.className = who ? "bub" : "bub mine";
  el.innerHTML = (who ? `<small>${who} · ${from}</small>` : "") + `<span>${text}</span>`;
  box.append(el);
  while (box.children.length > 8) { box.firstElementChild.remove(); }
  if (!quiet && !still.matches) {
    const h = el.offsetHeight + 10;
    box.animate([{ transform: `translateY(${h}px)` }, { transform: "none" }], { duration: 460, easing: "cubic-bezier(.2, .9, .25, 1)" });
    el.animate([{ opacity: 0, transform: "scale(.86)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: "cubic-bezier(.2, 1.2, .3, 1)" });
  }
}

// ---- What the screens show ----

const view = { curve: DAYS[0].curve.slice() };
function showScreens(day) {
  const s = { ...day, bz: minus(day.bz) + " nT" };
  for (const el of document.querySelectorAll("[data-d]")) { put(el, s[el.dataset.d]); }
  for (const el of document.querySelectorAll("[data-ring]")) { el.style.setProperty("--k", clamp(day.kp / 9, 0, 1)); }
  for (const el of document.querySelectorAll("[data-sun]")) { el.classList.toggle("on", +el.dataset.sun === day.level); }
}
const charts = [...document.querySelectorAll("[data-chart]")];
let chartsStill = 0;
function stepCharts(dt, to, force) {
  let move = 0;
  const f = force ? 1 : 1 - Math.exp(-dt * 6);
  for (let i = 0; i < 24; i++) { const d = (to[i] - view.curve[i]) * f; view.curve[i] += d; move = Math.max(move, Math.abs(d)); }
  if (move < 0.0005 && chartsStill > 2 && !force) { return; }
  chartsStill = move < 0.0005 ? chartsStill + 1 : 0;
  for (const c of charts) { drawChart(c, view.curve); }
}
// The halves follow every change of the frame's size (a late style sheet, a turn of the phone).
const foldWatch = new ResizeObserver(() => foldScreens());
document.querySelectorAll(".dev.fold").forEach((el) => foldWatch.observe(el));
