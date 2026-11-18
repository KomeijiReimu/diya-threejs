import { C, V, interpolate, surface } from './surface.js';

// Three substantial leaves, not strands/decorations stacked on a separate
// back plate. Their two natural overlaps are the two partings in the drawing.
// Station: elevation, lateral center, depth, projected half-width, bank,
// transverse arch and half-thickness. The returning tips curl in plan too.
const leaves=[
  ['Left leaf | folded return',[
    [908,-30,-39,24,-13,5,7],[878,-32,-54,27,-13,5,8],
    [839,-34,-62,27,-13,5,8],[797,-37,-69,27,-13,5,8],
    [753,-42,-80,28,-15,6,9],[712,-51,-92,30,-15,7,9],
    [673,-61,-100,31,-14,7,9],[638,-66,-109,34,-14,7,9],
    [603,-64,-119,35,-12,7,9],[576,-52,-133,34,-10,6,8],
    [555,-40,-141,28,-7,6,7],[544,-32,-147,17,-2,5,6],
    [536,-33,-151,10,4,3,4],[530,-42,-154,6,5,2,3],
    [525,-50,-154,3.5,4,1,2],[515,-61,-144,0,0,0,0]
  ],'#96b2fc','#4f67a4',-1],
  ['Right leaf | curled lip',[
    [908,29,-39,23,14,5,7],[878,33,-53,25,14,5,8],
    [838,34,-62,26,14,5,8],[796,36,-70,26,14,5,8],
    [752,42,-80,29,16,6,9],[710,49,-90,33,16,7,10],
    [671,54,-102,38,15,7,10],[637,56,-114,44,15,8,10],
    [604,54,-124,45,14,8,10],[578,50,-134,41,14,7,9],
    [558,45,-140,33,12,7,8],[546,36,-146,22,8,6,7],
    [537,34,-152,13,2,4,5],[530,40,-156,8,-4,3,4],
    [524,49,-156,4.5,-5,1,2],[516,63,-145,0,0,0,0]
  ],'#99b5fd','#526ca8',1],
  ['Mantle | luminous center leaf',[
    [912,0,-47,19,0,5,7],[881,0,-66,18,0,4,6],
    [848,0,-74,19,0,4,7],[807,1,-81,20,1,5,8],
    [762,0,-91,22,1,5,8],[719,-4,-101,26,0,6,9],
    [680,-10,-112,30,-1,7,10],[645,-14,-123,33,-2,8,11],
    [618,-11,-134,36,-4,10,11],[592,-3,-144,37,-5,12,11],
    [570,8,-152,38,-5,14,10],[552,17,-159,31,-3,14,9],
    [539,19,-165,22,3,12,7],[529,14,-171,14,7,8,5],
    [520,4,-175,9,7,5,4],[514,-7,-175,6,5,3,3],
    [510,-17,-172,3.8,4,2,2],[502,-27,-162,0,0,0,0]
  ],'#9db8ff','#546ba8',0]
];

export function addCascade(parent) {
  for(const [name,keys,light,lining,side] of leaves){
    const lit=C(light),back=C(lining),edge=C('#4d6293'),glow=C('#b6caff'),turned=C('#6e89c8');
    const pp=[],cc=[],ii=[],n=(keys.length-1)*5,m=48;
    const vertex=(p,c)=>{const id=pp.length/3;pp.push(p.x,p.y,p.z);cc.push(c.r,c.g,c.b);return id;};
    for(let i=0;i<n;i++){
      const t=i/n,[y,x,z,w,bank,arch,d]=interpolate(keys,t);
      for(let j=0;j<m;j++){
        const a=2*Math.PI*j/m,h=Math.cos(a),s=Math.sin(a);
        const pt=V(x+w*h,y,z+bank*h+arch*h*h-d*s*(.56+.44*Math.abs(s)));
        const col=edge.clone().lerp(s>=0?lit:back,Math.min(1,1.46*Math.sqrt(Math.abs(s))));
        // One wide plane of reflected skylight, not a sequence of etched bands.
        if(s>0){
          col.lerp(glow,(side?.060:.095)*s*s*(.75+.25*Math.cos(Math.PI*t)));
          const lip=Math.min(1,Math.max(0,(Math.abs(h)-.76)/.24));
          col.lerp(turned,lip*lip*.71*Math.sin(Math.PI*t)**.57);
        }
        vertex(pt,col);
        if(i){const k=(j+1)%m,p=(i-1)*m,q=i*m;ii.push(p+j,q+j,p+k,p+k,q+j,q+k);}
      }
    }
    const r=keys[0],e=keys.at(-1),root=vertex(V(r[1],r[0],r[2]),back),tip=vertex(V(e[1],e[0],e[2]),lit);
    for(let j=0;j<m;j++){const k=(j+1)%m;ii.push(root,j,k,(n-1)*m+j,tip,(n-1)*m+k);}
    parent.add(surface(name,pp,cc,ii));
  }
}
