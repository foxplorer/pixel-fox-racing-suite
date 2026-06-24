import * as THREE from 'three'

/**
 * Animated, unlit lava surface. There is no bloom pass in the racing renderer,
 * so "glow" comes from a bright emissive-looking colour rendered with a basic
 * (light-independent) material — it stays vivid in the dark cave while the
 * flickering point lights around it light up the surrounding rock.
 */
export const createLavaSurfaceMaterial = (): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsLib.fog,
      uTime: { value: 0 },
      uCrust: { value: new THREE.Color('#1a0a06') },
      uLavaLow: { value: new THREE.Color('#8f1d05') },
      uLavaHigh: { value: new THREE.Color('#ffd24a') }
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vFogDepth;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vFogDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uCrust;
      uniform vec3 uLavaLow;
      uniform vec3 uLavaHigh;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      varying vec2 vUv;
      varying float vFogDepth;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 4; i++) {
          value += amp * noise(p);
          p *= 2.0;
          amp *= 0.5;
        }
        return value;
      }

      void main() {
        // vUv carries the geometry's raw (world-scaled) vertex coordinates — the lava
        // meshes are built at world size, not unit-normalized — so scale here is in
        // world units. ~0.25 gives molten cells a few metres across, consistent across
        // the basin and every jump pit regardless of their size.
        vec2 p = vUv * 0.25;
        float flow = uTime * 0.18;
        float n = fbm(p + vec2(flow, -flow * 0.6));
        float cracks = fbm(p * 1.9 - vec2(flow * 0.4, flow));
        // Bright molten veins where the two noise fields line up; cooled crust
        // everywhere else.
        float heat = smoothstep(0.46, 0.72, n) * smoothstep(0.35, 0.7, cracks);
        float pulse = 0.85 + 0.15 * sin(uTime * 2.2 + n * 12.0);
        vec3 lava = mix(uLavaLow, uLavaHigh, heat) * pulse;
        vec3 color = mix(uCrust, lava, smoothstep(0.18, 0.5, heat) + heat);
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
      }
    `,
    side: THREE.DoubleSide,
    fog: true,
    transparent: false,
    depthWrite: true
  })

/** Soft radial puff used for both rising steam/smoke and glowing embers. */
export const createSoftSpriteTexture = (): THREE.CanvasTexture => {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}
