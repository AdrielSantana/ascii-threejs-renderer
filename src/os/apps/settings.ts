import type { App } from './registry';
import { createIcon } from '../icons';
import { getSettings, updateSetting } from '../settings-store';

export const settingsApp: App = {
  id: 'settings',
  title: 'Settings',
  label: 'Settings',
  icon: createIcon('settings'),
  defaultRect: { x: 60, y: 60, w: 340, h: 400 },
  minSize: { w: 240, h: 280 },
  mount(body) {
    body.className = 'win98-body';

    const scroll = document.createElement('div');
    scroll.style.cssText = 'flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:12px;';

    const s = getSettings();

    const makeSlider = (
      label: string,
      key: keyof typeof s,
      min: number,
      max: number,
      step: number,
      display?: (v: number) => string,
    ) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; flex-direction:column; gap:4px;';

      const header = document.createElement('div');
      header.style.cssText = 'display:flex; justify-content:space-between; font-family:VT323,monospace; font-size:15px;';
      const lbl = document.createElement('span');
      lbl.textContent = label;
      const val = document.createElement('span');
      val.textContent = display ? display(s[key] as number) : String(s[key] as number);
      header.appendChild(lbl);
      header.appendChild(val);

      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(s[key] as number);
      input.style.cssText = 'width:100%; accent-color:#1084d0;';

      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        val.textContent = display ? display(v) : String(v);
        updateSetting(key as any, v);
      });

      row.appendChild(header);
      row.appendChild(input);
      return row;
    };

    const makeColorPicker = (label: string, key: 'fgColor' | 'bgColor') => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; gap:8px; font-family:VT323,monospace; font-size:15px;';

      const lbl = document.createElement('span');
      lbl.textContent = label;
      lbl.style.flex = '1';

      const input = document.createElement('input');
      input.type = 'color';
      input.value = s[key];
      input.style.cssText = 'width:40px; height:28px; border:1px solid #808080; padding:0; cursor:pointer;';

      input.addEventListener('input', () => {
        updateSetting(key, input.value);
      });

      row.appendChild(lbl);
      row.appendChild(input);
      return row;
    };

    // Brightness
    scroll.appendChild(makeSlider('Brightness', 'brightness', 0.5, 10, 0.1, (v) => v.toFixed(1)));
    // Contrast
    scroll.appendChild(makeSlider('Contrast', 'contrast', 0.5, 4, 0.1, (v) => v.toFixed(1)));
    // Gamma
    scroll.appendChild(makeSlider('Gamma', 'gamma', 0.05, 1, 0.01, (v) => v.toFixed(2)));
    // Cell scale (resolution)
    scroll.appendChild(makeSlider('Cell Scale', 'cellScale', 20, 250, 1, (v) => String(Math.round(v))));

    // Colorized toggle
    const toggleRow = document.createElement('div');
    toggleRow.style.cssText = 'display:flex; align-items:center; gap:8px; font-family:VT323,monospace; font-size:15px;';
    const toggleLbl = document.createElement('span');
    toggleLbl.textContent = 'Colorized';
    toggleLbl.style.flex = '1';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = s.colorized;
    toggle.style.cssText = 'width:18px; height:18px; accent-color:#1084d0; cursor:pointer;';
    toggle.addEventListener('change', () => updateSetting('colorized', toggle.checked));
    toggleRow.appendChild(toggleLbl);
    toggleRow.appendChild(toggle);
    scroll.appendChild(toggleRow);

    // Color pickers
    scroll.appendChild(makeColorPicker('Foreground', 'fgColor'));
    scroll.appendChild(makeColorPicker('Background', 'bgColor'));

    // Separator
    const sep = document.createElement('hr');
    sep.style.cssText = 'border:0; border-top:1px solid #808080; margin:4px 0;';
    scroll.appendChild(sep);

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'app-button';
    resetBtn.textContent = 'Reset to Defaults';
    resetBtn.style.alignSelf = 'center';
    resetBtn.addEventListener('click', () => {
      const def = { brightness: 4.5, contrast: 1.5, gamma: 0.22, cellScale: 120, fgColor: '#d6d0b8', bgColor: '#050505', colorized: true };
      (Object.keys(def) as (keyof typeof def)[]).forEach((k) => updateSetting(k as any, def[k] as any));
      // Force re-render: close and reopen
      // For now just tell user to reopen
      const status = document.createElement('div');
      status.textContent = 'Defaults applied — reopen window to refresh sliders';
      status.style.cssText = 'font-family:VT323,monospace; font-size:13px; color:#888; text-align:center;';
      scroll.appendChild(status);
      setTimeout(() => status.remove(), 2000);
    });
    scroll.appendChild(resetBtn);

    body.appendChild(scroll);
  },
  unmount(body) {
    body.innerHTML = '';
  },
};
