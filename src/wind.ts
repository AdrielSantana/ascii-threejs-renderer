import * as THREE from 'three';

// Uniforms compartilhados de vento — atualizados uma vez por frame no loop.
export const windUniforms = {
  uTime: { value: 0 },
  uWindStrength: { value: 0.4 },
};

/**
 * Injeta vento GPU num material Three.js via onBeforeCompile.
 * - sway: amplitude máxima do balanço (em unidades world)
 * - heightFactor: quanto o topo balança vs base (0..1, baseado na altura local Y)
 *
 * Funciona pra MeshLambertMaterial e MeshStandardMaterial.
 * Requer que o mesh tenha position world acessível (usa modelMatrix).
 */
export function applyWind(material: THREE.Material, sway = 0.15, heightFactor = 1.0) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWindStrength = windUniforms.uWindStrength;
    shader.uniforms.uSway = { value: sway };
    shader.uniforms.uHeightFactor = { value: heightFactor };

    // No vertex shader: injeta antes do gl_Position
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `
        #include <common>
        uniform float uTime;
        uniform float uWindStrength;
        uniform float uSway;
        uniform float uHeightFactor;
        `,
      )
      .replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        // Posição world do vértice
        vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
        // Fator de altura: base (y=0) não balança, topo (y=1+) balança mais
        float h = clamp(transformed.y * uHeightFactor, 0.0, 1.0);
        // Rajada: onda lenta (0.3Hz) modula amplitude
        float gust = 0.5 + 0.5 * sin(uTime * 0.3);
        // Vento principal: senoide com variação espacial
        float wave = sin(uTime * 1.2 + worldPos.x * 0.5 + worldPos.z * 0.5);
        wave += 0.5 * sin(uTime * 2.1 + worldPos.x * 0.8 - worldPos.z * 0.3);
        // Offset horizontal (X e Z)
        float offset = wave * uSway * h * uWindStrength * gust;
        transformed.x += offset;
        transformed.z += offset * 0.4;
        `,
      );
  };
  material.customProgramCacheKey = () => `wind-${sway}-${heightFactor}`;
  return material;
}
