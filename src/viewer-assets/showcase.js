import * as THREE from 'three';
import { createExchangeFX } from '../motion/exchange-fx.js';

// Show time is authoritative for both rAF playback and offline frame capture.
const shots = [
  { id: 'breathe', title: '呼吸', start: 0, duration: 3.6 },
  { id: 'greet', title: '招手', start: 3.6, duration: 4.4 },
  { id: 'bow', title: '行礼', start: 8, duration: 4.4 },
  { id: 'exchange', title: '空间契约·交换', start: 12.4, duration: 8.6 },
];
export const showDuration = 21;
export function durationOf(selection) {
  return selection === 'all' ? showDuration : shots.find(s => s.id === selection).duration;
}

export function createShowcase(scene, character, bounds, shadow) {
  const mixer = new THREE.AnimationMixer(character);
  const actions = shots.map(({id}) => {
    const clip = THREE.AnimationClip.findByName(character.animations, id);
    if (!clip) throw new Error(`缺少角色动作：${id}`);
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    return action;
  });
  const fx = createExchangeFX(scene, character);
  fx.reset();
  const h = bounds.max.y - bounds.min.y;
  const center = bounds.getCenter(new THREE.Vector3());
  const target = new THREE.Vector3();
  const root = character.getObjectByName('Root');
  const foot = new THREE.Vector3();
  const shadowRest = shadow.position.clone();
  const rootRest = root.getWorldPosition(new THREE.Vector3());
  let active = -1;

  return {
    sample(selection, seconds, camera, aspect) {
      const t = THREE.MathUtils.clamp(seconds, 0, durationOf(selection));
      const index = selection === 'all'
        ? shots.findLastIndex(s => s.start <= t)
        : shots.findIndex(s => s.id === selection);
      const shot = shots[index];
      const p = THREE.MathUtils.clamp((selection === 'all' ? t - shot.start : t) / shot.duration, 0, 1);
      const absolute = shot.start + p * shot.duration;
      const action = actions[index];
      if (active !== index) {
        if (active !== -1) actions[active].stop();
        if (active === 3) fx.reset();
        action.reset().play();
        action.paused = true;
        active = index;
      }
      // Absolute local time makes a backwards seek identical to a forward seek;
      // never integrate particles or depend on which frames were displayed.
      action.time = p * action.getClip().duration;
      mixer.update(0);
      character.updateWorldMatrix(true, true);
      if (index === 3) fx.update(p);
      shadow.visible = character.visible;
      root.getWorldPosition(foot).sub(rootRest);
      shadow.position.set(shadowRest.x + foot.x, shadowRest.y, shadowRest.z + foot.z);

      // One standing camera, with a shallow arc into the bow and a single pull
      // back into the wide exchange. No cuts, per-clip reset, or bobbing target.
      const bow = THREE.MathUtils.smootherstep(absolute, 6.5, 9.25);
      const wide = THREE.MathUtils.smootherstep(absolute, 10.45, 12.4);
      const yaw = THREE.MathUtils.lerp(0.085 + 0.28 * bow, 0.08, wide);
      // The exchanged pose's fingertip mesh peaks near y=1191, higher than
      // the hand pivot; leave headroom for the actual skinned silhouette.
      const height = h * THREE.MathUtils.lerp(1.135, 1.33, wide);
      const width = h * THREE.MathUtils.lerp(0.70, 1.28, wide);
      const half = 0.5 * Math.max(height, width / aspect);
      camera.top = half; camera.bottom = -half; camera.right = half * aspect; camera.left = -camera.right;
      camera.zoom = 1;
      target.set(center.x, bounds.min.y + h * THREE.MathUtils.lerp(0.503, 0.603, wide), center.z * (1 - wide));
      camera.position.set(Math.sin(yaw), 0.032 + 0.02 * bow - 0.018 * wide, Math.cos(yaw)).normalize().multiplyScalar(h * 3).add(target);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      return shot;
    },
    stop() {
      if (active !== -1) actions[active].stop();
      if (active === 3) fx.reset();
      character.updateWorldMatrix(true, true);
      shadow.position.copy(shadowRest);
      shadow.visible = true;
      active = -1;
    },
    dispose() {
      this.stop();
      fx.dispose();
      mixer.uncacheRoot(character);
    },
  };
}
