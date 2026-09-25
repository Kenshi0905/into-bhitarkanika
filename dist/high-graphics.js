import {buildHighSky,getHighLighting} from './high-sky.js';
import {buildHighForest} from './high-forest.js';
import {createHighFauna} from './high-fauna.js';
import {createHighBoat} from './high-boat.js';
import {createHighAtmosphere} from './high-atmosphere.js';

export async function loadHighGraphics(context){
  const {onProgress=()=>{}}=context,parts=[];
  try{
    onProgress('Loading sky and natural light',.12);
    const sky=await buildHighSky({...context,onProgress:message=>onProgress(message,.2)});parts.push(sky);
    // Yield between geometry stages so loading status and cancel remain responsive.
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const forest=await buildHighForest({...context,onProgress:message=>onProgress(message,.45)});parts.push(forest);
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const fauna=await createHighFauna({...context,onProgress:message=>onProgress(message,.72)});parts.push(fauna);
    const boat=await createHighBoat({...context,onProgress:message=>onProgress(message,.84)});parts.push(boat);
    const atmosphere=createHighAtmosphere(context);parts.push(atmosphere);
    onProgress('Preparing reflections and materials',.94);
    return {
      setEnabled(value){for(const part of parts)part.setEnabled(value);},
      getLighting:getHighLighting,
      setLighting(...args){sky.setLighting(...args);atmosphere.setLighting(...args);},
      beginReflection(){forest.beginReflection?.();fauna.beginReflection?.();boat.beginReflection?.();},
      endReflection(){boat.endReflection?.();fauna.endReflection?.();forest.endReflection?.();},
      update(time,dt,boatPosition,camera){sky.update(time,camera);forest.update(time,boatPosition);fauna.update(time,dt);boat.update?.(time,dt);atmosphere.update(time,camera);},
      getStats(){return {forest:forest.getStats?.(),fauna:fauna.getStats?.(),sky:sky.getStats?.(),boat:boat.getStats?.()};},
      dispose(){for(const part of [...parts].reverse()){part.setEnabled(false);part.dispose?.();}}
    };
  }catch(error){for(const part of parts.reverse()){part.setEnabled(false);part.dispose?.();}throw error;}
}
