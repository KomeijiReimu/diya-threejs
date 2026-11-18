import * as THREE from 'three';
import {handLandmarks} from './landmarks.js';
import {surfaceNet} from './surface-net.js';

const calibre={Thumb:3.22,Index:3.12,Middle:3.20,Ring:2.93,Pinky:2.52};
const turn={Thumb:1.08,Index:.16,Middle:.035,Ring:-.11,Pinky:-.22};
const palm=[ // y, crown x, palm half-thickness, knuckle arch centre z, palm half-breadth
  [475.0,177.8,2.85,-7.1,9.6],[478.4,178.0,4.1,-7.6,14.8],[483.8,177.1,5.15,-7.6,16.1],
  [490.3,174.9,5.75,-7.5,15.6],[496.0,172.65,5.7,-7.4,13.6],[502,170.1,5.25,-7.1,10.35],
  [508.5,167.3,5.5,-7,9.15],[520,163.0,6.4,-7,9.8],
];

export function handGeometry(station){
  const spines=[],nailSegments=[];
  for(const [name,knots] of Object.entries(handLandmarks)){
    const radius=calibre[name], path=new THREE.CatmullRomCurve3(knots.map(p=>new THREE.Vector3(...p)));
    let a=path.getPoint(0),ra=radius;
    for(let i=1;i<=36;i++){
      const t=i/36,b=path.getPoint(t),dome=t>.872?Math.sqrt(Math.max(0,1-((t-.872)/.128)**2)):1;
      const rb=radius*(1-.31*t)*dome*(1+.074*Math.exp(-(((t-.36)/.066)**2))+.048*Math.exp(-(((t-.66)/.07)**2)));
      const dx=(b.x-a.x)/.86,dy=b.y-a.y,dz=b.z-a.z;
      spines.push([a.x,a.y,a.z,dx,dy,dz,1/(dx*dx+dy*dy+dz*dz),ra,rb-ra]);
      if(i>=23){
        const axis=b.clone().sub(a),inv=1/axis.lengthSq(),tangent=axis.clone().normalize();
        const dorsal=new THREE.Vector3(Math.cos(turn[name]),0,Math.sin(turn[name]));
        dorsal.addScaledVector(tangent,-tangent.dot(dorsal)).normalize();
        nailSegments.push({origin:a.clone(),axis,inv,t0:t-1/36,dorsal,binormal:tangent.clone().cross(dorsal),radius});
      }
      a=b;ra=rb;
    }
  }
  const step=.67,nx=65,ny=122,nz=83,x0=149,y0=443,z0=-31;
  const field=new Float32Array(nx*ny*nz),smooth=THREE.MathUtils.smoothstep;
  for(let j=0;j<ny;j++){
    const y=y0+j*step,cx=station(palm,y,1),w=station(palm,y,2),cz=station(palm,y,3),d=station(palm,y,4);
    const active=spines.filter(s=>Math.abs(y-s[1])<7.3),spread=1-smooth(y,479,505);
    for(let k=0;k<nz;k++){
      const z=z0+k*step,pz=(z-cz)/d,radial=Math.exp(-(((z-(cz+6))/7.2)**2))*Math.exp(-(((y-489)/9.6)**2));
      let fascicle=0;
      for(const zz of [3.2,-4.1,-11.5,-17.7]){
        const ridge=cz+(zz-cz)*(.43+.57*spread);
        fascicle+=(.84+.62*Math.exp(-(((y-481.3)/3.6)**2)))*Math.exp(-(((z-ridge)/(1.8+1.1*(1-spread)))**2))*Math.exp(-(((y-482)/10.5)**2));
      }
      const ax=cx+1.65*pz-.65*pz*pz;
      for(let i=0;i<nx;i++){
        const x=x0+i*step,px=(x-ax)/(w+(x>ax?fascicle:1.5*radial));
        const boundary=474.9+.92*(pz+.25)**2;
        const body=Math.max((Math.sqrt(px*px+pz*pz)-1)*w,boundary-y,y-520);
        let digit=22;
        for(const s of active){
          let dx=(x-s[0])/.86,dy=y-s[1],dz=z-s[2];
          const t=Math.max(0,Math.min(1,(dx*s[3]+dy*s[4]+dz*s[5])*s[6]));dx-=t*s[3];dy-=t*s[4];dz-=t*s[5];
          digit=Math.min(digit,Math.sqrt(dx*dx+dy*dy+dz*dz)-s[7]-t*s[8]);
        }
        const h=Math.max(0,1-Math.abs(digit-body)/3.2);
        field[i+nx*(j+ny*k)]=Math.min(body,digit)-h*h*.8;
      }
    }
  }
  const g=surfaceNet(field,nx,ny,nz,step,x0,y0,z0),p=g.attributes.position,norm=g.attributes.normal;
  const base=new THREE.Color('#fde6d8'),bed=new THREE.Color('#f4d0c5'),free=new THREE.Color('#fae2d4'),fold=new THREE.Color('#c8a99e');
  const color=new THREE.Color(),delta=new THREE.Vector3(),q=new THREE.Vector3(),n=new THREE.Vector3(),paint=[];
  // The nail beds are shaded directly on the dorsal skin, not offset billboards
  // or pads. They share their finger's exact surface, normals and skin weights.
  for(let i=0;i<p.count;i++){
    q.fromBufferAttribute(p,i);n.fromBufferAttribute(norm,i);color.copy(base);
    // Quiet MCP and interphalangeal folds remain legible on the shadow side
    // under the deliberately flat studio light. No painted rings around digits.
    if(n.x>.30){
      let shade=0;
      for(const [name,line] of Object.entries(handLandmarks))for(let j=0;j<=2;j++){
        const [x,y,z]=line[j],dz=(q.z-z)/calibre[name],dy=q.y-y+1.17-.83*dz*dz;
        if(Math.abs(q.x-x)>5||Math.abs(dz)>1.13)continue;
        shade+=Math.exp(-((dy/(j?.81:1.13))**2)-dz*dz*1.9)*(j?.19:.135);
      }
      color.lerp(fold,shade*smooth(n.x,.30,.79));
    }
    let nearest=Infinity,point=null,u=0;
    if(q.y<484)for(const s of nailSegments){
      if(Math.abs(s.origin.y-q.y)>5)continue;
      delta.subVectors(q,s.origin);const t=THREE.MathUtils.clamp(delta.dot(s.axis)*s.inv,0,1);
      delta.addScaledVector(s.axis,-t);const dist=delta.lengthSq();if(dist<nearest){nearest=dist;point=s;u=s.t0+t/36;}
    }
    if(point&&nearest<point.radius**2&&u>.72&&u<.947&&n.dot(point.dorsal)>.49){
      delta.subVectors(q,point.origin).addScaledVector(point.axis,-(u-point.t0)*36);
      const ang=Math.atan2(delta.dot(point.binormal),delta.dot(point.dorsal));
      const shape=((u-.85)/.094)**4+(ang/.69)**4, coverage=1-smooth(shape,.61,1.22);
      color.lerp(bed,coverage*.87);color.lerp(free,coverage*smooth(u,.893,.936));
    }
    paint.push(color.r,color.g,color.b);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(paint,3));return g;
}
