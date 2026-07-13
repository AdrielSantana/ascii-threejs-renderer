# ASCII GPU Renderer

A real-time ASCII art renderer running entirely on the GPU, built with [Three.js](https://threejs.org/).

A fluid particle vortex (76k GPU-driven particles) is rendered to a framebuffer, then a post-processing shader samples that buffer and maps luminance to characters from a glyph atlas — producing the ASCII effect with zero CPU work per frame.

## Features

- **GPU particle vortex** — 76k particles (38k on mobile) driven entirely by vertex shaders with spring-physics pointer trails
- **Procedural shape morphing** — particles morph into cube, torus, torus knot, and galaxy shapes when idle
- **Drag-to-rotate** — quaternion-based rotation with flick momentum on release
- **ASCII post-processing** — luminance → glyph mapping via a shader pass, with configurable charset, colors, contrast, gamma, and brightness
- **Mobile-friendly** — adaptive particle count, touch controls, reduced-motion support

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:5173/ascii-threejs-renderer/`

## URL parameters

All parameters are optional. Defaults shown below.

| Param         | Default                  | Description                                  |
| ------------- | ------------------------ | -------------------------------------------- |
| `scale`       | `120`                    | ASCII cell scale (higher = smaller chars)    |
| `charset`     | ` .,:;irsXA253hMHGS#9B&@` | Characters ordered by brightness             |
| `colorized`   | `true`                   | Tint ASCII glyphs with scene color           |
| `contrast`    | `1.5`                    | Contrast applied around 0.5                   |
| `gamma`       | `0.22`                   | Gamma expansion for darks (< 1 = brighter)   |
| `brightness`  | `4.5`                    | Multiplicative brightness boost               |
| `fg`          | `#d6d0b8`                | Foreground color (when not colorized)         |
| `bg`          | `#050505`                | Background color                              |
| `shape`       | _(none)_                 | Force a shape: `cube`, `torus`, `torusKnot`, `galaxy` |

### Examples

```
# Default vortex
http://localhost:5173/ascii-threejs-renderer/

# Force galaxy shape
http://localhost:5173/ascii-threejs-renderer/?shape=galaxy

# Green terminal vibe
http://localhost:5173/ascii-threejs-renderer/?charset=01&colorized=false&fg=%2300ff00&bg=%23000000

# High-res ASCII
http://localhost:5173/ascii-threejs-renderer/?scale=200
```

## How it works

### Particle vortex (`src/vortex-wallpaper.ts`)

A `THREE.Points` buffer geometry with 76k particles, each carrying per-particle attributes (`aSeed`, `aSize`, `aFollow`, `aTarget`). The vertex shader computes:

1. **Sphere home** — particles distributed in a sphere with differential spin (faster at core) and wave turbulence
2. **Fluid trail** — a 6-node spring chain follows the pointer; each particle samples a delayed point along the trail for fluid-like motion
3. **Shape morphing** — `aTarget` positions are generated procedurally (`src/shape-library.ts`) and blended via a `uMorph` uniform with per-particle "boil" noise so shapes dissolve rather than snap
4. **Drag rotation** — quaternion-based, avoiding gimbal lock on diagonal drags, with angular velocity momentum after release

### ASCII shader (`src/ascii-shader.ts`)

A `ShaderPass` that:

1. Divides the screen into a grid of cells
2. Samples the rendered scene at each cell center
3. Computes luminance, applies brightness/gamma/contrast
4. Maps the luminance value to a glyph index in a 1D canvas atlas
5. Samples the glyph texture and outputs the final color (scene-tinted or fixed foreground)

### Render pipeline

```
RenderPass (vortex scene) → ShaderPass (ASCII) → OutputPass
```

## Project structure

```
src/
  main.ts              — entry point: renderer, composer, resize, animation loop
  ascii-shader.ts      — ASCII post-processing shader + glyph atlas + URL config
  vortex-wallpaper.ts  — GPU particle vortex with shape morphing + pointer interaction
  shape-library.ts     — procedural shape generators (cube, torus, torusKnot, galaxy)
```

## Build

```bash
npm run build    # outputs to dist/
npm run preview  # preview the production build
```

## License

MIT
