import { MathUtils } from 'three';
import { handLandmarks } from '../../model/outfit-assets/landmarks.js';

const S = MathUtils.smoothstep;

// The interdigit webs are one continuous surface. Use its actual centre lines,
// not five independent Z bands: the curled tips overlap in front elevation.
function hand(x,y,z,s) {
  const wrist = S(y - .36*(x-167), 493, 514);
  const palm = 'Hand'+s;
  if (y > 497) return [[palm,1-wrist],['Forearm'+s,wrist]];
  const fingers = [];
  for (const [name,line] of Object.entries(handLandmarks)) {
    let nearest = Infinity;
    for (let i=1;i<line.length;i++) {
      const [ax,ay,az]=line[i-1], [bx,by,bz]=line[i];
      const dx=(bx-ax)/.88, dy=by-ay, dz=bz-az;
      const px=(x-ax)/.88, py=y-ay, pz=z-az;
      const t=MathUtils.clamp((px*dx+py*dy+pz*dz)/(dx*dx+dy*dy+dz*dz),0,1);
      nearest=Math.min(nearest,(px-t*dx)**2+(py-t*dy)**2+(pz-t*dz)**2);
    }
    fingers.push([name+s,nearest,line[0][1]]);
  }
  fingers.sort((a,b)=>a[1]-b[1]);
  const [a,b] = fingers;
  const influence = d => (1-S(y,d[2]-9,d[2]+1))*(1-S(d[1],15,67));
  // Share only the immediate dividing ridge, predominantly in the web.
  const share = .5*(1-S(b[1]-a[1],0,12)) * S(y,462,473);
  const wa = influence(a)*(1-share), wb = influence(b)*share;
  return [[palm,(1-wa-wb)*(1-wrist)],['Forearm'+s,(1-wa-wb)*wrist],[a[0],wa],[b[0],wb]];
}

export function weights(region, p, side, ownership) {
  const x = Math.abs(p.x), y=p.y, s = side || (p.x<0?'_L':'_R');
  if (region==='hand') return hand(x,y,p.z,s);
  if (region==='hair') {
    const root=S(y,815,885), lower=1-S(y,609,717), r=S(p.x,-34,34);
    if (root>0) return [['Head',root],['HairUpper_L',(1-root)*(1-r)],['HairUpper_R',(1-root)*r]];
    return [['HairUpper_L',(1-lower)*(1-r)],['HairUpper_R',(1-lower)*r],['HairLower_L',lower*(1-r)],['HairLower_R',lower*r]];
  }
  if (region==='leg' || region==='shorts') {
    if (y<150) { const t=S(y,51,102); return [['Foot'+s,1-t],['Shin'+s,t]]; }
    if (y<410) { const t=S(y,293,351); return [['Shin'+s,1-t],['Thigh'+s,t]]; }
    const leg=(1-S(y,478,536))*(1-(1-S(x,0,22))*S(y,477,505));
    return [['Thigh'+s,leg],['Hips',1-leg]];
  }
  if (region==='neck') {
    const t=S(y,798,820), h=S(y,833,855);
    return [['Chest',1-t],['Neck',t*(1-h)],['Head',h]];
  }
  if (region==='arm' && y<516) {
    // The leading hand folds deeply into the left bell during prayer. Let
    // that lip follow the palm; the trailing bell needs only thumb-side ease.
    // The outer jeweled tab and the innermost pointed edge stay on the sleeve.
    const ease=s==='_L'?1:.25+.56*S(p.z,-8,15);
    const flex=ease*(1-S(y,487,516))*(1-S(x,169,175))*S(x,140,151);
    return [['Hand'+s,flex],['Forearm'+s,1-flex]];
  }
  if (region==='arm' && y<748 && !(ownership!==undefined && y>730)) {
    const t=S(y-.32*(x-91),624,676);
    return [['Forearm'+s,1-t],['UpperArm'+s,t]];
  }
  if (region==='shoulder' || region==='sash' || region==='arm') {
    // Anchor the medial scarf end to the sternum. Only the lateral fold
    // follows the humerus; giving its inner lip arm weights wraps the bib
    // around the shoulder when the hand reaches overhead.
    // The decolletage starts *inside* the bodice. Its entire buried ring
    // must move with the neckline, including the points below the armpit.
    const skinField=region==='shoulder' || (ownership!==undefined && y>730);
    const exposed=skinField ? S(y,752,773) : 1;
    // Surface-net ownership distinguishes the arm from the nearly touching
    // torso under the axilla. The author's fabric facing interpolates its
    // two different sewn ends: sash at the rim, sleeve at the other end.
    const lateral=S(x,36,76)*exposed;
    const cap=ownership ?? (region==='arm'?1-(1-lateral)*S(y,748,771):lateral);
    const clav=(1-cap)*S(x,21,53)*exposed;
    const neck=skinField ? S(y,798,820)*(1-S(x,16,34)) : 0;
    return [['UpperArm'+s,cap],['Clavicle'+s,clav],['Neck',(1-cap-clav)*neck],['Chest',(1-cap-clav)*(1-neck)]];
  }
  // A single coordinate field for bodice, gores, lining, stitches and hem.
  // Thigh rotation moves the culottes; the wide dress has its own drape.
  const skirt=1-S(y,440,595), r=S(p.x,-66,66), spine=S(y,552,657), chest=S(y,651,722);
  if (skirt>0) return [['Skirt_L',skirt*(1-r)],['Skirt_R',skirt*r],['Spine',spine*(1-skirt)],['Hips',(1-spine)*(1-skirt)]];
  return [['Hips',1-spine],['Spine',spine*(1-chest)],['Chest',spine*chest]];
}
