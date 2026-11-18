import * as THREE from 'three';

// Cross-sections in the normalized 683 × 1024 drawing. Y is height off the
// floor; each row gives |center X|, half-width, anterior Z, posterior Z.
// In particular the kneecap is inside the hip line, not over the ankle.
const sections = [
  [50, 44.3, 21.8, 51.8, -29.4], [57, 43.8, 20.1, 44.0, -28.5],
  [65, 43.6, 19.3, 38.0, -26.1], [73, 43.6, 18.5, 33.6, -23.4],
  [80, 43.4, 18.3, 29.5, -21.1], [90, 43.6, 19.8, 25.6, -18.5],
  [103, 43.7, 18.3, 23.0, -16.6], [116, 44.0, 17.1, 21.4, -16.3],
  [135, 43.9, 16.3, 20.4, -16.2], [152, 43.9, 16.2, 19.6, -16.8],
  [171, 43.9, 16.3, 20.6, -17.5], [187, 43.8, 17.2, 21.7, -18.8],
  [206, 44.0, 18.8, 23.4, -20.8], [226, 44.5, 20.8, 25.1, -24.0],
  [244, 44.7, 22.9, 26.9, -26.4], [257, 44.7, 23.1, 28.1, -26.8],
  [270, 43.3, 22.7, 29.4, -25.1], [286, 41.0, 21.4, 31.1, -21.8],
  [297, 38.9, 20.7, 33.8, -18.8], [305, 36.5, 20.5, 37.2, -16.5],
  [316, 34.5, 21.3, 41.9, -13.2], [325, 34.5, 21.8, 43.7, -10.8],
  [338, 35.0, 22.8, 44.8, -8.2], [355, 36.7, 25.0, 49.1, -7.1],
  [370, 38.2, 27.4, 53.3, -7.0], [386, 39.5, 29.6, 57.9, -7.5],
  [402, 40.6, 32.0, 61.8, -8.8], [415, 41.1, 33.9, 65.4, -9.5],
  [436, 40.0, 35.0, 67.2, -11.2], [460, 39.7, 36.9, 68.0, -13.4],
  [480, 39.8, 38.0, 67.7, -15.1], [490, 39.9, 38.1, 67.1, -16.0],
];

// Shape-preserving cubic interpolation. Keeping each traced limit monotonic
// between samples matters most at the hollow above the calf and inside the heel.
function curve(rows) {
  const n = rows.length;
  const slope = rows.map((row, i) => row.slice(1).map((_, j) => {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), c = j + 1;
    if (!i || i === n - 1) return (rows[b][c] - rows[a][c]) / (rows[b][0] - rows[a][0]);
    const h0 = row[0] - rows[a][0], h1 = rows[b][0] - row[0];
    const d0 = (row[c] - rows[a][c]) / h0, d1 = (rows[b][c] - row[c]) / h1;
    if (d0 * d1 <= 0) return 0;
    return 3 * (h0 + h1) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
  }));
  return x => {
    let i = 0;
    while (i + 2 < n && x > rows[i + 1][0]) ++i;
    const a = rows[i], b = rows[i + 1], h = b[0] - a[0];
    const t = Math.max(0, Math.min(1, (x - a[0]) / h)), s = 1 - t;
    return a.slice(1).map((v, j) => s*s*(1+2*t)*v + t*t*(3-2*t)*b[j+1]
      + h*t*s*(s*slope[i][j] - t*slope[i+1][j]));
  };
}

const legProfile = curve(sections);
const footprint = curve([
  [0, 0], [.025, 5.0], [.05, 10.0], [.1, 17.8], [.15, 23.6], [.21, 26.5],
  [.28, 27.8], [.36, 27.3], [.46, 25.0], [.57, 21.1], [.66, 18.9],
  [.73, 19.0], [.8, 20.9], [.85, 22.0], [.905, 20.5], [.95, 16.7],
  [.98, 8.1], [1, 0],
]);
const outsoleTop = curve([
  [0, 17.0], [.05, 16.4], [.23, 16.0], [.42, 17.2], [.52, 20.3],
  [.62, 27.8], [.73, 32.0], [.9, 33.6], [.965, 34.2], [1, 36.1],
]);
// The underside itself turns up, cuts back down almost vertically and runs
// on to the lightly inset heel. No intersecting boxes or floating heel cap.
const outsoleBottom = curve([
  [0, 3.1], [.027, .9], [.1, 0], [.46, 0], [.53, .7], [.56, 2.1],
  [.61, 9.0], [.67, 14.5], [.712, 17.3], [.727, 17.7], [.735, 17.0],
  [.738, 3.1], [.745, 1.6], [.763, .4], [.81, 0], [.944, 0], [.984, .55], [1, 2.8],
]);
const tongue = curve([
  [0, 171], [5, 170.4], [12, 165.0], [19, 155], [25, 140], [32, 123],
  [40, 104], [48, 88], [58, 80.5], [72, 75.2], [90, 72.2], [115, 68.2],
  [150, 61.1], [180, 59.0],
]);
// Rounded triangular anterior quarter: the white tongue sits on the crest
// of the shin rather than appearing as a transverse white boot cuff.
const shinDepth = curve([
  [0, 0], [2, .004], [5, .026], [12, .117], [19, .228], [25, .32],
  [32, .387], [40, .456], [48, .55], [58, .654], [72, .735], [90, .790],
  [115, .866], [150, .956], [170, .994], [180, 1],
]);
const toeLine = curve([
  [17, 92.2], [21, 92.1], [25.5, 91.6], [29.5, 90.2], [32.5, 87.1],
  [35, 82.2], [38, 73.7], [42, 62.5], [46, 55.7], [50, 51.8],
]);
const mix = (a, b, t) => a + (b - a)*t;
const smooth = THREE.MathUtils.smoothstep;
const rad = Math.PI / 180;

function legPoint(side, y, a, ease = 0) {
  const [cx, w, front, back] = legProfile(y);
  const deg = Math.abs(a)/rad;
  const shin = smooth(y, 54, 78) * (1 - smooth(y, 170, 225));
  const p = mix((1 - Math.cos(a))*.5, shinDepth(deg)[0], shin);
  // Slight medial gastrocnemius and anterior patellar fullness; the outer
  // bounds still come from the two traced views, not from a generic cone.
  const g = Math.exp(-((y-268)**2)/960) * Math.sin(2*a);
  const x = side*cx + (w + ease)*Math.sin(a) - side*.85*g*g;
  return [x, y, mix(front, back, p) + ease*Math.cos(a)];
}

function toePoint(side, t, a) {
  const p = (1 - Math.cos(a))*.5, u = Math.abs(a)/Math.PI;
  const front = toeLine(mix(17, 50, t))[0];
  const s = t*t*(3-2*t);
  const width = mix(footprint(u)[0]*Math.sign(a), 21.8*Math.sin(a), s);
  return [side*mix(44.85, 44.3, t) + width,
    mix(outsoleTop(p)[0], 50, t), mix(front, mix(-31.4, -29.4, t), p)];
}

function surface(name, color, roughness) {
  return new THREE.MeshStandardMaterial({name, color, roughness, metalness: 0});
}

export function buildLegs() {
  const legs = new THREE.Group();
  legs.name = 'Legs and boots';
  const palette = [
    surface('Teal · boot sole', 0x24a8a8, .74), surface('Teal · tread', 0x187e83, .9),
    surface('Teal · welt', 0x237f85, .68), surface('Pearl · boot upper', 0xefeff5, .58),
    surface('Pearl · piping', 0xb7c6ce, .66), surface('Lagoon · thigh high', 0x219c9e, .92),
    surface('Lagoon · stocking top', 0x115d65, .89), surface('Thigh · under coat', 0xd6979c, .88),
    surface('Lagoon · knee folds', 0x1b8187, .93), surface('Pearl · vamp fold', 0xc5cddc, .75),
  ];
  // Vertex columns are meridians; the denser ones under the arch carry its
  // abrupt turn into the heel stem instead of rounding it out of existence.
  const half = [...new Set([
    ...Array.from({length: 37}, (_, i) => i*5*rad),
    ...[.027,.53,.56,.61,.67,.712,.727,.735,.738,.745,.763,.944,.984]
      .map(p => Math.acos(1 - 2*p)),
  ])].sort((a,b) => a-b);
  const angles = [...half, ...half.slice(1,-1).reverse().map(a => -a)];
  for (const side of [-1, 1]) {
    const pos = [], ids = [], runs = [];
    const geo = new THREE.BufferGeometry();
    let prev = -1;
    const vertex = p => { pos.push(...p); return pos.length/3 - 1; };
    const tri = (i,j,k,mat) => {
      let group = runs.at(-1);
      if (!group || group.materialIndex !== mat) {
        group = {start: ids.length, count: 0, materialIndex: mat};
        runs.push(group);
      }
      ids.push(i,j,k); group.count += 3;
    };
    const ring = (fn, mat) => {
      const first = pos.length/3;
      for (const a of angles) vertex(fn(a));
      if (prev >= 0) for (let i=0; i<angles.length; i++) {
        const j=(i+1)%angles.length;
        tri(prev+i, prev+j, first+j, mat); tri(prev+i, first+j, first+i, mat);
      }
      prev = first;
    };
    // Beveled lower edge. A restrained lateral inset narrows the heel below
    // its seat without thinning out the visible platform under the toes.
    for (const [h, bevel, mat] of [[0,1.45,1],[.055,.65,0],[.14,.23,0],[.78,0,0],[.945,0,0],[1,.22,2]]) {
      ring(a => {
        const p = (1 - Math.cos(a))*.5;
        const stem = (1-h) * smooth(p,.71,.78);
        const w = footprint(Math.abs(a)/Math.PI)[0] * (1 - bevel*.025 - .105*stem);
        return [side*44.85 + w*Math.sign(a), mix(outsoleBottom(p)[0], outsoleTop(p)[0], h),
          mix(92.2,-31.4,p) - Math.cos(a)*(bevel + stem*1.2)];
      }, mat);
      if (h===0) {
        // Span the variable-height arch with strips; a triangle fan would
        // bridge straight across this hollow and erase it in side view.
        const last=half.length-1, n=angles.length;
        const m=i => (n-i)%n;
        for (let i=0; i<last; i++) {
          if (i<last-1) tri(i,m(i+1),i+1,1);
          if (i>0) tri(i,m(i),m(i+1),1);
        }
      }
    }
    for (const t of [.024,.085,.16,.245,.345,.46,.57,.666,.77,.887,1]) ring(a => toePoint(side,t,a),3);
    const edge = a => tongue(Math.abs(a)/rad)[0];
    for (const t of [.14,.28,.44,.59,.73,.85,.94,1])
      ring(a => legPoint(side,mix(50,edge(a)-.48,t),a),3);
    ring(a => legPoint(side,edge(a)+.18,a,.12),4);
    // Same vertices on the two sides of the color boundary: the high white
    // tongue, ankle and hose are one continuous silhouette, including behind.
    for (let i=1; i<=14; i++) ring(a => legPoint(side,mix(edge(a)+.18,192,i/14),a),5);
    for (const y of [200,208,217,226,235,244,251,257,263,270,278,286,291,297,301,305,310,316,321,325,331,338,346,355,363,370,378,386,394,402,409,415])
      ring(a => legPoint(side,y,a),5);
    const cuff = a => 434.7 - side*4.2*Math.sin(a) - 1.5*Math.cos(a);
    ring(a => legPoint(side,mix(415,cuff(a)-8.1,.5),a),5);
    ring(a => legPoint(side,cuff(a)-8.1,a),5);
    ring(a => legPoint(side,cuff(a)-7.5,a,.36),6);
    ring(a => legPoint(side,cuff(a)-.8,a,.47),6);
    ring(a => legPoint(side,cuff(a),a,.18),6);
    ring(a => legPoint(side,cuff(a)+.65,a),7);
    for (const y of [448,456,464,475,483,490]) ring(a => legPoint(side,y,a),7);
    const crown = vertex([side*39.9,490,25]);
    for (let i=0; i<angles.length; i++) tri(crown,prev+i,prev+(i+1)%angles.length,7);

    // In the drawing the knee has two tiny tapered compression folds. Lay
    // them along the curved knit, avoiding spherical kneecaps and hard seams.
    for (const [sgn, lo, hi, a0, a1, w] of [[-1,286,312,20,49,5.3],[1,293,312,24,33,3.6]]) {
      const base = pos.length/3;
      for (let i=0; i<=12; i++) {
        const t=i/12, y=mix(lo,hi,t), mid=side*sgn*mix(a0,a1,t)*rad;
        const span=(.035+w*Math.sin(Math.PI*t)**1.27)*rad;
        vertex(legPoint(side,y,mid-span,.37)); vertex(legPoint(side,y,mid+span,.37));
        if (i) {const k=base+(i-1)*2; tri(k,k+1,k+3,8); tri(k,k+3,k+2,8);}
      }
    }
    const base = pos.length/3;
    for (let i=0; i<=20; i++) {
      const u=i/20, a=(u-.5)*1.02, crest=.687+.016*(2*u-1)**2;
      const width=.0007+.027*Math.sin(Math.PI*u)**1.3;
      for (const t of [crest-width,crest+width]) {
        const p=toePoint(side,t,a); p[1]+=.24; p[2]+=.24; vertex(p);
      }
      if(i){const k=base+(i-1)*2; tri(k,k+2,k+3,9); tri(k,k+3,k+1,9);}
    }
    geo.setIndex(ids); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.groups = runs; geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo,palette);
    mesh.name = side<0 ? 'Left · fitted stocking and boot' : 'Right · fitted stocking and boot';
    mesh.castShadow = true; mesh.receiveShadow = true;
    legs.add(mesh);
  }
  return legs;
}
