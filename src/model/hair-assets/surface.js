import { BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardMaterial, Vector3 } from 'three';

export const V = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);
export const C = hex => new Color(hex);
export const clamp = (a, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, a));
export const silk = new MeshStandardMaterial({name:'Blue silk | painted hair', vertexColors:true, roughness:.85, metalness:0});

export function surface(name, positions, colors, indices, material = silk) {
  const geom = new BufferGeometry();
  geom.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  const mesh = new Mesh(geom, material);
  mesh.name = name;
  return mesh;
}

// Open cubic through a small set of art-directed stations. Positions are allowed to
// overshoot a little (the returning hook on the tips); radii are clamped below.
export function interpolate(keys, t) {
  const k = clamp(t) * (keys.length - 1), i = Math.min(keys.length - 2, Math.floor(k)), u = k-i;
  const a = keys[Math.max(0,i-1)], b = keys[i], c = keys[i+1], d = keys[Math.min(i+2,keys.length-1)];
  return b.map((v,j) => v+.5*u*(c[j]-a[j]+u*(2*a[j]-5*v+4*c[j]-d[j]+u*(3*v-a[j]-3*c[j]+d[j]))));
}

// A pointed closed lens, not a swept circle. The painted outer face is framed
// independently of the tangent so the lock can open fanwise, roll and turn back.
// Stations: x, y, z, semi-width, semi-thickness, roll (degrees in the XZ plane).
export function lock(parent, name, stations, shades, {band=false, plan=false, glints=[], mirror=1, rootCap=true, folds=0}={}) {
  const [outer,inside,edge,flash] = shades.map(C), steps=(stations.length-1)*6, around=24;
  const pos=[], colors=[], ids=[];
  function frame(t) {
    const [x,y,z,w,d,angle=0] = interpolate(stations,t);
    const a=interpolate(stations,t-.0006), b=interpolate(stations,t+.0006);
    const tangent=V(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize();
    const roll=angle*Math.PI/180;
    let width, normal;
    if (band) {
      width=V(0,-1,0).addScaledVector(tangent,tangent.y).normalize();
      normal=V().crossVectors(width,tangent).normalize();
      width.applyAxisAngle(tangent,roll);normal.applyAxisAngle(tangent,roll);
    } else if(plan) {
      // In plan view the width is perpendicular to the drawn S, including on
      // the hook that comes back towards the skull. Never a fixed X extrusion.
      width=V(-tangent.z,0,tangent.x).normalize();
      normal=V().crossVectors(width,tangent).normalize();
      width.applyAxisAngle(tangent,roll);normal.applyAxisAngle(tangent,roll);
    } else {
      // Rising tips must retain the same painted side as their descending run.
      // Use a stable horizontal section on the turn instead of a Frenet frame.
      width=V(Math.cos(roll),0,Math.sin(roll));
      const baseN=V(Math.sin(roll),0,-Math.cos(roll));
      const vertical=clamp(Math.abs(tangent.y)/.5);
      const slope=clamp(baseN.dot(tangent)/Math.max(.36,Math.abs(tangent.y)),-1.1,1.1);
      normal=baseN.clone().addScaledVector(V(0,1,0),slope*vertical).normalize();
      if(tangent.y < -.23) width=V().crossVectors(tangent,normal).normalize();
    }
    return {p:V(x,y,z),w:Math.max(.01,w),d:Math.max(.01,d),width,normal};
  }
  function point(f,angle,extra=0) {
    const h=Math.cos(angle), s=Math.sin(angle);
    // Offset ridge and pinched edges: the cross-section is slightly asymmetric.
    const belly=s*(.51+.49*Math.abs(s))*(1-.19*h);
    const pt=f.p.clone().addScaledVector(f.width,h*f.w).addScaledVector(f.normal,f.d*belly+extra);
    pt.x*=mirror; return pt;
  }
  const first=frame(0);
  const add=(p,c)=>{const i=pos.length/3;pos.push(p.x,p.y,p.z);colors.push(c.r,c.g,c.b);return i};
  // Index winding: section [width,normal] is opposite to tangent; increasing
  // section-angle then increasing path goes inward. Mirror reverses winding too.
  const tri=(a,b,c)=>mirror>0?ids.push(a,c,b):ids.push(a,b,c);
  for(let i=0;i<steps;i++) {
    const t=i/steps,f=frame(t);
    for(let j=0;j<around;j++) {
      const a=j/around*2*Math.PI,s=Math.sin(a), q=Math.cos(a);
      const sheen=.07*(.5+.5*Math.cos((q-.08)*5.8))*(1-q*q);
      const shade=edge.clone().lerp(s>=0?outer:inside,clamp(Math.pow(Math.abs(s),.45)*1.18));
      if(s>0){
        shade.lerp(flash,sheen*(.69+.31*Math.sin(Math.PI*t)));
        // One side of the leaf tumbles under. Its painted occlusion tapers out
        // towards the tip; it reads as a folded blade, not a cylindrical shine.
        const seam=-.58+.27*Math.sin(t*Math.PI*1.55);
        shade.lerp(edge,folds*clamp((seam-q)*7.2+.5)*Math.sin(Math.PI*t)**.46);
      }
      add(point(f,a),shade);
    }
    if(i>0)for(let j=0;j<around;j++) {
      const n=(j+1)%around, u=(i-1)*around,v=i*around;
      tri(u+j,u+n,v+j);tri(u+n,v+n,v+j);
    }
  }
  const end=frame(1).p;end.x*=mirror;
  const tip=add(end,edge.clone().lerp(outer,.55));
  for(let j=0;j<around;j++)tri((steps-1)*around+j,(steps-1)*around+(j+1)%around,tip);
  if(rootCap) {
    const start=first.p.clone();start.x*=mirror;
    const root=add(start,inside);
    for(let j=0;j<around;j++)tri(root,(j+1)%around,j);
  }
  const mesh=surface(name,pos,colors,ids);parent.add(mesh);

  // Narrow, hand-shaped glazes sit on the crest, following the exact lock surface.
  // Keep flashes local; an uninterrupted stripe reads as plastic tubing.
  if(glints.length) {
    const pp=[],cc=[],ii=[];
    for(const [t0,t1,q,breadth] of glints) {
      const base=pp.length/3;
      for(let i=0;i<=12;i++) {
        const f=i/12,t=t0+(t1-t0)*f,section=frame(t),h=q+.15*f;
        const env=Math.pow(Math.sin(Math.PI*f),1.55);
        const pointTip=i===0||i===12;
        for(let side=0;side<(pointTip?1:2);side++) {
          const a=Math.acos(clamp(h+(side?1:-1)*breadth*env,-.98,.98));
          const p=point(section,a,.27);pp.push(p.x,p.y,p.z);
          const col=outer.clone().lerp(flash,.25+.59*env);cc.push(col.r,col.g,col.b);
        }
        if(i) {
          const k=base+2*i-1;
          const draw=(a,b,c)=>mirror>0?ii.push(a,b,c):ii.push(a,c,b);
          if(i===1)draw(base,k+1,k);
          else if(i===12)draw(k-2,k-1,k);
          else {draw(k-2,k-1,k);draw(k-1,k+1,k);}
        }
      }
    }
    parent.add(surface(name+' | reflected light',pp,cc,ii));
  }
  return mesh;
}
