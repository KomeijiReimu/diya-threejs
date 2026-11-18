import * as THREE from 'three';
import { handGeometry } from './outfit-assets/hand.js';
import { handLandmarks, wrist } from './outfit-assets/landmarks.js';
import { shoulderGeometry, snugUpperArm } from './outfit-assets/shoulder.js';

const TAU = Math.PI * 2;
const π = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mix = THREE.MathUtils.lerp;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => (x = clamp(x), x * x * (3 - 2 * x));

// Monotone cubic Hermite interpolation. The original contour stations remain exact;
// tangents vanish at extrema, e.g. where the waist turns out towards the hip.
function station(table, h, column) {
  const last = table.length - 1;
  if (h <= table[0][0]) return table[0][column];
  if (h >= table[last][0]) return table[last][column];
  let i = 0;
  while (h > table[i + 1][0]) i++;
  const sec = j => (table[j + 1][column] - table[j][column]) / (table[j + 1][0] - table[j][0]);
  const tan = j => {
    if (!j) return sec(0);
    if (j === last) return sec(last - 1);
    const a = sec(j - 1), b = sec(j);
    return a * b <= 0 ? 0 : 2 * a * b / (a + b);
  };
  const length = table[i + 1][0] - table[i][0];
  const t = (h - table[i][0]) / length, tt = t * t, ttt = t * tt;
  return (2 * ttt - 3 * tt + 1) * table[i][column] + (ttt - 2 * tt + t) * length * tan(i)
    + (3 * tt - 2 * ttt) * table[i + 1][column] + (ttt - tt) * length * tan(i + 1);
}

// A regular parametric patch. In a closed round, the UV seam shares the normal,
// not the UV; this matters on the shoulders seen against the dark hair.
function surface(part, name, material, nu, nv, sample, reverse = false, wrapped = false) {
  const geom = new THREE.BufferGeometry(), pos = [], uv = [], ix = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const p = sample(i / nu, j / nv);
    pos.push(p.x, p.y, p.z);
    uv.push(i / nu, j / nv);
    if (i < nu && j < nv) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      if (reverse) ix.push(a, c, b, b, c, d);
      else ix.push(a, b, c, b, d, c);
    }
  }
  geom.setIndex(ix);
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geom.computeVertexNormals();
  if (wrapped) {
    const ns = geom.attributes.normal, a = V(0, 0, 0), b = V(0, 0, 0);
    for (let j = 0; j <= nv; j++) {
      const i = j * (nu + 1);
      a.fromBufferAttribute(ns, i).add(b.fromBufferAttribute(ns, i + nu)).normalize();
      ns.setXYZ(i, a.x, a.y, a.z);
      ns.setXYZ(i + nu, a.x, a.y, a.z);
    }
  }
  const mesh = new THREE.Mesh(geom, material);
  mesh.name = name;
  part.add(mesh);
  return mesh;
}

function piping(part, name, material, fn, radius, segments = 40) {
  const points = Array.from({ length: segments + 1 }, (_, i) => fn(i / segments));
  const geom = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 5, false);
  const mesh = new THREE.Mesh(geom, material);
  mesh.name = name;
  part.add(mesh);
}

const torsoStations = [ // y, width radius, front extremity (before bust shaping), back extremity
  [641, 41.4, 66, -22], [648, 38.7, 64.7, -22], [657, 38.0, 64, -22.5],
  [676, 39.7, 64.8, -24], [693, 43.2, 65.1, -25], [705, 48.6, 65.5, -26.3],
  [719, 55.6, 67.5, -27.3], [730, 57.0, 67.3, -27.5], [740, 55.8, 64, -27.9],
  [750, 54.2, 57, -28], [760, 54.5, 47, -28], [768, 55.0, 40, -27.5],
];
function bodice(a, y, out = 0) {
  const s = Math.sin(a), c = Math.cos(a);
  const x = station(torsoStations, y, 1) * s;
  const front = station(torsoStations, y, 2), back = station(torsoStations, y, 3);
  const bustShape = Math.exp(-(((y - 727) / 22) ** 2));
  const volume = bustShape * (20.5 * Math.exp(-(((Math.abs(x) - 24) / 20.5) ** 2))
    - 4.9 * Math.exp(-((x / 9.5) ** 2)));
  return V(x + s * out, y, (front + back + (front - back) * c) / 2 + volume * Math.max(0, c) ** 1.1 + c * out);
}
function neckline(a) {
  const c = Math.cos(a), s = Math.abs(Math.sin(a));
  if (c < 0) return 751.2 + 8.5 * c * c;
  return 741.5 + 24 * s - 13.7 * s * s + 1.8 * Math.exp(-(((s - .64) / .19) ** 2));
}

const skinStations = [
  [735, 53, 62.5, -26], [746, 55.1, 57, -27], [758, 60.2, 46, -28], [768, 65.5, 39, -30],
  [778, 71.8, 36.5, -29.5], [787, 74.5, 34, -27.5], [793, 70.5, 32.5, -26],
  [797.8, 62.5, 30, -24], [800.2, 51.5, 28.2, -23], [802.2, 37, 26.5, -21.5],
  [806, 26, 24.5, -18.7], [812, 20, 23.5, -16.9], [815, 18.5, 23.3, -16.3],
];
function shoulders(a, y) {
  const c = Math.cos(a), s = Math.sin(a), f = station(skinStations, y, 2), b = station(skinStations, y, 3);
  // A broad, slightly squared shoulder girdle with rounded deltoid ends. At
  // the sternum the emerging skin meets the inside of the sweetheart edge.
  const p = V(station(skinStations, y, 1) * s, y, (f + b + (f - b) * c * (1 + .28 * s * s)) / 2);
  const t = ease((y - neckline(a)) / 10);
  return bodice(a, Math.min(y, 768), -1.4).lerp(p, t).setY(y);
}

const skirtStations = [ // height in the front elevation; waist shares the bodice station
  [413, 151.7, 148.0, -106.0], [441, 143.2, 143.5, -102.0], [466, 134.2, 137.0, -96.2],
  [492, 123.7, 130.0, -89.0], [521, 110.7, 120.8, -78.3], [552, 95.4, 109.5, -66.2],
  [578, 80.4, 98.5, -55], [604, 64.9, 85.5, -42.8], [624, 50.9, 74.8, -30.8], [641, 41.4, 66, -22],
];
const ventA = .867, ventB = 2.29;
const hemHeight = a => 413.5 + 29.0 * Math.sin(a) ** 2 + 8.4 * Math.max(0, -Math.cos(a)) ** 2;
function skirt(a, v, inset = 0) {
  const c = Math.cos(a), s = Math.sin(a), y = mix(hemHeight(a), 641, v);
  const f = station(skirtStations, y, 2), b = station(skirtStations, y, 3);
  // Restrained pressed flutes, deepest at the ends of the side godets.
  const fold = (1 - v) ** 2 * (1.05 * Math.sin(a * 4) ** 2
    - 2.05 * Math.exp(-(((Math.abs(a) - ventA) / .080) ** 2))
    - 1.7 * Math.exp(-(((Math.abs(a) - ventB) / .095) ** 2)));
  return V((station(skirtStations, y, 1) + inset + fold) * s, y, (f + b + (f - b) * c) / 2 + (inset + fold) * c);
}
function slit(v) {
  const y = mix(hemHeight(0), 641, v);
  return Math.asin(31.1 * clamp((557 - y) / (557 - hemHeight(0))) / station(skirtStations, y, 1));
}
const vent = v => .059 * clamp(1 - v / .139);
function goreAngles(i, v) {
  const cuts = [[slit(v), ventA - vent(v)], [ventA + vent(v), π / 2], [π / 2, ventB - vent(v)], [ventB + vent(v), π]];
  return cuts[i];
}

const sleeveStations = [ // y, centre x, breadth, centre depth, depth radius
  [490, 155, 20.5, -5.7, 29.8], [523, 145.5, 20.6, -5.5, 28.5], [553, 130, 19.7, -5.4, 25.4],
  [585, 115.3, 18.2, -5.3, 22.8], [622, 99.8, 15.8, -6.4, 19.3], [639, 92.8, 13.8, -7.6, 17.1],
  [650, 89.6, 14.6, -6.8, 16.3], [658, 88.6, 11.7, -6.3, 14.7], [670, 85.2, 12.0, -5.2, 15.8],
  [700, 78.8, 13.4, -4.1, 17.2], [729, 73.3, 15.3, -3.5, 19.6], [750, 70.1, 17.2, -3.2, 20.3],
  [762, 68.3, 17.0, -3.2, 20.0],
];
function mouth(a, side, up, inset = 0) {
  const s = Math.sin(a), c = Math.cos(a);
  // A mitred chevron: on the outside of each wrist the lower border crests
  // over the gem, on the inside it falls away to the pointed bell end.
  const peaks = 9.4 * (1 - Math.abs(c)) ** 1.5;
  const y = 484 + 15.4 * s + peaks * Math.sign(s) - 2.3 * Math.abs(c) + up * (23.4 + 2.8 * s);
  return V(side * (164.8 - 10.9 * up + (15.6 + 3.9 * up + inset) * s), y,
    -6.3 + (25.4 + 1.3 * up + inset) * c);
}
const armholeHeight = a => 750.5+2.6*Math.sin(a)+1.1*Math.cos(a);
function sleeve(a, v, side, offset = 0) {
  const start = mouth(a, side, 1, offset), endY = armholeHeight(a);
  const y = mix(start.y, endY, v), s = Math.sin(a), c = Math.cos(a);
  const normal = h => V(side * (station(sleeveStations, h, 1) + (station(sleeveStations, h, 2) + offset) * s),
    h, station(sleeveStations, h, 3) + (station(sleeveStations, h, 4) + offset) * c);
  const p = normal(y), delta = start.clone().sub(normal(start.y));
  const pinch = 1.6 * Math.exp(-(((y - (648 + 7 * s - 3 * c)) / 3.8) ** 2)) * (.4 + .6 * c * c);
  p.x -= side * pinch * s;
  p.z -= pinch * c;
  p.addScaledVector(delta, (1 - ease(v / .45)));
  if(y>738)p.lerp(snugUpperArm(station,a,y,side,2.05+offset),ease((y-738)/14));
  return p;
}
function shoulderFold(a, v, side, inset = 0) {
  const s = Math.sin(a), c = Math.cos(a), swell = 2.2 * Math.sin(v * π);
  const medial = Math.max(0,-s);
  const p = V(side * (mix(58.4, 54.3, v) + (mix(27.6, 37.8, v) + swell + inset) * s
      - 12.2*(1-v)*medial**3),
    mix(752 - 28.7 * s - 1.9 * c, 778.0 - 23.2 * s - 1.1 * c, v),
    mix(1.6, 1.3, v) + (mix(35.0, 40.0, v) + swell + inset) * c
      + 36.6*medial**2.55 + 3.6*Math.max(0,c)*medial
      + .86*Math.sin(π*v*4.3)*Math.exp(-(((s+.66)/.35)**2))*Math.max(0,c));
  // The gathered fabric tucks under, rather than piercing the scarf's V lip.
  const x = Math.abs(p.x);
  if (x<39.9 && c>0) {
    const lipCos=Math.sqrt(1-(x/40)**2), hem=809-23.8*lipCos**2.1*(1-.47*x/40);
    p.z=mix(p.z,Math.min(p.z,5.8+40.6*lipCos-1.55),ease((p.y-hem+4.4)/4.4));
  }
  return p;
}

function shortLeg(a, h, side) {
  const p = clamp((h - 463) / 110), t = ease((h - 485) / 34), angle = TAU * a - π / 2;
  // These openings enclose the fitted thighs: their centre is forward of
  // the skirt's axis. The cloth keeps its leg ease until above the crotch.
  const cx = mix(39.85, 40.1, p), rx = cx - .55 * (1 - ease((h - 463) / 16));
  const z = mix(26.75, 19.2, ease((h - 490) / 83));
  const rz = mix(44.25, 52.2, ease((h - 463) / 52));
  const widths = [[463, 79.5], [484, 80.4], [513, 80.7], [539, 77], [573, 63.4]];
  return V(side * mix(cx + rx * Math.sin(angle), station(widths, h, 1) * Math.sin(a * π), t),
    h + 3.5 * (1 - t) * (1 - Math.cos(TAU * a)) * .5,
    z + mix(rz * Math.cos(angle), (rz + 1.8) * Math.cos(π * a), t));
}

function mat(name, color, roughness = .86, metalness = 0) {
  const m = new THREE.MeshStandardMaterial({name, color, roughness, metalness, side: THREE.DoubleSide});
  return m;
}

export function buildOutfit() {
  const outfit = new THREE.Group();
  let handSkin;
  outfit.name = 'Día • porcelain coat dress';
  const silk = mat('Porcelain • faille', '#f2f1f7'), facing = mat('Pearl • cut edges', '#dbe2ed'),
    stitch = mat('Mist • inset stitch', '#8f9bb0'), ice = mat('Glacier • collar satin', '#a7c8d9', .72),
    iceShade = mat('Glacier • folded side', '#84aaba'), iceLit = mat('Glacier • turned edge', '#c0dbe6'),
    teal = mat('Turquoise • woven enamel', '#31c6bf', .62), tealShade = mat('Turquoise • reverse', '#127d85'),
    lining = mat('Ice grey • inside the skirt', '#b7c7d7'), skin = mat('Skin • warm porcelain', '#fde6d8'),
    frost = mat('Pearl • bodice halftone', '#acbfd3'), shortBlue = mat('Dust blue • culotte', '#8faec3'),
    shortHem = mat('Dust blue • folded hem', '#9bb9cb'), shortThread = mat('Dust blue • stitch', '#738fa5'),
    jewelRim = mat('Cuff • silver bezel', '#9caabe', .39, .24), jewel = mat('Cuff • moonstone', '#e0f1fa', .28, .08),
    handMat = mat('Skin • hand with flush nail beds', '#ffffff'), blush = mat('Skin • soft contour', '#d9a6a4'),
    cuffLining = mat('Turquoise • fitted inner sleeve', '#47a8a8'), bezelSeat = mat('Cuff • aqua seat', '#278f93', .64);
  jewel.emissive.set('#d4edff'); jewel.emissiveIntensity = .09;
  handMat.vertexColors=true;

  const dress = new THREE.Group();
  dress.name = 'Coat dress • eight tailored gores';
  outfit.add(dress);
  const {geometry:shoulderSkin,armWeight}=shoulderGeometry(shoulders,station);
  const girdle=new THREE.Mesh(shoulderSkin,skin);
  girdle.name='Bare shoulders and décolletage';girdle.userData.rigRegion='shoulder';outfit.add(girdle);
  surface(dress, 'Bodice • sculpted sweetheart', silk, 128, 46, (u,v) => {
    const a = TAU*u; return bodice(a, mix(641, neckline(a), v));
  }, false, true);
  piping(dress, 'Bodice • rolled neckline', facing, u => bodice(TAU*u, neckline(TAU*u)), .68, 112);

  // The cool, scalloped cel block under the bust is in the reference drawing;
  // it follows the actual double-curved surface rather than facing the camera.
  function bustShade(u, v) {
    const a = mix(-1.22, 1.22, u), s = Math.abs(Math.sin(a));
    const taper = Math.max(.005,Math.sin(π*u) ** .47);
    const bottom = 713.5 - 23.8 * Math.exp(-(((s - .54) / .36) ** 2)) - 10.8 * Math.exp(-((s / .38) ** 2));
    const y = mix(mix(716, bottom, taper), mix(716, 724.5 + 1.2 * s, taper), v);
    return bodice(a, y, .53);
  }
  surface(dress, 'Bodice • sculpted underbust halftone', frost, 100, 10, bustShade);
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'L' : 'R';
    // Tiny skin crease precisely at the notch. No hard line across the chest.
    surface(outfit, `${label} • neckline shadow`, blush, 12, 2, (u,v) => {
      const a = side * (.016 + u * .085 + (v - .5) * .011 * Math.max(.03,Math.sin(π*u)));
      const y = 742.3 + 8.4 * u; return shoulders(a, y).add(V(0,0,.36));
    }, side < 0);
    const seamAngle = y => .83 - .19 * Math.exp(-(((y-697)/23) ** 2)) + .02 * (y-641)/113;
    piping(dress, `${label} • bodice princess seam`, stitch, t => {
      let y = mix(641, 753, t);
      return bodice(side * seamAngle(y), Math.min(y, neckline(seamAngle(y))), .35);
    }, .40, 48);
    for (let i = 0; i < 4; i++) {
      const point = (u,v,inset=0) => {
        const [a,b] = goreAngles(i, v);
        return skirt(side * mix(a, b, u), v, inset);
      };
      const title = `${label} • ${['forepart','side front','side back','back'][i]}`;
      surface(dress, `${title} • faille`, silk, 28, 38, point, side < 0);
      surface(dress, `${title} • inner facing`, lining, 16, 22, (u,v) => point(u,v,-1.95), side > 0);
      surface(dress, `${title} • bound hem`, facing, 34, 2, (u,v) => point(u,0,-1.95+v*1.95), side > 0);
      if (i === 0) {
        surface(dress, `${title} • slit return`, facing, 2, 26, (u,v) => point(0,v*.637,-1.95+u*1.95), side < 0);
        piping(dress, `${title} • slit selvedge`, facing, t => point(0,t*.637), .42, 28);
      }
      if (i !== 0) piping(dress, `${title} • panel seam`, i === 2 ? facing : stitch,
        t => point(0,t,.18), i === 2 ? .39 : .44, 48);
    }
    for (const center of [ventA, ventB]) {
      surface(dress, `${label} • inset turquoise godet ${center}`, teal, 12, 14, (u,v) => {
        const a = side * (center + (u - .5) * 2 * (.086*(1-v)+.005));
        const p = skirt(a, v*.154, -2.6 - 2.0*Math.sin(π*u)*(1-v));
        p.y += 1.05; return p;
      }, side < 0);
    }
    // A concealed inverted pleat returns under each raised side hem. Its lower
    // lip sits behind the forepart in elevation, but drapes over the thigh in
    // profile; it closes into the existing lining above and at both ends.
    const underfold = (u,v) => {
      const a=mix(.68,2.57,u), tuck=Math.sin(π*u)**.88;
      const base=skirt(side*a,0,-3.3), p=skirt(side*a,.20*v,-3.3);
      const x=mix(Math.abs(base.x),78.4,tuck), hide=1-ease((v-.36)/.64);
      p.x=side*mix(Math.abs(p.x),x-(Math.abs(base.x)-Math.abs(p.x))*(1-tuck),hide);
      const lip=Math.max(base.y-21*tuck,414.3+29*(x/144)**2);
      p.y-=Math.max(0,base.y-lip)*(1-v); return p;
    };
    surface(dress,`${label} • inverted side pleat`,silk,40,14,underfold,side<0);
    const shorts = new THREE.Group();
    shorts.name = `${label} • tailored culotte`;
    outfit.add(shorts);
    surface(shorts, `${label} • culotte cloth`, shortBlue, 64, 36, (u,v) => shortLeg(u,mix(463,573,v),side), side < 0);
    surface(shorts, `${label} • folded shorts hem`, shortHem, 56, 5, (u,v) => {
      const p = shortLeg(u,463 + v*7.3,side), a = TAU*u-π/2;
      p.x += side*.65*Math.sin(a); p.z += .65*Math.cos(a); return p;
    }, side < 0);
    piping(shorts, `${label} • short edge stitch`, shortThread, u => shortLeg(u,470.8,side), .43, 56);
  }
  piping(outfit, 'Culotte • centre seam', shortThread, t => shortLeg(0,mix(480.5,564,t),1).add(V(0,0,.42)), .43, 40);

  // The bib is a hollow folded stand. Both lower and upper front boundaries
  // drop into a V; its opposite side stands high behind the base of the neck.
  const scarf = new THREE.Group();
  scarf.name = 'Glacier • folded standing collar'; outfit.add(scarf);
  const collar = (a,v,inset=0) => {
    const c = Math.cos(a), s = Math.sin(a), f = Math.max(0,c), back = Math.max(0,-c);
    const vFront = f ** 2.1 * (1-.47*Math.abs(s));
    const y = mix(809 - 23.8 * vFront - 11.3 * back**1.4, 837.2 - 25.4*vFront + 3.7*back, v);
    const rad = mix(40.0, 33.3,v) + 3.0*Math.sin(v*π);
    return V(s*(rad + inset), y,
      5.8 + c*(mix(36.9,30.1,v) + 2.3*Math.sin(v*π) + inset) + 3.7*f*(1-v));
  };
  surface(scarf, 'Collar • raised folded stand', ice, 112, 14, (u,v) => collar(TAU*u,v), false, true);
  surface(scarf, 'Collar • inside', iceShade, 80, 8, (u,v) => collar(TAU*u,v,-2.7), true, true);
  surface(scarf, 'Collar • top roll', iceLit, 104, 3, (u,v) => collar(TAU*u,1,-2.7+2.7*v), true, true);
  piping(scarf, 'Collar • lower fold', iceShade, u => collar(TAU*u,0), .62, 112);
  for (const side of [-1,1]) {
    const label = side < 0 ? 'L' : 'R';
    const arm = new THREE.Group(); arm.name = `${label} • bell sleeve and hand`; outfit.add(arm);
    const upperTube=surface(arm, `${label} • long bell sleeve`, silk, 88, 46, (u,v) => sleeve(TAU*u,v,side), side < 0,true);
    for (const [fold, angle] of [['fore',-.31],['side',1.40]]) {
      surface(arm,`${label} • ${fold} elbow pleat`,frost,22,3,(u,v) => {
        const a = angle + .66*u + (v-.5)*.29*Math.max(.015,Math.sin(π*u)**.66);
        const y = 640.5 + 17.6*u - (fold === 'side' ? 2.4 : 0), low = mouth(a,side,1).y;
        return sleeve(a,(y-low)/(armholeHeight(a)-low),side,.43);
      },side>0);
    }
    surface(arm, `${label} • bias shoulder fold`, silk, 88, 15, (u,v) => shoulderFold(TAU*u,v,side), side < 0,true);
    // The tab drapes over the measured crest of the pleats. Taking the height
    // at each individual vertex would pinch the cloth into the steep folds.
    const crest=[[0,42.2],[.05,43.12],[.1,47.05],[.13,49.08],[.18,50.02],
      [.24,50.20],[.32,50.16],[.46,49.74],[.67,48.84],[.82,48.09],[1,47.13]];
    const tail = (u,v) => {
      const x = side*(mix(19.5, 27.9, v) + (u-.5)*16.1), y = mix(796, 772.1,v) + (u-.5)*9.7;
      return V(x,y,station(crest,v,1)+(.5-u)*2.3);
    };
    surface(scarf, `${label} • crossed collar tail`, ice, 15, 12, (u,v) => tail(u,v*.69), side > 0);
    surface(scarf, `${label} • pearl end tab`, silk, 15, 5, (u,v) => tail(u,.69+v*.31), side > 0);
    piping(scarf, `${label} • collar tab selvedge`, stitch, u => tail(u,1), .48, 16);
    // Fine gathers fan out from the two pearl tabs. The whole white piece
    // is one continuous loop: no floating shoulder-tip or hidden root.
    for (const [i,v0] of [.37,.66].entries()) {
      surface(arm,`${label} • bias pleat ${i+1}`,facing,26,3,(u,v) => {
        const a = mix(-1.16,-.44+.1*i,u), row=v0+(i-.45)*.23*u
          + (v-.5)*.041*Math.max(.015,Math.sin(π*u)**.64);
        return shoulderFold(a,row,side).add(V(0,0,.48));
      },side<0);
    }
    // Both sides of the hanging fold turn back into the sleeve head. Its
    // rolled upper edge is sewn to a true facing rather than a hollow hoop.
    const turned = (a,v) => {
      const p=shoulderFold(a,1,side),d=V(side*66.8-p.x,0,-2.4-p.z).normalize();
      p.addScaledVector(d,1.04*v);p.y+=.23*Math.sin(π*v)-.27*v;return p;
    };
    surface(arm,`${label} • shoulder opening`,facing,88,4,(u,v)=>turned(TAU*u,v),side<0,true).userData.rigRegion='sash_'+label;
    const facingEnd=[],faceRay=new THREE.Raycaster();
    for(let i=0;i<=88;i++){
      const a=i*TAU/88,p=turned(a,1),outer=ease((Math.abs(p.x)-24)/31);
      const aim=V(side*mix(20,67,outer),p.y-13,mix(10,-2,outer)).sub(p),length=aim.length();
      aim.normalize();faceRay.set(p,aim);faceRay.near=.001;faceRay.far=length;
      const hit=faceRay.intersectObject(girdle)[0];
      // Return to the actual shoulder surface. Running this whole sheet all
      // the way down to the lower sleeve would create crossing cloth walls.
      facingEnd.push(p.addScaledVector(aim,Math.min(length,(hit?.distance??0)+3.4)));
    }
    surface(arm,`${label} • bias sleeve facing`,facing,88,12,(u,v)=>{
      const a=u*TAU,p=turned(a,1),q=facingEnd[Math.round(88*u)];
      p.lerp(q,v);p.y-=1.0*Math.sin(π*v);return p;
    },side<0,true);
    const returnFold=surface(arm,`${label} • folded shoulder underside`,silk,88,20,(u,v)=>{
      const a=u*TAU,p=shoulderFold(a,0,side),q=sleeve(a,1,side),axis=q.clone().sub(sleeve(a,.978,side)).normalize();
      // Ease out of the turned edge and enter the sleeve along its own tangent.
      // The raised arm now reveals a fold, not the cutoff end of a cylinder.
      return p.lerp(q,ease(v)).addScaledVector(axis,16.5*v*v*(1-v));
    },side>0,true);
    const tubeN=upperTube.geometry.attributes.normal,creaseN=returnFold.geometry.attributes.normal;
    for(let i=0;i<=88;i++){
      const j=tubeN.count-89+i,k=creaseN.count-89+i;
      creaseN.setXYZ(k,tubeN.getX(j),tubeN.getY(j),tubeN.getZ(j));
    }
    // Skin and the hanging stole need different material coordinates. In the
    // armpit two fabric walls are close in space but far apart on the pattern.
    // Attach a facing across its rows, not to whichever body surface is nearer.
    for(const piece of arm.children){
      if(!/long bell|bias|shoulder/.test(piece.name))continue;
      piece.userData.rigRegion=(piece.name.includes('long bell')?'arm_':'sash_')+label;
      const p=piece.geometry.attributes.position,uv=piece.geometry.attributes.uv,w=new Float32Array(p.count);
      for(let i=0;i<w.length;i++){
        const x=Math.abs(p.getX(i)),y=p.getY(i),v=uv.getY(i);
        if(piece.name.includes('long bell'))w[i]=1-.10*ease((y-746)/14)*(1-ease((x-52)/16));
        else if(piece.name.includes('facing')||piece.name.includes('underside')){
          const a=uv.getX(i)*TAU,high=piece.name.includes('facing'),rootX=Math.abs(high?turned(a,1).x:shoulderFold(a,0,side).x),q=sleeve(a,1,side);
          const tip=facingEnd[Math.round(88*uv.getX(i))];
          w[i]=mix(ease((rootX-31)/34),high?armWeight(tip.x,tip.y,tip.z):1-.10*ease((q.y-746)/14)*(1-ease((Math.abs(q.x)-52)/16)),high?v:ease(v));
        } else w[i]=ease((x-31)/34);
      }
      piece.geometry.setAttribute('rigUpperArm',new THREE.BufferAttribute(w,1));
    }
    surface(arm, `${label} • enamel chevron cuff`, teal, 80,8,(u,v) => mouth(TAU*u,side,v,.15),side<0,true);
    surface(arm, `${label} • inside of the cuff`, tealShade, 72,10,(u,v) => {
      const p = mouth(TAU*u,side,v,-1.8 - 2.3*v); p.y += 2.1*v; return p;
    },side>0,true);
    surface(arm, `${label} • cuff edge`, tealShade, 76,2,(u,v) => mouth(TAU*u,side,0,-1.8+1.95*v),side>0,true);
    // A turned-in facing narrows to a fitted wrist opening; the outer bell
    // can keep its pointed silhouette without exposing an empty dark tube.
    surface(arm,`${label} • shaped inner cuff`,cuffLining,80,12,(u,v) => {
      const a=TAU*u,s=Math.sin(a),c=Math.cos(a),p=mouth(a,side,0,-1.65);
      const q=V(side*(170.6+7.4*s),498.5+4.2*s+1.1*c,-7+12.0*c);
      p.lerp(q,v); p.y+=1.3*(1-v)+6.0*Math.sin(π*v); return p;
    },side>0,true);
    piping(arm, `${label} • cuff upper edge`, teal, u => mouth(TAU*u,side,1,.05), .54, 68);

    // A mounted square, not a glued-on sphere: closed silver setting, followed
    // by a four-sided cushion with bevel facets and a flat snowy-blue table.
    const center = mouth(π/2,side,0,1.20), n = V(side*.91,.375,.14).normalize();
    center.y -= 4.25;
    const across = V(n.z*side,0,-n.x*side).normalize(), up = n.clone().cross(across).normalize();
    if(up.y < 0) up.negate();
    surface(arm,`${label} • backed cuff tab`,teal,20,8,(u,v)=>{
      const a=π/2+mix(-.45,.45,u),p=mouth(a,side,.22);
      const q=center.clone().addScaledVector(across,(u-.5)*10.6).addScaledVector(up,-7.9+4.4*Math.abs(2*u-1)).addScaledVector(n,-2.05);
      return p.lerp(q,v);
    },side>0);
    surface(arm,`${label} • closed setting back`,bezelSeat,1,1,(u,v)=>center.clone()
      .addScaledVector(across,(u+v-1)*9.8).addScaledVector(up,(u-v)*9.8).addScaledVector(n,-2.0),side>0);
    const frame = (name,material,r1,r2,d1,d2) => {
      const ring = [[0,1],[1,0],[0,-1],[-1,0],[0,1]];
      surface(arm,`${label} • ${name}`,material,4,1,(u,v) => {
        const xy=ring[Math.round(u*4)], r=mix(r1,r2,v);
        return center.clone().addScaledVector(across,xy[0]*r).addScaledVector(up,xy[1]*r).addScaledVector(n,mix(d1,d2,v));
      },side<0);
    };
    frame('turquoise setting',bezelSeat,9.8,9.1,-2.0,.15);
    frame('bezel flank',jewelRim,9.1,8.8,.15,.85);
    frame('bezel bevel',facing,8.8,7.3,.85,1.65);
    frame('cut moonstone facets',jewel,7.3,5.25,1.65,3.05);
    surface(arm,`${label} • moonstone table`,jewel,1,1,(u,v) => center.clone()
      .addScaledVector(across,(u+v-1)*5.25).addScaledVector(up,(u-v)*5.25).addScaledVector(n,3.05),side<0);

    // Relaxed hands turned towards the body. The palm is flattened side-on;
    // the knuckles arch and the independently curved fingers taper in two axes.
    handSkin ??= handGeometry(station);
    const hand = new THREE.Mesh(handSkin,handMat);hand.name=`${label} • hand and articulated digits`;
    hand.scale.x=side;arm.add(hand);
    hand.userData.rigRegion='hand_'+label;
    const mirror=([x,y,z])=>[side*x,y,z];
    hand.userData.restLandmarks={wrist:mirror(wrist),...Object.fromEntries(Object.entries(handLandmarks).map(([key,line])=>[key,line.map(mirror)]))};
  }
  return outfit;
}
