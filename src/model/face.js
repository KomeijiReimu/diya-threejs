import * as THREE from 'three';
import { size, palette, indices } from './face-assets/atlas.js';

// Values are registered to the 1024-high drawing. p increases from crown to
// chin; columns: p, half-width, widest-section z, broad facial plane z, nape z.
// The mandible has one continuous envelope. Individual profile details such as
// the vermilion or nasal tip must never drive the radius of an entire section.
const skull = [
  [22.6, 0, -4,-4,-4], [24,13,-3.8,9,-15.6], [29,28.5,-3.5,23.5,-29.4],
  [39,41.2,-2.8,35.4,-42.5], [53,51.2,-2.1,44.3,-53], [68,55.3,-1.5,50.1,-58.5],
  [81,55.1,-1,54.4,-59.5], [98,49.7,1.9,58.0,-57.2], [114,44.8,4.7,56.4,-44.5],
  [124,41.2,7.3,56.2,-29.4], [137,37.3,15.9,56.0,-4.5], [146,33.9,24.4,55.7,7.5],
  [152,29.6,29.8,55.2,13.8], [157,23.1,33.7,54.2,19.3], [163,14.1,37.8,52.6,28.4],
  [167,6.9,41.8,51.2,35.8], [169,2.8,45.0,49.7,40.8], [170,0,47.1,47.1,47.1],
];

// Section interpolation for the two silhouettes.
function sections(table) {
  const slopes = table.map((row, i) => row.map((_, j) => {
    const a = table[Math.max(0,i-1)], b = table[Math.min(table.length-1,i+1)];
    const m = (row[j]-a[j])/(row[0]-a[0]), n = (b[j]-row[j])/(b[0]-row[0]);
    if (i === 0) return n;
    if (i === table.length-1) return m;
    return m*n <= 0 ? 0 : 2*m*n/(m+n);
  }));
  return p => {
    let i = 0;
    while (i < table.length-2 && p>table[i+1][0]) ++i;
    const a=table[i], b=table[i+1], h=b[0]-a[0], t=(p-a[0])/h, t2=t*t, t3=t2*t;
    return a.slice(1).map((v,k) => (2*t3-3*t2+1)*v + (t3-2*t2+t)*h*slopes[i][k+1]
      + (-2*t3+3*t2)*b[k+1] + (t3-t2)*h*slopes[i+1][k+1]);
  };
}

const envelope=sections(skull);
function headSection(p) {
  // Filter the drawing's isolated stations as an approximating curve instead of
  // locking curvature changes to individual transverse rings. At either pole
  // the support gently shrinks to zero so the tip and crown remain registered.
  const spread=2.5*Math.tanh((p-22.6)/6)*Math.tanh((170-p)/6);
  const z=[0,0,0,0];let sum=0;
  for(let k=-6;k<=6;k++){
    const weight=Math.exp(-.5*(k/2.4)**2), row=envelope(p+k*spread/2.4);
    for(let i=0;i<4;i++)z[i]+=weight*row[i]; sum+=weight;
  }
  return z.map(v=>v/sum);
}
const gaussian=(x,y,sx,sy)=>Math.exp(-.5*((x/sx)**2+(y/sy)**2));
const clamp = THREE.MathUtils.clamp;

function staticFace(x,p,cos,section) {
  const [,side,base,back]=section;
  if (cos<=0) return side+(side-back)*cos;
  // The maxillary arch, cheek fat, orbital shelves, lower lid folds and labial
  // planes are continuous with the facial skin; no intersecting facial shells.
  const ex=x>0 ? x-22.5 : -x-24.5;
  const nx=x+.65, ax=Math.abs(x), wrap=side+(base-side)*cos;
  // In profile her iris is a sliver, not a broad stripe wrapped around a
  // sphere. Give the socket an oblique, gently convex frontal plane, easing
  // back to the temple well past the lateral canthus.
  const lateral=Math.max(0,ex-6);
  const eyePlane=48.1-.26*ex-.058*lateral*lateral-.105*(p-114);
  const orbitalWeight=Math.exp(-.5*((ax-25)/19)**6-.5*((p-114)/13.7)**4)
    *THREE.MathUtils.smoothstep(cos,0,.43)*THREE.MathUtils.smoothstep(ax,2,12);
  const facialPlane=wrap+(eyePlane-wrap)*orbitalWeight;
  // Nasal root, dorsum, tip and alae are localized, smoothly overlapping lobes.
  let relief=6.8*gaussian(nx,p-98.5,9.5,8.9)+4.15*gaussian(nx,p-116,5.4,9.3)
    +11.9*gaussian(nx,p-131.9,4.65,5.35)+4.1*gaussian(nx,p-140.0,6.3,5.7);
  relief+=.67*gaussian(Math.abs(nx)-4,p-137,2.5,2.95);
  relief+=1.8*gaussian(ax-22,p-131.5,10.8,9.6);          // malar arc
  relief+=.56*gaussian(ex,p-114.5,8.5,7.4);               // corneal dome
  relief+=.79*gaussian(ex,p-98.65+.17*ex,10.9,3.0);       // brow pad
  const lidP=104.7+.025*(ex-1.8)**2;
  relief+=.36*gaussian(ex,p-lidP,11.2,2.1);
  relief+=.19*gaussian(ex,p-(124.15-.024*ex**2),8.8,2.0);
  relief-=.24*gaussian(ex,p-(101.4-.12*ex),9.6,1.8);
  relief+=3.65*gaussian(nx,p-147.8,8.6,6.8);              // rounded muzzle
  relief+=.40*gaussian(Math.abs(nx)-1.7,p-149.6,3.0,1.48);
  relief-=.28*gaussian(nx,p-151.6,5.3,.98);                // subtle parting
  relief+=.59*gaussian(nx,p-153.6,4.8,1.57);               // lower lip roll
  return facialPlane+relief*THREE.MathUtils.smoothstep(cos,0,.47);
}

// Depth drop from the bridge to the inner eye wall, sampled on the approved
// oblique sculpt. Only its transverse *shape* is retained, not the cheek or
// nasal pads beneath it. Seat its centre on the static head, and match both
// depth and tangent at the iris so no perimeter is visible as the head turns.
const canthalDrop=sections([[91,5.21],[96,6.79],[100,10.91],[104,12.20],[108,11.30],
  [112,10.40],[116,9.65],[119,9.06],[122,8.58],[125,8.86],[128,10.35],[131.7,11.87]]);
const canthalArc=sections([[0,0],[1,.009],[4,.135],[8,.418],[12,.715],[16,1]]);
function facialZ(x,p,cos,section,z=staticFace(x,p,cos,section)) {
  const r=Math.abs(x+.65);
  if(cos<=0||p<=91||p>=143||r>=25)return z;
  if(!section.canthus){
    const at=x=>staticFace(x,p,Math.sqrt(1-(x/section[0])**2),section);
    const base=at(-.65),local=base-.5*(at(15.35)+at(-16.65));
    const center=base-2.05*Math.exp(-.5*((p-127)/8.3)**2);
    const drop=THREE.MathUtils.lerp(canthalDrop(Math.min(p,131.7))[0],local,.22);
    const ends=[-1,1].map(sign=>{const x=-.65+sign*25;return [at(x),sign*(at(x+.2)-at(x-.2))/.4];});
    section.canthus={center,drop,ends};
  }
  const {center,drop,ends}=section.canthus;
  let wall;
  if(r<=16)wall=center-drop*canthalArc(r)[0];
  else{
    const [end,slope]=ends[x<-.65?0:1],t=(r-16)/9,t2=t*t,t3=t*t;
    wall=(2*t3-3*t2+1)*(center-drop)+(t3-2*t2+t)*(-.07125*drop)*9
      +(-2*t3+3*t2)*end+(t3-t2)*slope*9;
  }
  // The side wall returns along the sides of the nose rather than in a
  // horizontal transition across the cheeks. The centre settles by <2.1 px.
  const heel=THREE.MathUtils.smootherstep(r,4,22);
  const w=THREE.MathUtils.smootherstep(p,91,102)*(1-THREE.MathUtils.smootherstep(p,129-8*heel,143-8*heel));
  return z+(wall-z)*w;
}


function atlasTexture() {
  const pal=atob(palette), rle=atob(indices), rgba=new Uint8Array(size*size*4);
  let cursor=0, out=0;
  const put = k => {
    rgba[out++]=pal.charCodeAt(3*k); rgba[out++]=pal.charCodeAt(3*k+1);
    rgba[out++]=pal.charCodeAt(3*k+2); rgba[out++]=255;
  };
  while (cursor<rle.length) {
    const token=rle.charCodeAt(cursor++);
    if (token>=128) {
      const k=rle.charCodeAt(cursor++);
      for (let n=token-127;n;n--) put(k);
    } else for (let n=token+1;n;n--) put(rle.charCodeAt(cursor++));
  }
  const tex=new THREE.DataTexture(rgba,size,size,THREE.RGBAFormat,THREE.UnsignedByteType);
  tex.name='Diya | registered facial paint';
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.generateMipmaps=true; tex.magFilter=THREE.LinearFilter; tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.anisotropy=4; tex.needsUpdate=true;
  return tex;
}

function surface(name,pos,idx,mat,{ uv, colors, groups }={}) {
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  if (uv) geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  if (colors) geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setIndex(idx);
  if (groups) for (const g of groups) geo.addGroup(...g);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geo.name=name;
  const obj=new THREE.Mesh(geo,mat); obj.name=name; return obj;
}

// Part the original painted facial sheet at the two lid margins. At rest all
// positions, normals and UVs are barycentric samples of the *original* head
// triangles. There is no second eye decal, replacement iris, or floating lash.
// In motion only the two lamellae roll forward; the eye between them is still.
function blinkLids(head,group) {
  const g=head.geometry, {position,normal}=g.attributes, [mat]=head.material;
  const {data,width}=mat.map.image;
  const first=347.5, step=.25, columns=[];
  const closed=sections([[347.5,112],[349,112.45],[352,114.45],[356,116.05],[360.5,116.95],
    [363,117.05],[367,116.45],[371,115.05],[375,112.6],[378.5,110.05],[382,108.65]]);
  // The outer lash forks into two strokes. Follow the main rim smoothly,
  // rather than jumping between those branches on successive texture columns.
  const open=sections([[347.5,111.4,112.4],[349,109.4,111.35],[350.5,107.55,110.14],
    [352,106.40,108.7],[354,104.96,107.45],[357,103.35,105.96],[360,102.67,105.5],
    [364,102.61,105.52],[367,102.86,106.14],[370,103.86,107.47],[372,104.67,108.92],
    [373.5,103.96,110.45],[375,102.78,111.66],[376,104.24,111.52],
    [378.5,108.52,110.49],[380.8,108.93,109.33],[382,108.95,109.04]]);
  const fold=sections([[347.5,104.0,106.4],[349,101.25,105.53],[351,100.22,104.69],
    [354,99.30,102.95],[356,99.25,102.15],[359,99.68,101.68],[363,100.45,101.65],
    [366,100.7,101.72],[370,101.58,102.26],[373,101.13,102.22],[375.2,100.76,101.48],
    [376.8,102.7,103.73],[382,105.2,106.02]]);
  // Fit the cut to the *ink*, rather than bisecting a circular eyeball. The
  // crease/brow remain on the face; the upper margin contains the original ink.
  for(let u=first;u<=382;u+=step) {
    const col=Math.floor((u-274)*8), [high,rim]=open(u);let low=-Infinity;
    for(let i=0;i<=228;i++) {
      const p=98+i/8,j=(Math.floor((p-54)*8)*width+col)*4;
      const r=data[j],b=data[j+2],gg=data[j+1];
      if(p>107 && (Math.abs(r-253)>12||Math.abs(gg-230)>12||Math.abs(b-216)>12))low=p;
    }
    const arc=closed(u)[0];
    const [f0,f1]=fold(u);
    columns.push([high,rim,Math.max(rim+.1,low+.65),arc,f0,f1,...[.25,.5,.75].map(t=>f1+t*(high-f1))]);
  }
  const profile=u=>{
    const t=clamp((u-first)/step,0,columns.length-1.001),i=Math.floor(t);
    return columns[i].map((v,k)=>THREE.MathUtils.lerp(v,columns[i+1][k],t-i));
  };
  const sectionCache=new Map();
  function onFace(x,p,shading=false) {
    let row=sectionCache.get(p);
    if(!row) {row=headSection(p);sectionCache.set(p,row);}
    const c=Math.sqrt(Math.max(0,1-(x/row[0])**2));
    return shading?staticFace(x,p,c,row):facialZ(x,p,c,row);
  }
  const frontEnd=g.groups[0].count, ix=g.index.array, keep=[], bins=[[],[]],lining=[[],[]];
  for(let i=0;i<frontEnd;i+=3) {
    const ids=[ix[i],ix[i+1],ix[i+2]],x=position.getX(ids[0]), side=x>0?1:-1;
    const u=ids.map(id=>side>0?338+position.getX(id):336-position.getX(id));
    const p=ids.map(id=>1000-position.getY(id));
    if(Math.max(...u)>=344 && Math.min(...u)<=385.5 && Math.max(...p)>=97 && Math.min(...p)<=135)lining[side>0?1:0].push(...ids);
    (Math.max(...u)>=346 && Math.min(...u)<=383.5 && Math.max(...p)>=99 && Math.min(...p)<=133
      ? bins[side>0?1:0] : keep).push(...ids);
  }
  g.clearGroups();g.addGroup(0,keep.length,0);g.addGroup(keep.length,ix.length-frontEnd,1);
  g.setIndex(keep.concat(Array.from(ix.subarray(frontEnd))));
  for (const [b,faces] of bins.entries()) {
    const side=b?1:-1, pos=[], norms=[], uv=[], target=[], targetNorm=[], ind=[], cache=new Map();
    const U=x=>side>0?338+x:336-x;
    // q = (x, reference y, z, original interpolated normal xyz).
    const mix=(a,c,t)=>a.map((v,k)=>v+(c[k]-v)*t);
    function point(q,layer) {
      const [x,p,z,nx,ny,nz]=q, u=U(x,p);
      const k=`${Math.round(x*1e5)},${Math.round(p*1e5)},${layer}`;
      if(cache.has(k))return cache.get(k);
      const id=pos.length/3;cache.set(k,id);
      const [high,upper,lower,arc,foldTop,foldBottom]=profile(u);
      const wing=THREE.MathUtils.smoothstep(u,347.65,349.7)*(1-THREE.MathUtils.smoothstep(u,379.5,381.8));
      let dp=0, weight=0;
      if(layer===0) {
        // A small roll of upper skin supplies most of the closure. The lash
        // travels intact, becoming thinner and slightly upswept at the outside.
        const squash=.53-.22*THREE.MathUtils.smoothstep(u,371.7,375.5), rim=arc+.36;
        const topTarget=rim+(high-upper)*squash, foldEnd=foldTop+.21*(foldBottom-foldTop);
        let dest=p;
        if(p>=high)dest=rim+(p-upper)*squash;
        else if(p>=foldBottom)dest=THREE.MathUtils.lerp(foldEnd,topTarget,(p-foldBottom)/(high-foldBottom));
        else if(p>=foldTop)dest=foldTop+.21*(p-foldTop);
        weight=wing*THREE.MathUtils.smoothstep(p,foldTop-.1,high-.15);
        dp=wing*(dest-p);
      } else if(layer===2) {
        weight=wing*(1-THREE.MathUtils.smoothstep(p,lower,lower+5.1));
        dp=weight*(arc-.27-lower);
      }
      let dz=layer===1?-.75*wing:0, normalX=nx,normalY=ny,normalZ=nz;
      if(weight>1e-6) {
        const a=onFace(x,p), f=onFace(x,p+dp);let lift=0;
        // A linear morph follows chords, while the actual socket is convex.
        // Give its swept margin sufficient clearance across the entire motion.
        for(const t of [.1,.25,.5,.75])lift=Math.max(lift,(onFace(x,p+t*dp)-a)/t-(f-a));
        // The aperture seats behind the advancing rim instead of pushing
        // the lower lid out into a raised, angular plate on full closure.
        dz=f-z+Math.min(.55,lift)*.22+weight*(layer===0?.18:.055);
        // Follow the same authored skin normals as the surrounding face while
        // the two moving margins conform to the actual (corrected) depth.
        const e=.17, dx=(onFace(x+e,p+dp,true)-onFace(x-e,p+dp,true))/(2*e),dy=(onFace(x,p+dp+e,true)-onFace(x,p+dp-e,true))/(2*e);
        const len=Math.hypot(dx,dy,1),blend=THREE.MathUtils.smoothstep(weight,0,.45);
        normalX=nx+blend*(-dx/len-nx);normalY=ny+blend*(dy/len-ny);normalZ=nz+blend*(1/len-nz);
      }
      pos.push(x,1000-p,z);norms.push(nx,ny,nz);uv.push((x+64)/128,(p-54)/128);
      target.push(0,-dp,dz);targetNorm.push(normalX-nx,normalY-ny,normalZ-nz);
      return id;
    }
    function clip(poly,margin,positive) {
      const out=[];
      for(let i=0;i<poly.length;i++){
        const a=poly[i],c=poly[(i+1)%poly.length];
        const v=a[1]-profile(U(a[0],a[1]))[margin],w=c[1]-profile(U(c[0],c[1]))[margin];
        if(positive?v>=0:v<=0)out.push(a);
        if(v*w<0)out.push(mix(a,c,v/(v-w)));
      }
      return out;
    }
    function polygon(poly,layer){
      for(let i=1;i<poly.length-1;i++){
        const a=point(poly[0],layer),b=point(poly[i],layer),c=point(poly[i+1],layer);
        if(a!==b && b!==c && c!==a)ind.push(a,b,c);
      }
    }
    function cut(tri) {
      const rest=clip(tri,1,true),top=clip(tri,1,false),foldOn=clip(top,4,true),roll=clip(foldOn,5,true);
      // Sample the fold shoulders explicitly: without these edges the thin
      // black line would stretch unevenly as a triangle crossed a fold.
      polygon(clip(top,4,false),0);polygon(clip(foldOn,5,false),0);
      let span=roll;
      for(const boundary of [6,7,8,0]){polygon(clip(span,boundary,false),0);span=clip(span,boundary,true);}
      polygon(span,0);
      polygon(clip(rest,2,false),1);polygon(clip(rest,2,true),2);
      // Connect the sliding rims back to the stationary eye. These inward-
      // facing folds have zero width when open; oblique rays cannot see a
      // hollow seam beneath a moving lash, and there is no coplanar overlay.
      for(const [which,layer] of [[1,0],[2,2]]){
        const crossing=[];
        for(let k=0;k<3;k++){
          const a=tri[k],b=tri[(k+1)%3],da=a[1]-profile(U(a[0],a[1]))[which],db=b[1]-profile(U(b[0],b[1]))[which];
          if(da*db<0)crossing.push(mix(a,b,da/(da-db)));
        }
        if(crossing.length===2){
          const [a,b]=crossing.sort((a,b)=>which===1?a[0]-b[0]:b[0]-a[0]);
          const ia=point(a,1),ib=point(b,1),ja=point(a,layer),jb=point(b,layer);
          if(Math.abs(target[ja*3+1])+Math.abs(target[jb*3+1])>1e-5)ind.push(ia,ib,ja,ib,jb,ja);
        }
      }
    }
    for(let i=0;i<faces.length;i+=3){
      const [a,b,c]=faces.slice(i,i+3).map(id=>[position.getX(id),1000-position.getY(id),position.getZ(id),normal.getX(id),normal.getY(id),normal.getZ(id)]);
      const ab=mix(a,b,.5),bc=mix(b,c,.5),ca=mix(c,a,.5);
      cut([a,ab,ca]);cut([ab,b,bc]);cut([ca,bc,c]);cut([ab,bc,ca]);
    }
    // Inside skin on an overlapping ring of original head triangles. Without
    // a lining, MSAA samples at a subpixel T-junction of the moving sheet can
    // see the far side of the skull. Depth ink magnifies this into cheek dots.
    // This unpainted surface stays inside the head at every blink weight.
    const inner=new Map();
    for(const id of lining[b]){
      if(!inner.has(id)){
        const x=position.getX(id),y=position.getY(id),z=position.getZ(id),nx=normal.getX(id),ny=normal.getY(id),nz=normal.getZ(id);
        inner.set(id,pos.length/3);pos.push(x-.24*nx,y-.24*ny,z-.24*nz);norms.push(nx,ny,nz);uv.push(.015625,.015625);
        const p=1000-y, u=U(x,p),[high,,low]=profile(u);
        const seating=THREE.MathUtils.smoothstep(p,high-2,high+.2)*(1-THREE.MathUtils.smoothstep(p,low+.2,low+2.6));
        target.push(0,0,-1.16*seating);targetNorm.push(0,0,0);
      }
      ind.push(inner.get(id));
    }
    const geo=new THREE.BufferGeometry();geo.setIndex(ind);
    for(const [key,values,num] of [['position',pos,3],['normal',norms,3],['uv',uv,2]])geo.setAttribute(key,new THREE.Float32BufferAttribute(values,num));
    geo.morphTargetsRelative=true;
    for(const [key,values] of [['position',target],['normal',targetNorm]]){
      const attr=new THREE.Float32BufferAttribute(values,3);attr.name='Blink';geo.morphAttributes[key]=[attr];
    }
    const lid=new THREE.Mesh(geo,mat);lid.name=side>0?'Lid_R':'Lid_L';geo.name=lid.name;
    group.add(lid);
  }
}

export function buildFace() {
  const group=new THREE.Group(); group.name='Diya | head, ears and neck';
  const skin=new THREE.MeshStandardMaterial({color:0xfde6d8, roughness:.93});
  skin.name='Porcelain-peach skin';
  const faceMat=new THREE.MeshStandardMaterial({map:atlasTexture(),roughness:.93});
  faceMat.name='Face | fitted linework and aquamarine eyes';
  {
    const pos=[], uv=[], front=[], rear=[],medial=[];
    const sides=232, rows=174, start=22.6,end=170;
    const add=(x,p,z)=>{
      pos.push(x,1000-p,z); uv.push((x+64)/128,(p-54)/128);
    };
    add(0,start,-4);
    for (let j=1;j<rows;j++) {
      const p=THREE.MathUtils.lerp(start,end,j/rows), section=headSection(p);
      for (let k=0;k<sides;k++) {
        const theta=2*Math.PI*k/sides,x=section[0]*Math.sin(theta),c=Math.cos(theta);
        const original=staticFace(x,p,c,section),z=facialZ(x,p,c,section,original);
        if(z!==original)medial.push(pos.length/3,z);
        add(x,p,original);
      }
    }
    const bottom=pos.length/3; add(0,end,47.1);
    for (let k=0;k<sides;k++) {
      const next=(k+1)%sides, faces=Math.cos(2*Math.PI*(k+.5)/sides)>0 ? front:rear;
      faces.push(0,1+k,1+next);
      for (let r=0;r<rows-2;r++) {
        const a=1+r*sides+k,b=1+r*sides+next;
        faces.push(a,a+sides,b,b,a+sides,b+sides);
      }
      faces.push(1+(rows-2)*sides+k,bottom,1+(rows-2)*sides+next);
    }
    const head=surface('Head | continuous fitted sculpt',pos,front.concat(rear),[faceMat,skin],{
      uv,groups:[[0,front.length,0],[front.length,rear.length,1]],
    });
    // `surface` has computed the published static face's per-vertex normals
    // on this exact grid. Retain them as the local authored shading normals:
    // change only the positions needed to resolve the oblique eye silhouette.
    // Everywhere outside that patch BOTH positions and normals are original.
    const g=head.geometry;
    for(let i=0;i<medial.length;i+=2)g.attributes.position.setZ(medial[i],medial[i+1]);
    g.computeBoundingSphere();group.add(head);blinkLids(head,group);
  }

  const tintMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96});
  tintMat.name='Skin | hand-tinted ear and neck';
  const cSkin=new THREE.Color(0xfde6d8), cRosy=new THREE.Color(0xd09197), cFold=new THREE.Color(0x9e676e);
  const cPaint=new THREE.Color();
  // A solid pinna with a rolling helix, recessed bowl and antihelical Y. Its
  // anatomical plane faces obliquely forward so both profile and front show it.
  for (const sign of [-1,1]) {
    const pos=[],idx=[],colors=[],n=88,m=27;
    function earPoint(u,v,depth,r,back=false) {
      const gx=(a,b,s,t)=>gaussian(u-a,v-b,s,t);
      // u is anterior, v superior. Three folds rise from the same surface.
      const yFold=.6*gx(-.25,-.05,.15,.42)+.82*gx(-.12,.29,.15,.2)+.47*gx(-.47,.34,.11,.18);
      const bowl=gx(.11,-.15,.4,.46), tragus=gx(.53,-.03,.20,.215);
      const helix=Math.exp(-.5*((r-.80)/.112)**2);
      const h=back ? depth : depth+1.72*helix +1.42*yFold+1.7*tragus-1.65*bowl+.8*gx(.02,-.72,.4,.22);
      const x=44.55+4.4*v-4.3*u+.825*h;
      const z=-1.85-4.15*v+9.4*u+.56*h;
      pos.push(sign*x,877.1+14.85*v,z);
      const rose=back ? .36:clamp(.14+.54*bowl+.15*(1-r)-.16*helix-.11*tragus,0,.93);
      cPaint.copy(cSkin).lerp(cRosy,rose);
      if (!back) cPaint.lerp(cFold,clamp(.76*gx(.22,-.13,.20,.26)+.25*gx(-.42,.12,.13,.40),0,.84));
      colors.push(cPaint.r,cPaint.g,cPaint.b);
    }
    earPoint(0,0,1.65,0);
    for (let j=1;j<=m;j++) {
      const r=j/m;
      for (let k=0;k<n;k++) {
        const t=k*2*Math.PI/n,v=r*Math.sin(t),u=r*Math.cos(t)*(1+.12*v);
        earPoint(u,v,1.65-2.3*r**3,r);
      }
    }
    const backCenter=pos.length/3; earPoint(0,0,-4.6,0,true);
    for (let k=0;k<n;k++) {
      const a=1+k,b=1+(k+1)%n; idx.push(0,b,a);
      for(let j=0;j<m-1;j++) {
        const h=j*n;idx.push(a+h,b+h,a+h+n,b+h,b+h+n,a+h+n);
      }
      idx.push(backCenter,a+(m-1)*n,b+(m-1)*n);
    }
    if (sign<0) for(let i=0;i<idx.length;i+=3) [idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];
    group.add(surface(`Ear ${sign<0?'L':'R'} | helix and concha`,pos,idx,tintMat,{colors}));
  }

  {
    const neck=sections([
      [795,20.4,5.6,18.5], [803,19.1,5.0,17.9], [812,16.7,5.0,16.9],
      [822,15.7,5.1,16.7], [832,16.0,5.3,17.1], [842,16.9,5.8,17.8],
      [855,18.4,6.1,19.4], [867,20.2,5.8,20.7],
    ]);
    const pos=[],idx=[],colors=[],n=72,m=39;
    for(let j=0;j<=m;j++) {
      const y=795+72*j/m,[rx,cz,rz]=neck(y);
      for(let k=0;k<n;k++) {
        const t=k*2*Math.PI/n, c=Math.cos(t),x=rx*Math.sin(t);
        pos.push(x,y,cz+rz*c);
        // Painted jaw shadow, as in the drawing; no disembodied black chin line.
        const lit=clamp(.12+.09*c+.07*Math.sin(t)-.20*clamp((y-826)/23,0,1),.01,.32);
        cPaint.copy(cRosy).lerp(cSkin,lit);
        colors.push(cPaint.r,cPaint.g,cPaint.b);
      }
    }
    for(let k=0;k<n;k++) {
      const next=(k+1)%n;
      for(let j=0;j<m;j++) {
        const a=j*n+k,b=j*n+next;idx.push(a,b,a+n,b,b+n,a+n);
      }
    }
    for (let j of [0,m]) {
      const base=pos.length/3,y=795+72*j/m; pos.push(0,y,neck(y)[1]);
      colors.push(cRosy.r,cRosy.g,cRosy.b);
      for(let k=0;k<n;k++) {
        const a=j*n+k,b=j*n+(k+1)%n;
        if(j===0)idx.push(base,b,a);else idx.push(base,a,b);
      }
    }
    group.add(surface('Neck | visible throat',pos,idx,tintMat,{colors}));
  }
  return group;
}
