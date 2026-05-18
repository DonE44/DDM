/**
 * ShapeButton.jsx
 * ───────────────────────────────────────────────────────────────────
 * Turns any transparent PNG into a custom-shaped interactive button.
 *
 * Features
 * ────────
 * • Alpha-channel hit-testing  — only non-transparent pixels are clickable.
 * • WebGL Normal-Map Shader    — a real GPU fragment shader computes per-pixel
 *   normals from the alpha-channel gradient (Sobel operator) and applies
 *   Phong shading to create convincing 3-D depth/bevel.
 * • Color Overlay              — GPU-blended tint (supports any CSS hex color).
 * • Hover Scale                — smooth CSS transform on hover / press.
 * • Programmable props         — onPressed, hoverScale, bevelIntensity,
 *   colorOverlay, alphaThreshold, lightDirection, disabled.
 *
 * Framework: React + WebGL (no extra dependencies).
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import SmartColorPicker from './components/SmartColorPicker.tsx'

/* ─── WebGL Shaders ──────────────────────────────────────────────────── */

const VERT_SRC = /* glsl */`
  attribute vec2 aPosition;
  varying   vec2 vUv;
  void main() {
    vUv = aPosition * 0.5 + 0.5;
    vUv.y = 1.0 - vUv.y;            /* flip Y to match CSS image origin  */
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

/**
 * Fragment shader — Normal Map + Phong lighting + colour overlay.
 *
 * Algorithm
 * ─────────
 * 1. Sample the 3×3 neighbourhood of alpha values.
 * 2. Apply the Sobel operator to extract the gradient (∂α/∂x, ∂α/∂y).
 * 3. Build a surface normal:  N = normalize(−Gx·intensity, Gy·intensity, 1).
 * 4. Phong light model: ambient + diffuse·dot(N,L) + specular·pow(dot(R,V),n).
 * 5. Mix with optional colour overlay.
 */
const FRAG_SRC = /* glsl */`
  precision mediump float;

  uniform sampler2D uImage;
  uniform vec2      uTexelSize;     /* 1/imageWidth, 1/imageHeight      */
  uniform float     uBevelIntensity;/* 0 = flat, 10 = extreme bevel     */
  uniform vec3      uLightDir;      /* normalised light direction (view) */
  uniform vec3      uColorOverlay;  /* RGB 0-1                           */
  uniform float     uColorMix;      /* 0 = no overlay, 1 = full         */
  uniform float     uAlpha;         /* master opacity 0-1               */

  varying vec2 vUv;

  void main() {
    vec4 c = texture2D(uImage, vUv);

    /* Fully transparent — discard so background shows through */
    if (c.a < 0.01) { gl_FragColor = vec4(0.0); return; }

    /* ── Sobel kernel on alpha channel ─────────────────────────── */
    vec2 t = uTexelSize;

    float tl = texture2D(uImage, vUv + vec2(-t.x, -t.y)).a;
    float tc = texture2D(uImage, vUv + vec2( 0.0, -t.y)).a;
    float tr = texture2D(uImage, vUv + vec2( t.x, -t.y)).a;
    float ml = texture2D(uImage, vUv + vec2(-t.x,  0.0)).a;
    float mr = texture2D(uImage, vUv + vec2( t.x,  0.0)).a;
    float bl = texture2D(uImage, vUv + vec2(-t.x,  t.y)).a;
    float bc = texture2D(uImage, vUv + vec2( 0.0,  t.y)).a;
    float br = texture2D(uImage, vUv + vec2( t.x,  t.y)).a;

    float Gx = (tr + 2.0*mr + br) - (tl + 2.0*ml + bl);
    float Gy = (bl + 2.0*bc + br) - (tl + 2.0*tc + tr);

    /* ── Surface normal from gradient ──────────────────────────── */
    vec3 N = normalize(vec3(-Gx * uBevelIntensity,
                             Gy * uBevelIntensity,
                             1.0));

    /* ── Phong lighting ─────────────────────────────────────────── */
    vec3  L        = normalize(uLightDir);
    float diffuse  = max(dot(N, L), 0.0);
    vec3  R        = reflect(-L, N);
    float specular = pow(max(dot(R, vec3(0.0, 0.0, 1.0)), 0.0), 48.0) * 0.55;
    float ambient  = 0.30;
    float lighting = ambient + (1.0 - ambient) * diffuse + specular;

    /* ── Colour overlay ─────────────────────────────────────────── */
    vec3 rgb = mix(c.rgb, uColorOverlay, uColorMix);

    /* ── Output ─────────────────────────────────────────────────── */
    gl_FragColor = vec4(clamp(rgb * lighting, 0.0, 1.0), c.a * uAlpha);
  }
`

/* ─── WebGL helpers ──────────────────────────────────────────────────── */

function compileShader(gl, type, src) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('ShapeButton shader error:', gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

function createProgram(gl) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC)
  if (!vs || !fs) return null
  const prog = gl.createProgram()
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('ShapeButton program link error:', gl.getProgramInfoLog(prog))
    return null
  }
  return prog
}

function hexToRgb(hex) {
  if (!hex) return [1, 1, 1]
  const m = hex.replace('#', '').match(/.{2}/g)
  if (!m) return [1, 1, 1]
  return m.map(x => parseInt(x, 16) / 255)
}

/* ─── Alpha hit-test hook ────────────────────────────────────────────── */
/**
 * Samples the alpha channel of `src` at a given DOM coordinate.
 * Returns a function: (clientX, clientY, domRect) → boolean (hit?)
 */
function useAlphaHitTest(src, alphaThreshold) {
  const alphaCanvas = useRef(null)
  const alphaCtx    = useRef(null)
  const imgSize     = useRef({ w: 1, h: 1 })

  useEffect(() => {
    if (!src) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c   = document.createElement('canvas')
      c.width   = img.naturalWidth
      c.height  = img.naturalHeight
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      alphaCanvas.current  = c
      alphaCtx.current     = ctx
      imgSize.current      = { w: img.naturalWidth, h: img.naturalHeight }
    }
    img.onerror = () => { alphaCanvas.current = null }
    img.src = src
  }, [src])

  return useCallback((clientX, clientY, domRect) => {
    if (!alphaCanvas.current) return true   // no data → allow click
    const scaleX = imgSize.current.w / domRect.width
    const scaleY = imgSize.current.h / domRect.height
    const px = Math.round((clientX - domRect.left) * scaleX)
    const py = Math.round((clientY - domRect.top ) * scaleY)
    if (px < 0 || py < 0 || px >= imgSize.current.w || py >= imgSize.current.h) return false
    const data = alphaCtx.current.getImageData(px, py, 1, 1).data
    return data[3] > (alphaThreshold ?? 10)
  }, [alphaThreshold])
}

/* ─── WebGL canvas renderer hook ─────────────────────────────────────── */
/**
 * Renders the image through the Normal-Map shader onto a <canvas>.
 * Refreshes whenever any shader uniform changes.
 */
function useNormalMapGL(canvasRef, src, width, height, options) {
  const glRef   = useRef(null)
  const progRef = useRef(null)
  const texRef  = useRef(null)
  const imgRef  = useRef(null)
  const _rafRef  = useRef(null)

  // Build/teardown WebGL context once
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false })
    if (!gl) { glRef.current = null; return }
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const prog = createProgram(gl)
    if (!prog) return
    gl.useProgram(prog)

    // Full-screen quad
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1,  1,
       1, -1,  1,  1,  -1,  1,
    ]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'aPosition')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    glRef.current   = gl
    progRef.current = prog

    return () => {
      if (texRef.current) gl.deleteTexture(texRef.current)
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
      glRef.current = null
    }
  }, [canvasRef])

  // Load texture when src changes
  useEffect(() => {
    const gl = glRef.current
    if (!gl || !src) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      if (texRef.current) gl.deleteTexture(texRef.current)
      const tex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      texRef.current = tex
      draw()   // initial draw after texture load
    }
    img.src = src
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  function draw() {
    const gl   = glRef.current
    const prog = progRef.current
    const tex  = texRef.current
    const img  = imgRef.current
    if (!gl || !prog || !tex || !img) return

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(prog)

    const loc = name => gl.getUniformLocation(prog, name)
    const { bevelIntensity, lightDirection, colorOverlay, colorOverlayOpacity, masterAlpha } = options.current

    gl.uniform1i(loc('uImage'),         0)
    gl.uniform2f(loc('uTexelSize'),     1 / img.naturalWidth, 1 / img.naturalHeight)
    gl.uniform1f(loc('uBevelIntensity'), bevelIntensity)
    gl.uniform3fv(loc('uLightDir'),     lightDirection)
    gl.uniform3fv(loc('uColorOverlay'), hexToRgb(colorOverlay))
    gl.uniform1f(loc('uColorMix'),      colorOverlay ? colorOverlayOpacity : 0)
    gl.uniform1f(loc('uAlpha'),         masterAlpha)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  // Redraw whenever options change (bevel, overlay, alpha …)
  const optionsRef = options
  const _lightDirKey = optionsRef.current?.lightDirection?.join()
  useEffect(() => {
    draw()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    optionsRef.current?.bevelIntensity,
    optionsRef.current?.colorOverlay,
    optionsRef.current?.colorOverlayOpacity,
    optionsRef.current?.masterAlpha,
    _lightDirKey,
  ])

  return { draw }
}

/* ─── ShapeButton Component ──────────────────────────────────────────── */

/**
 * @param {object} props
 * @param {string}   props.src                Image URL (transparent PNG).
 * @param {number}   props.width              Display width in px.
 * @param {number}   props.height             Display height in px.
 * @param {function} props.onPressed          Called on successful (non-transparent) click.
 * @param {number}   [props.hoverScale=1.06]  CSS scale factor on hover.
 * @param {boolean}  [props.bevel=false]      Enable the Normal-Map 3-D shader.
 * @param {number}   [props.bevelIntensity=3] Shader bevel strength (0–10).
 * @param {string}   [props.colorOverlay]     Hex colour tint e.g. '#ff3300'.
 * @param {number}   [props.colorOverlayOpacity=0.35]
 * @param {number}   [props.alphaThreshold=10] Min alpha (0-255) to register a hit.
 * @param {number[]} [props.lightDirection]   Normalised XYZ light vector.
 * @param {number}   [props.opacity=1]        Master opacity 0–1.
 * @param {boolean}  [props.disabled=false]
 * @param {string}   [props.title]            Tooltip text.
 * @param {object}   [props.style]            Extra inline styles on the host.
 * @param {string}   [props.className]
 * @param {boolean}  [props.previewOnly=false] No click events (editor preview).
 */
export default function ShapeButton({
  src,
  width  = 120,
  height = 120,
  onPressed          = undefined,
  hoverScale          = 1.06,
  bevel               = false,
  bevelIntensity      = 3,
  colorOverlay        = null,
  colorOverlayOpacity = 0.35,
  alphaThreshold      = 10,
  lightDirection      = [0.55, 0.70, 0.80],
  opacity             = 1,
  disabled            = false,
  title               = '',
  style               = {},
  className           = '',
  previewOnly         = false,
}) {
  const hostRef   = useRef(null)
  const glRef     = useRef(null)      // WebGL canvas element ref
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  // Keep shader options in a ref so draw() always uses fresh values without triggering re-renders.
  // Writing to a ref during render is intentional here — it keeps the ref in sync with the latest
  // props so callbacks/effects always read current values (a well-established React pattern).
  const shaderOpts = useRef({})
  // eslint-disable-next-line react-hooks/refs
  shaderOpts.current = {
    bevelIntensity,
    lightDirection,
    colorOverlay,
    colorOverlayOpacity,
    masterAlpha: opacity,
  }

  /* Hit test */
  const hitTest = useAlphaHitTest(src, alphaThreshold)

  /* WebGL (only mounted when bevel is on) */
  const glCanvasRef = useRef(null)
  useNormalMapGL(
    glCanvasRef,
    src,
    width,
    height,
    shaderOpts,
  )

  /* Force a GL redraw whenever bevel params change */
  useEffect(() => {
    if (!bevel || !glRef.current) return
    // draw() is called inside the hook whenever shaderOpts changes
  }, [bevel, bevelIntensity, colorOverlay, colorOverlayOpacity, opacity, lightDirection])

  /* ── Event handlers ─────────────────────────────────────────── */
  const handlePointerMove = useCallback((e) => {
    if (!src) return
    const rect = hostRef.current?.getBoundingClientRect()
    if (!rect) return
    const hit = hitTest(e.clientX, e.clientY, rect)
    hostRef.current.style.cursor = hit ? 'pointer' : 'default'
  }, [hitTest, src])

  const handleClick = useCallback((e) => {
    if (previewOnly || disabled || !src) return
    const rect = hostRef.current?.getBoundingClientRect()
    if (!rect) return
    if (!hitTest(e.clientX, e.clientY, rect)) return
    e.stopPropagation()
    onPressed?.(e)
  }, [hitTest, onPressed, disabled, src, previewOnly])

  const handlePointerDown = useCallback((e) => {
    if (previewOnly || disabled) return
    const rect = hostRef.current?.getBoundingClientRect()
    if (!rect || !hitTest(e.clientX, e.clientY, rect)) return
    setPressed(true)
  }, [hitTest, disabled, previewOnly])

  const handlePointerUp = useCallback(() => setPressed(false), [])

  /* ── Computed styles ────────────────────────────────────────── */
  const scale = useMemo(() => {
    if (previewOnly || disabled) return 1
    if (pressed) return Math.max(1, hoverScale * 0.94)
    if (hovered) return hoverScale
    return 1
  }, [hovered, pressed, hoverScale, disabled, previewOnly])

  const hostStyle: React.CSSProperties = {
    position    : 'relative',
    display     : 'inline-block',
    width,
    height,
    outline     : 'none',
    userSelect  : 'none',
    transformOrigin: 'center center',
    transform   : `scale(${scale})`,
    transition  : 'transform 0.15s cubic-bezier(.34,1.56,.64,1)',
    ...style,
  }

  /* Image / fallback style (used when bevel is off) */
  const imgStyle: React.CSSProperties = {
    display   : 'block',
    width     : '100%',
    height    : '100%',
    objectFit : 'contain',
    opacity,
    ...(colorOverlay && !bevel
      ? {
          filter: `drop-shadow(0 0 0px ${colorOverlay})`,
          // CSS colour overlay via mix-blend-mode on a pseudo-sibling
        }
      : {}),
  }

  return (
    <div
      ref={hostRef}
      className={`shape-btn${className ? ' ' + className : ''}`}
      style={hostStyle}
      title={title}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => { setHovered(false); setPressed(false); if (hostRef.current) hostRef.current.style.cursor = 'default' }}
      onPointerEnter={() => setHovered(true)}
    >
      {/* ── Normal-Map WebGL canvas (bevel on) ─────────────────── */}
      {bevel && src ? (
        <canvas
          ref={glCanvasRef}
          className="shape-btn-gl"
          width={width}
          height={height}
          style={{ display: 'block', width: '100%', height: '100%', opacity }}
        />
      ) : (
        /* ── Plain image (bevel off) ──────────────────────────── */
        src ? (
          <div className="shape-btn-img-wrap" style={{ width: '100%', height: '100%', position: 'relative' }}>
            <img
              src={src}
              alt={title || ''}
              className="shape-btn-img"
              style={imgStyle}
              draggable={false}
            />
            {/* CSS colour overlay layer */}
            {colorOverlay && (
              <div
                className="shape-btn-overlay"
                style={{
                  position       : 'absolute',
                  inset          : 0,
                  background     : colorOverlay,
                  opacity        : colorOverlayOpacity,
                  mixBlendMode   : 'multiply',
                  maskImage      : src ? `url("${src}")` : 'none',
                  WebkitMaskImage: src ? `url("${src}")` : 'none',
                  maskSize       : 'contain',
                  WebkitMaskSize : 'contain',
                  maskRepeat     : 'no-repeat',
                  WebkitMaskRepeat: 'no-repeat',
                  maskPosition   : 'center',
                  WebkitMaskPosition: 'center',
                  pointerEvents  : 'none',
                }}
              />
            )}
          </div>
        ) : (
          <div className="shape-btn-empty">🖼</div>
        )
      )}

      {/* Disabled overlay */}
      {disabled && (
        <div className="shape-btn-disabled" />
      )}
    </div>
  )
}

/* ─── ShapeButton Inspector Panel (for App.jsx inspector) ─────────── */

/**
 * Drop-in inspector section that edits all ShapeButton properties
 * on a clip element.  Pass the element and an updateElement callback.
 */
export function ShapeButtonInspector({ el, onUpdate }) {
  const isImage = el?.mediaKind === 'image' || detectIsImage(el?.file || '')

  if (!isImage) return null

  const on = !!el.shapeButton
  return (
    <div className="sb-inspector">
      <div className="sb-insp-header">
        <label className="sb-insp-toggle" title="Make this PNG clickable only where non-transparent">
          <input
            type="checkbox"
            checked={on}
            onChange={e => onUpdate({ shapeButton: e.target.checked })}
          />
          <span>🎯 Shape Button</span>
        </label>
      </div>

      {on && (
        <div className="sb-insp-body">
          {/* Bevel */}
          <label className="sb-insp-row">
            <input
              type="checkbox"
              checked={!!el.sbBevel}
              onChange={e => onUpdate({ sbBevel: e.target.checked })}
            />
            3-D Bevel (Normal Map)
          </label>

          {el.sbBevel && (
            <label className="sb-insp-field">
              Bevel Intensity {(el.sbBevelIntensity ?? 3).toFixed(1)}
              <input
                type="range" min="0.1" max="10" step="0.1"
                value={el.sbBevelIntensity ?? 3}
                onChange={e => onUpdate({ sbBevelIntensity: Number(e.target.value) })}
              />
            </label>
          )}

          {/* Hover Scale */}
          <label className="sb-insp-field">
            Hover Scale ×{(el.sbHoverScale ?? 1.06).toFixed(2)}
            <input
              type="range" min="1.0" max="1.5" step="0.01"
              value={el.sbHoverScale ?? 1.06}
              onChange={e => onUpdate({ sbHoverScale: Number(e.target.value) })}
            />
          </label>

          {/* Colour Overlay */}
          <div className="sb-insp-row">
            <label>
              <input
                type="checkbox"
                checked={!!el.sbOverlayOn}
                onChange={e => onUpdate({ sbOverlayOn: e.target.checked })}
              />
              Colour Overlay
            </label>
            {el.sbOverlayOn && (
              <SmartColorPicker
                value={el.sbOverlayColor || '#ff0000'}
                onChange={v => onUpdate({ sbOverlayColor: v })}
              />
            )}
          </div>

          {el.sbOverlayOn && (
            <label className="sb-insp-field">
              Overlay Opacity {Math.round((el.sbOverlayOpacity ?? 0.35) * 100)}%
              <input
                type="range" min="0" max="1" step="0.01"
                value={el.sbOverlayOpacity ?? 0.35}
                onChange={e => onUpdate({ sbOverlayOpacity: Number(e.target.value) })}
              />
            </label>
          )}

          {/* Alpha Threshold */}
          <label className="sb-insp-field">
            Hit Threshold {el.sbAlphaThreshold ?? 10}
            <input
              type="range" min="1" max="200" step="1"
              value={el.sbAlphaThreshold ?? 10}
              onChange={e => onUpdate({ sbAlphaThreshold: Number(e.target.value) })}
            />
          </label>

          {/* Light Direction Preset */}
          <div className="sb-insp-field">
            <span className="sb-insp-label">Light Direction</span>
            <div className="sb-light-grid">
              {LIGHT_PRESETS.map(p => (
                <button
                  key={p.label}
                  className={`sb-light-btn ${JSON.stringify(el.sbLightDir) === JSON.stringify(p.dir) ? 'on' : ''}`}
                  title={p.label}
                  onClick={() => onUpdate({ sbLightDir: p.dir })}
                >{p.icon}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const LIGHT_PRESETS = [
  { label: 'Top-Left',    icon: '↖', dir: [0.55,  0.70, 0.80] },
  { label: 'Top',         icon: '↑', dir: [0.00,  0.90, 0.80] },
  { label: 'Top-Right',   icon: '↗', dir: [-0.55, 0.70, 0.80] },
  { label: 'Left',        icon: '←', dir: [0.90,  0.00, 0.80] },
  { label: 'Centre',      icon: '●', dir: [0.00,  0.00, 1.00] },
  { label: 'Right',       icon: '→', dir: [-0.90, 0.00, 0.80] },
  { label: 'Bottom-Left', icon: '↙', dir: [0.55, -0.70, 0.80] },
  { label: 'Bottom',      icon: '↓', dir: [0.00, -0.90, 0.80] },
  { label: 'Bottom-Right',icon: '↘', dir: [-0.55,-0.70, 0.80] },
]

function detectIsImage(file) {
  return /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(file) ||
    /^data:image\//i.test(file)
}
