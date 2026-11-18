import {
  AnimationClip, NumberKeyframeTrack, Quaternion, QuaternionKeyframeTrack,
  Vector3, VectorKeyframeTrack,
} from 'three';
import { armPose, legPose, rotation } from './poses/articulation.js';
import { arms, hands } from './poses/gestures.js';
import { scores } from './poses/scores.js';

// A shape-preserving cubic through the drawings. Zero tangent at stationary
// endpoints and at extrema; unequal beat lengths don't cause overshoot. Bake
// the result, because a GLB player should need neither IK nor custom easing.
function curve(rows) {
  const slopes=rows.map((r,i)=>r.slice(1).map((_,j)=>{
    if (!i || i===rows.length-1) return 0;
    const a=rows[i-1], b=rows[i+1], h=r[0]-a[0], k=b[0]-r[0];
    const left=(r[j+1]-a[j+1])/h, right=(b[j+1]-r[j+1])/k;
    if (left*right<=0) return 0;
    return 3*(h+k)/((2*k+h)/left+(k+2*h)/right);
  }));
  return u=>{
    let i=0; while(i<rows.length-2 && u>rows[i+1][0]) i++;
    const a=rows[i], b=rows[i+1], h=b[0]-a[0], t=(u-a[0])/h, s=1-t;
    return slopes[i].map((m,j)=>s*s*((1+2*t)*a[j+1]+h*t*m)+t*t*((3-2*t)*b[j+1]-h*s*slopes[i+1][j]));
  };
}

function armCurves(bones,side,keys) {
  const rotations=keys.map(([t,id])=>[t,armPose(bones,side,hands[id])]);
  const channels={};
  for(const name of Object.keys(rotations[0][1])) {
    let prev;
    channels[name]=curve(rotations.map(([t,pose])=>{
      const q=pose[name], values=q.toArray();
      // q and -q are the same pose. Unwind before component interpolation,
      // especially where a lifted wrist passes the vertical of the head.
      if (prev && prev.dot(q)<0) for(let k=0;k<4;k++) values[k]*=-1;
      prev=new Quaternion(...values);
      return [t,...values];
    }));
  }
  return channels;
}

function makeClip(bones,id) {
  const score=scores[id], duration=score.duration;
  const c={}; for(const [key,rows] of Object.entries(score)) if(Array.isArray(rows)) c[key]=curve(rows);
  const armChannels={...armCurves(bones,-1,arms[id].L),...armCurves(bones,1,arms[id].R)};
  const steps=Math.ceil(duration*30);
  const grid=new Set(Array.from({length:steps+1},(_,k)=>k/steps));
  for(const rows of [...Object.values(score).filter(Array.isArray),arms[id].L,arms[id].R]) for(const row of rows) grid.add(row[0]);
  const frames=[...grid].sort((a,b)=>a-b).filter((t,i,a)=>!i || t-a[i-1]>1e-7);
  const tracks=[], channels={};
  const add=(binding,value)=>{(channels[binding]??=[]).push(value);};
  for(const t of frames) {
    const neutral=t===0 || t===1;
    const [spinePitch,ribPitch,ribTurn,lean,chin,look,tip]=c.body(t);
    const [pitch,drag,opening,hem]=c.cloth(t);
    const pelvis=new Vector3(...(c.hips?.(t)??[0,0,0]));
    const q={ Root:rotation(0,c.yaw?.(t)[0]??0,0),
      Spine:rotation(spinePitch,ribTurn*.35,lean*.48),Chest:rotation(ribPitch,ribTurn*.65,lean*.52),
      Neck:rotation(chin*.38,look*.4,tip*.38), Head:rotation(chin*.62,look*.6,tip*.62) };
    if(c.hips) add('Hips.position',bones.Hips.position.clone().add(pelvis).toArray());
    if(c.rootY) add('Root.position',bones.Root.position.clone().add(new Vector3(0,c.rootY(t)[0],0)).toArray());
    if(c.ribs) add('Chest.position',bones.Chest.position.clone().add(new Vector3(0,c.ribs(t)[0],0)).toArray());
    for(const side of [-1,1]) {
      const s=side<0?'L':'R';
      q['HairUpper_'+s]=rotation(pitch*.56,drag*.65,side*opening*.62-tip*.18);
      q['HairLower_'+s]=rotation(pitch*.74,drag*.65,side*opening*.72-tip*.21);
      q['Skirt_'+s]=rotation(pitch*.21,drag*.45,side*hem);
      const foot=c['foot'+s]?.(t)??[0,0,0,0,0];
      const bank=c.bootBank?.(t)[side<0?0:1]??0;
      if(c.hips || c['foot'+s]) Object.assign(q,legPose(bones,side,pelvis,new Vector3(...foot.slice(0,3)),rotation(foot[3],foot[4],bank),id==='exchange'));
    }
    for(const [name,sample] of Object.entries(armChannels)) q[name]=new Quaternion(...sample(t)).normalize();
    for(const [name,quat] of Object.entries(q)) {
      if(neutral && name!=='Root') quat.identity();
      add(name+'.quaternion',quat.toArray());
    }
    const blink=c.eyes(t)[0];
    // Native target name, index zero on both meshes. Named bracket binding
    // works with the mixer *and* GLTFExporter's morph-track merge.
    for(const s of ['L','R']) add(`Lid_${s}.morphTargetInfluences[Blink]`,[blink]);
  }
  // Keep a compact set of LINEAR/SLERP samples with bounded error. In
  // particular, don't optimize a complete turn down to its equal endpoints.
  const q0=new Quaternion(),q1=new Quaternion(),actual=new Quaternion();
  for(const [binding,values] of Object.entries(channels)) {
    const quat=binding.endsWith('.quaternion'), scalar=values[0].length===1;
    const T=quat?QuaternionKeyframeTrack:scalar?NumberKeyframeTrack:VectorKeyframeTrack;
    const threshold=quat ? .00000012 : scalar ? .005 : .13;
    const keep=new Set([0,frames.length-1]);
    function split(a,b) {
      let worst=threshold, at=-1;
      for(let i=a+1;i<b;i++) {
        const t=(frames[i]-frames[a])/(frames[b]-frames[a]);
        let error=0;
        if(quat) {
          q0.fromArray(values[a]).slerp(q1.fromArray(values[b]),t);
          error=1-Math.abs(q0.dot(actual.fromArray(values[i])));
        } else for(let k=0;k<values[i].length;k++) error=Math.max(error,Math.abs(values[a][k]*(1-t)+values[b][k]*t-values[i][k]));
        if(error>worst) { worst=error; at=i; }
      }
      if(at>=0) {keep.add(at);split(a,at);split(at,b);}
    }
    split(0,frames.length-1);
    // Closed eyes are a held drawing, not just a value within a reduction
    // tolerance of one. Preserve the exact contacts of the lid score.
    if(scalar) for(const row of score.eyes) keep.add(frames.findIndex(t=>Math.abs(t-row[0])<1e-7));
    if(keep.size===2 && !scalar && values[0].every((x,i)=>Math.abs(x-values.at(-1)[i])<1e-8)) continue;
    const keys=[...keep].sort((a,b)=>a-b);
    tracks.push(new T(binding,keys.map(i=>duration*frames[i]),keys.flatMap(i=>values[i])));
  }
  return new AnimationClip(id,duration,tracks);
}

export function createClips(bones) {
  return ['breathe','greet','bow','exchange'].map(id=>makeClip(bones,id));
}
