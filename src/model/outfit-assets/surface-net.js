import * as THREE from 'three';

// One indexed, smoothly shaded surface for a branched anatomical volume.
export function surfaceNet(field,nx,ny,nz,step,x0,y0,z0){
  const cells=new Int32Array(field.length).fill(-1);
  const strides=[1,nx,nx*ny], corner=[0,1,nx,nx+1,nx*ny,nx*ny+1,nx*ny+nx,nx*ny+nx+1],pos=[],index=[];
  for(let k=1;k<nz-1;k++) for(let j=1;j<ny-1;j++) for(let i=1;i<nx-1;i++) {
    const q=i+nx*(j+ny*k);let mask=0;
    for(let n=0;n<8;n++) if(field[q+corner[n]]<0)mask|=1<<n;
    if(!mask||mask===255)continue;
    const sum=[0,0,0];let count=0;
    for(let n=0;n<8;n++) for(let d=0;d<3;d++) {
      const bit=1<<d;if(n&bit)continue;
      const a=field[q+corner[n]],b=field[q+corner[n+bit]];if((a<0)===(b<0))continue;
      count++;sum[0]+=n&1;sum[1]+=(n>>1)&1;sum[2]+=(n>>2)&1;sum[d]+=a/(a-b);
    }
    cells[q]=pos.length/3;
    pos.push(x0+(i+sum[0]/count)*step,y0+(j+sum[1]/count)*step,z0+(k+sum[2]/count)*step);
    for(let d=0;d<3;d++) {
      if((field[q]<0)===(field[q+strides[d]]<0))continue;
      const a=cells[q],du=strides[(d+1)%3],dv=strides[(d+2)%3],b=cells[q-du],c=cells[q-du-dv],e=cells[q-dv];
      if(b<0||c<0||e<0)continue;
      if(field[q]<0)index.push(a,b,c,a,c,e);else index.push(a,c,b,a,e,c);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(index);g.computeVertexNormals();return g;
}
