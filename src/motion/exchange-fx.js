import * as T from 'three';

const TAU = 2 * Math.PI;
const mix = T.MathUtils.lerp;
const sat = x => Math.max(0, Math.min(1, x));
function ease(a, b, t) { const k = sat((t - a) / (b - a)); return k * k * (3 - 2 * k); }
const windowAt = (a, b, c, d, p) => ease(a, b, p) * (1 - ease(c, d, p));
const fract = x => x - Math.floor(x);
const A = -142, B = 142, jewelY = 363;
const sealStart=[.496,.552,.59], sealDuration=[.171,.145,.125];

// Batched, physical-width strips rather than WebGL's fixed 1px lines. Every
// stroke has its own pigment, taper, and entrance time but shares one draw.
function strokes(name, build) {
  const positions = [], pigments = [], gates = [], bands=[], indices = [], color = new T.Color();
  function ribbon(points, width, hex, opacity=1, delay=0, glow=0, shine=0) {
    color.set(hex);
    const pad=1.45+3.05*glow;
    for(let j=0;j<points.length;++j){
      const a=points[Math.max(0,j-1)],q=points[j],b=points[Math.min(points.length-1,j+1)];
      const dx=b[0]-a[0], dy=b[1]-a[1], f=width*.5*pad/(Math.hypot(dx,dy)||1), i=positions.length/3;
      for(const s of [-1,1]){
        positions.push(q[0]-s*dy*f,q[1]+s*dx*f,q[2]);
        pigments.push(color.r,color.g,color.b,opacity); bands.push(s*pad,glow,shine);
        gates.push(typeof delay==='number'?delay:delay(j));
      }
      if(j)indices.push(i-2,i-1,i+1,i-2,i+1,i);
    }
  }
  build((a,b,...style)=>ribbon([a,b],...style),ribbon);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('pigment', new T.Float32BufferAttribute(pigments, 4));
  geometry.setAttribute('gate', new T.Float32BufferAttribute(gates, 1));
  geometry.setAttribute('band',new T.Float32BufferAttribute(bands,3));
  geometry.setIndex(indices);
  const material = new T.ShaderMaterial({
    uniforms: { ink: { value: 0 }, reveal: { value: 2 }, portrait:{value:new T.Vector3()} },
    vertexShader: `attribute vec4 pigment; attribute float gate; attribute vec3 band;
      varying vec4 vPigment; varying float vGate; varying vec3 vBand; varying vec2 vPlane;
      void main(){vPigment=pigment;vGate=gate;vBand=band;vPlane=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec4 vPigment; varying float vGate; varying vec3 vBand; varying vec2 vPlane;
      uniform float ink,reveal; uniform vec3 portrait;
      void main(){float d=abs(vBand.x), aa=clamp(fwidth(vBand.x),.015,1.25);
      float core=1.-smoothstep(1.-.52*aa,1.+.52*aa,d);
      float glint=1.-smoothstep(.18,.72+.24*aa,d);
      float radiance=max(core,vBand.y*.38*exp(-.37*d*d));
      float room=mix(1.,mix(.05,1.,smoothstep(.55,1.47,length((vPlane-portrait.xy)/vec2(162.,128.)))),portrait.z);
      gl_FragColor=vec4(mix(vPigment.rgb,vec3(1.,.97,.83),vBand.z*glint),vPigment.a*ink*radiance*room*smoothstep(vGate,vGate+.12,reveal));
      #include <colorspace_fragment>
      }`,
    side: T.DoubleSide, transparent: true, depthWrite: false, toneMapped: false, forceSinglePass: true,
  });
  const mesh = new T.Mesh(geometry, material); mesh.name = name; return mesh;
}

// A single triangular enamel stroke with an outer keyline, ice-white inlay
// and a restrained translucent lip. The slightly clipped tips echo her brooch.
function sealGeometry() {
  const geometry = new T.BufferGeometry(), pos = [], rgba = [], indices = [];
  const corners = Array.from({ length: 3 }, (_, i) => {
    const a = i * TAU / 3 - Math.PI / 2; return new T.Vector2(Math.cos(a), Math.sin(a));
  });
  const outline = [];
  for (let i = 0; i < 3; ++i) {
    const a = corners[i], b = corners[(i+1)%3];
    outline.push(a.clone().lerp(b,.013), a.clone().lerp(b,.987));
  }
  const sections = [[.845,0x38dadb,0],[.902,0x2cd2d4,.29],[.926,0x169fa9,.89],
    [.936,0xbdfff8,1],[.951,0xeaffff,1],[.972,0x73ffef,1],[.99,0x32e4dc,1],
    [1.,0x2ecbd0,.94],[1.028,0x33f0f0,.35],[1.082,0x50eeef,0]];
  for (let j = 0; j < sections.length; ++j) {
    const [r, hex, a] = sections[j], c = new T.Color(hex);
    outline.forEach((pt,i) => {
      pos.push(pt.x*r,pt.y*r,0); rgba.push(c.r,c.g,c.b,a);
      const k = j*6+i, n = j*6+(i+1)%6;
      if (j) indices.push(k,n,n-6,k,n-6,k-6);
    });
  }
  geometry.setAttribute('position', new T.Float32BufferAttribute(pos,3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(rgba,4));
  geometry.setIndex(indices); return geometry;
}

/** Browser only stagecraft, not part of the skeletal clip or exported rig.
 * Call update(p) AFTER sampling the mixer. Coordinates are native studio
 * units (986 high, ground 0, +Z front). No clocks, random(), or particle state.
 */
export function createExchangeFX(scene, character) {
  const base = character.position.clone(), originalVisible = character.visible;
  const root = new T.Group(); root.name = 'Spatial exchange · stage'; root.visible = false;
  root.position.copy(base); scene.add(root);
  const left = character.getObjectByName('Hand_L'), right = character.getObjectByName('Hand_R'), head=character.getObjectByName('Head');
  const palm = new T.Vector3(), other = new T.Vector3(), origin = new T.Vector3();

  // An open-sided, forced-perspective frustum: the orthographic studio still
  // has a vanishing point. Pigment is on the planes of the chamber, never on
  // the camera or the background of the scene.
  const chamber = strokes('Folded chamber · violet to rose', line => {
    function point(u,v,q) {
      return [u*mix(160,1740,q), 520+v*mix(152,1136,q), mix(-824,-130,q)];
    }
    const divisions = [0,.047,.126,.361,.562,.788,1];
    for (const q of divisions) {
      const color = q<.12?0xb88ae5:q<.3?0xe093dc:q<.6?0xffabdd:0xffb6d6;
      const a=.46+.47*Math.sqrt(q), w=3.65+10.2*q;
      const ring = [[-1,-1],[1,-1],[1,1],[-1,1]];
      for (let i = 0; i < 4; ++i) {
        const p0=point(...ring[i],q), p1=point(...ring[(i+1)%4],q);
        line(p0,p1,w,color,a,q*.69,.81,.23+.13*q);
      }
    }
    for (const edge of [-1,1]) for (const t of [-1,-.72,-.45,-.22,0,.22,.45,.72,1]) {
      // Subdivide the rails to let depth and strength graduate toward the front.
      for (let i=0; i<divisions.length-1; ++i) {
        const s=divisions[i], e=divisions[i+1], a=.40+e*.43, w=2.+e*5.6;
        line(point(t,edge,s),point(t,edge,e),w,0xf9aadd,a,s*.67,.68,.24);
        if (Math.abs(t)!==1) line(point(edge,t,s),point(edge,t,e),w*.85,0xd590e2,a,s*.67,.65,.22);
        // A few opal inlays catch the light near the floor and side portals;
        // the central aqua seal stays the only cyan silhouette in the room.
        if(edge<0 && Math.abs(t)===.72 && (i===2 || i===4))
          line(point(t,edge,mix(s,e,.26)),point(t,edge,mix(s,e,.83)),w*.88,0x95dfeb,.82,s*.67,.95,.3);
      }
    }
  });
  chamber.renderOrder = -8; root.add(chamber);
  const veil = new T.Mesh(new T.PlaneGeometry(6400,3700),new T.ShaderMaterial({
    uniforms:{ weight:{value:0},deep:{value:new T.Color(0x362053)},iris:{value:new T.Color(0x733593)},
      orchid:{value:new T.Color(0xa93e87)},satin:{value:new T.Color(0xd67cc1)} },
    transparent:true,depthWrite:false,toneMapped:false,
    vertexShader:`varying vec2 plane;void main(){plane=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 plane;uniform float weight;uniform vec3 deep,iris,orchid,satin;
      void main(){vec2 q=plane/vec2(1190.,668.);float r=length(q),theta=atan(q.y,q.x);
      float wall=smoothstep(.14,1.08,r);float flank=smoothstep(.12,1.28,abs(q.x));
      float folds=pow(max(0.,cos(theta*8.+.36)),8.)*smoothstep(.23,.86,r);
      float lamp=exp(-dot((q-vec2(.74,.62))*vec2(1.9,3.1),(q-vec2(.74,.62))*vec2(1.9,3.1)));
      vec3 c=mix(deep,iris,wall*.81);c=mix(c,orchid,flank*.54+.12*wall);c=mix(c,satin,.20*folds+.18*lamp);
      gl_FragColor=vec4(c,weight*(.992-.009*wall));
      #include <colorspace_fragment>
      }`,
  }));
  veil.name='Far portal · violet chamber';veil.position.set(0,520,-905);veil.renderOrder=-9;root.add(veil);

  // A second subject, not a random particle: two-tone marquise cut in an
  // antique-gold gimbal. Its silhouette and colour survive the actual swap.
  const jewel = new T.Group(); jewel.name = 'Counterparty · suspended marquise'; root.add(jewel);
  const shell = strokes('Marquise · interrupted setting', line => {
    for (const sign of [-1,1]) {
      let prev;
      for(let i=0;i<=26;i++) {
        const a = .14+(Math.PI-.28)*i/26;
        const pt=[sign*32*Math.sin(a),49*Math.cos(a),0];
        if(prev) line(prev,pt,i%13===0?2.6:1.9,0xab8353,.95);
        prev=pt;
      }
      line([0,sign*46,0],[0,sign*56,0],1.6,0x9c784a);
      line([-3.4,sign*55,0],[0,sign*61,0],1.8,0xab8353);
      line([0,sign*61,0],[3.4,sign*55,0],1.8,0xab8353);
    }
  });
  shell.material.uniforms.ink.value=1; jewel.add(shell);
  const gemGeom=new T.OctahedronGeometry(1), gemColor=[];
  const facets=[0xe7ce94,0x89cfbb,0x247e80,0xceeed0,0xbd9460,0x5bafac,0xade2c1,0x367f89];
  for(let i=0;i<gemGeom.attributes.position.count;i++){
    const c=new T.Color(facets[Math.floor(i/3)]); gemColor.push(c.r,c.g,c.b);
  }
  gemGeom.setAttribute('color',new T.Float32BufferAttribute(gemColor,3));
  const gem=new T.Mesh(gemGeom,new T.MeshBasicMaterial({vertexColors:true,toneMapped:false}));
  gem.scale.set(20,38,16); jewel.add(gem);

  const gathering=strokes('Intake · three filaments', line=>{
    for(let i=0;i<3;i++) {
      let prev;
      for(let j=0;j<=25;j++) {
        const q=j/25, a=i*TAU/3 + .9*q, r=17+81*q;
        const pt=[Math.cos(a)*r,Math.sin(a)*r*.74,5-13*q];
        if(prev) line(prev,pt,.8+1.85*(1-q),0x55b8b0,.72*(1-q),.48*(1-q)); prev=pt;
      }
    }
  });
  root.add(gathering);
  const sealGeom=sealGeometry();
  const seals = [0,1,2].map(i=>{
    const mesh=new T.Mesh(sealGeom,new T.MeshBasicMaterial({vertexColors:true,transparent:true,
      depthWrite:false,side:T.DoubleSide,forceSinglePass:true,toneMapped:false}));
    mesh.name=['Contract · master seal','Contract · first echo','Contract · answering echo'][i];
    mesh.renderOrder=3-i; root.add(mesh); return mesh;
  });

  // Brass astrolabe: open sweeps, long/short/fifth-degree graduations, two
  // interrupted tips. Built in depth so that Diya occludes the rear arc.
  const orbits=[0,1].map(n=>{
    const orbit=strokes(n?'Brass · oblique dial':'Brass · equatorial dial',(line,ribbon)=>{
      const rx=n?444:525, ry=n?85:101;
      const point=(a,dr=0)=>{
        const x=Math.cos(a),y=Math.sin(a),length=Math.hypot(ry*x,rx*y);
        return [rx*x+dr*ry*x/length,ry*y+dr*rx*y/length,(210+dr*.38)*y];
      };
      const angle=j=>(j/164+.025)*TAU;
      const curve=Array.from({length:145},(_,j)=>point(angle(j)));
      // A continuous joined ribbon, including the soft outer band: no fan
      // of tiny overlapping rectangles that scintillate around the ellipse.
      ribbon(curve,n?7.5:11.8,n?0xffca64:0xffc34f,.99,j=>j/244,1.,.90);
      if(!n)for(const [from,to] of [[7,36],[47,81],[98,131]]){
        const inlay=Array.from({length:to-from+1},(_,j)=>point(angle(from+j),-14));
        ribbon(inlay,2.7,0xffde82,.87,j=>(j+from)/244,.35,.43);
      }
      for(let j=n?9:4;j<144;j+=n?9:4){
        const a=angle(j),major=j%(n?27:16)===0;
        line(point(a,-3.8),point(a,major?32:15),major?6.2:3.9,major?0xffda78:0xffca64,.99,j/244,.7,.79);
      }
    });
    orbit.renderOrder=1; root.add(orbit); return orbit;
  });

  // The address marks remain stationary while their occupants disappear.
  const ports = [A,B].map((x,n)=>{
    const mark=strokes(n?'Receiving address':'Sending address',line=>{
      for(const side of [-1,1]) for(let j=0;j<20;j++){
        const a=(side===1?0:Math.PI)+.24+j*.056, b=a+.056;
        const pt=t=>[Math.cos(t)*64,Math.sin(t)*9,Math.sin(t)*39];
        line(pt(a),pt(b),2,0x699f9d,.88);
      }
      for (let j=0;j<3;j++) {
        const x0=-9+j*9; line([x0,-8,-37],[x0,-11,-45],1.55,0xa48b61,.85);
      }
    }); mark.position.set(x,12,0); root.add(mark); return mark;
  });

  // A cell wipe on the real skinned surfaces: lighting, facial atlas, hair
  // paint, alpha tests and the studio depth ink are all retained. Never edit
  // the originals. Switch back to the exact material references after landing.
  const mask = {value:0}, offset={value:origin}, variants=new Map(), materialSlots=[];
  function variant(original) {
    if(variants.has(original)) return variants.get(original);
    const m=original.clone();
    m.onBeforeCompile=(shader,renderer)=>{
      original.onBeforeCompile(shader,renderer);
      shader.uniforms.exchangeCut=mask; shader.uniforms.exchangeOffset=offset;
      shader.vertexShader=`varying vec3 vExchange; uniform vec3 exchangeOffset;\n${shader.vertexShader}`
        .replace('#include <project_vertex>',`#include <project_vertex>
          vExchange=(modelMatrix*vec4(transformed,1.)).xyz-exchangeOffset;`);
      shader.fragmentShader=`varying vec3 vExchange;uniform float exchangeCut;\n${shader.fragmentShader}`
        .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
          vec3 cell=floor(vExchange/vec3(37.,29.,47.));
          float rnd=fract(sin(dot(cell,vec3(12.9898,78.233,19.171)))*4375.5453);
          float edge=clamp(cell.y/37.,0.,1.)*.76+.22*rnd+.01-exchangeCut;
          if(edge<0.)discard;`)
        .replace('#include <opaque_fragment>',`outgoingLight=mix(outgoingLight,vec3(.28,.92,.87),
          (1.-smoothstep(0.,.06,edge))*.65*smoothstep(0.,.05,exchangeCut));
          #include <opaque_fragment>`);
    };
    m.customProgramCacheKey=()=>original.customProgramCacheKey()+'|spatial-exchange-cells-1';
    variants.set(original,m); return m;
  }
  character.traverse(mesh=>{
    if(!mesh.isMesh) return;
    const original=mesh.material;
    materialSlots.push({mesh,original,cut:Array.isArray(original)?original.map(variant):variant(original)});
  });
  let usingCut=false;
  function useCut(next){
    if(usingCut===next)return;
    for(const slot of materialSlots) slot.mesh.material=next?slot.cut:slot.original;
    usingCut=next;
  }

  // Two counter-moving packet streams. Each tile is a glass pane with an
  // enamel edge and one inset ruling, not an opaque confetti square.
  const packetGeom=new T.PlaneGeometry(1,1), particles=[], count=58;
  const colors = new Float32Array(count*3), fades=new T.InstancedBufferAttribute(new Float32Array(count),1);
  packetGeom.setAttribute('intensity',fades.setUsage(T.DynamicDrawUsage));
  for(let i=0;i<count;i++){
    const anchor=i>=46, id=anchor?i-46:i, h=(id+.5)/(anchor?12:46),
      k=fract(.5+i*.61803398875), u=fract(.27+i*.754877666), v=fract(.1+i*.56984029);
    const breadth = h<.39?44:h<.62?125:h<.77?88:123;
    particles.push({anchor,h,k,u,v,x:(k*2-1)*(anchor?25:breadth),y:anchor?jewelY+(h-.5)*80:38+h*934,
      z:anchor?88+v*19:46+v*61,size:(anchor?9:14)+(anchor?11:28)*u});
    const c=new T.Color(anchor?(id%2?0x8aaf8b:0xc7aa71):(id%3===0?0x33a7b1:0x76ccce));
    c.toArray(colors,i*3);
  }
  packetGeom.setAttribute('pigment',new T.InstancedBufferAttribute(colors,3));
  const packets=new T.InstancedMesh(packetGeom,new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,toneMapped:false,
    vertexShader:`attribute vec3 pigment; attribute float intensity; varying vec2 q; varying vec3 c; varying float a;
      void main(){q=uv;c=pigment;a=intensity;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 q; varying vec3 c; varying float a;
      void main(){vec2 d=min(q,1.-q);float edge=min(d.x,d.y);float aa=max(fwidth(edge),.01);
      float frame=1.-smoothstep(.045,.045+aa,edge);
      float inner=(1.-smoothstep(.012,.012+aa,abs(edge-.16)))*.32;
      gl_FragColor=vec4(mix(c,vec3(.62,.99,.94),smoothstep(.08,.38,edge)*.55),a*(.22+.67*frame+inner));
      #include <colorspace_fragment>
      }`,
  }),count);
  packets.name='Exchange · crossing address cells'; packets.frustumCulled=false; packets.renderOrder=4;
  packets.instanceMatrix.setUsage(T.DynamicDrawUsage); root.add(packets);
  const tile=new T.Object3D();

  function reset(){
    root.visible=false; character.position.copy(base); character.visible=originalVisible;
    useCut(false); mask.value=0; character.updateWorldMatrix(true,false);
  }
  function update(progress){
    const p=sat(progress);
    if(p===0||p===1){reset();return;}
    root.visible=true;
    const swapped=p>=.846, landing=ease(.909,.988,p);
    const outgoingY=16*windowAt(.151,.225,.291,.379,p);
    // Hidden address change, followed by a visible arrival at B. The final
    // return is a descending aerial arc: no horizontal skating at ground level.
    const dx=swapped?mix(B,0,landing):A*ease(.15,.315,p);
    const arrivalY=swapped?49*(1-landing)+53*Math.sin(Math.PI*landing):0;
    character.position.set(base.x+dx,base.y+outgoingY+arrivalY,base.z);
    character.visible=originalVisible && !(p>=.837 && p<=.853);
    mask.value=windowAt(.791,.837,.853,.907,p);
    useCut(mask.value>0 && character.visible);
    character.getWorldPosition(origin);

    const atmosphere=windowAt(.135,.352,.783,.858,p);
    chamber.visible=veil.visible=atmosphere>0;
    chamber.material.uniforms.ink.value=atmosphere;
    chamber.material.uniforms.reveal.value=1.12*ease(.135,.349,p);
    if(atmosphere>0){
      if(head){head.getWorldPosition(other);root.worldToLocal(other);}else other.set(dx,887,0);
      chamber.material.uniforms.portrait.value.set(other.x-38,other.y+21,1);
    }
    veil.material.uniforms.weight.value=atmosphere;

    const jewelLife=windowAt(.074,.244,.942,.989,p)*(1-windowAt(.799,.836,.854,.891,p));
    jewel.visible=jewelLife>0; jewel.scale.setScalar(jewelLife);
    jewel.position.set(swapped?A:B,jewelY+7*Math.sin(TAU*p*1.7),86);
    jewel.rotation.z=.11*Math.sin(TAU*p); gem.rotation.y=.27+p*2.5;
    for(const mark of ports){
      const ink=windowAt(.712,.781,.923,.976,p); mark.visible=ink>0; mark.material.uniforms.ink.value=ink;
    }

    if(p<.717){
      if(left && right){
        left.getWorldPosition(palm); right.getWorldPosition(other); palm.lerp(other,.5);
        root.worldToLocal(palm);
      } else palm.set(dx,p<.21?684:594,126);
      palm.z+=29;
    }
    const drawIn=windowAt(.006,.069,.132,.204,p);
    gathering.visible=drawIn>0; gathering.material.uniforms.ink.value=drawIn;
    gathering.material.uniforms.reveal.value=ease(.006,.106,p);
    if(drawIn>0){gathering.position.copy(palm);gathering.rotation.z=p*2;gathering.scale.setScalar(1.2-.88*ease(.025,.202,p));}
    for(let i=0;i<3;i++){
      const m=seals[i],start=sealStart[i],duration=sealDuration[i];
      const t=sat((p-start)/duration), k=ease(.10,1,t);
      m.visible=t>0 && t<1; if(!m.visible)continue;
      const rad=mix(55-i*4,519-i*63,k), ink=ease(0,.156,t)*(1-ease(.72,1,t));
      // Let the leading corner pass under the eyes instead of bisecting
      // her face. The next contour is still being written at the palms.
      m.position.set(palm.x+(139+i*13)*k,palm.y-6-(154+i*6)*k-31*Math.sin(Math.PI*k),palm.z+6+k*(484-i*72));
      m.scale.setScalar(rad); m.rotation.set(-.04+.095*k,.045+.165*k,.01 + (1.64-i*.39)*k+i*.14);
      m.material.opacity=ink*(1-i*.13);
    }

    for(let i=0;i<2;i++){
      const orb=orbits[i], ink=windowAt(.693+.017*i,.742+.012*i,.786+.006*i,.83,p);
      orb.visible=ink>0; orb.material.uniforms.ink.value=ink;
      orb.material.uniforms.reveal.value=1.08*ease(.695+.017*i,.757+.008*i,p);
      const sweep=ease(.69,.823,p);
      orb.position.set(-57,481+i*48,8);orb.rotation.set(.045,i?.15:-.04,(i?-.70:.15)+(i?.25:.18)*sweep);
      orb.scale.setScalar(.8+.24*sweep);
    }

    packets.visible=p>.782 && p<.915;
    if(packets.visible){
      for(let i=0;i<count;i++){
        const s=particles[i], sign=s.anchor?-1:1;
        const t=ease(.807+.023*s.h,.863+.016*s.u,p), arch=Math.sin(Math.PI*t);
        const alpha=windowAt(.782+s.h*.036,.803+s.h*.039,.863+(1-s.h)*.032,.886+(1-s.h)*.029,p);
        const x=mix(sign*A,sign*B,t)+s.x + sign*(s.u-.18)*45*arch;
        tile.position.set(x,s.y+(s.anchor?-45:52)*arch+ (s.anchor?0:49*t),s.z+(s.anchor?-58:114)*arch);
        tile.rotation.set(.08*(s.k-.5),.36*(s.v-.5)+arch*.6,(s.anchor?.44:0)+(s.v-.5)*.16+arch*(s.k-.5)*.8);
        const size=s.size*(.6+.4*alpha);
        tile.scale.set(size*(.81+.71*s.k),size,1); tile.updateMatrix(); packets.setMatrixAt(i,tile.matrix);
        fades.setX(i,alpha*.95);
      }
      packets.instanceMatrix.needsUpdate=true; fades.needsUpdate=true;
    }
  }
  function dispose(){
    reset(); root.removeFromParent();
    const geometries=new Set(), materials=new Set(variants.values());
    root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    for(const g of geometries)g.dispose(); for(const m of materials)m.dispose(); packets.dispose();
  }
  return {update,reset,dispose};
}
