import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { parseAsciiConfig, createAsciiShader } from './ascii-shader';
import { createVortexWallpaper } from './vortex-wallpaper';

// --- Config (via URL params: ?scale=120&charset=...&colorized=true&shape=galaxy&debug=1) ---
const params = new URLSearchParams(window.location.search);
const config = parseAsciiConfig(params);
const debug = params.get('debug') === '1';

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.id = 'scene-canvas';
document.body.appendChild(renderer.domElement);

// --- Wallpaper (GPU particle vortex with shape morphing) ---
const VALID_SHAPES = ['cube', 'torus', 'torusKnot', 'galaxy', 'skull', 'katana', 'revolver'] as const;
type ForcedShape = (typeof VALID_SHAPES)[number];
const forcedShape = config.shape && VALID_SHAPES.includes(config.shape as ForcedShape)
  ? (config.shape as ForcedShape)
  : undefined;
const wallpaper = createVortexWallpaper(window.innerWidth, window.innerHeight, forcedShape);
(window as any).__wallpaper = wallpaper; // debug

// Preload GLB shapes (skull, etc.) in the background
wallpaper.preloadGlbShapes();

// --- Post-processing: Render → ASCII → Output ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(wallpaper.scene, wallpaper.camera));

const asciiPass = new ShaderPass(createAsciiShader(config));
composer.addPass(asciiPass);

composer.addPass(new OutputPass());

// --- Resize ---
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const pr = Math.min(window.devicePixelRatio, 1.5);
  const shorter = Math.min(w, h);
  const cellH = shorter / config.cellScale;
  const cellW = cellH * 6 / 9;
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  asciiPass.uniforms.uResolution.value.set(w * pr, h * pr);
  asciiPass.uniforms.uCellSize.value.set(cellW * pr, cellH * pr);
  wallpaper.resize(w, h);
}
resize();
window.addEventListener('resize', resize);

// --- Loop ---
let prevTime = 0;
const VORTEX_CELL_SCALE = 30;
const SHAPE_CELL_SCALE = 75;
const MORPH_CELL_SCALE = 20;
let currentCellScale = VORTEX_CELL_SCALE;
let manualCellScale = false;

function applyMorphCellScale(uMorph: number) {
  if (manualCellScale) return;
  const target = uMorph < 0.5
    ? VORTEX_CELL_SCALE + (MORPH_CELL_SCALE - VORTEX_CELL_SCALE) * (uMorph * 2)
    : MORPH_CELL_SCALE + (SHAPE_CELL_SCALE - MORPH_CELL_SCALE) * ((uMorph - 0.5) * 2);
  currentCellScale += (target - currentCellScale) * 0.15;
  if (Math.abs(currentCellScale - config.cellScale) > 0.5) {
    config.cellScale = currentCellScale;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio, 1.5);
    const shorter = Math.min(w, h);
    const cellH = shorter / currentCellScale;
    const cellW = cellH * 6 / 9;
    asciiPass.uniforms.uCellSize.value.set(cellW * pr, cellH * pr);
  }
}

function animate(time: number) {
  const t = time * 0.001;
  const dt = Math.min(t - prevTime, 1 / 30);
  prevTime = t;
  wallpaper.update(t, dt);
  const morphState = wallpaper.getMorphState?.();
  if (morphState) applyMorphCellScale(morphState.uMorph);
  composer.render();
  if (debug) updateDebugHud(morphState);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// --- Debug panel (?debug=1) ---
if (debug) {
  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:fixed', 'top:8px', 'right:8px',
    'background:rgba(0,0,0,0.85)', 'color:#0f0',
    'font:12px monospace', 'padding:10px 12px',
    'border:1px solid #0f0', 'border-radius:4px',
    'z-index:9999', 'min-width:220px',
    'max-height:90vh', 'overflow-y:auto',
    'pointer-events:auto',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'DEBUG PANEL';
  title.style.cssText = 'font-weight:bold;margin-bottom:8px;color:#0ff;';
  panel.appendChild(title);

  const hud = document.createElement('div');
  hud.id = 'debug-hud';
  hud.style.cssText = 'margin-bottom:8px;font-size:11px;line-height:1.4;white-space:pre;';
  panel.appendChild(hud);

  function addSlider(label: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:4px 0;';
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'flex:1;font-size:11px;';
    const val = document.createElement('span');
    val.style.cssText = 'min-width:40px;text-align:right;font-size:11px;color:#ff0;';
    val.textContent = value.toFixed(3);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.style.cssText = 'width:120px;accent-color:#0f0;';
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      val.textContent = v.toFixed(3);
      onChange(v);
    });
    row.appendChild(lbl);
    row.appendChild(input);
    row.appendChild(val);
    panel.appendChild(row);
  }

  const u = wallpaper.uniforms;

  addSlider('boilAmp', 0, 0.3, 0.001, 0.085, (v) => { u.uBoilAmp.value = v; });
  addSlider('pointSize', 0.2, 3.0, 0.01, 1.0, (v) => { u.uPointSizeMul.value = v; });
  addSlider('morph', 0, 1, 0.001, u.uMorph.value as number, (v) => { u.uMorph.value = v; });
  addSlider('shapeScale', 0.3, 2.0, 0.01, u.uShapeScale.value as number, (v) => { u.uShapeScale.value = v; });
  addSlider('asciiScale', 10, 200, 1, config.cellScale, (v) => {
    manualCellScale = true;
    config.cellScale = v;
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio, 1.5);
    const shorter = Math.min(w, h);
    const cellH = shorter / v;
    const cellW = cellH * 6 / 9;
    asciiPass.uniforms.uCellSize.value.set(cellW * pr, cellH * pr);
  });
  addSlider('contrast', 0, 4, 0.01, asciiPass.uniforms.uContrast.value as number, (v) => { asciiPass.uniforms.uContrast.value = v; });
  addSlider('brightness', 0, 10, 0.1, asciiPass.uniforms.uBrightness.value as number, (v) => { asciiPass.uniforms.uBrightness.value = v; });
  addSlider('gamma', 0.05, 2.0, 0.01, asciiPass.uniforms.uGamma.value as number, (v) => { asciiPass.uniforms.uGamma.value = v; });

  // ASCII on/off toggle
  const toggleRow = document.createElement('div');
  toggleRow.style.cssText = 'margin-top:8px;';
  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = 'ASCII: ON';
  toggleBtn.style.cssText = 'width:100%;font:bold 11px monospace;padding:4px;background:#0a0;color:#0f0;border:1px solid #0f0;cursor:pointer;';
  let asciiOn = true;
  toggleBtn.addEventListener('click', () => {
    asciiOn = !asciiOn;
    asciiPass.enabled = asciiOn;
    toggleBtn.textContent = `ASCII: ${asciiOn ? 'ON' : 'OFF'}`;
    toggleBtn.style.color = asciiOn ? '#0f0' : '#888';
    toggleBtn.style.borderColor = asciiOn ? '#0f0' : '#888';
    toggleBtn.style.background = asciiOn ? '#0a0' : '#222';
  });
  toggleRow.appendChild(toggleBtn);
  panel.appendChild(toggleRow);

  // Shape selector
  const shapeRow = document.createElement('div');
  shapeRow.style.cssText = 'margin-top:8px;';
  const shapeLabel = document.createElement('div');
  shapeLabel.textContent = 'SHAPE';
  shapeLabel.style.cssText = 'font-size:11px;color:#0ff;margin-bottom:4px;';
  shapeRow.appendChild(shapeLabel);
  const shapeSelect = document.createElement('select');
  shapeSelect.style.cssText = 'width:100%;font:11px monospace;padding:3px;background:#111;color:#0f0;border:1px solid #0f0;';
  const shapeOptions: (string)[] = ['cube', 'torus', 'torusKnot', 'galaxy', 'skull', 'katana', 'revolver'];
  for (const s of shapeOptions) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    shapeSelect.appendChild(opt);
  }
  if (forcedShape) shapeSelect.value = forcedShape;
  shapeSelect.addEventListener('change', () => {
    const s = shapeSelect.value;
    window.location.search = `?debug=1&shape=${s}`;
  });
  shapeRow.appendChild(shapeSelect);
  panel.appendChild(shapeRow);

  document.body.appendChild(panel);
}

function updateDebugHud(morphState: { phase: string; morphProgress: number; shapeIdx: number; currentShapeName: string | null; uMorph: number } | undefined) {
  const hud = document.getElementById('debug-hud');
  if (!hud) return;
  const ms = morphState ?? { phase: '?', morphProgress: 0, shapeIdx: 0, currentShapeName: null, uMorph: 0 };
  hud.textContent = [
    `phase: ${ms.phase}`,
    `morph: ${ms.uMorph.toFixed(3)}`,
    `progress: ${ms.morphProgress.toFixed(3)}`,
    `shape: ${ms.currentShapeName ?? '-'}`,
    `idx: ${ms.shapeIdx}`,
  ].join('\n');
}
