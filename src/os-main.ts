import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { parseAsciiConfig, createAsciiShader } from './ascii-shader';
import { createVortexWallpaper } from './os/vortex-wallpaper';
import { WindowManager } from './os/window-manager';
import { Desktop } from './os/desktop';
import { Taskbar } from './os/taskbar';
import { registerApp, listApps, getApp } from './os/apps/registry';
import { notepadApp } from './os/apps/notepad';
import { aboutApp } from './os/apps/about';
import { terminalApp } from './os/apps/terminal';
import { settingsApp } from './os/apps/settings';
import { paintApp } from './os/apps/paint';
import { snakeApp } from './os/apps/snake';
import { initSettings } from './os/settings-store';

// --- Config ---
const config = parseAsciiConfig(new URLSearchParams(window.location.search));
config.cellScale = 30; // high resolution ASCII

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.id = 'os-canvas';
document.body.appendChild(renderer.domElement);

// --- Wallpaper ---
const VALID_SHAPES = ['cube', 'torus', 'torusKnot', 'galaxy'] as const;
type ForcedShape = (typeof VALID_SHAPES)[number];
const forcedShape = config.shape && VALID_SHAPES.includes(config.shape as ForcedShape)
  ? (config.shape as ForcedShape)
  : undefined;
const wallpaper = createVortexWallpaper(window.innerWidth, window.innerHeight, forcedShape);
// Debug surface (dev only)
(window as any).__wallpaper = wallpaper;

// --- Post-processing ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(wallpaper.scene, wallpaper.camera));

const asciiPass = new ShaderPass(createAsciiShader(config));
composer.addPass(asciiPass);

// Initialize settings store for live control
initSettings(asciiPass, handleCellScaleChange);

const outputPass = new OutputPass();
composer.addPass(outputPass);

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

// Callback for settings cellScale changes
function handleCellScaleChange(scale: number) {
  config.cellScale = scale;
  resize();
}

// --- OS UI ---
const uiRoot = document.createElement('div');
uiRoot.id = 'os-ui';
document.body.appendChild(uiRoot);

const wm = new WindowManager(uiRoot);
const desktop = new Desktop(uiRoot);
const taskbar = new Taskbar(uiRoot, { onAppTap: (id: string) => {
  if (wm.isOpen(id)) {
    wm.focus(id);
  } else {
    openApp(id);
  }
}});

// Register apps
registerApp(notepadApp);
registerApp(aboutApp);
registerApp(terminalApp);
registerApp(settingsApp);
registerApp(paintApp);
registerApp(snakeApp);

// Build desktop icons
const desktopIcons = listApps().map((app) => ({
  id: app.id,
  label: app.label,
  icon: app.icon!,
  onOpen: () => openApp(app.id),
}));
desktop.setIcons(desktopIcons);

// Start menu items
const startItems = listApps().map((app) => ({
  id: app.id,
  label: app.label,
  onClick: () => openApp(app.id),
}));
taskbar.setStartMenu(startItems);

function openApp(id: string) {
  const app = getApp(id);
  if (!app) return;
  if (wm.isOpen(id)) {
    wm.focus(id);
    return;
  }
  wm.open(app);
  updateTaskbar();
}

function updateTaskbar() {
  const openIds = wm.listOpen();
  const activeId = openIds.length > 0 ? openIds[openIds.length - 1] : null;
  const running = openIds.map((id) => {
    const app = getApp(id)!;
    return { id, title: app.title, icon: app.icon! };
  });
  taskbar.setRunningApps(running, activeId);
}

// Hook window close to update taskbar
const originalClose = wm.close.bind(wm);
wm.close = (id: string) => {
  originalClose(id);
  updateTaskbar();
};

// Start clock
taskbar.start();

// --- Boot screen (real progress: gates on fonts + first GPU frame) ---
const bootScreen = document.getElementById('boot-screen');
const bootBar = document.getElementById('boot-bar');
const bootStatus = document.getElementById('boot-status');

let firstFrameResolve!: () => void;
const firstFrame = new Promise<void>((resolve) => {
  firstFrameResolve = resolve;
});

function setBootProgress(p: number, label: string) {
  if (bootBar) bootBar.style.width = `${Math.round(p * 100)}%`;
  if (bootStatus) bootStatus.textContent = label;
}

async function runBoot() {
  if (!bootScreen) return;
  setBootProgress(0.20, 'Renderer pronto');
  await document.fonts.ready.catch(() => {});
  setBootProgress(0.55, 'Fontes pixeladas carregadas');
  await firstFrame;
  setBootProgress(0.90, 'Shaders compilados');
  setBootProgress(1.00, 'Pronto!');
  // brief visible beat so the user can read "Pronto!" before the fade
  await new Promise((r) => setTimeout(r, 250));
  bootScreen.classList.add('boot-hidden');
  setTimeout(() => bootScreen.remove(), 700);
}

void runBoot();

// --- Loop ---
let prevTime = 0;
let firstFrameRendered = false;
const VORTEX_CELL_SCALE = 30;   // vortex idle (medium-res)
const SHAPE_CELL_SCALE = 75;   // shape idle (high-res, small chars)
const MORPH_CELL_SCALE = 20;   // mid-morph (low-res, large chars)
let currentCellScale = VORTEX_CELL_SCALE;

function applyMorphCellScale(uMorph: number) {
  // V-curve: 30 (vortex) → 20 (mid-morph, chars large) → 75 (shape, high-res)
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
  (window as any).__cellScale = currentCellScale;
}

function animate(time: number) {
  const t = time * 0.001;
  const dt = Math.min(t - prevTime, 1 / 30);
  prevTime = t;
  wallpaper.update(t, dt);
  const morphState = wallpaper.getMorphState?.();
  if (morphState) applyMorphCellScale(morphState.uMorph);
  composer.render();
  if (!firstFrameRendered) {
    firstFrameRendered = true;
    firstFrameResolve();
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
