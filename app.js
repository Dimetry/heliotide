// The app's screens and widgets, built for the page: the same layouts, words and colours as in the app.
"use strict";

/// Example days: the same samples as in the app's widget gallery.
const DAYS = [
  { level: 0, kp: 2, state: "Space weather is quiet now", feel: "Most people will not feel anything", condition: "Quiet space weather", watch: "Calm next 24 hours", outlook: "Calm", peak: 3, flare: "B6.2", m: "5%", x: "1%", flareWord: "Low", wind: 362, windWord: "Calm", bz: 1, field: "Calm", radio: "Normal", radiation: "Normal",
    curve: [1.33, 1.33, 0.67, 1.67, 1.33, 1.33, 0.67, 0.67, 1.33, 1.67, 1.67, 2, 1.67, 1.67, 1.67, 1.33, 1.67, 2.33, 2.33, 1.33, 0.67, 1.33, 2, 2.33] },
  { level: 1, kp: 4, state: "Space weather is active now", feel: "Some people may notice it", condition: "Active space weather", watch: "Storm tomorrow", outlook: "Storm expected", peak: 5, flare: "C4.1", m: "25%", x: "5%", flareWord: "Moderate", wind: 468, windWord: "Raised", bz: -6, field: "Unsettled", radio: "Normal", radiation: "Normal",
    curve: [2, 1.33, 1.33, 2.67, 2.33, 3.33, 2, 3.67, 3, 2.67, 3.67, 4, 4.33, 4, 3.33, 4.67, 3.67, 3, 3.33, 2.33, 2.67, 1.67, 2, 1.67] },
  { level: 2, kp: 6, state: "Magnetic storm now", feel: "Some people may feel a bit off", condition: "Magnetic storm", watch: "Storm possible", outlook: "Storm expected", peak: 6, flare: "M1.8", m: "55%", x: "15%", flareWord: "Medium", wind: 612, windWord: "High", bz: -14, field: "Stormy", radio: "Minor issues", radiation: "Normal",
    curve: [1.67, 2.33, 2, 3.33, 2.67, 4.33, 3.33, 5, 4.67, 6.33, 5.33, 6, 5.67, 6.33, 5, 4.33, 4.67, 3.33, 3.67, 2.67, 3, 2, 2.33, 1.67] },
  { level: 3, kp: 8, state: "Severe magnetic storm now", feel: "Some people may sleep lighter", condition: "Severe magnetic storm", watch: "Storm today", outlook: "Storm expected", peak: 8, flare: "X2.1", m: "85%", x: "40%", flareWord: "Strong", wind: 925, windWord: "High", bz: -32, field: "Stormy", radio: "Disrupted", radiation: "Raised",
    curve: [2.33, 3, 2.67, 4, 5.33, 4.67, 6.67, 6, 7.67, 8.33, 7.33, 8, 8.67, 7.33, 7.67, 6, 6.33, 5, 4.33, 4.67, 3.33, 3.67, 2.67, 2.33] }
];
const minus = (v) => v < 0 ? "−" + -v : "" + v;

// ---- Text that changes softly ----

/// The old word blurs away upwards while the new one comes out of the blur from below, both at once.
function put(el, text) {
  text = String(text);
  if (el.dataset.text === text) { return; }
  const before = el.dataset.text;
  el.dataset.text = text;
  const box = el.getBoundingClientRect();
  if (before === undefined || still.matches || !el.animate || box.bottom < -60 || box.top > innerHeight + 60 || box.right < 0 || box.left > innerWidth) { el.textContent = text; return; }
  const fresh = document.createElement("span"), ghost = document.createElement("span");
  fresh.textContent = text;
  ghost.textContent = before;
  ghost.className = "ghost";
  el.classList.add("swap");
  el.replaceChildren(fresh, ghost);
  const big = text.length <= 3, blur = big ? 10 : 5, way = big ? ".22em" : ".35em";
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
  left: '<path d="M14.500 5 7.500 12l7 7"/>', right: '<path d="m9.500 5.500 6.500 6.500-6.500 6.500"/>', up: '<path d="m4.500 15.500 7.500-7 7.500 7"/>', down: '<path d="m4.500 8.500 7.500 7 7.500-7"/>',
  wave: '<path d="M2.500 12h2.200l1.300-4 2 9 2-13 2.200 17 2-13 2 9 1.300-5h2"/>', info: '<circle cx="12" cy="12" r="9.300"/><path d="M12 11v5.600M12 7.300v.2"/>',
  flare: '<circle cx="10" cy="11" r="4"/><path d="M10 2.800v2M10 17.200v2M1.800 11h2M4.200 5.200l1.400 1.400M4.200 16.800l1.400-1.400M15.800 5.200l-1.400 1.400M17 13.500l4.200 7.200h-8.400Z"/>',
  wind: '<path d="M2.500 9h11a2.700 2.700 0 1 0-2.700-2.700M2.500 12.500h16a2.700 2.700 0 1 1-2.700 2.700M2.500 16h8.500a2.400 2.400 0 1 1-2.400 2.400"/>',
  aurora: '<path d="M12 4.500l1.500 3.800 3.800 1.500-3.800 1.500L12 15l-1.500-3.700-3.800-1.500 3.800-1.500ZM18.500 14.500l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8ZM5.500 15.500l.6 1.500 1.500.6-1.500.6-.6 1.500-.6-1.500-1.500-.6 1.500-.6Z"/>',
  quake: '<path d="M2.500 12h4l2-6 3.500 13 3-10 1.500 3h5"/>', fire: '<path d="M12 3c.5 3.500 5.500 5.500 5.500 10.500A5.500 5.500 0 0 1 12 20a5.500 5.500 0 0 1-5.500-6C6.500 11 8.500 9.500 9 7.500c1.500.8 2 2 2 3C12.500 9 12.500 6 12 3Z"/>',
  gauge: '<circle cx="12" cy="12" r="9"/><path d="M12 12l3.500-4.500"/><circle cx="12" cy="12" r="1.200"/>', cloud: '<path d="M7 18a4 4 0 0 1-.3-8A5.500 5.500 0 0 1 17 9.500 4 4 0 0 1 17.500 18Z"/>', bell: '<path d="M6 16.500V11a6 6 0 0 1 12 0v5.500l1.500 1.500h-15ZM10 20a2 2 0 0 0 4 0"/>',
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
  face: () => `<div class="scr watchface" data-tone="dark"><div class="wf-top"><div class="ring" data-ring2><span data-w="kp"></span><small>Kp</small></div><div class="wf-time"><span>TUE 24</span>9:41</div></div><div class="wf-rect"><b data-w="condition"></b><span data-w="watch"></span><div class="chart" data-wchart><svg viewBox="0 0 364 52" preserveAspectRatio="none"><path class="ahead"/><path/></svg><i></i></div></div></div>`,
  lock: () => `<div class="scr lock" data-tone="dark"><div class="wall"><picture><source media="(prefers-color-scheme: dark)" srcset="img/wall-dark.jpg"><img src="img/wall-light.jpg" alt="" loading="lazy"></picture></div><div class="date">Wednesday, 25 November</div><div class="clock">9:41</div><div class="notes"></div><span class="torch l"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2.500h8a.8.8 0 0 1 .8.8v1.200H7.200V3.300a.8.8 0 0 1 .8-.8ZM7.200 6h9.600v.6c0 1.700-.7 2.600-1.400 3.500-.4.5-.6 1-.6 1.700v8.500a1.700 1.700 0 0 1-1.700 1.700h-2.200a1.700 1.700 0 0 1-1.700-1.700v-8.500c0-.7-.2-1.200-.6-1.700C7.900 9.200 7.200 8.300 7.200 6.600Zm4.800 6.600a1 1 0 0 0-1 1v1.600a1 1 0 0 0 2 0v-1.600a1 1 0 0 0-1-1Z" fill-rule="evenodd"/></svg></span><span class="torch r"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.300 4h5.400c.5 0 .9.200 1.200.6l1 1.500h2.500A2.600 2.600 0 0 1 22 8.700v8.700a2.600 2.600 0 0 1-2.600 2.600H4.600A2.600 2.600 0 0 1 2 17.400V8.700a2.600 2.600 0 0 1 2.600-2.600h2.500l1-1.500c.3-.4.7-.6 1.200-.6ZM12 8.200a4.600 4.600 0 1 0 0 9.200 4.600 4.600 0 0 0 0-9.200Zm0 1.800a2.800 2.800 0 1 1 0 5.600 2.800 2.800 0 0 1 0-5.600Z" fill-rule="evenodd"/></svg></span><i class="homebar"></i></div>`,
  chat: () => `<div class="scr chatapp"><canvas data-bg="chat"></canvas>${status_}<span class="round l">${icon("left")}</span><div class="ctitle"><b>Chat <i>BETA</i></b><span id="room"></span></div><span class="round r">${icon("globe")}</span><div class="bubbles"></div><div class="field"><span>Message</span><em><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5.500M6 11.500l6-6 6 6"/></svg></em></div></div>`
};
for (const el of document.querySelectorAll("[data-screen]")) { el.innerHTML = SCREENS[el.dataset.screen](); }
// Frames: Apple's product bezels (Apple Design Resources).
for (const el of document.querySelectorAll(".dev")) {
  if (el.classList.contains("phone")) { el.insertAdjacentHTML("beforeend", '<img class="frame" src="img/frame-phone.png" alt="" draggable="false">'); }
  if (el.classList.contains("clock_")) { el.insertAdjacentHTML("beforeend", '<img class="frame" src="img/frame-watch.png" alt="" draggable="false">'); }
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
  // A second widget shows another day, so two of them never look the same.
  const of = (el) => DAYS[(day.level + Number(el.closest("[data-shift]")?.dataset.shift ?? 0)) % 4];
  for (const el of document.querySelectorAll("[data-w]")) { put(el, of(el)[el.dataset.w]); }
  for (const el of document.querySelectorAll("[data-flow]")) { paintFlow(el, of(el).level); }
  for (const el of document.querySelectorAll("[data-ring]")) { el.style.setProperty("--k", day.kp / 9); }
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

const NOTES = [["Strong magnetic storm", "Kp 7 now. Aurora may be seen far from the poles."], ["Earthquake near you", "Magnitude 4.8, near Grindavík, Iceland."], ["Aurora possible tonight", "Look north after dark, away from city lights."], ["Strong solar flare", "X2.1. Short radio blackouts are possible."]];
const NEAR = [["Freyja", "Grindavík", "Did anyone feel that just now?"], ["Óskar", "Reykjavík", "Yes! The lamp was swinging."], ["", "", "4.8, not far from us. It is on the map."], ["Birta", "Keflavík", "The dog woke up before it."], ["Freyja", "Grindavík", "Look north, the sky is green"], ["", "", "Going outside!"], ["Óskar", "Reykjavík", "Clouds here. Enjoy it for me."]];
const WORLD = [["Mateo", "Santiago", "Small one here an hour ago. Nobody else woke up."], ["Yuki", "Sapporo", "Kp 4 already? I have had a headache all day."], ["Amara", "Nairobi", "Nothing here, only a beautiful sunset."], ["Ingrid", "Tromsø", "The aurora is dancing. I wish you all could see it."], ["", "", "Send us some of that sky!"], ["Liam", "Dunedin", "Aurora australis tonight too!"], ["Noor", "Amman", "Slept badly again. Is it the storm or the coffee?"], ["Chloé", "Lyon", "Coffee. But I check the Kp first too."], ["Kenji", "Osaka", "M5.1 off the coast. All fine here."]];
const ROOMS = [{ name: "Reykjavík area · 12 online", talk: NEAR }, { name: "World · 214 online", talk: WORLD }];
let room = 1, said = 0, turnNo = 0;
function openRoom(i) {
  room = i; said = 0; turnNo++;
  document.querySelectorAll("#chat .segments button").forEach((b, k) => b.setAttribute("aria-pressed", k === i));
  document.querySelector("#chat .thumb").style.transform = `translateX(${i * 100}%)`;
  put(document.querySelector("#room"), ROOMS[i].name);
  document.querySelector(".bubbles").replaceChildren();
  fieldText("");
  for (let k = 0; k < 6; k++) { say(true); }
}
function fieldText(t) {
  const f = document.querySelector("#chat .field");
  f.classList.toggle("typing", t !== "");
  f.firstElementChild.textContent = t || "Message";
}
/// The conversation runs by itself, calmly and unevenly, as people write. Others' messages just come in;
/// ours is typed letter by letter, then sent.
async function talkLoop(active) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), some = (a, b) => a + Math.random() * (b - a);
  for (;;) {
    if (!active() || still.matches) { await wait(500); continue; }
    const mine = turnNo, next = ROOMS[room].talk[said % ROOMS[room].talk.length];
    if (next[0]) {
      // Mostly a pause to read, sometimes a quick answer, sometimes a long silence.
      const luck = Math.random();
      await wait(luck < 0.25 ? some(1100, 1700) : luck < 0.8 ? some(2300, 3700) : some(4200, 5600));
      if (mine === turnNo && active()) { say(); }
    } else {
      await wait(some(1500, 2400));
      for (let n = 1; n <= next[2].length && mine === turnNo; n++) {
        fieldText(next[2].slice(0, n));
        const c = next[2][n - 1];
        await wait(/[.,!?]/.test(c) ? some(220, 380) : c === " " ? some(110, 190) : some(55, 125));
      }
      await wait(some(550, 900));
      if (mine === turnNo) { fieldText(""); say(); }
    }
  }
}

/// A new alert comes in on top of the list; the others move down, the third one leaves.
function note(i) {
  for (const box of document.querySelectorAll(".notes")) {
    const [t, b] = NOTES[i % NOTES.length], el = document.createElement("div"), before = new Map([...box.children].map((c) => [c, c.offsetTop]));
    el.className = "note";
    el.innerHTML = `<img src="img/icon.png" alt=""><div><b>${t}</b><p>${b}</p></div><time>now</time>`;
    box.prepend(el);
    const old = box.children[2];
    for (const c of [...box.children].slice(1, 2)) { c.querySelector("time").textContent = "2m ago"; }
    if (!box.animate || still.matches || !before.size) { old?.remove(); continue; }
    if (old) {
      // It leaves from where it stands, under the others.
      const ghost = old.cloneNode(true);
      Object.assign(ghost.style, { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: -1 });
      old.remove();
      box.append(ghost);
      ghost.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(30%) scale(.9)" }], { duration: 420, easing: "cubic-bezier(.4, 0, .6, 1)", fill: "forwards" }).onfinish = () => ghost.remove();
    }
    const spring = "cubic-bezier(.22, 1.22, .36, 1)", grown = el.offsetHeight + parseFloat(getComputedStyle(box).rowGap || 0);
    for (const c of box.children) { if (before.has(c) && c !== el && c.style.position !== "absolute") { c.animate([{ transform: `translateY(${-grown}px)` }, { transform: "none" }], { duration: 760, easing: spring }); } }
    el.animate([{ opacity: 0, transform: "translateY(-46%) scale(.86)", filter: "blur(8px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: 760, easing: spring });
  }
}
function addBubble(el, quiet) {
  const box = document.querySelector(".bubbles");
  box.append(el);
  while (box.children.length > 10) { box.firstElementChild.remove(); }
  if (quiet || still.matches) { return; }
  const h = el.offsetHeight + 10, mine = el.classList.contains("mine"), soft = "cubic-bezier(.22, 1, .36, 1)";
  box.animate([{ transform: `translateY(${h}px)` }, { transform: "none" }], { duration: 720, easing: soft });
  el.style.transformOrigin = mine ? "100% 100%" : "0 100%";
  el.animate([{ opacity: 0, transform: mine ? "translateY(26%) scale(.92)" : "translateY(8%) scale(.95)" }, { opacity: 1, transform: "none" }], { duration: 760, easing: soft });
}
function say(quiet) {
  const talk = ROOMS[room].talk, [who, from, text] = talk[said++ % talk.length], el = document.createElement("div");
  el.className = who ? "bub" : "bub mine";
  el.innerHTML = (who ? `<small>${who} · ${from}</small>` : "") + `<span>${text}</span>`;
  addBubble(el, quiet);
}

// ---- What the screens show ----

const view = { curve: DAYS[0].curve.slice() };
function showScreens(day) {
  const s = { ...day, bz: minus(day.bz) + " nT" };
  for (const el of document.querySelectorAll("[data-d]")) { put(el, s[el.dataset.d]); }
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

// ---- The cards of Today ----

const tick = Array.from({ length: 60 }, (_, i) => { const t = (i * 6 - 90) * Math.PI / 180; return i > 27 && i < 33 ? "" : `<line x1="${(50 * Math.cos(t)).toFixed(1)}" y1="${(50 * Math.sin(t)).toFixed(1)}" x2="${(44 * Math.cos(t)).toFixed(1)}" y2="${(44 * Math.sin(t)).toFixed(1)}"/>`; }).join("");
const head = (i, t) => `<div class="head">${icon(i)}${t}</div>`;
document.querySelector("#bento").innerHTML = `
  <article class="tile t-sun">${head("flare", "SOLAR FLARES")}<p class="big">B1.4 <b>Low</b></p><div class="pic" data-tone="dark"><video id="sunfilm" src="img/sun.mp4" poster="img/sun3.jpg" muted loop playsinline preload="none" aria-label="The Sun turning, seen by NASA SDO"></video></div><p class="cap_"><b>304 Å · Flares and filaments</b><span>NASA SDO</span></p></article>
  <article class="tile t-aur">${head("aurora", "AURORA")}<p class="big">34 % <b>tonight</b></p><div class="pic" data-tone="dark"><img src="https://services.swpc.noaa.gov/images/animations/ovation/north/latest.jpg" alt="Aurora over the northern hemisphere, live from NOAA" referrerpolicy="no-referrer" loading="lazy" draggable="false"><canvas id="aurorafilm" width="560" height="560" style="opacity:0"></canvas></div><p class="cap_"><b>Last 24 hours, live</b><span>NOAA SWPC</span></p></article>
  <article class="tile"><div class="relief"></div>${head("quake", "EARTHQUAKES")}<div class="pinn quake" aria-hidden="true"><i></i><i></i><i></i><b>4.6</b></div><p class="mid">3 near you</p><p class="small_">Closest: M4.6, 320 km away</p></article>
  <article class="tile"><div class="relief two"></div>${head("fire", "WILDFIRES")}<div class="pinn fire" aria-hidden="true"><i></i><i></i><b>${icon("fire")}</b></div><p class="mid">2 near you</p><p class="small_">Closest: 84 km away</p></article>
  <article class="tile">${head("sun", "UV INDEX")}<p class="big"><span id="uv">3</span> <b id="uvw">Moderate</b></p><div class="scale"><i id="uvdot"></i></div><p class="small_" style="margin-top:auto">Clear sky: up to 4 at 13:00.</p></article>
  <article class="tile t-press">${head("gauge", "PRESSURE")}<div class="dial"><svg viewBox="-56 -56 112 112" aria-hidden="true">${tick}<line id="needle" class="needle" x1="0" y1="-52" x2="0" y2="-40"/></svg><p><span id="hpa">1015</span><small>hPa</small></p></div></article>
  <article class="tile t-wide">${head("cloud", "WEATHER")}<p class="big">8° <b>Rain</b></p><div class="hours">${["Now", "14", "15", "16", "17", "18", "19", "20"].map((t, i) => `<div><b>${t}</b><svg class="wx" viewBox="0 0 32 32" aria-hidden="true"><path d="M9 20a5.500 5.500 0 0 1-.4-11A7.500 7.500 0 0 1 23 10.500 4.800 4.800 0 0 1 23.500 20Z"/>${i < 5 ? '<g><path d="M11 23l-1.500 4M16 23l-1.500 4M21 23l-1.500 4"/></g>' : ""}</svg><span>${[90, 84, 80, 62, 40, 20, 10, 5][i]}%</span><b>${[8, 8, 9, 9, 8, 8, 7, 7][i]}°</b></div>`).join("")}</div></article>
  <article class="tile t-wide">${head("bell", "ALERTS")}<div class="rows_">${[["Magnetic storm", "", "Calm"], ["Radio", "", "Calm"], ["Radiation", "", "Calm"], ["Solar wind", "353 km/s", "Calm"]].map(([l, n, w]) => `<div><span>${l}</span><small${l === "Solar wind" ? ' id="tw"' : ""}>${n}</small><b>${w}</b></div>`).join("")}</div></article>`;
// The cards rise one after another.
document.querySelectorAll("#bento .tile").forEach((e, i) => { e.classList.add("soft"); e.style.setProperty("--d", (i % 4) * 0.07 + "s"); });
let todayStep = 0;
/// One small change at a time, slowly.
function stepToday() {
  todayStep++;
  const p = [1015, 1004, 988, 996, 1021, 1034, 1027, 1009][todayStep % 8];
  put(document.querySelector("#hpa"), p);
  document.querySelector("#needle").style.transform = `rotate(${(p - 1013) * 4.6}deg)`;
  if (todayStep % 2) { const u = [3, 5, 8, 4, 2][(todayStep >> 1) % 5]; put(document.querySelector("#uv"), u); put(document.querySelector("#uvw"), u < 3 ? "Low" : u < 6 ? "Moderate" : "Very high"); document.querySelector("#uvdot").style.left = u / 11 * 100 + "%"; }
}
