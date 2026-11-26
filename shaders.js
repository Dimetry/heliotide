// WebGL versions of the app's Metal shaders: the clouds of the background and the orb of the app icon.
"use strict";

const VERTEX = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const CLOUDS = `
precision highp float;
uniform vec2 size;
uniform float time, energy;
uniform vec3 cMain, cLow, cMid, cHigh;

float hash2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float hash3(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
}
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p), u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float v = mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), u.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), u.x), u.y),
                mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), u.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), u.x), u.y), u.z);
  return v * 2.0 - 1.0;
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = vec2(0.8775826 * p.x - 0.4794255 * p.y, 0.4794255 * p.x + 0.8775826 * p.y) * 2.0 + 100.0;
    a *= 0.5;
  }
  return v;
}
vec3 burn(vec3 base, vec3 blend, float amount) { return mix(base, max(base + blend - 1.0, 0.0), amount); }

float cloudHeight(vec2 u, float t) {
  return u.y;
}

vec3 cloudPaint(vec2 uv, out float sky) {
  float t = time * 0.7;
  uv += vec2(noise3(vec3(uv + vec2(0.0, 74.86), t * 0.3)) * 2.0, noise3(vec3(uv + vec2(203.9, 10.0), t * 0.3))) * 0.18;
  float rip = noise3(vec3(uv * 18.0 + vec2(344.9, 0.0), t * 0.3)) + noise3(vec3(uv * 40.0 + vec2(723.9, 0.0), t * 0.4)) * 0.5;
  uv += rip * 0.01;
  uv.y -= 0.075 + 0.11 * energy;

  float dm = sin(t) * 0.5 + 0.5;
  vec2 d = uv * 3.0;
  float d0 = (mix(noise(d), noise(d.yx + 17.0), dm) - 0.5) * 0.15;
  float d1 = (mix(noise(d + 63.9), noise(d.yx + 368.9), dm) - 0.5) * 0.15;
  float d3 = (mix(noise(d + 453.2), noise(d.yx + 1649.8), dm) - 0.5) * 0.15;
  uv += d0;

  vec2 s = uv * 1.25;
  float wind = 0.12 + energy * 0.1;
  vec2 q = vec2(fbm(s * 0.5 + wind * t));
  vec2 rr = vec2(fbm(s + q + vec2(0.3, 9.2) + 0.15 * t), fbm(s + q + vec2(8.3, 0.8) + 0.126 * t));
  float f = fbm(s + rr - q);
  float body = pow((f + 0.6 * f * f + 0.7 * f + 0.5) * 0.5, 0.55) * (1.2 + energy * 0.1);

  float spread = 1.0 + energy * 0.3, blur = 1.5;
  vec2 u1 = uv + (body - 0.5) * 1.2 + vec2(0.0, 0.025) + d0;
  float n1 = noise(u1 * 2.0 + vec2(0.0, t * 0.5));
  n1 = n1 * n1 * 3.0;
  float l1 = smoothstep(n1 - 1.2 * blur, n1 + 1.2 * blur, (cloudHeight(u1, t) - 0.5 * spread) * 5.0 + 0.5);
  vec2 u2 = uv + (body - 0.5) * 0.85 + vec2(0.0, 0.025) + d1;
  float n2 = noise(u2 * 4.0 + vec2(293.0, t));
  n2 = n2 * n2 * 2.8;
  float l2 = smoothstep(n2 - 0.9 * blur, n2 + 0.9 * blur, (cloudHeight(u2, t) - 0.6 * spread) * 5.0 + 0.5);
  vec2 u3 = uv + (body - 0.5) * 1.1 + d3;
  float n3 = noise(u3 * 6.0 + vec2(153.0, t * 1.2));
  n3 = n3 * n3 * 2.6;
  float l3 = smoothstep(n3 - 0.7 * blur, n3 + 0.7 * blur, (cloudHeight(u3, t) - 0.9 * spread) * 6.0 + 0.5);
  l1 = pow(l1, 0.8);
  l2 = pow(l2, 0.9);

  vec3 col = burn(cMain, cLow, 1.0 - l1);
  col = burn(col, mix(cMain, cMid, 1.0 - l2), l1);
  col = mix(col, mix(cMain, cHigh, 1.0 - l3), l1 * l2);
  col = mix(col, cHigh, energy * 0.1);
  sky = l1 * l2 * l3;
  return col;
}
`;

const FIELD = CLOUDS + `
uniform float zoom, lift, dark;
uniform vec3 deep, dmid, glow, skyShift;

vec3 cloudDark(vec3 col) {
  const vec3 W = vec3(0.2126, 0.7152, 0.0722);
  float lo = dot(max(cMain + cLow - 1.0, 0.0), W), hi = dot(cHigh, W);
  float t = smoothstep(0.0, 1.0, clamp((dot(col, W) - lo) / max(hi - lo, 0.05), 0.0, 1.0));
  return t < 0.5 ? mix(deep, dmid, t * 2.0) : mix(dmid, glow, (t - 0.5) * 2.0);
}
void main() {
  // gl_FragCoord already has y up, as the clouds need it.
  vec2 uv = vec2((gl_FragCoord.x - size.x * 0.5) / size.y * zoom + 0.5,
                 (gl_FragCoord.y / size.y - lift) * zoom - (zoom - 1.0) * 0.5);
  float sky;
  vec3 col = clamp(cloudPaint(uv, sky), 0.0, 1.0);
  if (dark > 0.5) { col = cloudDark(col) + skyShift * sky; }
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const ORB = CLOUDS + `
uniform vec2 roll;
void main() {
  float side = min(size.x, size.y);
  vec2 st = (vec2(gl_FragCoord.x, size.y - gl_FragCoord.y) - size * 0.5) / side;
  float ang = atan(st.y, st.x);
  float wob = sin(ang * 3.0 + time * 1.6) * 0.55 + sin(ang * 5.0 - time * 2.2 + 1.3) * 0.3;
  float radius = 0.48 * (1.0 + wob * (0.003 + energy * 0.012));
  float shape = 1.0 - smoothstep(-0.8 / side, 0.8 / side, length(st) - radius);
  if (shape <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec2 disc = st / radius;
  float r = clamp(length(disc), 0.0001, 0.9999);
  // The clouds lie on the ball and really turn with it, all the way round: the point under this pixel, turned back.
  float front = sqrt(1.0 - r * r);
  vec3 b = vec3(disc.x, -disc.y, front);
  float cp = cos(roll.y), sp = sin(roll.y), cw = cos(roll.x), sw = sin(roll.x);
  b = vec3(b.x, b.y * cp - b.z * sp, b.y * sp + b.z * cp);
  b = vec3(b.x * cw - b.z * sw, b.y, b.x * sw + b.z * cw);
  float rr_ = clamp(length(b.xy), 0.0001, 0.9999);
  vec2 p = b.xy * mix(1.0, asin(rr_) / (rr_ * 1.5707963), 0.45);
  p.x += 1.25 * (1.0 - smoothstep(-0.5, 0.5, b.z));     // the back has other clouds
  p.y += 0.3 * (1.0 - smoothstep(-0.6, 0.4, b.z));
  float tw = energy * 0.8 * (1.0 - smoothstep(0.0, 1.0, r));
  p = vec2(cos(tw) * p.x - sin(tw) * p.y, sin(tw) * p.x + cos(tw) * p.y);
  vec2 uv = p * 0.52 * mix(1.05, 0.95, energy) + 0.5;
  float sky;
  vec3 col = cloudPaint(uv, sky);

  float z = sqrt(1.0 - r * r);
  vec3 n = vec3(disc.x, -disc.y, z);
  col *= mix(0.88, 1.06, clamp(dot(n, normalize(vec3(-0.42, 0.62, 0.66))), 0.0, 1.0));
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = clamp(mix(vec3(lum), col, 1.18), 0.0, 1.0);
  col = mix(col, cHigh, (1.0 - smoothstep(0.0, 0.9, r)) * (0.05 + energy * 0.3));
  float rim = pow(1.0 - z, 3.2) * 0.6;
  float pool = smoothstep(0.62, 0.98, r) * smoothstep(0.2, 0.9, -n.y) * 0.2;
  vec3 R = vec3(2.0 * n.z * n.x, 2.0 * n.z * n.y, 2.0 * n.z * n.z - 1.0);
  vec3 W = normalize(vec3(-0.12, 0.95, 0.3));
  vec3 ax = normalize(vec3(W.z, 0.0, -W.x));
  vec3 ay = cross(W, ax);
  float facing = dot(R, W);
  vec2 luv = vec2(dot(R, ax), dot(R, ay)) / max(facing, 0.05);
  float box = (1.0 - smoothstep(0.5, 1.4, abs(luv.x))) * (1.0 - smoothstep(0.1, 0.5, abs(luv.y))) * smoothstep(0.15, 0.6, facing);
  col += cHigh * (rim + pool) + box * mix(0.35, 1.0, 0.08 + 0.92 * pow(1.0 - z, 4.0)) * 0.22;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0) * shape, shape);
}`;

/// A canvas that one fragment shader fills. Null when WebGL is missing or the shader does not build.
function shaderCanvas(canvas, fragment) {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" });
  if (!gl) { return null; }
  let program, places;
  function build() {
    program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, fragment]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return false; }
      gl.attachShader(program, s);
    }
    gl.bindAttribLocation(program, 0, "p");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(program)); return false; }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    places = {};
    return true;
  }
  if (!build()) { return null; }
  let lost = false;
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; });
  canvas.addEventListener("webglcontextrestored", () => { lost = !build(); });
  return {
    canvas,
    resize(w, h) {
      w = Math.max(8, Math.round(w)); h = Math.max(8, Math.round(h));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    },
    draw(values) {
      if (lost) { return; }
      gl.viewport(0, 0, canvas.width, canvas.height);
      values.size = [canvas.width, canvas.height];
      for (const name in values) {
        if (!(name in places)) { places[name] = gl.getUniformLocation(program, name); }
        const v = values[name], at = places[name];
        if (typeof v === "number") { gl.uniform1f(at, v); }
        else if (v.length === 2) { gl.uniform2f(at, v[0], v[1]); }
        else { gl.uniform3f(at, v[0], v[1], v[2]); }
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  };
}
