"use strict";
const $ = (q) => document.querySelector(q);
const still = matchMedia("(prefers-reduced-motion: reduce)");
const darkMode = matchMedia("(prefers-color-scheme: dark)");
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mix = (a, b, k) => a + (b - a) * k;
const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
