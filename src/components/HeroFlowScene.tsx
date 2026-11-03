import { useEffect, useRef, useState } from "react";
import "../hero-flow-scene.css";

const POSTER = "/hero/flow-ribbon-concept.png";
const VERTEX = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;
const FRAGMENT = `
precision mediump float;
uniform sampler2D artwork;
uniform vec2 resolution;
uniform vec2 pointer;
uniform float imageAspect;
uniform float seconds;
uniform float cropPosition;
varying vec2 uv;
void main() {
  vec2 p = uv;
  float aspect = resolution.x / resolution.y;
  if (aspect > imageAspect) {
    p.y = (p.y - 0.5) * imageAspect / aspect + 0.5;
  } else {
    float crop = aspect / imageAspect;
    p.x = p.x * crop + (1.0 - crop) * cropPosition;
  }
  // 只让曲面区域轻缓变形，左侧留白与真实HTML文字保持稳定。
  float surface = smoothstep(0.25, 0.60, p.x);
  p.x += surface * (0.005 * sin(p.y * 5.0 + seconds * 0.22) + pointer.x);
  p.y += surface * (0.007 * sin(p.x * 5.4 - seconds * 0.18) + pointer.y);
  vec3 color = texture2D(artwork, clamp(p, 0.001, 0.999)).rgb;
  float blueGlass = clamp((color.b - color.r) * 2.8, 0.0, 1.0);
  float light = sin(p.y * 3.0 + p.x * 2.0 - seconds * 0.15);
  color += blueGlass * surface * light * 0.008;
  gl_FragColor = vec4(color, 1.0);
}`;

/** 品牌视觉采用原图材质与微幅流动，不把它伪装成用户代码的执行结果。 */
export default function HeroFlowScene({ paused = false }: { paused?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const wake = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => { pausedRef.current = paused; wake.current?.(); }, [paused]);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    const container = host.current;
    setReady(false);
    if (!container || reduced) return;
    let disposed = false, cleaned = false, frame = 0, last = 0, elapsed = 0;
    let visible = false, loaded = false, width = 1, height = 1;
    let aimX = 0, aimY = 0, currentX = 0, currentY = 0;
    // 初始化第一步就建立逆序清理；任何一次失败都走相同出口，避免残留GPU资源与监听器。
    const releases: Array<() => void> = [];
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      cancelAnimationFrame(frame);
      frame = 0;
      wake.current = null;
      while (releases.length) { try { releases.pop()?.(); } catch { /* 后续资源仍需继续释放。 */ } }
    };
    const fallback = () => { cleanup(); if (!disposed) setReady(false); };

    try {
      const canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power", depth: false, stencil: false });
      if (!gl) return;
      releases.push(() => gl.getExtension("WEBGL_lose_context")?.loseContext());
      releases.push(() => canvas.remove());
      container.appendChild(canvas);
      const shader = (type: number, source: string) => {
        const item = gl.createShader(type);
        if (!item) throw new Error("Shader unavailable");
        releases.push(() => gl.deleteShader(item));
        gl.shaderSource(item, source); gl.compileShader(item);
        if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) throw new Error("Shader unavailable");
        return item;
      };
      const program = gl.createProgram();
      if (!program) throw new Error("Program unavailable");
      releases.push(() => gl.deleteProgram(program));
      gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Program unavailable");
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error("Buffer unavailable");
      releases.push(() => gl.deleteBuffer(buffer));
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      // 一个覆盖视口的三角形，整页只绘制一次素材，不引入三维模型或重型后处理。
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const attribute = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
      const uniforms = Object.fromEntries(["artwork", "resolution", "pointer", "imageAspect", "seconds", "cropPosition"].map(name => [name, gl.getUniformLocation(program, name)]));
      const texture = gl.createTexture();
      if (!texture) throw new Error("Texture unavailable");
      releases.push(() => gl.deleteTexture(texture));
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(uniforms.artwork, 0);
      const canMove = () => !disposed && !cleaned && loaded && visible && !document.hidden && !pausedRef.current;
      const draw = () => {
        if (!loaded || cleaned) return;
        gl.uniform2f(uniforms.resolution, width, height);
        gl.uniform2f(uniforms.pointer, currentX, currentY);
        gl.uniform1f(uniforms.seconds, elapsed);
        gl.uniform1f(uniforms.cropPosition, width <= 900 ? .78 : .5);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      const tick = (now: number) => {
        frame = 0;
        if (!canMove()) { last = 0; return; }
        if (!last) last = now;
        if (now - last >= 1000 / 30) {
          elapsed += Math.min(now - last, 70) / 1000; last = now;
          currentX += (aimX - currentX) * .05;
          currentY += (aimY - currentY) * .05;
          draw();
        }
        if (canMove()) frame = requestAnimationFrame(tick);
      };
      const synchronize = () => {
        if (!canMove()) { cancelAnimationFrame(frame); frame = 0; last = 0; }
        else if (!frame) frame = requestAnimationFrame(tick);
      };
      wake.current = synchronize;
      const resize = () => {
        const rect = container.getBoundingClientRect();
        if (!rect.width || !rect.height || cleaned) return;
        width = rect.width; height = rect.height;
        const dpr = Math.min(devicePixelRatio || 1, matchMedia("(max-width: 640px)").matches ? 1 : 1.5);
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
        draw();
      };
      const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; synchronize(); }, { threshold: .04 });
      releases.push(() => observer.disconnect()); observer.observe(container);
      const resizeObserver = new ResizeObserver(resize);
      releases.push(() => resizeObserver.disconnect()); resizeObserver.observe(container);
      const pointer = (event: PointerEvent) => {
        if (event.pointerType !== "mouse" || !canMove()) return;
        const rect = container.getBoundingClientRect();
        aimX = ((event.clientX - rect.left) / rect.width - .5) * .004;
        aimY = ((event.clientY - rect.top) / rect.height - .5) * .003;
      };
      const leave = () => { aimX = 0; aimY = 0; };
      const lost = (event: Event) => { event.preventDefault(); fallback(); };
      container.addEventListener("pointermove", pointer); releases.push(() => container.removeEventListener("pointermove", pointer));
      container.addEventListener("pointerleave", leave); releases.push(() => container.removeEventListener("pointerleave", leave));
      canvas.addEventListener("webglcontextlost", lost); releases.push(() => canvas.removeEventListener("webglcontextlost", lost));
      document.addEventListener("visibilitychange", synchronize); releases.push(() => document.removeEventListener("visibilitychange", synchronize));
      const artwork = new Image();
      releases.push(() => { artwork.onload = null; artwork.onerror = null; });
      artwork.onload = () => {
        if (disposed || cleaned) return;
        try {
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, artwork);
          if (gl.getError() !== gl.NO_ERROR) throw new Error("Texture unavailable");
          gl.uniform1f(uniforms.imageAspect, artwork.naturalWidth / artwork.naturalHeight);
          loaded = true; resize(); draw();
          setReady(true); synchronize();
        } catch { fallback(); }
      };
      artwork.onerror = fallback;
      artwork.src = POSTER;
      resize();
    } catch { fallback(); }
    return () => { disposed = true; cleanup(); };
  }, [reduced]);

  return <div ref={host} className={`hero-flow-scene${ready ? " is-rendered" : ""}`} data-renderer={ready ? "webgl-flow" : "fallback"} role="img" aria-label="透明蓝色曲面轻缓流动">
    <img className="hero-flow-fallback" src={POSTER} alt="" decoding="async" draggable="false"/>
  </div>;
}
