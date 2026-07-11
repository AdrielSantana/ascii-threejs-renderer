import type { App } from './registry';
import { createIcon } from '../icons';

const COLORS = ['#000000', '#808080', '#c3c3c3', '#ffffff', '#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80', '#00ffff', '#0080ff', '#0000ff', '#8000ff', '#ff00ff', '#ff0080'];

export const paintApp: App = {
  id: 'paint',
  title: 'Paint',
  label: 'Paint',
  icon: createIcon('paint'),
  defaultRect: { x: 30, y: 30, w: 360, h: 420 },
  minSize: { w: 240, h: 280 },
  mount(body) {
    body.className = 'win98-body';

    const CANVAS_W = 320;
    const CANVAS_H = 240;

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'app-toolbar';

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = '#ffffff';
    colorPicker.style.cssText = 'width:28px;height:22px;border:1px solid #808080;padding:0;cursor:pointer;';

    const sizeSlider = document.createElement('input');
    sizeSlider.type = 'range';
    sizeSlider.min = '1';
    sizeSlider.max = '12';
    sizeSlider.value = '3';
    sizeSlider.step = '1';
    sizeSlider.style.cssText = 'width:60px;accent-color:#1084d0;';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'app-button';
    clearBtn.textContent = 'Clear';

    const undoBtn = document.createElement('button');
    undoBtn.className = 'app-button';
    undoBtn.textContent = 'Undo';

    toolbar.appendChild(colorPicker);
    toolbar.appendChild(sizeSlider);
    toolbar.appendChild(undoBtn);
    toolbar.appendChild(clearBtn);

    // Color palette row
    const palette = document.createElement('div');
    palette.style.cssText = 'display:flex; flex-wrap:wrap; gap:1px; padding:3px 4px; background:#c3c3c3; border-bottom:1px solid #808080;';

    for (const c of COLORS) {
      const swatch = document.createElement('div');
      swatch.style.cssText = `width:16px;height:16px;background:${c};cursor:pointer;border:1px solid #808080;`;
      swatch.addEventListener('click', () => { colorPicker.value = c; });
      palette.appendChild(swatch);
    }

    // Canvas
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = 'flex:1; display:flex; align-items:center; justify-content:center; background:#808080; padding:4px;';

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    canvas.style.cssText = 'width:100%;height:100%;image-rendering:pixelated;cursor:crosshair;background:#fff;';
    canvasContainer.appendChild(canvas);

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Status bar
    const status = document.createElement('div');
    status.className = 'win98-statusbar';
    status.innerHTML = '<span>Ready</span>';

    body.appendChild(toolbar);
    body.appendChild(palette);
    body.appendChild(canvasContainer);
    body.appendChild(status);

    // Drawing state
    let drawing = false;
    let color = '#ffffff';
    let brushSize = 3;
    let snapshots: ImageData[] = [];

    const saveSnapshot = () => {
      snapshots.push(ctx.getImageData(0, 0, CANVAS_W, CANVAS_H));
      if (snapshots.length > 20) snapshots.shift();
    };

    const drawPoint = (x: number, y: number) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const cx = (x - rect.left) * scaleX;
      const cy = (y - rect.top) * scaleY;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    };

    const getPos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      drawing = true;
      saveSnapshot();
      const pos = getPos(e);
      drawPoint(e.clientX, e.clientY);
      status.innerHTML = `<span>${Math.round(pos.x)}, ${Math.round(pos.y)}</span>`;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      drawPoint(e.clientX, e.clientY);
    });

    canvas.addEventListener('pointerup', (e) => {
      if (!drawing) return;
      drawing = false;
      canvas.releasePointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointercancel', () => { drawing = false; });

    colorPicker.addEventListener('input', () => {
      color = colorPicker.value;
    });

    sizeSlider.addEventListener('input', () => {
      brushSize = parseInt(sizeSlider.value);
      status.innerHTML = `<span>Brush: ${brushSize}px</span>`;
    });

    clearBtn.addEventListener('click', () => {
      saveSnapshot();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      status.innerHTML = '<span>Cleared</span>';
    });

    undoBtn.addEventListener('click', () => {
      if (snapshots.length > 0) {
        ctx.putImageData(snapshots.pop()!, 0, 0);
        status.innerHTML = '<span>Undo</span>';
      }
    });
  },
  unmount(body) {
    body.innerHTML = '';
  },
};
