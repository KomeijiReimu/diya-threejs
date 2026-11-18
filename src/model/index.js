import { Group } from 'three';
import { buildFace } from './face.js';
import { buildHair } from './hair.js';
import { buildOutfit } from './outfit.js';
import { buildLegs } from './legs.js';
import { bindCharacter } from '../motion/rig.js';
import { createClips } from '../motion/clips.js';

export async function buildCharacter() {
  const root = new Group();
  root.name = 'Diya';
  const parts = await Promise.all([buildLegs(), buildOutfit(), buildFace(), buildHair()]);
  parts.forEach((part, i) => {
    part.name ||= ['Legs and boots', 'Dress and arms', 'Head and neck', 'Hair and brooch'][i];
    root.add(part);
  });
  const bones = bindCharacter(root);
  root.animations = createClips(bones);
  return root;
}
