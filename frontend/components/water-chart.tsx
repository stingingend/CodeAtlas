"use client";

import { useEffect, useRef } from "react";

// The landing page's backdrop: a dependency graph cut into marble and filled
// with water, drawn by one fragment shader. Moving the pointer sends ripples
// across the surface and a click makes a larger one. The files and imports
// shown are an illustration, not a real repository.

type Node = { name: string; at: [number, number]; hub?: boolean };
const NODES: Node[] = [
  { name: "__init__.py", at: [-0.5, 0.06] },
  { name: "serializer.py", at: [0, 0.22], hub: true },
  { name: "signer.py", at: [0.46, 0.02] },
  { name: "encoding.py", at: [-0.2, -0.3] },
  { name: "timed.py", at: [0.32, -0.36] },
  { name: "exc.py", at: [0.02, -0.06] },
];
// importer -> dependency
const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [1, 3],
  [1, 5],
  [4, 2],
  [4, 5],
  [2, 5],
];

const SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uCam;
uniform float uScale;
uniform vec2 uMouse;
uniform float uGlow;
uniform vec4 uRip[10];
uniform vec3 uSplash[3];
uniform vec3 uNode[6];
uniform vec4 uEdge[7];
const float PI = 3.14159265;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * noise(p);
    p = p * 2.03 + vec2(17.3, 9.1);
    a *= 0.5;
  }
  return s;
}

// Height of the water: slow swell, a ring per pointer ripple, a train per click.
float surface(vec2 p) {
  float h = 0.6 * (noise(p * 4.0 + vec2(uTime * 0.22, uTime * 0.17))
                 + noise(p * 7.0 - vec2(uTime * 0.15, -uTime * 0.2)));
  for (int i = 0; i < 10; i++) {
    vec4 r = uRip[i];
    float age = uTime - r.z;
    if (age > 0.0 && age < 5.0) {
      float d = length(p - r.xy);
      float w = d - age * 0.32;
      h += r.w * cos(w * 55.0) * exp(-w * w * 220.0) * exp(-age * 1.1) / (1.0 + d * 2.0);
    }
  }
  for (int i = 0; i < 3; i++) {
    vec3 s = uSplash[i];
    float age = uTime - s.z;
    if (age > 0.0 && age < 7.0) {
      float d = length(p - s.xy);
      float w = d - age * 0.5;
      h += 1.7 * cos(w * 30.0) * exp(-w * w * 26.0) * smoothstep(0.0, 0.08, age) * exp(-age * 0.55) / (1.0 + d * 1.1);
      h -= 1.2 * exp(-d * d * 260.0) * exp(-age * 5.0);
    }
  }
  return h;
}

float caustic(vec2 uv) {
  vec2 p = mod(uv * 6.2831853, 6.2831853) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float t = uTime * 0.5 + 23.0;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - 3.5 / float(n + 1));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005)));
  }
  c = 1.17 - pow(c / 4.0, 1.4);
  return pow(abs(c), 8.0);
}

float fill(float d, float w, float aa) {
  return 1.0 - smoothstep(w - aa, w + aa, d);
}
float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

// The graph: a pool for each file, a channel for each import.
float inlay(vec2 q, float aa) {
  float c = 0.0;
  for (int i = 0; i < 7; i++) c = max(c, fill(seg(q, uEdge[i].xy, uEdge[i].zw), 0.0065, aa));
  for (int i = 0; i < 6; i++) {
    float d = length(q - uNode[i].xy);
    float r = uNode[i].z;
    // the hub is a ring with an island in it; the rest are plain pools
    c = max(c, r > 0.07 ? fill(abs(d - r + 0.018), 0.018, aa) : fill(d, r, aa));
  }
  return clamp(c, 0.0, 1.0);
}

vec3 marble(vec2 q) {
  vec2 w = q * 1.7 + vec2(3.7, 1.3);
  float n = fbm(w + 1.8 * vec2(fbm(w + vec2(1.7, 9.2)), fbm(w + vec2(8.3, 2.8))));
  float strength = smoothstep(0.35, 0.75, fbm(w * 0.6 + 11.0));
  float v = abs(sin((w.x * 0.9 + w.y * 1.6 + n * 4.2) * 1.7));
  float vein = (1.0 - smoothstep(0.0, 0.10, v)) * (0.35 + 0.65 * strength);
  float fine = (1.0 - smoothstep(0.0, 0.05, abs(sin((w.x * 2.3 - w.y * 1.1 + n * 7.0) * 2.3)))) * 0.25 * strength;
  vec3 col = mix(vec3(0.972, 0.970, 0.960), vec3(0.915, 0.922, 0.925), smoothstep(0.3, 0.8, n));
  return mix(col, vec3(0.70, 0.735, 0.76), clamp(vein * 0.6 + fine, 0.0, 1.0));
}

vec3 floorColour(vec2 q, float aa) {
  vec3 col = marble(q);
  float r = length(q);
  float a = atan(q.y, q.x);
  float hair = aa * 1.5;

  // Engraved chart grid and a slowly turning dial around the graph.
  vec2 g1 = abs(fract(q / 0.25 - 0.5) - 0.5) * 0.25;
  float e = (1.0 - smoothstep(0.0, hair, min(g1.x, g1.y))) * 0.28;
  e += 1.0 - smoothstep(0.0, hair, abs(r - 0.70));
  e += 1.0 - smoothstep(0.0, hair, abs(r - 0.735));
  float f1 = fract((a + uTime * 0.03) / (2.0 * PI) * 180.0);
  e += (1.0 - smoothstep(0.08, 0.16, min(f1, 1.0 - f1))) * (smoothstep(0.70 - aa, 0.70 + aa, r) - smoothstep(0.735 - aa, 0.735 + aa, r));
  float f3 = fract((a - uTime * 0.02) / (2.0 * PI) * 72.0);
  e += step(0.5, f3) * (1.0 - smoothstep(0.0, hair, abs(r - 0.83))) * 0.8;
  col = mix(col, vec3(0.52, 0.59, 0.68), clamp(e, 0.0, 1.0) * 0.5);

  // Channels with a shadowed and a lit wall, so they read as cut into the stone.
  vec2 light = vec2(-0.006, 0.008);
  float c = inlay(q, aa);
  float shadow = c * (1.0 - inlay(q + light, aa));
  float lit = c * (1.0 - inlay(q - light, aa));
  vec3 water = mix(vec3(0.36, 0.70, 0.88), vec3(0.16, 0.38, 0.86),
                   smoothstep(0.2, 0.75, fbm(q * 3.0 + uTime * 0.05)));
  col = mix(col, water, c * 0.86);
  col = mix(col, vec3(0.07, 0.20, 0.55), shadow * 0.55);
  col += lit * 0.16;
  return col;
}

void main() {
  float m = min(uRes.x, uRes.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / m;
  vec2 p = uv / uScale + uCam;
  float aa = 1.5 / m / uScale;

  float eps = 0.004 / uScale;
  float h = surface(p);
  float hx1 = surface(p + vec2(eps, 0.0));
  float hx0 = surface(p - vec2(eps, 0.0));
  float hy1 = surface(p + vec2(0.0, eps));
  float hy0 = surface(p - vec2(0.0, eps));
  vec2 g = vec2(hx1 - hx0, hy1 - hy0) / 0.008;
  float lap = (hx1 + hx0 + hy1 + hy0 - 4.0 * h) / 0.000016;

  vec2 q = p + g * 0.0009 / uScale;
  vec3 col = floorColour(q, aa) * vec3(0.905, 0.955, 0.985);

  col += vec3(0.80, 0.95, 1.0) * caustic(q * 2.2 + g * 0.004) * 0.17;
  col += vec3(0.85, 0.95, 1.0) * clamp(-lap * 0.00022, -0.5, 1.4) * 0.11;
  col += clamp(dot(g, vec2(-0.7, 0.7)), -40.0, 40.0) * 0.0016;
  vec3 nrm = normalize(vec3(-g * 0.02, 1.0));
  col += pow(max(dot(nrm, vec3(-0.28, 0.34, 0.90)), 0.0), 140.0) * 0.5;
  float dm = length(p - uMouse) * uScale;
  col += vec3(0.55, 0.75, 1.0) * exp(-dm * dm * 14.0) * 0.07 * uGlow;

  col *= vec3(0.975, 0.992, 1.0);
  gl_FragColor = vec4(col, 1.0);
}`;

export function WaterChart() {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const host = frame.current?.parentElement;
    const view = canvas.current;
    if (!host || !view) return;
    const gl = view.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) {
      frame.current?.classList.add("no-gl");
      return;
    }
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader) || "shader");
      return shader;
    };
    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl.VERTEX_SHADER, "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}"));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, SHADER));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("link");
    } catch {
      frame.current?.classList.add("no-gl");
      return;
    }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const corner = gl.getAttribLocation(program, "a");
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
    const u = (name: string) => gl.getUniformLocation(program, name);
    gl.uniform3fv(u("uNode"), new Float32Array(NODES.flatMap((n) => [...n.at, n.hub ? 0.085 : 0.05])));
    gl.uniform4fv(u("uEdge"), new Float32Array(EDGES.flatMap(([a, b]) => [...NODES[a].at, ...NODES[b].at])));

    const ripples = new Float32Array(10 * 4).fill(-100);
    const splashes = new Float32Array(3 * 3).fill(-100);
    let nextRipple = 0;
    let nextSplash = 0;
    let cam: [number, number] = [0, 0];
    let scale = 1;
    let mouse: [number, number] = [0, 0];
    let glow = 0;
    const eased = { x: 0, y: 0, glow: 0 };
    let last: [number, number, number] = [0, 0, -1];
    const began = performance.now();
    const seconds = () => (still ? 0 : (performance.now() - began) / 1000);
    let width = 1;
    let height = 1;

    // Chart coordinates <-> pixels inside the hero.
    const toChart = (x: number, y: number): [number, number] => {
      const m = Math.min(width, height);
      return [cam[0] + (x - width / 2) / m / scale, cam[1] + (height / 2 - y) / m / scale];
    };
    const toPixels = (cx: number, cy: number): [number, number] => {
      const m = Math.min(width, height);
      return [width / 2 + (cx - cam[0]) * scale * m, height / 2 - (cy - cam[1]) * scale * m];
    };

    function resize() {
      width = host!.clientWidth;
      height = host!.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2.2e6 / (width * height)));
      view!.width = Math.max(1, Math.round(width * ratio));
      view!.height = Math.max(1, Math.round(height * ratio));
      gl!.viewport(0, 0, view!.width, view!.height);
      // Wide screens: the graph sits right of the headline. Narrow: below it.
      const aspect = width / height;
      if (aspect > 1.15) {
        scale = 0.56;
        cam = [-(aspect * 0.5 - 0.47) / scale, 0];
      } else {
        scale = 0.6;
        cam = [0, -(0.5 / aspect - 0.46) / scale];
      }
      NODES.forEach((node, i) => {
        const label = labels.current[i];
        if (!label) return;
        const [x, y] = toPixels(node.at[0], node.at[1] - (node.hub ? 0.085 : 0.05) - 0.03);
        label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translateX(-50%)`;
      });
      if (still) draw();
    }

    function addRipple(x: number, y: number, strength: number) {
      if (still) return;
      ripples.set([x, y, seconds(), strength], nextRipple * 4);
      nextRipple = (nextRipple + 1) % 10;
    }
    const onMove = (event: PointerEvent) => {
      const box = host!.getBoundingClientRect();
      const [x, y] = toChart(event.clientX - box.left, event.clientY - box.top);
      mouse = [x, y];
      glow = 1;
      const now = seconds();
      if (Math.hypot(x - last[0], y - last[1]) > 0.07 || now - last[2] > 0.35) {
        addRipple(x, y, 0.42);
        last = [x, y, now];
      }
    };
    const onDown = (event: PointerEvent) => {
      if (still || (event.target as HTMLElement).closest("a, button")) return;
      const box = host!.getBoundingClientRect();
      splashes.set([...toChart(event.clientX - box.left, event.clientY - box.top), seconds()], nextSplash * 3);
      nextSplash = (nextSplash + 1) % 3;
    };
    const onLeave = () => (glow = 0);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointerleave", onLeave);

    function draw() {
      const t = seconds();
      if (!still && t - last[2] > 1.8) {
        // keep the water moving when nobody is touching it
        const [x, y] = toChart(Math.random() * width, Math.random() * height);
        addRipple(x, y, 0.3);
        last[2] = t - 0.4;
      }
      eased.x += (mouse[0] - eased.x) * 0.18;
      eased.y += (mouse[1] - eased.y) * 0.18;
      eased.glow += (glow - eased.glow) * 0.06;
      gl!.uniform2f(u("uRes"), view!.width, view!.height);
      gl!.uniform1f(u("uTime"), t);
      gl!.uniform2f(u("uCam"), cam[0], cam[1]);
      gl!.uniform1f(u("uScale"), scale);
      gl!.uniform2f(u("uMouse"), eased.x, eased.y);
      gl!.uniform1f(u("uGlow"), eased.glow);
      gl!.uniform4fv(u("uRip"), ripples);
      gl!.uniform3fv(u("uSplash"), splashes);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }

    let raf = 0;
    let visible = true;
    const loop = () => {
      if (visible) draw();
      raf = requestAnimationFrame(loop);
    };
    // Stop drawing once the hero has scrolled away.
    const watcher = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    watcher.observe(host);
    window.addEventListener("resize", resize);
    resize();
    if (!still) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      watcher.disconnect();
      window.removeEventListener("resize", resize);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="water-chart" ref={frame} aria-hidden="true">
      <canvas ref={canvas} />
      {NODES.map((node, i) => (
        <span
          key={node.name}
          className={node.hub ? "water-label is-hub" : "water-label"}
          ref={(element) => {
            labels.current[i] = element;
          }}
        >
          {node.name}
        </span>
      ))}
    </div>
  );
}
