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
const config = parseAsciiConfig(new URLSearchParams());
config.cellScale = 120; // extra large ASCII characters / very low resolution

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.id = 'os-canvas';
document.body.appendChild(renderer.domElement);

// --- Wallpaper ---
const wallpaper = createVortexWallpaper(window.innerWidth, window.innerHeight);

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

// --- Boot screen dismiss ---
const bootScreen = document.getElementById('boot-screen');
if (bootScreen) {
  const bar = document.getElementById('boot-bar');
  const status = document.getElementById('boot-status');
  const messages = ['Inicializando sistema...', 'Carregando módulos...', 'Iniciando interface...', 'Pronto!'];
  let step = 0;
  const bootTick = () => {
    if (step < messages.length) {
      if (status) status.textContent = messages[step];
      if (bar) bar.style.width = `${((step + 1) / messages.length) * 100}%`;
      step++;
      setTimeout(bootTick, 600);
    } else {
      bootScreen.classList.add('boot-hidden');
      setTimeout(() => bootScreen.remove(), 700);
    }
  };
  bootTick();
}

// --- Loop ---
let prevTime = 0;
function animate(time: number) {
  const t = time * 0.001;
  const dt = Math.min(t - prevTime, 1 / 30);
  prevTime = t;
  wallpaper.update(t, dt);
  composer.render();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
