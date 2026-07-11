import type { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { AsciiConfig } from './ascii-shader';
import { createGlyphAtlas } from './ascii-shader';

export function createControlPanel(
  config: AsciiConfig,
  asciiPass: ShaderPass,
  onCellSizeChange: () => void,
): HTMLElement {
  const u = asciiPass.uniforms;

  // --- Toggle button ---
  const toggle = document.createElement('button');
  toggle.textContent = '\u2699';
  toggle.style.cssText = [
    'position:fixed', 'bottom:12px', 'right:12px',
    'font:bold 18px monospace', 'color:#d6d0b8',
    'background:rgba(5,5,5,0.85)', 'border:1px solid #554433',
    'padding:6px 10px', 'cursor:pointer', 'z-index:10001',
    'border-radius:3px', 'line-height:1',
  ].join(';');
  document.body.appendChild(toggle);

  // --- Panel container ---
  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:fixed', 'top:0', 'right:0', 'bottom:0',
    'width:280px', 'background:rgba(10,8,12,0.92)',
    'border-left:1px solid #332233',
    'z-index:10000', 'overflow-y:auto',
    'font:13px monospace', 'color:#c8bfb0',
    'padding:12px 14px 60px',
    'box-sizing:border-box',
    'transform:translateX(100%)',
    'transition:transform 0.2s ease',
    'backdrop-filter:blur(6px)',
  ].join(';');

  let visible = false;
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    visible = !visible;
    panel.style.transform = visible ? 'translateX(0)' : 'translateX(100%)';
    toggle.style.opacity = visible ? '0.6' : '1';
  });

  // --- Helper: section label ---
  const section = (label: string): HTMLElement => {
    const el = document.createElement('div');
    el.style.cssText = 'font-weight:bold;color:#8877aa;margin:14px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px';
    el.textContent = label;
    return el;
  };

  // --- Helper: labeled row ---
  const row = (label: string, input: HTMLElement): HTMLElement => {
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:5px';
    const lbl = document.createElement('span');
    lbl.style.cssText = 'flex-shrink:0;width:80px;color:#988f80;font-size:12px';
    lbl.textContent = label;
    r.appendChild(lbl);
    r.appendChild(input);
    return r;
  };

  // --- Helper: range slider ---
  const range = (
    min: number, max: number, step: number, initial: number,
    onChange: (v: number) => void,
  ): { container: HTMLElement; input: HTMLInputElement; val: HTMLElement } => {
    const container = document.createElement('div');
    container.style.cssText = 'display:flex;align-items:center;gap:6px;flex:1';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(initial);
    input.style.cssText = 'flex:1;accent-color:#8877aa;height:16px;margin:0';
    const val = document.createElement('span');
    val.style.cssText = 'width:36px;text-align:right;color:#d6d0b8;font-size:12px';
    val.textContent = String(step < 1 ? initial.toFixed(2) : initial);
    container.appendChild(input);
    container.appendChild(val);
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      val.textContent = String(step < 1 ? v.toFixed(2) : v);
      onChange(v);
    });
    return { container, input, val };
  };

  // ===== CHARSET =====
  panel.appendChild(section('Charset'));
  const charsetInput = document.createElement('input');
  charsetInput.type = 'text';
  charsetInput.value = config.charset;
  charsetInput.style.cssText = [
    'width:100%', 'box-sizing:border-box',
    'background:#1a1420', 'border:1px solid #332233',
    'color:#d6d0b8', 'font:12px monospace',
    'padding:4px 6px', 'border-radius:2px', 'outline:none',
  ].join(';');
  charsetInput.addEventListener('change', () => {
    const s = charsetInput.value;
    if (s.length < 2) return;
    config.charset = s;
    u.uGlyphAtlas.value = createGlyphAtlas(s);
    u.uGlyphCount.value = s.length;
  });
  panel.appendChild(charsetInput);

  // ===== RESOLUTION =====
  panel.appendChild(section('Resolution'));
  const scaleCtrl = range(30, 300, 5, config.cellScale, (v) => {
    config.cellScale = v;
    const pr = Math.min(window.devicePixelRatio, 1.5);
    const shorter = Math.min(window.innerWidth, window.innerHeight);
    const cellH = shorter / v;
    const cellW = cellH * 6 / 9;
    u.uCellSize.value.set(cellW * pr, cellH * pr);
    onCellSizeChange();
  });
  panel.appendChild(row('Scale', scaleCtrl.container));

  // ===== COLORS =====
  panel.appendChild(section('Colors'));

  const fgInput = document.createElement('input');
  fgInput.type = 'color';
  fgInput.value = '#' + config.fg.getHexString();
  fgInput.style.cssText = 'width:36px;height:24px;border:none;padding:0;cursor:pointer;background:none;display:block';
  fgInput.addEventListener('input', () => {
    config.fg.set(fgInput.value);
    u.uForeground.value = config.fg;
  });
  panel.appendChild(row('Foreground', fgInput));

  const bgInput = document.createElement('input');
  bgInput.type = 'color';
  bgInput.value = '#' + config.bg.getHexString();
  bgInput.style.cssText = 'width:36px;height:24px;border:none;padding:0;cursor:pointer;background:none;display:block';
  bgInput.addEventListener('input', () => {
    config.bg.set(bgInput.value);
    u.uBackground.value = config.bg;
  });
  panel.appendChild(row('Background', bgInput));

  const colorizedRow = document.createElement('div');
  colorizedRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:5px';
  const colorizedCb = document.createElement('input');
  colorizedCb.type = 'checkbox';
  colorizedCb.checked = config.colorized;
  colorizedCb.style.cssText = 'accent-color:#8877aa;margin:0';
  colorizedCb.addEventListener('change', () => {
    config.colorized = colorizedCb.checked;
    u.uColorized.value = config.colorized ? 1 : 0;
  });
  const colorizedLabel = document.createElement('span');
  colorizedLabel.style.cssText = 'color:#988f80;font-size:12px';
  colorizedLabel.textContent = 'Colorized';
  colorizedRow.appendChild(colorizedCb);
  colorizedRow.appendChild(colorizedLabel);
  panel.appendChild(colorizedRow);

  // ===== IMAGE =====
  panel.appendChild(section('Image'));
  const ctrlR = range(0.2, 5, 0.05, config.contrast, (v) => {
    config.contrast = v;
    u.uContrast.value = v;
  });
  panel.appendChild(row('Contrast', ctrlR.container));

  const gCtrl = range(0.05, 1, 0.01, config.gamma, (v) => {
    config.gamma = v;
    u.uGamma.value = v;
  });
  panel.appendChild(row('Gamma', gCtrl.container));

  const bCtrl = range(0.5, 15, 0.1, config.brightness, (v) => {
    config.brightness = v;
    u.uBrightness.value = v;
  });
  panel.appendChild(row('Brightness', bCtrl.container));

  // ===== RESET =====
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset Defaults';
  resetBtn.style.cssText = [
    'width:100%', 'margin-top:18px', 'padding:6px',
    'background:#1a1420', 'border:1px solid #554433',
    'color:#c8bfb0', 'font:12px monospace', 'cursor:pointer',
    'border-radius:2px',
  ].join(';');
  resetBtn.addEventListener('click', () => {
    // Charset
    charsetInput.value = ' .,:;irsXA253hMHGS#9B&@';
    charsetInput.dispatchEvent(new Event('change'));
    // Cell size
    scaleCtrl.input.value = '120'; scaleCtrl.val.textContent = '120';
    scaleCtrl.input.dispatchEvent(new Event('input'));
    // Image
    ctrlR.input.value = '1.5'; ctrlR.val.textContent = '1.50';
    ctrlR.input.dispatchEvent(new Event('input'));
    gCtrl.input.value = '0.22'; gCtrl.val.textContent = '0.22';
    gCtrl.input.dispatchEvent(new Event('input'));
    bCtrl.input.value = '4.5'; bCtrl.val.textContent = '4.50';
    bCtrl.input.dispatchEvent(new Event('input'));
    // Colors
    fgInput.value = '#d6d0b8';
    fgInput.dispatchEvent(new Event('input'));
    bgInput.value = '#050505';
    bgInput.dispatchEvent(new Event('input'));
    // Colorized
    colorizedCb.checked = true;
    colorizedCb.dispatchEvent(new Event('change'));
  });

  panel.appendChild(resetBtn);

  document.body.appendChild(panel);
  return panel;
}
