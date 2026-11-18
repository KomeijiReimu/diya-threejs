import * as THREE from 'three';
import {surfaceNet} from './surface-net.js';

// This is the physical arm THROUGH the armhole, not a cap sitting on top of it.
// Cross-sections of the deltoid become an elliptic upper arm down to mid-sleeve.
const muscle=[ // elevation, lateral centre, breadth, depth centre, depth radius
  [707,77.6,11.5,-3.9,14.9],[731,72.8,13.7,-3.4,17.3],[748,70.6,15.2,-3.0,18.6],
  [755,69.3,16.6,-2.6,20.6],[767,66.9,18.5,-1.9,23.9],[777,64.8,16.1,-1.2,23.1],
  [785,62.8,12.7,-.3,19.7],[791,59.4,9.0,.6,14.4],[797,54.1,5.2,1.1,6.7],
];
export function snugUpperArm(station,a,y,side,ease=0){
  return new THREE.Vector3(side*(station(muscle,y,1)+(station(muscle,y,2)+ease)*Math.sin(a)),y,
    station(muscle,y,3)+(station(muscle,y,4)+ease)*Math.cos(a));
}

export function shoulderGeometry(shoulders,station){
  const step=1.32, nx=151,ny=91,nz=99,x0=-99,y0=701,z0=-42, angular=256;
  const field=new Float32Array(nx*ny*nz), ownership=new Float32Array(field.length), smooth=THREE.MathUtils.smoothstep;
  for(let j=0;j<ny;j++){
    const y=y0+step*j, sampledY=Math.max(736,Math.min(y,815)), tighten=1-.21*smooth(736-y,0,22);
    const mid=(shoulders(0,sampledY).z+shoulders(Math.PI,sampledY).z)/2;
    const radius=[],phi=[];
    for(let s=0;s<=angular;s++){
      const p=shoulders(Math.PI*s/angular,sampledY),z=p.z-mid;
      radius.push(Math.hypot(p.x,z)*tighten);phi.push(Math.atan2(p.x,z));
    }
    phi[0]=0;phi[angular]=Math.PI;
    const radial=new Float32Array(angular+1);let bin=0;
    for(let n=0;n<=angular;n++){
      const a=n*Math.PI/angular;while(bin<angular-1&&phi[bin+1]<a)bin++;
      radial[n]=THREE.MathUtils.lerp(radius[bin],radius[bin+1],(a-phi[bin])/(phi[bin+1]-phi[bin]));
    }
    const cx=station(muscle,y,1),rx=station(muscle,y,2),cz=station(muscle,y,3),rz=station(muscle,y,4);
    for(let k=0;k<nz;k++)for(let i=0;i<nx;i++){
      const x=Math.abs(x0+i*step),z=z0+k*step,a=Math.atan2(x,z-mid)*angular/Math.PI,b=Math.min(angular-1,Math.floor(a));
      const body=Math.max(Math.hypot(x,z-mid)-THREE.MathUtils.lerp(radial[b],radial[b+1],a-b),718-y,y-815);
      const arm=Math.max((Math.hypot((x-cx)/rx,(z-cz)/rz)-1)*rx,707-y,y-797);
      const h=Math.max(0,Math.min(1,.5+.5*(body-arm)/4.8)), q=i+nx*(j+ny*k);
      field[q]=THREE.MathUtils.lerp(body,arm,h)-4.8*h*(1-h);
      const cap=smooth(x,37,77)*smooth(y,750,783),span=2.7+10.6*smooth(y,745,769);
      ownership[q]=THREE.MathUtils.lerp(cap,1,smooth(body-arm,-span,span)*(1-smooth(y,758,787)));
    }
  }
  const g=surfaceNet(field,nx,ny,nz,step,x0,y0,z0),p=g.attributes.position,w=new Float32Array(p.count);
  const armWeight=(px,py,pz)=>{
    const x=THREE.MathUtils.clamp((px-x0)/step,0,nx-1.001),y=THREE.MathUtils.clamp((py-y0)/step,0,ny-1.001),z=THREE.MathUtils.clamp((pz-z0)/step,0,nz-1.001);
    const i=Math.floor(x),j=Math.floor(y),k=Math.floor(z),dx=x-i,dy=y-j,dz=z-k;
    let sum=0;for(let cx=0;cx<=1;cx++)for(let cy=0;cy<=1;cy++)for(let cz=0;cz<=1;cz++)sum+=ownership[i+cx+nx*(j+cy+ny*(k+cz))]*(cx?dx:1-dx)*(cy?dy:1-dy)*(cz?dz:1-dz);
    return sum;
  };
  for(let n=0;n<p.count;n++)w[n]=armWeight(p.getX(n),p.getY(n),p.getZ(n));
  g.setAttribute('rigUpperArm',new THREE.BufferAttribute(w,1));return {geometry:g,armWeight};
}
