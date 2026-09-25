import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const threeURL = new URL('./dist/vendor/three.module.js', import.meta.url).href;
const moduleURL = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const resolveThree = source => source.replaceAll("from 'three'", `from '${threeURL}'`);
const utilsURL = moduleURL(resolveThree(await readFile(new URL('./dist/vendor/BufferGeometryUtils.js', import.meta.url), 'utf8')));
const forestSource = resolveThree(await readFile(new URL('./dist/high-forest.js', import.meta.url), 'utf8'))
  .replace("'./vendor/BufferGeometryUtils.js'", `'${utilsURL}'`)
  .replace("'./channel.js'", `'${new URL('./dist/channel.js', import.meta.url).href}'`)
  .replace("new URL('./assets/high/forest/', import.meta.url)", `new URL('${new URL('./dist/assets/high/forest/', import.meta.url).href}')`);
const T = await import(threeURL);
const {createForestLandGeometry, createForestStudyGeometry, buildHighForest} = await import(moduleURL(forestSource));
const {center, width} = await import('./dist/channel.js');

test('continuous inland terrain joins every section and stays outside the established bank', () => {
  let previous = null;
  for (let chunk = -2; chunk < 15; chunk++) {
    const geometry = createForestLandGeometry(chunk), p = geometry.attributes.position, n = geometry.attributes.normal;
    assert.equal(geometry.index.count / 3, 576);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      assert.ok(Number.isFinite(x + y + z));
      assert.ok(Math.abs(x - center(z)) - width(z) > 111.99, 'land must not alter the shoreline or collision channel');
      assert.ok(y > 1.3 && y < 2.05, 'skirt must cover the horizon without becoming a mound');
      assert.ok(n.getY(i) > .99, 'land faces upward on both banks');
    }
    for (let side = 0; side < 2; side++) for (let j = 0; j < 10; j++) {
      const first = side * 170 + j;
      if (previous) for (let axis = 0; axis < 3; axis++) assert.equal(p.array[first * 3 + axis], previous.attributes.position.array[(side * 170 + 160 + j) * 3 + axis]);
    }
    previous?.dispose(); previous = geometry;
  }
  previous.dispose();
});

test('hero tree geometry keeps bounded medium clusters and buried tapered roots', () => {
  const shapes=new Set(),habits=new Set();
  for (let variant = 0; variant < 3; variant++) {
    const tree = createForestStudyGeometry(variant);
    assert.ok(tree.near.index.count / 3 >= 288 && tree.near.index.count / 3 <= 336);
    assert.ok(tree.mid.index.count / 3 >= 128 && tree.mid.index.count / 3 <= 152);
    for (const geometry of Object.values(tree)) {
      for (const attribute of Object.values(geometry.attributes)) for (const value of attribute.array) assert.ok(Number.isFinite(value));
      assert.ok(geometry.boundingSphere.radius < 13);
    }
    tree.roots.computeBoundingBox(); tree.core.computeBoundingBox(); tree.near.computeBoundingBox();
    tree.trunk.computeBoundingBox();habits.add(tree.trunk.userData.growthHabit);shapes.add(tree.trunk.attributes.position.count);
    assert.ok(tree.near.boundingBox.max.y-tree.near.boundingBox.min.y>4.5,'crowns must occupy multiple levels rather than a flat umbrella');
    assert.ok(tree.roots.boundingBox.min.y < -.50, 'root forks must continue below the bank');
    assert.ok(tree.roots.boundingBox.max.y > 1.8,'aerial roots remain visibly connected to the lower trunk');
    assert.ok(tree.core.boundingBox.max.y < tree.near.boundingBox.max.y, 'tiny support stays within textured crown height');
    assert.ok(tree.core.boundingBox.min.y > tree.near.boundingBox.min.y, 'no solid underside exposed');
    Object.values(tree).forEach(geometry => geometry.dispose());
  }
  assert.equal(shapes.size,3,'three genuinely different stem/branch topologies');assert.equal(habits.size,3);
});

function fakeCanvas() {
  const gradient = {addColorStop(){}};
  const context = new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createLinearGradient:()=>gradient}, {get:(object,key)=>key in object?object[key]:()=>{}});
  return {getContext:()=>context};
}

test('representative section, wind, reflection LOD and Standard restoration keep exact resources', async t => {
  const oldDocument = globalThis.document, oldPath = globalThis.Path2D, oldLoad = T.TextureLoader.prototype.loadAsync;
  globalThis.document = {createElement:()=>fakeCanvas()};
  globalThis.Path2D = class {moveTo(){}bezierCurveTo(){}};
  T.TextureLoader.prototype.loadAsync = async () => new T.Texture();
  const scene = new T.Scene(), renderer = {capabilities:{getMaxAnisotropy:()=>8},shadowMap:{needsUpdate:false}};
  let high = false, bank = 'original';
  const world = {setHighDetail:value=>{high=value;},setHighBankMaterial:value=>{bank=value??'original';}};
  let forest;
  try {
    forest = await buildHighForest({scene,world,renderer,reviewSection:2});
    assert.equal(forest.getStats().treatedSections,17,'review retains the existing cohesive forest elsewhere');
    assert.equal(forest.getStats().artDirectedSections,1);
    assert.equal(forest.getStats().supportingTrees,1224);
    forest.setEnabled(true);
    forest.update(4,{z:0},{wind:{x:.6,z:.8,strength:1.4,gust:.7}});
    assert.equal(high,true); assert.notEqual(bank,'original');
    assert.deepEqual(forest.getStats().wind,[.6,.8,1.4,.7]);
    const group = scene.getObjectByName('Mangrove section 2 — cohesive');
    assert.ok(group?.visible);
    assert.ok(group.getObjectByName('Continuous land behind bank'));
    assert.ok(group.getObjectByName('Grounded forest understorey'));
    assert.ok(group.getObjectByName('Partially buried tidal branches'));
    const shoreline=group.getObjectByName('Irregular leafy shoreline patches'),placement=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion();
    let nearPatches=0,raisedPatches=0;
    for(let i=0;i<shoreline.count;i++){
      shoreline.getMatrixAt(i,placement);placement.decompose(position,rotation,scale);
      const offset=Math.abs(position.x-center(position.z))-width(position.z);
      assert.ok(offset>3,'leafy patch centers stay outside the navigation bank');
      const side=position.x>center(position.z)?1:-1,leaf=new T.Vector3();
      for(let vertex=0;vertex<shoreline.geometry.attributes.position.count;vertex++){
        leaf.fromBufferAttribute(shoreline.geometry.attributes.position,vertex).applyMatrix4(placement);
        assert.ok(side*(leaf.x-center(leaf.z))-width(leaf.z)>.349,'the entire rotated foliage envelope stays outside water');
      }
      if(offset<7)nearPatches++;if(position.y+scale.y*2.5>3.5)raisedPatches++;
    }
    assert.ok(nearPatches>=20,'shoreline cover must reach the otherwise bare foreground bank');
    assert.ok(raisedPatches>=20,'patches must rise into the visible midstory instead of lying under terrain');
    const meshes = []; scene.traverse(object=>{if(object.isMesh)meshes.push(object);});
    const snapshot = meshes.map(mesh=>[mesh.geometry,mesh.material,mesh.visible]);
    for (let i=0;i<20;i++) {
      forest.beginReflection();assert.equal(forest.getStats().reflectionPass,true);
      assert.equal(group.getObjectByName('Partially buried tidal branches').visible,false);
      forest.endReflection();
      meshes.forEach((mesh,j)=>assert.deepEqual([mesh.geometry,mesh.material,mesh.visible],snapshot[j]));
    }
    forest.beginReflection();forest.setEnabled(false);
    assert.equal(high,false);assert.equal(bank,'original');assert.equal(forest.getStats().reflectionPass,false);
    assert.equal(scene.children[0].visible,false);
    forest.setEnabled(true);forest.update(20,{z:-300});
    assert.equal(group.getObjectByName('Overlapping supporting crowns').material.isMeshLambertMaterial,true);
    assert.equal(group.getObjectByName('Supporting mangrove stems').visible,true);
    forest.update(21,{z:-480});
    assert.equal(group.getObjectByName('Supporting mangrove stems').visible,true, 'distant stems must not disappear beneath visible crowns');
    forest.dispose();assert.equal(scene.children.length,0);assert.equal(high,false);assert.equal(bank,'original');
    forest = await buildHighForest({scene,world,renderer});
    forest.setEnabled(true); forest.update(15,{z:0});
    assert.equal(forest.getStats().treatedSections,17);
    const budget=()=>{const b={triangles:0,draws:0,shadowTriangles:0,shadowDraws:0};scene.traverseVisible(mesh=>{if(!mesh.isMesh)return;const triangles=mesh.geometry.index.count/3*(mesh.count??1);b.triangles+=triangles;b.draws++;if(mesh.castShadow){b.shadowTriangles+=triangles;b.shadowDraws++;}});return b;};
    const main=budget();forest.beginReflection();const reflection=budget();forest.endReflection();
    assert.ok(reflection.triangles<main.triangles*.78,'reflection must use cheaper geometry than the visible forest');
    assert.ok(reflection.draws<main.draws);
    t.diagnostic(`Visible scene budget before frustum culling, z=0: ${JSON.stringify({main,reflection})}`);
    scene.updateMatrixWorld(true);
    const originals=[];scene.traverse(mesh=>{if(mesh.isInstancedMesh) originals.push({mesh,matrix:mesh.instanceMatrix.array.slice(),color:mesh.instanceColor?.array.slice(),visible:mesh.visible,geometry:mesh.geometry,material:mesh.material});});
    const camera = new T.PerspectiveCamera(55,16/9,.1,750);camera.up.set(0,-1,0);
    for (const [name,position,target] of [['Follow',[0,-8,24],[0,-2,-20]],['Bow',[0,-3,2],[0,-3,-80]],['Overhead',[0,-72,0],[0,0,0]]]) {
      camera.position.fromArray(position);camera.lookAt(...target);camera.updateMatrixWorld(true);
      forest.beginReflection({camera});
      const compact=budget(), instances=forest.getStats().reflectionInstances;
      assert.equal(instances.considered,instances.submitted+instances.culled);
      assert.equal(instances.consideredTriangles,instances.submittedTriangles+instances.savedTriangles);
      assert.ok(instances.culled>0,`${name} should remove invisible instances`);
      assert.ok(compact.triangles<reflection.triangles*.8,`${name} should save actual geometry`);
      const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
      const transform=new T.Matrix4(),worldTransform=new T.Matrix4(),sphere=new T.Sphere();
      for(const {mesh} of originals){
        const clone=mesh.parent.children.find(candidate=>candidate.userData.sourceForestId===mesh.uuid);
        if(!clone?.visible)continue;
        let expected=0;
        for(let i=0;i<mesh.count;i++){
          transform.fromArray(mesh.instanceMatrix.array,i*16);worldTransform.multiplyMatrices(mesh.matrixWorld,transform);
          sphere.copy(mesh.geometry.boundingSphere);sphere.radius+=.65;sphere.applyMatrix4(worldTransform);
          if(frustum.intersectsSphere(sphere))expected++;
        }
        assert.equal(clone.count,expected,'no intersecting crown, stem or root may be omitted');
        for(let i=0;i<clone.count;i++){
          transform.fromArray(clone.instanceMatrix.array,i*16);worldTransform.multiplyMatrices(clone.matrixWorld,transform);
          sphere.copy(clone.geometry.boundingSphere);sphere.radius+=.65;sphere.applyMatrix4(worldTransform);
          assert.ok(frustum.intersectsSphere(sphere),'every retained instance intersects the conservative reflected view');
        }
      }
      t.diagnostic(`${name} reflected budget: ${JSON.stringify({compact,instances})}`);
      forest.endReflection();
      for(const {mesh,matrix,color,visible,geometry,material} of originals){
        assert.deepEqual(mesh.instanceMatrix.array,matrix);if(color)assert.deepEqual(mesh.instanceColor.array,color);
        assert.equal(mesh.visible,visible);assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);
      }
      scene.traverse(mesh=>{if(mesh.userData.reflectionOnly)assert.equal(mesh.visible,false);});
    }
    forest.beginReflection({camera});forest.setEnabled(false);
    scene.traverse(mesh=>{if(mesh.userData.reflectionOnly)assert.equal(mesh.visible,false);});
  } finally {
    forest?.dispose(); globalThis.document=oldDocument;globalThis.Path2D=oldPath;T.TextureLoader.prototype.loadAsync=oldLoad;
  }
});
