import { Group } from 'three';
import { addCrown } from './hair-assets/crown.js';
import { addBrooch } from './hair-assets/brooch.js';
import { addCascade } from './hair-assets/cascade.js';
import { lock } from './hair-assets/surface.js';

const midnight=['#405189','#303e70','#2f395f','#657bb3'];
const dark=['#495c9b','#39497e','#34416e','#748ac3'];
const marine=['#6886d7','#455888','#425487','#9bbcff'];
const cobalt=['#94b0ff','#657dc7','#40558d','#d5e8ff'];
const cornflower=['#9ebaff','#758ee1','#435d9d','#d9edff'];

export function buildHair() {
  const group=new Group();group.name='Hair | Blue cascade and silver star';
  const lengths=new Group();lengths.name='Layered lengths';group.add(lengths);
  // The two outer wings enclose negative space. Behind them, the mantle is
  // broad and continuous until it breaks into curved, folded blades at the hem.
  for(const sign of [-1,1]) {
    const prefix=sign>0?'R · ':'L · ';
    const strand=(name,keys,palette,options={})=>{
      if(/^(01|02|03|07)/.test(name))for(const p of keys){
        // In elevation the dark mass continues beneath the bright sheet. It
        // remains forward of it in depth until the rolled hem is past the waist;
        // below that, it settles *behind* the back of the flaring white skirt.
        const y=p[1], lift=11+30*Math.exp(-((y-602)**2)/14500);
        p[2]+=lift*Math.max(0,Math.min(1,(y-471)/49));
        if(name.startsWith('01'))p[0]-=9*Math.exp(-((y-500)**2)/4700);
      }
      return lock(lengths,prefix+name,keys,palette,{mirror:sign,...options});
    };
    strand('01 | deepest folded end',[
      [20,913,-35,24,13,6],[22,862,-47,33,17,10],[21,802,-59,38,19,13],
      [26,739,-81,41,19,13],[30,667,-99,48,20,14],[40,601,-107,54,22,12],
      [48,545,-115,48,20,16],[44,495,-111,44,20,7],[28,452,-97,33,18,-4],
      [13,418,-108,21,15,-13],[9,394,-102,16,11,-23],[12,376,-83,10,7,-23],
      [21,366,-59,5,4,-27],[37,360,-39,0,0,-36]
    ],midnight);
    strand('02 | indigo blade and turned foot',[
      [48,903,-22,17,11,42],[45,850,-28,27,16,33],[43,785,-37,34,18,28],
      [45,722,-53,36,21,26],[53,659,-75,40,21,24],[66,596,-94,39,26,26],
      [73,551,-104,37,20,31],[79,506,-113,30,16,41],[75,467,-113,24,15,38],
      [70,427,-105,18,13,33],[77,400,-89,12,11,28],[85,378,-65,7,6,22],
      [97,366,-42,0,0,23]
    ],midnight);
    strand('03 | shorter notched end',[
      [53,895,-26,13,10,57],[54,846,-34,19,12,56],[58,792,-48,21,15,52],
      [64,728,-67,26,18,52],[73,661,-94,28,19,46],[84,603,-121,31,20,42],
      [94,550,-101,29,17,48],[101,506,-88,23,15,57],[103,473,-78,20,13,50],
      [96,437,-78,15,11,40],[100,402,-70,10,7,28],[111,385,-71,5,4,25],
      [126,382,-73,0,0,24]
    ],dark);

    strand('04 | long outer swallowtail',[
      [55,905,-20,8,5,0],[58,861,-26,11,7,0],[72,812,-33,13,8,0],
      [94,769,-42,16,10,0],[115,720,-54,18,11,0],[129,675,-60,18,12,0],
      [146,638,-57,18,11,0],[162,604,-43,15,10,0],[173,575,-25,10,7,0],
      [178,555,-8,6,4,0],[169,538,5,0,0,0]
    ],dark,{plan:true,folds:.82});
    strand('05 | inner swallowtail',[
      [49,902,-21,11,7,0],[58,842,-32,14,9,0],[75,794,-46,18,11,0],
      [96,749,-55,20,12,0],[113,701,-61,21,13,0],[129,655,-68,19,12,0],
      [145,616,-69,16,10,0],[156,582,-59,11,8,0],[159,556,-48,6,4,0],
      [154,543,-36,0,0,0]
    ],midnight,{plan:true,folds:.9});

    // Dense lower backing at the nape prevents gaps when the model turns.
    // This shoulder-side lock points inwards rather than fanning outside.
    strand('06 | shadow behind ear',[
      [55,906,-18,14,9,70],[53,869,-18,17,12,75],[49,826,-23,24,14,66],
      [51,783,-33,26,15,57],[63,735,-47,27,17,58],[70,692,-52,26,16,64],
      [70,647,-53,26,16,67],[66,608,-52,19,12,59],[60,581,-45,8,7,48],
      [50,570,-33,0,0,41]
    ],midnight);
    strand('07 | outer folded underleaf',[
      [48,899,-38,16,9,26],[45,851,-47,21,12,29],[47,796,-59,24,13,30],
      [55,743,-71,27,15,35],[72,681,-85,28,16,37],[88,620,-98,29,17,36],
      [105,565,-108,26,16,41],[113,528,-111,17,11,44],[108,500,-105,9,6,42],
      [91,480,-88,0,0,35]
    ],dark,{folds:.8});

    strand('11 | cheek-side curl',[
      [57,912,-12,7,4,0],[57,878,-15,9,5,0],[65,839,-22,12,6,0],
      [78,803,-26,14,8,0],[93,767,-30,15,8,0],[108,732,-34,15,8,0],
      [121,701,-31,13,8,0],[128,679,-22,10,6,0],[125,663,-10,7,4,0],
      [115,654,1,0,0,0]
    ],cobalt,{plan:true,folds:.65,glints:[[.53,.63,-.16,.07]]});
    strand('12 | wide curling wing',[
      [55,910,-31,6,5,0],[60,876,-37,9,6,0],[68,835,-49,13,8,0],
      [83,796,-60,16,9,0],[103,761,-70,19,10,0],[124,724,-78,19,10,0],
      [142,689,-73,16,10,0],[151,662,-58,12,9,0],[147,639,-36,9,6,0],
      [137,623,-19,6,4,0],[122,614,-13,0,0,0]
    ],cornflower,{plan:true,folds:.73,glints:[[.47,.61,-.13,.1],[.51,.635,.10,.075],[.61,.67,-.09,.055]]});
  }
  addCascade(lengths);

  addCrown(group);
  const twists=new Group();twists.name='Temple twists and pointed back join';group.add(twists);
  for(const sign of [-1,1]) {
    // Each twist is two flattened, interleaved ribbons. The lower roll emerges
    // once near the ear and disappears beneath the next fold at the back.
    lock(twists,(sign>0?'R':'L')+' | rolled temple, lower fold',[
      [34,920,34,3,2,0],[51,911,25,5,3,-6],[64,905,8,6.8,4.5,-9],
      [66,906,-9,5,4,5],[59,907,-28,5.8,4,13],[50,901,-45,6.5,4,5],
      [32,894,-65,6.5,5,-3],[13,884,-73,5.5,3.5,-2],[3,873,-76,2.7,2,0],
      [0,863,-74,0,0,0]
    ],marine,{band:true,mirror:sign});
    lock(twists,(sign>0?'R':'L')+' | sweep to the nape',[
      [32,930,42,3,2,-9],[44,924,32,6,3,-7],[58,916,17,8,4,-4],
      [65,912,5,7,5,4],[65,910,-13,4.3,4.2,20],[62,912,-26,6.6,5,14],
      [54,907,-46,7.2,5,1],[40,900,-63,6.8,5.4,-3],[22,892,-72,5.8,4.4,-5],
      [8,882,-78,4,3.4,-9],[0,870,-75,0,0,0]
    ],cobalt,{band:true,mirror:sign});
    lock(twists,(sign>0?'R':'L')+' | swept crown fold into the rear V',[
      [57,947,-14,2,1,0],[61,938,-25,5,2,-3],[59,927,-39,8,3,-5],
      [49,917,-52,10,3,-6],[37,908,-63,10,3.6,-5],[26,899,-70,8.5,3.7,-3],
      [15,891,-75,6,3,0],[6,881,-78,3.3,2,2],[0,871,-76,0,0,4]
    ],cornflower,{band:true,mirror:sign,folds:.56});
  }
  addBrooch(group);
  return group;
}
