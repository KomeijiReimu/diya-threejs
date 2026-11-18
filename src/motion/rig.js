import { Bone, BufferAttribute, Matrix4, Mesh, Skeleton, SkinnedMesh, Vector3 } from 'three';
import { handLandmarks, wrist } from '../model/outfit-assets/landmarks.js';
import { weights } from './rig/fields.js';

function regionOf(mesh) {
  const ancestors = [];
  let hint;
  for (let node=mesh;node;node=node.parent) {
    ancestors.push(node.name);
    hint ??= node.userData.rigRegion;
  }
  const path=ancestors.join('/'), name=mesh.name;
  const side=hint?.match(/_([LR])$/)?.[0] || (/^(L\b|Left\b)/.test(name)?'_L':/^(R\b|Right\b)/.test(name)?'_R':'');
  const nail=name.match(/\b(thumb|index|middle|ring|little|pinky) nail/i)?.[1].toLowerCase();
  if (nail) return [nail==='little' || nail==='pinky'?'Pinky'+side:nail[0].toUpperCase()+nail.slice(1)+side];
  if (hint) return [hint.replace(/_[LR]$/,''),side];
  if (path.includes('Layered lengths')) return ['hair'];
  if (path.includes('Hair |') || /^Lid_[LR]$/.test(name)) return ['Head'];
  if (path.includes('head, ears and neck')) return [/^Neck \|/.test(name)?'neck':'Head'];
  if (path.includes('Legs and boots')) return ['leg',side];
  if (/culotte|shorts hem|short edge stitch/i.test(path)) return ['shorts',side];
  if (/Bare shoulders|neckline shadow/i.test(name)) return ['shoulder',side];
  if (/bias|folded shoulder underside|shoulder opening/i.test(name)) return ['sash',side];
  if (path.includes('folded standing collar')) return ['Chest'];
  if (/hand and articulated digits/.test(name)) return ['hand',side];
  if (/backed cuff tab|setting|bezel|moonstone/.test(name) && path.includes('bell sleeve and hand')) return ['Forearm'+side];
  if (path.includes('bell sleeve and hand')) return ['arm',side];
  if (path.includes('Coat dress')) return ['dress'];
  throw new Error(`No character binding for ${path}`);
}

/** Bind in the original drawing units. Scaling/positioning the returned character
 * as a whole afterwards requires no changes to the inverse bind matrices. */
export function bindCharacter(root) {
  const bones={}, pivots={}, indices={};
  function add(name,parent,x,y,z) {
    const bone=new Bone(); bone.name=name;
    pivots[name]=new Vector3(x,y,z);
    bone.position.copy(pivots[name]);
    if (parent) bone.position.sub(pivots[parent]);
    indices[name]=Object.keys(bones).length;
    bones[name]=bone; (bones[parent] || root).add(bone);
  }
  add('Root',null,0,0,0); add('Hips','Root',0,505,20);
  add('Spine','Hips',0,625,17); add('Chest','Spine',0,722,8);
  add('Neck','Chest',0,805,5); add('Head','Neck',0,850,6);
  for (const sign of [-1,1]) {
    const s=sign<0?'_L':'_R';
    add('Clavicle'+s,'Chest',18*sign,786,1);
    add('UpperArm'+s,'Clavicle'+s,62*sign,783,0);
    add('Forearm'+s,'UpperArm'+s,91*sign,650,-6);
    add('Hand'+s,'Forearm'+s,wrist[0]*sign,wrist[1],wrist[2]);
    for (const [finger,[[x,y,z]]] of Object.entries(handLandmarks)) add(finger+s,'Hand'+s,x*sign,y,z);
    add('Thigh'+s,'Hips',40*sign,500,20); add('Shin'+s,'Thigh'+s,35*sign,322,14); add('Foot'+s,'Shin'+s,44*sign,76,4);
    add('HairUpper'+s,'Head',38*sign,874,-44); add('HairLower'+s,'HairUpper'+s,59*sign,665,-90);
    add('Skirt'+s,'Hips',45*sign,554,18);
  }
  root.updateWorldMatrix(true,true);
  const skeleton=new Skeleton(Object.values(bones));
  const toRoot=new Matrix4().copy(root.matrixWorld).invert(), matrix=new Matrix4(), point=new Vector3();
  const meshes=[], used=new Set(), rigid=new Map();
  root.traverse(obj=>{if (obj.isMesh) meshes.push(obj);});
  for (const mesh of meshes) {
    const [region,side]=regionOf(mesh);
    if (bones[region]) { rigid.set(mesh,bones[region]); continue; }
    if (!['hair','hand','arm','leg','shorts','neck','shoulder','sash','dress'].includes(region)) throw new Error(`Unknown rigRegion '${region}' on ${mesh.name}`);
    const geometry=mesh.geometry, pos=geometry.attributes.position;
    const ownership=geometry.getAttribute('rigUpperArm');
    const joints=new Uint8Array(pos.count*4), values=new Uint16Array(pos.count*4);
    matrix.multiplyMatrices(toRoot,mesh.matrixWorld);
    let rigidIndex;
    for (let i=0;i<pos.count;i++) {
      point.fromBufferAttribute(pos,i).applyMatrix4(matrix);
      const row=weights(region,point,side,ownership?.getX(i));
      // Quantize cumulative weights (the differences always sum to 65535).
      let sum=0, prev=0, only=-1;
      for (let j=0;j<row.length;j++) {
        const [joint,w]=row[j]; sum+=w;
        const value=Math.round(65535*sum);
        joints[4*i+j]=value===prev?0:indices[joint]; values[4*i+j]=value-prev;
        if (value-prev===65535) only=indices[joint];
        prev=value;
      }
      if (!i) rigidIndex=only; else if (rigidIndex!==only) rigidIndex=-1;
    }
    if (ownership) geometry.deleteAttribute('rigUpperArm');
    if (rigidIndex>=0) { rigid.set(mesh,skeleton.bones[rigidIndex]); continue; }
    // Shared (mirrored) hands need distinct joint attributes; their actual
    // vertex/index/morph buffers needn't be duplicated in memory or on disk.
    let geo=geometry;
    if (used.has(geometry)) {
      geo=geometry.clone(); geo.attributes={...geometry.attributes}; geo.index=geometry.index;
      geo.morphAttributes=geometry.morphAttributes;
    }
    used.add(geometry);
    geo.setAttribute('skinIndex',new BufferAttribute(joints,4));
    geo.setAttribute('skinWeight',new BufferAttribute(values,4,true));
    const skin=new SkinnedMesh(geo,mesh.material);
    Mesh.prototype.copy.call(skin,mesh,false); // base copy includes morph state and render flags
    skin.geometry=geo;
    const parent=mesh.parent, order=parent.children.indexOf(mesh);
    for (const child of mesh.children.slice()) skin.add(child);
    parent.remove(mesh); parent.add(skin);
    parent.children.splice(parent.children.indexOf(skin),1); parent.children.splice(order,0,skin);
    skin.bind(skeleton,mesh.matrixWorld);
    skin.frustumCulled=false; // A resting sleeve's bounds do not cover an overhead reach.
  }
  // Move maximal rigid branches, not just leaves, so decorative groups (e.g.
  // the brooch) and morph mesh identities survive intact. attach preserves TRS.
  function gather(obj) {
    if (obj.isMesh) return rigid.get(obj);
    if (obj.isBone || !obj.children.length) return;
    const children=obj.children.slice(), targets=children.map(gather);
    if (obj!==root && targets[0] && targets.every(t=>t===targets[0])) return targets[0];
    children.forEach((child,i)=>{if(targets[i]) targets[i].attach(child);});
  }
  gather(root);
  root.updateMatrixWorld(true);
  return bones;
}
