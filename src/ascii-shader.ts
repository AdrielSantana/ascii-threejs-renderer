import * as THREE from 'three';

export interface AsciiConfig {
  cellScale: number;
  charset: string;
  colorized: boolean;
  contrast: number;
  gamma: number;
  brightness: number;
  fg: THREE.Color;
  bg: THREE.Color;
  shape?: string;
}

export function parseAsciiConfig(search: URLSearchParams): AsciiConfig {
  return {
    cellScale: parseFloat(search.get('scale') ?? '120'),
    charset: search.get('charset') ?? ' .,:;irsXA253hMHGS#9B&@',
    colorized: search.get('colorized') !== 'false',
    contrast: parseFloat(search.get('contrast') ?? '1.5'),
    gamma: parseFloat(search.get('gamma') ?? '0.22'),
    brightness: parseFloat(search.get('brightness') ?? '4.5'),
    fg: new THREE.Color(search.get('fg') ?? '#d6d0b8'),
    bg: new THREE.Color(search.get('bg') ?? '#050505'),
    shape: search.get('shape') ?? undefined,
  };
}

// Font atlas: desenha chars num canvas 1D horizontal.
export function createGlyphAtlas(charset: string): THREE.CanvasTexture {
  const charCount = charset.length;
  const charW = 32;
  const charH = 32;
  const canvas = document.createElement('canvas');
  canvas.width = charW * charCount;
  canvas.height = charH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${charH * 0.9}px monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  for (let i = 0; i < charCount; i++) {
    ctx.fillText(charset[i], i * charW + charW / 2, charH / 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

export function createAsciiShader(config: AsciiConfig) {
  return {
    uniforms: {
      tDiffuse: { value: null },
      uGlyphAtlas: { value: createGlyphAtlas(config.charset) },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uCellSize: { value: new THREE.Vector2(window.innerWidth / 120, window.innerHeight / 120) },
      uGlyphCount: { value: config.charset.length },
      uForeground: { value: config.fg },
      uBackground: { value: config.bg },
      uColorized: { value: config.colorized ? 1 : 0 },
      uContrast: { value: config.contrast },
      uGamma: { value: config.gamma },
      uBrightness: { value: config.brightness },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform sampler2D uGlyphAtlas;
      uniform vec2 uResolution;
      uniform vec2 uCellSize;
      uniform float uGlyphCount;
      uniform float uColorized;
      uniform float uContrast;
      uniform float uGamma;
      uniform float uBrightness;
      uniform vec3 uForeground;
      uniform vec3 uBackground;
      varying vec2 vUv;

      float luminance(vec3 c) {
        return dot(c, vec3(0.2126, 0.7152, 0.0722));
      }

      void main() {
        vec2 grid = uResolution / uCellSize;
        vec2 cell = floor(vUv * grid);
        vec2 cellUv = (cell + 0.5) / grid;
        vec3 sceneColor = texture2D(tDiffuse, cellUv).rgb;
        float brightness = luminance(sceneColor);
        // Brightness boost (multiplicativo)
        brightness *= uBrightness;
        // Gamma: valores < 1 expandem o range escuro (escuros ficam visíveis)
        brightness = pow(clamp(brightness, 0.0, 1.0), uGamma);
        // Contrast around 0.5
        brightness = (brightness - 0.5) * uContrast + 0.5;
        brightness = clamp(brightness, 0.0, 0.9999);
        float glyphIndex = floor(brightness * uGlyphCount);
        vec2 glyphLocalUv = fract(vUv * grid);
        vec2 atlasUv = vec2(
          (glyphIndex + glyphLocalUv.x) / uGlyphCount,
          glyphLocalUv.y
        );
        float glyphMask = texture2D(uGlyphAtlas, atlasUv).r;
        vec3 glyphColor = mix(uForeground, sceneColor, uColorized);
        vec3 finalColor = mix(uBackground, glyphColor, glyphMask);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  };
}
