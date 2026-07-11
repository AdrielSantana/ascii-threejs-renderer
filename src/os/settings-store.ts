import type { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export interface OsSettings {
  brightness: number;
  contrast: number;
  gamma: number;
  cellScale: number;
  fgColor: string;
  bgColor: string;
  colorized: boolean;
}

const defaults: OsSettings = {
  brightness: 4.5,
  contrast: 1.5,
  gamma: 0.22,
  cellScale: 120,
  fgColor: '#d6d0b8',
  bgColor: '#050505',
  colorized: true,
};

let current: OsSettings = { ...defaults };
let asciiPass: ShaderPass | null = null;
let onCellScaleChange: ((scale: number) => void) | null = null;

export function initSettings(pass: ShaderPass, onScale: (s: number) => void): void {
  asciiPass = pass;
  onCellScaleChange = onScale;
}

export function getSettings(): OsSettings {
  return { ...current };
}

export function updateSetting<K extends keyof OsSettings>(key: K, value: OsSettings[K]): void {
  current[key] = value;

  if (!asciiPass) return;

  const u = asciiPass.uniforms;

  switch (key) {
    case 'brightness':
      u.uBrightness.value = value;
      break;
    case 'contrast':
      u.uContrast.value = value;
      break;
    case 'gamma':
      u.uGamma.value = value;
      break;
    case 'fgColor':
      u.uForeground.value.set(value as string);
      break;
    case 'bgColor':
      u.uBackground.value.set(value as string);
      break;
    case 'colorized':
      u.uColorized.value = value ? 1 : 0;
      break;
    case 'cellScale':
      onCellScaleChange?.(value as number);
      break;
  }
}
