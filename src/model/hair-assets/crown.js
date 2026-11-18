import { C, V, clamp, surface } from './surface.js';

// The crown, temple and long left fringe are a single sheet, from the whorl to
// this asymmetric hairline. There is deliberately no separate helmet beneath
// the bang: below the cheek it rolls over to reveal its blue-black lining.
const rim=[
  [-180,0,874,-64],[-157,-28,889,-60],[-137,-47,898,-46],[-113,-61,900,-24],
  [-98,-65,898,-5],[-91,-68,890,5],[-86,-70,861,33],[-82,-75,830,55],
  [-78,-77,808,66],[-74,-74,788,62],[-71,-63,774,55],[-67,-69,786,70],
  [-62,-69,806,80],[-55,-58,847,86],[-46,-46,870,87],[-35,-34,886,83],
  [-24,-22,900,80],[-12,-7,916,77],[0,7,934,69],[10,14,948,64],
  [16,13,938,64],[31,25,934,59],[46,36,923,52],[59,42,909,42],
  [71,43,896,28],[83,49,886,10],[95,57,897,-5],[113,64,900,-21],
  [134,51,898,-43],[155,29,888,-60],[180,0,874,-64]
];
const DEG=Math.PI/180, top=986;

function rimPoint(deg) {
  let i=1;while(i<rim.length-1 && rim[i][0]<deg)i++;
  const a=rim[i-1],b=rim[i],len=b[0]-a[0],u=clamp((deg-a[0])/len);
  const p=i>1?rim[i-2]:rim[rim.length-2].map((v,j)=>j===0?v-360:v);
  const n=i+1<rim.length?rim[i+1]:rim[1].map((v,j)=>j===0?v+360:v);
  return V(...[1,2,3].map(j=>{
    // Keep the blunt angle at the hooked tip and the little split at the part.
    const ma=(a[0]===-71||a[0]===10)?0:(b[j]-p[j])/(b[0]-p[0]);
    const mb=(b[0]===-71||b[0]===10)?0:(n[j]-a[j])/(n[0]-a[0]);
    return (1+2*u)*(1-u)**2*a[j]+u*(1-u)**2*ma*len+u*u*(3-2*u)*b[j]+u*u*(u-1)*mb*len;
  }));
}

function point(deg,y,foot) {
  const end=foot??rimPoint(deg),t=clamp((top-y)/(top-end.y));
  const phi=deg*DEG;
  const radial=Y=>Math.sqrt(Math.max(0,1-clamp((Y-914)/72)**2));
  const a=phi+(.38*Math.sin(phi+1.1)-.08)*Math.pow(1-t,1.3);
  // A small turn at the part and subtle broad ridges, dying into the hairline.
  const groove=(.5+.5*Math.cos(7*a+1.1*t+1.25*Math.sin(2.1*a+t)))**8;
  const lobe=1+(.021*Math.cos(7*a+1.1*t+1.25*Math.sin(2.1*a+t))-.014*groove)*Math.sin(Math.PI*t);
  const ease=t*t*(3-2*t);
  const rx=68.5,rz=71.8,zc=4.5;
  const endR=radial(end.y),r=radial(y)*lobe;
  const long=clamp((890-end.y)/110), bend=Math.sin(Math.PI*clamp((927-y)/(927-end.y||1)));
  const left=Math.max(0,-Math.sin(a));
  const tuck=3.1*left**3*Math.exp(-((y-905)**2)/1200);
  const forward=2.5*Math.max(0,Math.cos(a))**2*Math.exp(-((y-948)**2)/410);
  const temple=4.7*Math.max(0,Math.sin(a))**6*Math.exp(-((y-921)**2)/860);
  const occiput=11.5*Math.max(0,-Math.cos(a))**1.25*Math.exp(-((y-900)**2)/1250);
  const p=V(rx*r*Math.sin(a)+(end.x-rx*endR*Math.sin(phi))*ease+tuck+temple,
    y,
    zc+rz*r*Math.cos(a)+(end.z-zc-rz*endR*Math.cos(phi))*ease+forward-occiput+(35-9*Math.exp(-((y-849)**2)/1350))*long*bend);
  // Above the brow the forelock is full; below it the leaf rolls outwards
  // to skim the left temple. Recess the continuous sheet (including its rim),
  // not a cut-out over the eye: the cheek can be read when she turns to profile.
  const cheek=Math.exp(-((y-876)**2)/2360)*clamp((-p.x-7)/25)*clamp((p.z-20)/46);
  p.x-=4.8*cheek*clamp((81+p.x)/40);
  p.z-=35*cheek;
  return p;
}

const light=C('#92adff'), blue=C('#819ce9'), valley=C('#415a9e'), under=C('#354474');
function shade(deg,t,inner) {
  if(inner)return under.clone().lerp(valley,.13+.10*Math.cos(deg*DEG));
  const a=deg*DEG;
  // Lobes get discrete, soft inlaid troughs instead of evenly spaced drawn lines.
  const b=.5+.5*Math.cos(8.1*a+1.4*t+.63*Math.sin(3*a));
  const c=blue.clone().lerp(light,.39+.39*Math.cos(a-.6)+.13*(1-t));
  c.lerp(valley,.44*Math.pow(b,7)*Math.sin(Math.PI*t));
  const y=top+(rimPoint(deg).y-top)*t, da=180-Math.abs(deg);
  // Blue-black cleft beneath the paired folds on the rear of the crown.
  if(y<916&&da<40){const limit=clamp((y-874)/35)*29;
    const lip=904+9*Math.exp(-((da-11)**2)/95);
    c.lerp(under,.93*clamp((limit-da)/3)*clamp((lip-y)/3.2));}
  return c;
}

export function addCrown(group) {
  const pp=[],cc=[],ii=[];
  const angles=Array.from(new Set([...rim.slice(0,-1).map(p=>p[0]),...Array.from({length:180},(_,i)=>-180+2*i)])).sort((a,b)=>a-b);
  const m=angles.length, n=44;
  function add(p,c) {const idx=pp.length/3;pp.push(p.x,p.y,p.z);cc.push(c.r,c.g,c.b);return idx;}
  // Both surfaces end at a single pole; the hem bridges the two, not the open face.
  const shell=[];
  for(let side=0;side<2;side++) {
    const base=pp.length/3;
    const pole=add(V(0,top-side*3.8,4.5),side?under:light);
    for(let k=1;k<=n;k++)for(let j=0;j<m;j++) {
      const deg=angles[j], a=deg*DEG, f=rimPoint(deg);
      const t=1-Math.cos(.5*Math.PI*k/n), y=top+(f.y-top)*t;
      const p=point(deg,y,f);
      if(side) {
        const dist=(2.5+3.2*Math.sin(Math.PI*t))*(.12+.88*clamp((y-774)/24));
        p.x-=Math.sin(a)*dist;p.z-=Math.cos(a)*dist;p.y-=3.8*(1-t)+.5*t;
      }
      const idx=add(p,shade(deg,t,side));
      const next=base+1+(k-1)*m+(j+1)%m;
      const tri=(a,b,c)=>side?ii.push(a,c,b):ii.push(a,b,c);
      if(k===1)tri(pole,idx,next);
      else {const last=idx-m,lastNext=next-m;tri(last,idx,next);tri(last,next,lastNext);}
    }
    shell.push(base+1+(n-1)*m);
  }
  for(let j=0;j<m;j++){const k=(j+1)%m,a=shell[0],b=shell[1];ii.push(a+j,b+j,b+k,a+j,b+k,a+k);}
  group.add(surface('01 | single swept crown and left forelock',pp,cc,ii));

  // Draw a few asymmetric, tapered areas of reflected blue light. Surface
  // coordinates, rather than billboards, keep them attached in every view.
  const pigment=(name, paths, dark=false)=>{
    const pos=[],col=[],ind=[],ink=dark?C('#3b508f'):C('#c5e0ff');
    for(const [angle,yt,yb,width,drift] of paths) {
      const first=pos.length/3;
      for(let i=0;i<=17;i++) {
        const t=i/17,y=yt+(yb-yt)*t,q=angle+drift*(t+.13*Math.sin(Math.PI*t));
        const env=.015+.985*Math.pow(Math.sin(Math.PI*t),dark?.76:1.2);
        for(let side=0;side<2;side++) {
          const a=q+(side?1:-1)*width*env,p=point(a,y);
          const dA=point(a+.025,y).sub(point(a-.025,y));
          const up=point(a,y+.025).sub(point(a,y-.025));
          p.addScaledVector(dA.cross(up).normalize(),.29);
          pos.push(p.x,p.y,p.z);
          const color=(dark?blue:light).clone().lerp(ink,(dark?.75:.73)*env+.19);col.push(color.r,color.g,color.b);
        }
        if(i){const k=first+i*2;ind.push(k-2,k,k-1,k-1,k,k+1);}
      }
    }
    group.add(surface(name,pos,col,ind));
  };
  pigment('02 | cobalt folds at the part',[
    [-21,985,937,.91,-21],[-48,979,903,.78,-16],[-66,934,825,.58,1],
    [31,984,949,.91,21],[87,984,935,.93,23],[132,983,911,1.15,26],
    [-108,984,909,1.17,-40],[168,984,941,.72,5]
  ],true);
  pigment('03 | broken crown glints',[
    [-29,962,950,2.20,-5],[-27,958,945,1.35,-5],[-25,957,951,.86,-3],
    [-54,953,939,1.34,-3],[-51,952,943,.86,-3],[8,949,941,1.04,-3],
    [39,960,949,1.85,3],[43,955,946,.91,2],[115,964,955,1.60,3],
    [138,954,942,1.97,3],[142,950,942,1.09,2],[-137,955,944,1.19,-3]
  ]);
}
