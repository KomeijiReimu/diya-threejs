import { Group, MeshStandardMaterial } from 'three';
import { V, C, surface } from './surface.js';

export function addBrooch(parent) {
  const brooch=new Group();brooch.name='Hair jewel | silver and sea glass';parent.add(brooch);
  // Each corner sits at a different depth around the right temple. A planar
  // jewel facing forward would disappear entirely from the profile drawing.
  const L=V(15,938,66), R=V(54,948,17), D=V(39.5,907,44);
  const normal=D.clone().sub(L).cross(R.clone().sub(L)).normalize();
  const p=(u,v,h)=>L.clone().multiplyScalar(1-u-v).addScaledVector(R,u).addScaledVector(D,v)
    .addScaledVector(normal,h+2.6+6.6*(1-(u*u+v*v+(1-u-v)**2)));
  const holder=new MeshStandardMaterial({name:'Silver | pale satin bevels',vertexColors:true,metalness:.23,roughness:.39});
  const jewel=new MeshStandardMaterial({name:'Sea glass | cut turquoise',vertexColors:true,metalness:.14,roughness:.27});
  let pp=[],cc=[],ii=[];
  const tri=(a,b,d,colour)=>{
    const c=C(colour), n=pp.length/3;
    pp.push(...a.toArray(),...b.toArray(),...d.toArray());
    cc.push(c.r,c.g,c.b,c.r,c.g,c.b,c.r,c.g,c.b);ii.push(n,n+1,n+2);
  };
  const face=(a,b,c,color)=>tri(a,c,b,color);
  const outer=[[0,0],[1,0],[0,1]], bevel=[[.026,.011],[.951,.014],[.008,.955]];
  const chamber=[[.096,.095],[.712,.130],[.073,.799]];
  const ring=(coords,h)=>coords.map(([u,v])=>p(u,v,h));
  const low=ring(outer,-1.85),edge=ring(outer,.05),rim=ring(bevel,1.72),inner=ring(chamber,2.0);
  face(low[2],low[1],low[0],'#384765');
  for(let j=0;j<3;j++) {
    const k=(j+1)%3;
    face(low[j],low[k],edge[k],'#465575');face(low[j],edge[k],edge[j],'#465575');
    face(edge[j],edge[k],rim[k],['#adbdd3','#768ca6','#cddbeb'][j]);
    face(edge[j],rim[k],rim[j],['#c6d7e8','#8297af','#dce8f4'][j]);
    face(rim[j],rim[k],inner[k],['#f3f6fb','#94a6bd','#d9e5f0'][j]);
    face(rim[j],inner[k],inner[j],['#e1ebf6','#bdccdc','#f2f8ff'][j]);
  }
  brooch.add(surface('Sterling triangular bezel',pp,cc,ii,holder));
  pp=[];cc=[];ii=[];
  // Seven unequal facets, with a tiny triangular table offset toward the light.
  const border=[[.096,.095],[.407,.105],[.712,.130],[.451,.419],[.073,.799],[.079,.454]];
  const girdle=ring(border,2.47), inside=ring(chamber,1.70);
  for(let j=0;j<6;j++){
    const k=(j+1)%6,a=girdle[j].clone().addScaledVector(normal,-1.08),b=girdle[k].clone().addScaledVector(normal,-1.08);
    face(a,b,girdle[k],'#105565');face(a,girdle[k],girdle[j],'#105565');
  }
  face(inside[2],inside[1],inside[0],'#126777');
  const t0=p(.28,.244,6.0),t1=p(.413,.230,5.7),t2=p(.284,.423,5.3);
  face(girdle[0],girdle[1],t0,'#83f4df');face(girdle[1],t1,t0,'#46e2cd');
  face(girdle[1],girdle[2],t1,'#9affed');face(girdle[2],girdle[3],t1,'#21cbbd');
  face(girdle[3],t2,t1,'#069f9d');face(girdle[3],girdle[4],t2,'#147a82');
  face(girdle[4],girdle[5],t2,'#02a79f');face(girdle[5],t0,t2,'#16b8ab');
  face(girdle[5],girdle[0],t0,'#37d7c3');face(t0,t1,t2,'#16d6c3');
  brooch.add(surface('Cut triangular aqua stone',pp,cc,ii,jewel));
}
