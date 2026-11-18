import { DataTexture, LinearFilter, SRGBColorSpace } from 'three';
import { createShowcase, durationOf, showDuration } from './showcase.js';

const byId = id => document.getElementById(id);
const stamp = seconds => `0:${seconds.toFixed(1).padStart(4, '0')}`;

export function createPlayback({ scene, character, bounds, shadow, camera, studio, host, resize, scheduleFrame, setInteractive }) {
  const director = createShowcase(scene, character, bounds, shadow);
  const cinemaCamera = camera.clone();
  // Unlike the static viewer's CSS backdrop, the film stock belongs to the
  // actual framebuffer: saving canvas pixels produces the same light studio.
  const originalBackground = scene.background;
  const pixels = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; ++y) for (let x = 0; x < 128; ++x) {
    const t = Math.max(0, 1 - Math.hypot((x - 64) / 95, (y - 82) / 110));
    const glow = t * t * (3 - 2 * t), p = (128 * y + x) * 4;
    pixels[p] = 226 + 22 * glow; pixels[p+1] = 234 + 16 * glow; pixels[p+2] = 231 + 16 * glow; pixels[p+3] = 255;
  }
  const filmBackground = new DataTexture(pixels, 128, 128);
  filmBackground.colorSpace = SRGBColorSpace;
  filmBackground.minFilter = filmBackground.magFilter = LinearFilter;
  filmBackground.needsUpdate = true;
  const portal = byId('show-transport'), panel = byId('transport');
  const toggle = byId('show-toggle'), restart = byId('show-restart');
  const title = byId('show-title'), clock = byId('show-time'), index = byId('show-index'), meter = byId('show-progress');
  const choice = byId('clip-choice'), one = byId('play-clip'), all = byId('play-all');
  let session = null;
  let returnFocus = null;

  function reveal(open, focus = false) {
    panel.hidden = !open;
    portal.setAttribute('aria-expanded', String(open));
    portal.setAttribute('aria-label', open ? '隐藏播放控制' : '显示播放控制');
    if (focus) (open ? (session.ended ? restart : toggle) : portal).focus({preventScroll: true});
  }
  function transportState() {
    toggle.hidden = session.ended;
    toggle.textContent = session.playing ? '暂停' : '继续播放';
    document.body.dataset.playback = session.capture ? 'capture' : session.ended ? 'ended' : session.playing ? 'playing' : 'paused';
  }
  function paint() {
    const shot = director.sample(session.selection, session.seconds, cinemaCamera, host.clientWidth / host.clientHeight);
    studio.render(scene, cinemaCamera);
    if (session.capture) return;
    title.textContent = shot.title;
    index.textContent = session.ended ? '放映结束' : session.selection === 'all' ? '全部连播' : '单段放映';
    clock.textContent = `${stamp(session.seconds)} / ${stamp(session.duration)}`;
    meter.value = session.seconds;
  }
  function start(selection, capture = false) {
    returnFocus = selection === 'all' ? all : one;
    session = { selection, capture, duration: durationOf(selection), seconds: 0, playing: !capture, ended: false, origin: 0 };
    document.body.classList.add('is-showing');
    scene.background = filmBackground;
    setInteractive(false);
    portal.hidden = capture;
    meter.max = session.duration;
    reveal(false);
    transportState();
    resize();
    paint();
    session.origin = performance.now();
    if (!capture) {
      portal.focus({preventScroll: true});
      scheduleFrame();
    }
  }
  function exit() {
    if (!session) return;
    director.stop();
    session = null;
    panel.hidden = portal.hidden = true;
    document.body.classList.remove('is-showing');
    scene.background = originalBackground;
    document.body.dataset.playback = 'idle';
    setInteractive(true);
    resize();
    returnFocus?.focus({preventScroll:true});
  }
  function playPause() {
    if (session.ended) return;
    if (session.playing) {
      // Retain the displayed frame (not a later part of the gesture).
      session.playing = false;
      reveal(true, true);
    } else {
      session.origin = performance.now() - session.seconds * 1000;
      session.playing = true;
      reveal(false, true);
      scheduleFrame();
    }
    transportState();
  }
  function fromStart() {
    session.seconds = 0;
    session.ended = false;
    session.playing = true;
    transportState();
    reveal(false, true);
    paint();
    session.origin = performance.now();
    scheduleFrame();
  }
  one.addEventListener('click', () => start(choice.value));
  all.addEventListener('click', () => start('all'));
  portal.addEventListener('click', () => reveal(panel.hidden, true));
  byId('show-hide').addEventListener('click', () => reveal(false, true));
  byId('show-exit').addEventListener('click', exit);
  toggle.addEventListener('click', playPause);
  restart.addEventListener('click', fromStart);
  document.addEventListener('keydown', (event) => {
    if (!session || session.capture || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') { event.preventDefault(); exit(); }
    else if (event.code === 'Space' && !event.repeat && (event.target === portal || event.target === document.body)) {
      event.preventDefault();
      if (session.ended) fromStart(); else playPause();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && session?.playing) playPause();
  });
  one.disabled = all.disabled = choice.disabled = false;
  document.body.dataset.playback = 'idle';

  return {
    get active() { return session !== null; },
    draw(now) {
      if (session.playing) {
        session.seconds = Math.min(session.duration, Math.max(0, (now - session.origin) / 1000));
        if (session.seconds === session.duration) { session.ended = true; session.playing = false; }
      }
      paint();
      if (session.ended) {
        director.stop();
        if (document.body.dataset.playback !== 'ended') {
          transportState();
          reveal(true, true);
        }
      }
      if (session.playing) scheduleFrame();
    },
    enableCapture() {
      start('all', true);
      window.diyaCapture = Object.freeze({
        duration: showDuration,
        seek(seconds) {
          if (!Number.isFinite(seconds)) throw new TypeError('seek(seconds) 需要有限秒数。');
          session.seconds = Math.min(showDuration, Math.max(0, seconds));
          paint();
        },
      });
    },
    dispose() {
      if (session?.capture) delete window.diyaCapture;
      exit();
      director.dispose();
      filmBackground.dispose();
      delete document.body.dataset.motionReady;
      one.disabled = all.disabled = choice.disabled = true;
    },
  };
}
