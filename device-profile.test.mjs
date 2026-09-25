import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isPhoneDevice} from './dist/device-profile.js';
test('desktop windows never become phones solely because they are narrow',()=>{
 assert.equal(isPhoneDevice({userAgent:'Windows NT 10.0',screenWidth:390,screenHeight:844}),false);
 assert.equal(isPhoneDevice({userAgent:'Windows NT 10.0',touchPoints:10,coarse:false,hoverNone:false,screenWidth:390,screenHeight:844}),false);
});
test('mobile and reduced mobile browser signals show the advice before High loads',()=>{
 assert.equal(isPhoneDevice({mobile:true}),true);assert.equal(isPhoneDevice({userAgent:'Mozilla iPhone'}),true);
 assert.equal(isPhoneDevice({userAgent:'Android 14 Mobile Safari'}),true);
 assert.equal(isPhoneDevice({touchPoints:5,coarse:true,hoverNone:true,screenWidth:844,screenHeight:390}),true);
 assert.equal(isPhoneDevice({touchPoints:5,coarse:true,hoverNone:true,screenWidth:1024,screenHeight:768}),false);
});
