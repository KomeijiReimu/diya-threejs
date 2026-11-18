import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { addStudioLights, createStudioRenderer } from './viewer-assets/studio.js';
import { createPlayback } from './viewer-assets/playback.js';
import { buildCharacter } from './model/index.js';
import frontImage from '../四视图/笛亚正视图.png';
import sideImage from '../四视图/笛亚侧视图.png';
import backImage from '../四视图/笛亚后视图.png';
import topImage from '../四视图/笛亚俯视图.png';
import './style.css';

const byId = (id) => document.getElementById(id);
const presets = {
  front:   { name: '正面', dir: [0, 0.012, 1], image: frontImage, ref: '正视图' },
  side:    { name: '侧面', dir: [1, 0, 0], image: sideImage, ref: '侧视图' },
  back:    { name: '背面', dir: [0, 0, -1], image: backImage, ref: '后视图' },
  top:     { name: '俯视', dir: [0, 1, 0.0001], image: topImage, ref: '俯视图' },
  quarter: { name: '斜侧', dir: [0.71, 0.075, 1] },
};
const entries = Object.entries(presets);
for (const [, view] of entries) view.vector = new THREE.Vector3(...view.dir).normalize();

const stage = document.querySelector('.stage');
const presetButtons = [...document.querySelectorAll('[data-view]')];
const compare = byId('compare');
const reference = byId('reference');
const refImage = byId('reference-image');
const refCaption = byId('ref-caption');
const refError = byId('ref-error');
const notice = byId('notice');
const host = byId('canvas-host');
let referenceKey = 'front';
let nearbyReference = false;

function updateReference() {
  if (reference.hidden) return;
  const { image, ref } = presets[referenceKey];
  reference.dataset.view = referenceKey;
  refCaption.textContent = nearbyReference ? `邻近视角 · ${ref}` : ref;
  if (refImage.dataset.view !== referenceKey) {
    refError.hidden = true;
    refImage.hidden = false;
    refImage.dataset.view = referenceKey;
    refImage.alt = `笛亚原始设定：${ref}`;
    refImage.src = image;
  }
}

compare.addEventListener('click', () => {
  const open = reference.hidden;
  reference.hidden = !open;
  stage.classList.toggle('is-comparing', open);
  compare.setAttribute('aria-pressed', String(open));
  updateReference();
});
refImage.addEventListener('error', () => {
  refImage.hidden = true;
  refError.hidden = false;
});
byId('retry').addEventListener('click', () => window.location.reload());

function showError(title, detail, error) {
  console.error(title, error);
  byId('notice-title').textContent = title;
  byId('notice-detail').textContent = detail;
  notice.querySelector('.loader').hidden = true;
  byId('retry').hidden = false;
  notice.hidden = false;
  byId('current-view').textContent = '未就绪';
  for (const button of [...presetButtons, ...document.querySelectorAll('.camera-tools button')]) button.disabled = true;
}

async function initialize() {
  const capture = new URLSearchParams(location.search).get('capture') === '1';
  let playback;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: capture, powerPreference: 'high-performance' });
  } catch (error) {
    showError('无法启动三维视图', '请检查浏览器的图形加速设置。你也可以查看参考图或下载模型。', error);
    return;
  }
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const studio = createStudioRenderer(renderer);
  const canvas = renderer.domElement;
  host.append(canvas);
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '笛亚三维模型。拖动或使用方向键旋转，滚轮、双指或加减键缩放，F 键查看全身。');
  let contextLost = false;
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    playback?.dispose();
    showError('三维视图已中断', '请重新载入页面，或继续查看参考图。', event);
  });

  const scene = new THREE.Scene();
  addStudioLights(scene);

  const character = await buildCharacter();
  if (contextLost) return;
  scene.add(character);
  const bounds = new THREE.Box3().setFromObject(character, true);
  const size = bounds.getSize(new THREE.Vector3());
  if (bounds.isEmpty() || !Number.isFinite(size.y) || size.y <= 0) throw new Error('模型没有可取景的几何边界。');
  const center = bounds.getCenter(new THREE.Vector3());
  const h = size.y;

  // A small transparent footprint instead of a floor: lower views stay unobstructed.
  const shadowMap = document.createElement('canvas');
  shadowMap.width = shadowMap.height = 128;
  const brush = shadowMap.getContext('2d');
  const penumbra = brush.createRadialGradient(64, 64, 0, 64, 64, 64);
  penumbra.addColorStop(0, 'rgba(59, 77, 77, .22)');
  penumbra.addColorStop(0.32, 'rgba(59, 77, 77, .15)');
  penumbra.addColorStop(0.73, 'rgba(59, 77, 77, .045)');
  penumbra.addColorStop(1, 'rgba(59, 77, 77, 0)');
  brush.fillStyle = penumbra;
  brush.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowMap);
  shadowTexture.colorSpace = THREE.SRGBColorSpace;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.54, h * 0.30), new THREE.MeshBasicMaterial({
    map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false,
  }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(center.x, bounds.min.y - h * 0.001, 0);
  shadow.renderOrder = -1;
  scene.add(shadow);

  const distance = h * 3;
  const camera = new THREE.OrthographicCamera(-h, h, h, -h, h * 0.002, h * 15);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.9;
  controls.zoomToCursor = true;
  controls.minZoom = 0.33;
  controls.maxZoom = 14;
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(presets.front.vector, distance);
  controls.update();

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const direction = new THREE.Vector3();
  let selected = 'front';
  let flight = null;
  let frameId = 0;

  function refreshReadout() {
    direction.subVectors(camera.position, controls.target).normalize();
    selected = null;
    let best = -Infinity;
    for (const [key, view] of entries) {
      const score = direction.dot(view.vector);
      if (score > 0.99994) selected = key;
      if (view.image && score > best) { referenceKey = key; best = score; }
    }
    nearbyReference = selected !== referenceKey;
    updateReference();
    for (const button of presetButtons) button.setAttribute('aria-pressed', String(button.dataset.view === selected));
    byId('current-view').textContent = selected ? presets[selected].name : '自由视角';
    byId('zoom').textContent = `${Math.round(camera.zoom * 100)}%`;
    byId('zoom-out').disabled = camera.zoom <= controls.minZoom;
    byId('zoom-in').disabled = camera.zoom >= controls.maxZoom;
  }

  function scheduleFrame() {
    if (!frameId && !contextLost) frameId = requestAnimationFrame(draw);
  }
  function draw(now) {
    frameId = 0;
    if (contextLost) return;
    if (playback?.active) { playback.draw(now); return; }
    if (flight) {
      const t = Math.min((now - flight.start) / flight.duration, 1);
      const k = 1 - (1 - Math.max(t, 0)) ** 3;
      const { from, to } = flight;
      const pose = new THREE.Spherical(distance, THREE.MathUtils.lerp(from.phi, to.phi, k), THREE.MathUtils.lerp(from.theta, to.theta, k));
      controls.target.lerpVectors(flight.oldTarget, flight.newTarget, k);
      camera.position.setFromSpherical(pose).add(controls.target);
      camera.zoom = THREE.MathUtils.lerp(flight.oldZoom, flight.newZoom, k);
      camera.updateProjectionMatrix();
      controls.update();
      if (t === 1) flight = null;
      else scheduleFrame();
    }
    studio.render(scene, camera);
  }

  function frameTo(vector, target, zoom) {
    const from = new THREE.Spherical().setFromVector3(new THREE.Vector3().subVectors(camera.position, controls.target));
    const to = new THREE.Spherical().setFromVector3(vector);
    to.theta = from.theta + Math.atan2(Math.sin(to.theta - from.theta), Math.cos(to.theta - from.theta));
    flight = {
      from, to, oldTarget: controls.target.clone(), newTarget: target.clone(),
      oldZoom: camera.zoom, newZoom: THREE.MathUtils.clamp(zoom, controls.minZoom, controls.maxZoom),
      start: performance.now(), duration: reducedMotion.matches ? 1 : 260,
    };
    scheduleFrame();
  }
  function fitZoom(view) {
    if (view !== 'top') return 1;
    const aspect = camera.right / camera.top;
    return (2 * camera.top) / Math.max(size.z * 1.29, size.x * 1.28 / aspect);
  }
  function adjustZoom(factor) {
    flight = null;
    camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom);
    camera.updateProjectionMatrix();
    refreshReadout();
    scheduleFrame();
  }
  function resize() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    const aspect = width / height;
    const span = Math.max(h * 1.085, Math.max(size.x, size.z) * 1.115 / aspect);
    camera.top = span / 2;
    camera.bottom = -camera.top;
    camera.right = camera.top * aspect;
    camera.left = -camera.right;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    scheduleFrame();
  }

  controls.addEventListener('change', () => { refreshReadout(); scheduleFrame(); });
  controls.addEventListener('start', () => { flight = null; });
  new ResizeObserver(resize).observe(host);
  resize();
  for (const button of presetButtons) {
    button.disabled = false;
    button.addEventListener('click', () => {
      const name = button.dataset.view;
      frameTo(presets[name].vector, center, fitZoom(name));
    });
  }
  for (const button of document.querySelectorAll('.camera-tools button')) button.disabled = false;
  byId('fit').addEventListener('click', () => {
    frameTo(new THREE.Vector3().subVectors(camera.position, controls.target), center, fitZoom(selected));
  });
  byId('face').addEventListener('click', () => {
    const target = new THREE.Vector3(center.x, bounds.min.y + h * 0.89, h * 0.025);
    const span = Math.max(h * 0.30, h * 0.22 / (camera.right / camera.top));
    frameTo(presets.front.vector, target, 2 * camera.top / span);
  });
  byId('zoom-in').addEventListener('click', () => adjustZoom(1.25));
  byId('zoom-out').addEventListener('click', () => adjustZoom(0.8));

  canvas.addEventListener('keydown', (event) => {
    if (contextLost || playback?.active || event.ctrlKey || event.altKey || event.metaKey) return;
    const pose = new THREE.Spherical().setFromVector3(new THREE.Vector3().subVectors(camera.position, controls.target));
    switch (event.key) {
      case '+': case '=': adjustZoom(1.25); break;
      case '-': adjustZoom(0.8); break;
      case 'f': case 'F': byId('fit').click(); break;
      case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown':
        pose.theta += event.key === 'ArrowRight' ? 0.14 : event.key === 'ArrowLeft' ? -0.14 : 0;
        pose.phi += event.key === 'ArrowDown' ? 0.14 : event.key === 'ArrowUp' ? -0.14 : 0;
        pose.phi = THREE.MathUtils.clamp(pose.phi, 0.001, Math.PI - 0.001);
        flight = null;
        camera.position.setFromSpherical(pose).add(controls.target);
        controls.update();
        break;
      default: return;
    }
    event.preventDefault();
  });
  refreshReadout();
  notice.hidden = true;
  playback = createPlayback({ scene, character, bounds, shadow, camera, studio, host, resize, scheduleFrame,
    setInteractive(enabled) { flight = null; controls.enabled = enabled; canvas.tabIndex = enabled ? 0 : -1; },
  });
  if (capture) playback.enableCapture();
  document.body.dataset.motionReady = 'true';
  scheduleFrame();
}

initialize().catch((error) => showError('模型未能载入', '可重新载入页面，或打开参考对照查看原始设定。', error));
