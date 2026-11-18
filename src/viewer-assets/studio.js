import * as THREE from 'three';

export function addStudioLights(scene) {
  const key = new THREE.DirectionalLight(0xffffff, 0.91);
  key.position.set(-1.1, 1.8, 2.1);
  scene.add(key, new THREE.AmbientLight(0xffffff, 1.58), new THREE.HemisphereLight(0xffffff, 0xe9e8e5, 0.65));
}

/** Full-canvas orthographic renderer. characterHeight defaults to native units;
 * for the meter-scaled GLB pass its measured height (about 1.6762).
 * Call render(scene, camera) after a change. Pass { ink: false } for the direct
 * uninked beauty pass; dispose() releases only the pass's own GPU resources.
 */
export function createStudioRenderer(renderer, { characterHeight = 986 } = {}) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const size = new THREE.Vector2();
  const depth = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  const target = new THREE.WebGLRenderTarget(1, 1, {
    depthTexture: depth, samples: Math.min(4, renderer.capabilities.maxSamples),
    colorSpace: THREE.SRGBColorSpace, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    storeMultisampledColorBuffer: false, storeMultisampledDepthBuffer: false,
  });
  const ink = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
    uniforms: {
      beauty: { value: target.texture }, depthMap: { value: depth }, stepUV: { value: new THREE.Vector2() },
      depthRange: { value: 1 }, worldPerStep: { value: 1 },
      premultiply: { value: renderer.getContext().getContextAttributes().premultipliedAlpha },
    },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D beauty, depthMap;
      uniform vec2 stepUV;
      uniform float depthRange, worldPerStep;
      uniform bool premultiply;

      // Only the nearer lip of a geometric depth break receives ink. Subtract
      // the opposite slope: smooth convex surfaces and coplanar paint stay clean.
      float lip(vec2 delta, float z) {
        float a = texture2D(depthMap, vUv + delta).r - z;
        float b = texture2D(depthMap, vUv - delta).r - z;
        // A grazing curved surface can have a large gradient on BOTH sides.
        // Require a clear break from that slope, not just its quantization noise.
        float stepDepth = (max(a, b) + 2.8 * min(0., min(a, b))) * depthRange;
        return smoothstep(max(1.3, 1.05*worldPerStep), max(4.1, 3.1*worldPerStep), stepDepth);
      }

      void main() {
        vec4 c = texture2D(beauty, vUv);
        vec3 paper = sRGBTransferOETF(vec4(c.rgb / max(c.a, 0.00001), 1.)).rgb;
        float z = texture2D(depthMap, vUv).r;
        if (z < 1.0 && c.a > 0.) {
          float axial = lip(vec2(stepUV.x, 0.), z) + lip(vec2(0., stepUV.y), z);
          float corners = lip(stepUV, z) + lip(vec2(stepUV.x, -stepUV.y), z);
          float coverage = min(1., 0.40 * axial + 0.23 * corners);
          // Pigment follows the lit surface; a dark hair tip never gains a pale rim.
          float skin = smoothstep(.025, .11, min(paper.r - paper.g, paper.r - paper.b));
          vec3 coolInk = min(paper * vec3(.57,.61,.66), vec3(.32,.37,.44));
          vec3 warmInk = min(paper * vec3(.65,.55,.52), vec3(.52,.36,.34));
          paper = mix(paper, mix(coolInk, warmInk, skin), .74 * coverage);
        }
        gl_FragColor = vec4(premultiply ? paper * c.a : paper, c.a);
      }`,
  });
  const triangle = new THREE.BufferGeometry();
  triangle.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0], 3));
  const screen = new THREE.Scene(), screenCamera = new THREE.Camera();
  const quad = new THREE.Mesh(triangle, ink);
  quad.frustumCulled = false;
  screen.add(quad);

  return {
    render(scene, camera, { ink: withInk = true } = {}) {
      if (!withInk) { renderer.render(scene, camera); return; }
      renderer.getDrawingBufferSize(size);
      if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
      const pixels = Math.max(1, Math.round(renderer.getPixelRatio() * 0.84));
      ink.uniforms.stepUV.value.set(pixels / size.x, pixels / size.y);
      const unit = characterHeight / 986;
      ink.uniforms.worldPerStep.value = (camera.top - camera.bottom) * pixels / (camera.zoom * size.y * unit);
      ink.uniforms.depthRange.value = (camera.far - camera.near) / unit;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(screen, screenCamera);
    },
    dispose() { target.dispose(); triangle.dispose(); ink.dispose(); },
  };
}
