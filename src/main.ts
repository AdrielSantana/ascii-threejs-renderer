import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { parseAsciiConfig, createAsciiShader } from './ascii-shader';
import { createVortexWallpaper } from './vortex-wallpaper';

// --- Config (via URL params: ?scale=120&charset=...&colorized=true&shape=galaxy) ---
const config = parseAsciiConfig(new URLSearchParams(window.location.search));

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.id = 'scene-canvas';
document.body.appendChild(renderer.domElement);

// --- Wallpaper (GPU particle vortex with shape morphing) ---
const VALID_SHAPES = ['cube', 'torus', 'torusKnot', 'galaxy'] as const;
type ForcedShape = (typeof VALID_SHAPES)[number];
const forcedShape = config.shape && VALID_SHAPES.includes(config.shape as ForcedShape)
  ? (config.shape as ForcedShape)
  : undefined;
const wallpaper = createVortexWallpaper(window.innerWidth, window.innerHeight, forcedShape);

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

function applyMorphCellScale(uMorph: number) {
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
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
