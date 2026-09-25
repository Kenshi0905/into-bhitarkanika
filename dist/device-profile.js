// A narrow desktop window is not a phone. Input/screen signals supplement the
// mobile UA flag for browsers that reduce their user-agent information.
export function isPhoneDevice({mobile=false,userAgent='',touchPoints=0,coarse=false,hoverNone=false,screenWidth=0,screenHeight=0}={}){
  if(mobile||/iPhone|iPod|Android.*Mobile|Windows Phone/i.test(userAgent))return true;
  return touchPoints>0&&coarse&&hoverNone&&Math.min(screenWidth,screenHeight)>0&&Math.min(screenWidth,screenHeight)<=600;
}
export function readDeviceProfile(){
  return {mobile:navigator.userAgentData?.mobile??false,userAgent:navigator.userAgent,touchPoints:navigator.maxTouchPoints??0,
    coarse:matchMedia('(pointer:coarse)').matches,hoverNone:matchMedia('(hover:none)').matches,screenWidth:screen.width,screenHeight:screen.height};
}
