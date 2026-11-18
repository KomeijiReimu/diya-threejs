// Rest-space joint centres, in the original front-view pixel units. These
// are the R (+X) hand; mirror only X for L. Digits are ordered MCP/PIP/DIP/tip
// (the thumb path records its CMC, MCP, IP and tip).
export const wrist = [167,503,-7];
export const handLandmarks = {
  Index: [[178.8,481.4,3.2],[180.5,470.4,5.0],[179.0,460.6,6.4],[176.3,452.4,7.1]],
  Middle: [[180.2,480.9,-4.1],[181.1,468.4,-2.9],[177.9,457.9,-1.7],[173.6,449.5,-.75]],
  Ring: [[178.8,480.2,-11.5],[178.8,468.8,-10.4],[175.5,460.1,-8.7],[171.1,453,-8]],
  Pinky: [[174.8,480.5,-17.7],[175.7,472.3,-18.5],[172.5,464.8,-18],[168.8,458.7,-16.6]],
  Thumb: [[169.4,494.4,1.7],[167.9,486.4,8.1],[165.7,478.1,13.8],[162.9,470.6,16.8]],
};
