// Named drawings, not animation presets. Each row gives wrist, elbow guide,
// fingertip direction, palm direction, shoulder lift, curl, and finger spread.
// Each sequence can offset the two sides in time without mirroring the whole
// body. The raised arms pass *outside* the temples rather than through them.
export const hands={
  idle: null,
  inhale: [[172,507,0],[88,651,-5],[.15,-1,.1],[-1,0,.08],3.4,3,1.7],
  loose: [[162,515,28],[89,649,-8],[.09,-1,.25],[-1,.03,.16],.8,8,2],
  balance: [[179,532,54],[96,642,-3],[.25,-.97,.15],[-1,.2,.14],1.0,7,3.4],
  // Greeting. The elbow does not pump in time with the wrist; the fingers
  // answer the change of direction in a smaller fan as the wrist turns.
  scoop: [[178,608,99],[116,651,-4],[.28,-.8,.53],[-.93,.25,.28],4,11,2.2],
  waveLift: [[198,773,101],[156,678,16],[.54,.80,.22],[-.62,.08,.81],12,4,5.2],
  waveOut: [[192,881,74],[180,739,28],[.48,.87,.01],[-.24,.07,1],17,-5,10.5],
  waveIn: [[142,887,81],[174,746,27],[-.48,.87,.08],[-.26,.03,1],18,0,8.5],
  waveOut2: [[183,888,79],[178,743,26],[.38,.93,-.04],[-.15,.10,1],17,-4,9.5],
  waveIn2: [[149,883,79],[171,741,25],[-.35,.94,.08],[-.29,.06,1],16,2,7.8],
  farewell: [[174,845,91],[164,712,24],[.11,.99,.10],[-.28,.12,1],13,4,7.5],
  release: [[180,673,98],[122,654,1],[.29,-.65,.71],[-.88,.31,.33],4,10,4],
  // Courtesy. One hand settles over the sternum while the other describes
  // the flare of the skirt, lifting a little away from its outermost edge.
  drawIn: [[95,661,116],[99,642,18],[-.62,.43,.66],[-.4,.01,-.90],4,11,3.2],
  heart: [[11,742,104],[94,648,40],[-.67,.74,.03],[.08,.10,-1],6,8,2],
  heartLow: [[19,734,110],[97,651,45],[-.71,.70,-.08],[.12,.05,-1],5,13,2],
  skirt: [[153,533,91],[102,646,9],[.17,-.91,.36],[-.84,.19,-.50],3,17,2],
  skirtWide: [[180,547,90],[108,647,4],[.63,-.70,.32],[-.70,.05,-.70],5,20,1],
  // Exchange: finger groups overlap in projection, cuffs do not occupy
  // the same depth. The next sweep opens broad before coming back together.
  gather: [[109,633,113],[104,646,0],[-.53,.10,.84],[-.60,.60,-.43],4,15,3.5],
  prayerNear: [[15,769,155],[101,653,48],[-.56,.64,-.50],[-.58,-.03,-.81],6,18,1.1],
  prayerFar: [[13,776,88],[95,655,26],[-.57,.70,.38],[-.78,.02,.60],6,15,1.5],
  prayerTight: [[14,772,153],[96,654,50],[-.55,.65,-.5],[-.60,.02,-.80],7.5,19,1],
  prayerBack: [[12,777,85],[89,653,23],[-.57,.70,.4],[-.78,.03,.60],6,17,1],
  openArc: [[121,828,114],[151,726,36],[.30,.93,.11],[-.97,.09,.14],19,10,3],
  arch: [[85,968,106],[153,856,42],[-.43,.89,.07],[-.96,.08,.22],31,3,3.7],
  apex: [[57,1047,64],[125,907,33],[-.77,.64,-.03],[-.64,-.75,.18],40,12,2.8],
  apexFar: [[53,1045,63],[125,906,32],[-.76,.65,-.03],[-.66,-.74,.17],39,9,2.3],
  descent: [[113,889,122],[166,790,27],[-.19,.95,.24],[-.9,.29,.28],22,6,4.2],
  catch: [[70,704,152],[105,655,34],[-.52,.55,.65],[-.57,.79,.25],8,23,4.0],
  bowl: [[47,624,155],[104,629,31],[-.32,.24,.92],[-.18,.97,.12],4,28,4.4],
  pour: [[43,633,161],[108,631,35],[-.31,.36,.88],[-.25,.95,.16],5,22,5.7],
  orbit: [[49,629,161],[107,628,33],[-.27,.28,.92],[-.15,.98,.14],4,26,5.2],
  flash: [[60,646,170],[112,644,42],[-.20,.42,.87],[-.26,.92,.32],6,14,7.6],
  fall: [[111,591,108],[106,637,11],[.09,-.54,.83],[-.92,.35,.16],3,10,4.0],
  trail: [[154,546,77],[100,646,2],[.23,-.88,.41],[-.98,.13,.12],1.4,7,3.6],
};

export const arms={
  breathe: {
    L:[[0,'idle'],[.46,'inhale'],[1,'idle']], R:[[0,'idle'],[.48,'inhale'],[1,'idle']]
  },
  greet: {
    L:[[0,'idle'],[.105,'scoop'],[.205,'waveLift'],[.32,'waveOut'],[.424,'waveIn'],[.518,'waveOut2'],[.61,'waveIn2'],[.70,'farewell'],[.82,'release'],[.95,'loose'],[1,'idle']],
    R:[[0,'idle'],[.23,'loose'],[.46,'balance'],[.70,'loose'],[1,'idle']]
  },
  bow: {
    L:[[0,'idle'],[.15,'gather'],[.34,'heart'],[.56,'heartLow'],[.71,'heart'],[.86,'drawIn'],[.955,'loose'],[1,'idle']],
    R:[[0,'idle'],[.20,'loose'],[.34,'skirt'],[.55,'skirtWide'],[.70,'skirt'],[.88,'loose'],[1,'idle']]
  },
  exchange: {
    L:[[0,'idle'],[.053,'gather'],[.127,'prayerNear'],[.19,'prayerTight'],[.296,'prayerTight'],[.324,'prayerNear'],[.348,'openArc'],[.368,'arch'],[.394,'apex'],[.453,'apex'],[.473,'descent'],[.494,'catch'],[.523,'bowl'],[.57,'pour'],[.645,'bowl'],[.711,'pour'],[.774,'orbit'],[.815,'pour'],[.832,'flash'],[.851,'bowl'],[.879,'fall'],[.912,'trail'],[.956,'loose'],[1,'idle']],
    R:[[0,'idle'],[.06,'gather'],[.13,'prayerFar'],[.197,'prayerBack'],[.297,'prayerBack'],[.323,'prayerFar'],[.353,'openArc'],[.375,'arch'],[.398,'apexFar'],[.456,'apexFar'],[.478,'descent'],[.499,'catch'],[.526,'bowl'],[.578,'pour'],[.653,'bowl'],[.718,'pour'],[.78,'orbit'],[.816,'pour'],[.832,'flash'],[.856,'bowl'],[.887,'fall'],[.918,'trail'],[.962,'loose'],[1,'idle']]
  },
};
