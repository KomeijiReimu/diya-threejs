import { MathUtils, Quaternion, Vector3, Euler } from 'three';

const rad = Math.PI / 180;
const v = (x,y,z) => new Vector3(x,y,z);
export const rotation = (x=0,y=0,z=0) => new Quaternion().setFromEuler(new Euler(x*rad,y*rad,z*rad,'YXZ'));
const aim = (a,b) => new Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize());
const axial = (axis,angle) => new Quaternion().setFromAxisAngle(axis,angle);
const limit = MathUtils.clamp;

// Bind positions are drawing units and all bind axes are parallel. No queries
// against live matrixWorld: clips can also be built under a scaled export root.
export function bindPoint(bone) {
  const p=new Vector3();
  for(let b=bone;b?.isBone;b=b.parent) p.add(b.position);
  return p;
}

// A two-link triangle with a point on the intended elbow/knee side of the
// plane. The end is clamped at full reach, never achieved by stretching.
export function triangle(first,second,goal,pole,maxBend=148) {
  const a=first.length(), b=second.length(), axis=goal.clone().normalize();
  const minReach=Math.sqrt(a*a+b*b+2*a*b*Math.cos(maxBend*rad));
  const d=limit(goal.length(),minReach,a+b-1e-5);
  const along=(a*a-b*b+d*d)/(2*d);
  const elbow=axis.clone().multiplyScalar(along).addScaledVector(
    pole.clone().addScaledVector(axis,-pole.dot(axis)).normalize(), Math.sqrt(Math.max(0,a*a-along*along)));
  return [elbow.normalize(),axis.multiplyScalar(d).addScaledVector(elbow,-a).normalize()];
}

function rollTo(q,axis,localNormal,target) {
  const a=localNormal.clone().applyQuaternion(q), b=target.clone();
  a.addScaledVector(axis,-a.dot(axis)).normalize(); b.addScaledVector(axis,-b.dot(axis)).normalize();
  return Math.atan2(a.clone().cross(b).dot(axis),a.dot(b));
}

// Arm notations are wrist + elbow guide in front elevation, finger direction,
// palm normal, collar elevation, palm curl and finger fan. X is measured
// outwards on either side. All depths are explicit: the near folded hand lies
// on a different plane than the far one. The forearm owns the palm turn; the
// wrist supplies only the remainder rather than twisting a dislocated hand.
export function armPose(bones,side,notation) {
  const suffix=side<0?'_L':'_R', q={}, fingerNames=['Thumb','Index','Middle','Ring','Pinky'];
  if (!notation) {
    for(const name of ['Clavicle','UpperArm','Forearm','Hand',...fingerNames]) q[name+suffix]=new Quaternion();
    return q;
  }
  const [w,e,f,n,elevation,curl,fan]=notation;
  const mirror=([x,y,z])=>v(side*x,y,z);
  const clav=bones['Clavicle'+suffix], shoulder=bones['UpperArm'+suffix];
  const first=bones['Forearm'+suffix].position, second=bones['Hand'+suffix].position;
  const collar=rotation(0,-side*Math.max(0,elevation)*.18,side*elevation);
  const origin=bindPoint(clav).add(shoulder.position.clone().applyQuaternion(collar));
  const [up,low]=triangle(first,second,mirror(w).sub(origin),mirror(e).sub(origin));
  const upper=aim(first,up), normal=v(-side,0,0), desiredNormal=mirror(n).normalize();
  const lowerSwing=()=>aim(second.clone().applyQuaternion(upper),low).multiply(upper);
  const upperRoll=rollTo(lowerSwing(),low,normal,desiredNormal);
  upper.premultiply(axial(up,limit(upperRoll*.32,-32*rad,32*rad)));
  const lower=lowerSwing();
  const roll=rollTo(lower,low,normal,desiredNormal);
  lower.premultiply(axial(low,limit(roll,-98*rad,98*rad)));
  const handAxis=v(side*.12,-1,.10).normalize(), from=handAxis.clone().applyQuaternion(lower);
  const target=mirror(f).normalize(), angle=from.angleTo(target);
  const wristBend=new Quaternion().slerp(aim(from,target),Math.min(1,40*rad/Math.max(.001,angle)));
  const hand=wristBend.multiply(lower), handDir=handAxis.applyQuaternion(hand);
  hand.premultiply(axial(handDir,limit(rollTo(hand,handDir,normal,desiredNormal),-18*rad,18*rad)));
  q['Clavicle'+suffix]=collar;
  q['UpperArm'+suffix]=collar.clone().invert().multiply(upper);
  q['Forearm'+suffix]=upper.clone().invert().multiply(lower);
  q['Hand'+suffix]=lower.clone().invert().multiply(hand);
  for(let i=0;i<5;i++) {
    const flex=curl*[.40,.75,.91,1.03,1.15][i];
    q[fingerNames[i]+suffix]=rotation(fan*[-1.4,-.76,-.12,.39,.94][i]+(i===0?curl*.45:0),0,-side*flex);
  }
  return q;
}

export function legPose(bones,side,delta,ankleOffset,toe,suspended) {
  const s=side<0?'_L':'_R', a=bones['Shin'+s].position,b=bones['Foot'+s].position;
  const restGoal=a.clone().add(b);
  const goal=restGoal.clone().add(ankleOffset).sub(delta);
  // In the suspended split the kneecap travels forward, not out toward
  // the ankle. Projected from the front, the knee stays *inside* the line
  // of the boot and leaves a long diagonal below it. The weight-bearing
  // courtesy uses its own lateral knee tracking instead.
  const axis=restGoal.clone().normalize();
  const natural=a.clone().addScaledVector(axis,-a.dot(axis));
  const weight=limit(goal.distanceTo(restGoal)/22,0,1);
  const transverse=suspended ? -.105 : .13+Math.abs(ankleOffset.x)*.004;
  const pole=natural.normalize().lerp(v(side*transverse,-.08,1).normalize(),weight);
  const [up,low]=triangle(a,b,goal,pole,134);
  const thigh=aim(a,up), shin=aim(b.clone().applyQuaternion(thigh),low).multiply(thigh);
  return {['Thigh'+s]:thigh,['Shin'+s]:thigh.clone().invert().multiply(shin),['Foot'+s]:shin.clone().invert().multiply(toe)};
}
