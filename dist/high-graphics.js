import {buildHighSky,getHighLighting} from './high-sky.js';
import {buildHighForest} from './high-forest.js';
import {createHighFauna} from './high-fauna.js';
import {createHighBoat} from './high-boat.js';
import {createHighAtmosphere} from './high-atmosphere.js';
import {createHighWeather} from './high-weather.js';
import {createHighPost} from './high-post.js';

export async function loadHighGraphics(context){
  const {onProgress=()=>{}}=context,parts=[];
  const current=()=>{if(context.isCurrent&&!context.isCurrent())throw new Error('Graphics preparation was interrupted.');};
  try{
    onProgress('Loading sky and natural light',.12);
    const sky=await buildHighSky({...context,onProgress:message=>onProgress(message,.2)});parts.push(sky);current();
    // Yield between geometry stages so loading status and cancel remain responsive.
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const forest=await buildHighForest({...context,onProgress:message=>onProgress(message,.45)});parts.push(forest);current();
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const fauna=await createHighFauna({...context,onProgress:message=>onProgress(message,.72)});parts.push(fauna);current();
    const boat=await createHighBoat({...context,onProgress:message=>onProgress(message,.84)});parts.push(boat);current();
    const atmosphere=createHighAtmosphere(context);parts.push(atmosphere);
    const weather=createHighWeather(context);parts.push(weather);
    const post=createHighPost(context.renderer);
    let enabled=false,climate=weather.getState();
    onProgress('Preparing reflections and materials',.94);
    return {
      setEnabled(value){enabled=value;for(const part of parts)part.setEnabled(value);},
      getLighting:getHighLighting,
      setLighting(...args){sky.setLighting(...args);atmosphere.setLighting(...args);weather.setLighting(args[0]);post.setLighting(getHighLighting(args[0],args[1]));},
      advanceWeather(time,dt,boatPosition,camera){weather.update(time,dt,boatPosition,camera);climate=weather.getState();climate.waterHeight=context.waterHeight;sky.setWeather?.(climate);atmosphere.setWeather?.(climate);return climate;},
      getWeather(){return climate;},
      setSize(w,h){post.setSize(w,h);},
      render(scene,camera,direction,profile){if(enabled)post.render(scene,camera,direction,profile);else context.renderer.render(scene,camera);},
      beginReflection(context){forest.beginReflection?.(context);fauna.beginReflection?.();boat.beginReflection?.();weather.beginReflection?.();},
      endReflection(){weather.endReflection?.();boat.endReflection?.();fauna.endReflection?.();forest.endReflection?.();},
      update(time,dt,boatPosition,camera){sky.update(time,camera);forest.update(time,boatPosition,climate);fauna.update(time,dt,climate);boat.update?.(time,dt,climate);atmosphere.update(time,camera);},
      getStats(){return {forest:forest.getStats?.(),fauna:fauna.getStats?.(),sky:sky.getStats?.(),boat:boat.getStats?.(),post:post.getStats?.()};},
      dispose(){post.dispose();for(const part of [...parts].reverse()){part.setEnabled(false);part.dispose?.();}}
    };
  }catch(error){for(const part of parts.reverse()){part.setEnabled(false);part.dispose?.();}throw error;}
}
