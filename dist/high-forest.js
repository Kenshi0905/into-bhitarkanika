import * as T from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { center, width } from './channel.js';

// Loaded only after selecting High. The normal forest and its textures stay
// independent: returning to Standard restores the original scene immediately.
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
function randomSource(seed) {
  return (min = 0, max = 1) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return min + seed / 4294967296 * (max - min);
  };
}

// A connected leaf cluster, not a cloud of individually cut-out tiny leaves.
// The opaque interior makes mip reduction preserve the crown's coverage, while
// thirty medium overlapping forms give the edge a readable, irregular silhouette.
function shootTexture(variant, anisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d'), random = randomSource(8734 + variant * 117);
  const leaf = (x, y, length, breadth, angle, young) => {
    g.save(); g.translate(x, y); g.rotate(angle);
    const shape = new Path2D();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(-breadth * .8, -length * .28, -breadth * .76, -length * .78, 0, -length);
    shape.bezierCurveTo(breadth * .7, -length * .8, breadth * .75, -length * .22, 0, 0);
    const gradient = g.createLinearGradient(-breadth, 0, breadth, -length);
    gradient.addColorStop(0, young ? '#465b3b' : '#3b5034');
    gradient.addColorStop(.47, young ? '#586c46' : variant === 2 ? '#536740' : '#4e623d');
    gradient.addColorStop(.53, young ? '#5c6e47' : '#536740');
    gradient.addColorStop(1, young ? '#4f633f' : '#415736');
    g.fillStyle = gradient; g.fill(shape);
    // Broad restrained fold only; tiny veins and spots were subpixel noise at
    // every gameplay camera and brought no readable botanical detail.
    g.strokeStyle = '#a0ad751c'; g.lineWidth = 1.7;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(2, -length * .55, 0, -length * .95); g.stroke();
    g.restore();
  };
  g.fillStyle = '#435738'; g.beginPath(); g.moveTo(184, 158);
  g.bezierCurveTo(240, 106, 328, 139, 354, 221); g.bezierCurveTo(396, 289, 342, 373, 267, 388);
  g.bezierCurveTo(184, 394, 118, 318, 146, 237); g.bezierCurveTo(140, 197, 158, 174, 184, 158); g.fill();
  const shoots = [[183,245,-.63],[240,191,-.12],[310,233,.58],[204,337,-1.0],[302,335,1.0],[250,286,.18]];
  for (let i = 0; i < shoots.length; i++) {
    const [x,y,angle] = shoots[i];g.save();g.translate(x,y);g.rotate(angle+variant*.055);
    for (const [side,py,tilt] of [[-1,33,.9],[1,33,.9],[-1,-4,.67],[1,-4,.67]]) {
      leaf(side*13,py,random(73,94),random(27,34),side*tilt,false);
    }
    leaf(0,-38,random(72,89),random(27,33),random(-.1,.1),i===1);g.restore();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = T.LinearMipmapLinearFilter; texture.magFilter = T.LinearFilter;
  texture.anisotropy = Math.min(anisotropy,4);
  return texture;
}

function massTexture(anisotropy) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d'), random = randomSource(7623);
  g.fillStyle = '#405237'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 95; i++) {
    const x = random(0, 512), y = random(0, 512), r = random(23, 57);
    g.fillStyle = ['#46593a', '#425638', '#4b5c3d', '#415437', '#4d5e3e'][i % 5];
    g.beginPath(); g.ellipse(x, y, r * .48, r, random(0, 6.28), 0, 6.28); g.fill();
  }
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.anisotropy = anisotropy; return texture;
}

function massGeometry(seed) {
  const random = randomSource(seed), parts = [];
  for (const [x, y, z, sx, sy, sz] of [[-1.3, -.25, -.6, 1.6, 1.1, 1.45], [.9, .6, -.65, 1.55, 1.45, 1.35], [.3, -.2, 1.3, 1.8, 1.05, 1.5]]) {
    // Three lobes share one reused 180-triangle geometry (previously168). The
    // old30% high-frequency displacement folded the coarse rings into rocks.
    // Spend the same scale of geometry on a smoother azimuth silhouette instead.
    const part = new T.SphereGeometry(1, 10, 4), p = part.attributes.position, n=part.attributes.normal, colors = [];
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
      const uneven = 1 + .045 * Math.sin(px * 2.7 + pz * 2.3 + x) + .032 * Math.cos(py * 3.1 - pz * 2.5 + z);
      p.setXYZ(i, x + px * sx * uneven, y + py * sy * uneven, z + pz * sz * uneven);
      // These are distant aggregates of upward-facing leaves, not a solid shell.
      // Analytic wrapped normals stay continuous at poles and the UV seam, and
      // preserve shaded sides without the nearly black downward-facing wedges.
      const nx=px/sx*.68,ny=.45+.70*Math.max(0,py),nz=pz/sz*.68,length=Math.hypot(nx,ny,nz);
      n.setXYZ(i,nx/length,ny/length,nz/length);
      const shade = .80 + .17 * T.MathUtils.smoothstep(py,-.9,1); colors.push(shade, shade, shade);
    }
    part.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    part.rotateY(random(-.3, .3)); parts.push(part);
  }
  return merge(parts);
}

function bankMaterial(anisotropy, resources) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d'), random = randomSource(41377), image = g.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const silt = Math.sin(x * .034 + Math.sin(y * .016) * 2) * 4 + Math.sin(y * .091 + x * .012) * 2 + random(-2, 2), i = (y * 512 + x) * 4;
    image.data[i] = 128 + silt; image.data[i + 1] = 119 + silt; image.data[i + 2] = 100 + silt; image.data[i + 3] = 255;
  }
  g.putImageData(image, 0, 0);
  for (let i = 0; i < 230; i++) {
    const x = random(0, 512), y = random(0, 512); g.fillStyle = i % 3 ? '#463e3224' : '#9e977437';
    g.beginPath(); g.ellipse(x, y, random(.4, 2), random(1.4, 4), random(0, 6.28), 0, 6.28); g.fill();
  }
  const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace; map.wrapS = map.wrapT = T.RepeatWrapping; map.repeat.set(22, 205); map.anisotropy = anisotropy;
  const material = new T.MeshStandardMaterial({ map, bumpMap: map, bumpScale: .018, color: 0xb4ad98, vertexColors: true, roughness: .95, envMapIntensity: .2, side: T.DoubleSide });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 highBankWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nhighBankWorld = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = 'varying vec3 highBankWorld;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float tideBand = .045 * sin(highBankWorld.z * .73) + .025 * sin(highBankWorld.x * .8 + highBankWorld.z * .23);
      float drySilt = smoothstep(-.15, 1.45, highBankWorld.y - tideBand);
      diffuseColor.rgb *= mix(vec3(.66,.71,.66),vec3(1.0),drySilt);
      diffuseColor.rgb *= .95 + .05 * sin(highBankWorld.z * .31 + highBankWorld.x * .77);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(.58,.96,drySilt);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      float bankRelief = .018 * sin(highBankWorld.z * .8 + sin(highBankWorld.x * .5) * 2.0) * sin(highBankWorld.x * 1.4);
      normal = perturbNormalArb(-vViewPosition, normal, vec2(dFdx(bankRelief),dFdy(bankRelief)),faceDirection);`);
  };
  material.customProgramCacheKey = () => 'high-tidal-silt'; resources.add(map); resources.add(material); return material;
}

function taperedBranch(points, startRadius, endRadius, sides = 9) {
  const curve = new T.CatmullRomCurve3(points);
  const segments = Math.max(sides < 6 ? 3 : 5, Math.ceil(curve.getLength() * (sides < 6 ? .8 : 1.4)));
  const geometry = new T.TubeGeometry(curve, segments, startRadius, sides, false);
  const position = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let ring = 0; ring <= segments; ring++) {
    const ratio = ring / segments, axis = curve.getPointAt(ratio);
    const radius = T.MathUtils.lerp(startRadius, endRadius, Math.pow(ratio, .8));
    for (let side = 0; side <= sides; side++) {
      const i = ring * (sides + 1) + side;
      const irregular = 1 + .085 * Math.sin(side * 4.27 + ratio * 9) + .055 * Math.sin(side * 2.9 - ratio * 14);
      const factor = radius / startRadius * irregular;
      position.setXYZ(i, axis.x + (position.getX(i) - axis.x) * factor, axis.y + (position.getY(i) - axis.y) * factor, axis.z + (position.getZ(i) - axis.z) * factor);
      // TubeGeometry uses length along U. Rotating UVs keeps photographed bark
      // furrows running along the branch instead of wrapping around it.
      uv.setXY(i, side / sides * Math.max(.32, startRadius * 3), ratio * curve.getLength() * .38);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

function merge(parts) {
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  geometry.computeBoundingSphere();
  return geometry;
}

function foliageGeometry(crowns, seed, count) {
  const random = randomSource(seed), pos = [], normals = [], uv = [], colors = [], index = [];
  const q = new T.Quaternion(), normal = V(), p = V();
  const supportCards = crowns.length >= 9 ? Math.ceil(crowns.length / 3) * 2 : 0;
  for (let i = 0; i < count; i++) {
    // Reserve two of the existing sprays around each opaque support. Random
    // sampling alone left the supports uncovered in both the near and mid LOD.
    const supported = i < supportCards;
    const crown = crowns[supported ? Math.floor(i / 2) * 3 : (i - supportCards) % crowns.length];
    const yaw = random(0, Math.PI * 2), elevation = random(-.9, 1), r = Math.pow(random(), .5);
    const radius = Math.sqrt(1 - elevation * elevation) * r;
    // Keep compact overlapping sprays at the actual twig ends. Scattering a few
    // huge cards over a broad sphere left the opaque support visible underneath.
    const origin = supported
      ? V(crown.x, crown.y + (i % 2 === 0 ? .2 : -.44), crown.z)
      : V(crown.x + Math.cos(yaw) * radius * .92, crown.y + elevation * .58 * r, crown.z + Math.sin(yaw) * radius * .92);
    q.setFromEuler(new T.Euler(supported ? -Math.PI / 2 + random(-.1, .1) : random(-1.8, 1.8), yaw, supported ? random(-.1, .1) : random(-1.8, 1.8), supported ? 'YXZ' : 'XYZ'));
    const size = random(supported ? 1.72 : 1.45, 2.0), base = pos.length / 3;
    if (supported) origin.add(V(0, 0, -size * .05).applyQuaternion(q));
    const tint = new T.Color().setHSL(random(.23, .27), random(.09, .15), random(.77, .88));
    // The atlas owns leaf colour. Only neutral occlusion is applied here; tinted
    // material × tinted vertices × tinted instances previously crushed albedo.
    // Retain the seeded colour samples so existing cluster placement is stable.
    const shade = (.7 + .26 * T.MathUtils.clamp((origin.y - 2) / 8, 0, 1)) * (.94 + .06 * r) * (.97 + .03 * tint.g);
    // A shallow folded quad avoids an unnaturally flat paper silhouette.
    const vertices = [[-.5, -.5, 0], [.5, -.5, 0], [-.5, .5, .1], [.5, .5, .1]];
    // Average leaf normals over the crown volume; random flat card normals make
    // a whole forest sparkle and change brightness when the camera turns.
    vertices.forEach(([x, y, z], j) => {
      p.set(x * size, y * size, z * size).applyQuaternion(q).add(origin);
      // A crown normal varies smoothly across the patch itself, avoiding a
      // single uniformly shaded paper plane without adding more triangles.
      normal.set((p.x-crown.x)*.14,.84+(p.y-crown.y)*.09,(p.z-crown.z)*.14).normalize();
      pos.push(p.x, p.y, p.z); normals.push(normal.x, normal.y, normal.z);
      uv.push(j % 2, j > 1 ? 1 : 0); colors.push(shade, shade, shade);
    });
    index.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index); geometry.computeBoundingSphere();
  return geometry;
}

function innerCrownGeometry(crowns, variant, distant = false) {
  const parts = [];
  // Eight small overlapping branch masses, rather than one spherical tree dome.
  // They sit inside the textured shoot envelope and block bright sky pinholes.
  for (let i = 0; i < crowns.length; i += 3) {
    const crown = crowns[i], geometry = new T.SphereGeometry(1, 6, 4), position = geometry.attributes.position, normal = geometry.attributes.normal, colors = [];
    for (let j = 0; j < position.count; j++) {
      const x = position.getX(j), y = position.getY(j), z = position.getZ(j);
      const edge = 1 + .11 * Math.sin(x * 7.1 + z * 4.9 + i) + .07 * Math.sin(z * 9.3 - y * 5.8 + variant);
      // The near support is a small shaded interior, precisely aligned with its
      // sprays. Pulling the old center toward the trunk and raising it exposed a
      // separate plain ellipsoid above the branch when seen from overhead.
      const sx=distant?1.58:.23,sy=distant?.94:.13,sz=distant?1.52:.22,inset=distant?.94:1;
      position.setXYZ(j, crown.x * inset + x * sx * edge, crown.y + (distant?-.05:-.12) + y * sy * edge, crown.z * inset + z * sz * edge);
      // This volume represents many small leaves, not a solid downward-facing
      // shell. Wrapped crown normals keep diffuse skylight on its underside;
      // neutral AO and actual canopy shadows retain the shaded interior.
      const nx=x/sx,ny=.3+.65*Math.max(0,y),nz=z/sz,length=Math.hypot(nx,ny,nz)||1;
      normal.setXYZ(j,nx/length,ny/length,nz/length);
      const shade = .58 + .3 * (y + 1) / 2; colors.push(shade, shade, shade);
    }
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); parts.push(geometry);
  }
  return merge(parts);
}

function makeTree(variant) {
  const random = randomSource(1591 + variant * 519), parts = [], midParts = [], roots = [], midRoots = [], crowns = [];
  const lean = variant === 1 ? -.8 : .54, tall = variant === 2 ? 1.18 : 1;
  const mainStem = [V(), V(lean * .18, 1.9, -.12), V(lean * .5, 4.1, .13), V(lean, 6.5 * tall, .2)];
  parts.push(taperedBranch(mainStem, .43, .095, 9)); midParts.push(taperedBranch(mainStem, .43, .095, 5));
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2 + random(-.33, .33), radius = random(1.5, 3.5);
    const start = V(lean * .3, random(2.3, 4.3), 0), fork = V(Math.cos(angle) * radius * .61 + lean, random(4.8, 6.4) * tall, Math.sin(angle) * radius * .54);
    const end = V(Math.cos(angle) * radius + lean, random(6.2, 8.8) * tall, Math.sin(angle) * radius);
    const branchRadius = random(.105, .17);
    parts.push(taperedBranch([start, fork, end], branchRadius, .022, 6));
    midParts.push(taperedBranch([start, fork, end], branchRadius, .022, 4)); crowns.push(end);
    for (const side of [-1, 1]) {
      const tip = end.clone().add(V(Math.cos(angle + side * 1.15) * random(.8, 1.7), random(-.2, .8), Math.sin(angle + side * 1.15) * random(.8, 1.7)));
      parts.push(taperedBranch([fork.clone().lerp(end, .5), end.clone().lerp(tip, .36), tip], .044, .008, 4));
      crowns.push(tip);
    }
  }
  // Rhizophora-style arching prop roots, uneven diameters and secondary forks.
  for (let i = 0; i < 11; i++) {
    const angle = i / 11 * Math.PI * 2 + random(-.19, .19), reach = random(1.9, 4.2), height = random(1.2, 3.2);
    const base = V(Math.cos(angle) * reach, -.42, Math.sin(angle) * reach);
    const arch = V(base.x * .65, .78, base.z * .65);
    const rootPath=[V(lean * .2, height, 0), V(base.x * .23, height * .79, base.z * .23), arch, base],rootRadius=random(.09,.16);
    roots.push(taperedBranch(rootPath, rootRadius, .025, 6));midRoots.push(taperedBranch(rootPath, rootRadius, .025, 4));
    if (i % 2 === 0) roots.push(taperedBranch([arch, V(base.x + Math.cos(angle + 1) * .42, .16, base.z + Math.sin(angle + 1) * .42), base.clone().add(V(Math.cos(angle + 1) * .75, -.12, Math.sin(angle + 1) * .75))], .055, .016, 4));
  }
  return { trunk: merge(parts), midTrunk: merge(midParts), roots: merge(roots), midRoots: merge(midRoots), core: innerCrownGeometry(crowns, variant), farCore: innerCrownGeometry(crowns,variant,true), near: foliageGeometry(crowns, 456 + variant, 108), mid: foliageGeometry(crowns, 456 + variant, 44) };
}

function addWind(material, time, strength = 1) {
  material.onBeforeCompile = shader => {
    shader.uniforms.highForestTime = time;
    shader.vertexShader = 'uniform float highForestTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 forestWorld = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
      float forestFlex = smoothstep(2.0, 10.0, position.y);
      float treePhase = sin(dot(instanceMatrix[3].xz, vec2(1.71,.97))) * 3.14;
      transformed.x += sin(forestWorld.z * .13 + treePhase + highForestTime * (.52 + .08 * sin(treePhase))) * .075 * forestFlex * ${strength.toFixed(2)};
      transformed.z += sin(forestWorld.x * .16 + treePhase + highForestTime * .43) * .045 * forestFlex * ${strength.toFixed(2)};`);
    if (material.isMeshStandardMaterial || material.isMeshLambertMaterial) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', T.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
    }
  };
  material.customProgramCacheKey = () => `high-forest-wind-${strength}`;
}

export async function buildHighForest({ scene, world, renderer, onProgress = () => {} }) {
  const root = new T.Group(); root.name = 'High detail mangrove forest'; root.visible = false;
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8), resources = new Set(), time = { value: 0 };
  const loader = new T.TextureLoader(), base = new URL('./assets/high/forest/', import.meta.url);
  const release = () => { scene.remove(root); root.traverse(object => { if (object.isInstancedMesh) object.dispose(); }); resources.forEach(resource => resource.dispose()); };
  try {
  onProgress('Loading bark and leaf surfaces', .04);
  // Wait for every request before rejecting, so even textures that finish after
  // an earlier failure belong to the same cleanup and cannot leak on retry.
  const barkResults = await Promise.allSettled(['bark-color.jpg', 'bark-normal.jpg', 'bark-roughness.jpg'].map(async (file, i) => {
    const texture = await loader.loadAsync(new URL(file, base).href);
    texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.anisotropy = anisotropy;
    if (i === 0) texture.colorSpace = T.SRGBColorSpace;
    resources.add(texture); return texture;
  }));
  const failure = barkResults.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  const barkMaps = barkResults.map(result => result.value);
  const bark = new T.MeshStandardMaterial({ color: 0xa8ada0, map: barkMaps[0], normalMap: barkMaps[1], roughnessMap: barkMaps[2], normalScale: new T.Vector2(.7, .7), roughness: .94 });
  bark.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 highBarkWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nhighBarkWorld = (modelMatrix * instanceMatrix * vec4(position,1.0)).xyz;');
    shader.fragmentShader = 'varying vec3 highBarkWorld;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float rootDryness = smoothstep(.08,1.35,highBarkWorld.y);
      diffuseColor.rgb *= mix(vec3(.57,.62,.54),vec3(1.0),rootDryness);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(.63,.96,rootDryness);');
  };
  bark.customProgramCacheKey = () => 'high-damp-root-foot';
  resources.add(bark);
  const mud = bankMaterial(anisotropy, resources), backgroundMap = massTexture(anisotropy), backgroundGeometry = massGeometry(1712);
  // Match the nearby diffuse leaves. Multiplying their green albedo by another
  // green material and applying PBR to a solid proxy made the backdrop read as
  // black plastic, even though the individual leaf clusters were correctly lit.
  const backgroundMaterial = new T.MeshLambertMaterial({ map: backgroundMap, color: 0xffffff, vertexColors: true });
  resources.add(backgroundMap); resources.add(backgroundGeometry); resources.add(backgroundMaterial);
  const coreMaterial = new T.MeshLambertMaterial({ map: backgroundMap, color: 0xffffff, vertexColors: true }); resources.add(coreMaterial);
  const variants = [], leafMaterials = [], depthMaterials = [], dummy = new T.Object3D(), color = new T.Color(), sections = [];
  for (let i = 0; i < 3; i++) {
    const map = shootTexture(i, anisotropy);
    // Diffuse canopy shading is deliberate: a PBR specular lobe on the smoothed
    // normals of double-sided leaf cards creates silver Fresnel glints, even at
    // high roughness. These matte leaves retain direct light, shadows, and hue.
    const material = new T.MeshLambertMaterial({ map, color: 0xffffff, vertexColors: true, alphaTest: .28, alphaToCoverage: true, side: T.DoubleSide });
    material.shadowSide = T.DoubleSide;
    const depth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map, alphaTest: .28, side: T.DoubleSide });
    addWind(material, time); addWind(depth, time);
    resources.add(map); resources.add(material); resources.add(depth);
    leafMaterials.push(material); depthMaterials.push(depth);
    const tree = makeTree(i); Object.values(tree).forEach(geometry => resources.add(geometry)); variants.push(tree);
    onProgress('Growing layered mangrove canopies', .16 + i * .10); await pause();
  }
  const rootGeometry = taperedBranch([V(0,-.5,0),V(.04,-.1,.035),V(.025,.3,.045),V(-.02,.5,.03)],.046,.006,4); resources.add(rootGeometry);
  const shrubGeometry = foliageGeometry([V(-1.3, .7, -.3), V(.6, 1.7, .4), V(1.8, .95, -.7)], 743, 42); resources.add(shrubGeometry);
  for (let chunk = -2; chunk < 15; chunk++) {
    const random = randomSource(97023 + (chunk + 2) * 773), group = new T.Group(), leaves = [], detail = [], trunks = [], cores = [], propRoots = [];
    group.userData.centerZ = 169 - chunk * 112;
    // Closely overlapping, irregular small crowns replace the Standard preset's
    // giant distant domes. The bank offsets follow the same existing forest bands.
    const backgroundRandom = randomSource(97244 + (chunk + 2) * 829);
    const backgroundBands = [[38, 9.5, 2.1], [52, 10.5, 2.5], [70, 12, 2.9], [91, 14, 3.3], [116, 15, 3.8]];
    const backgroundCount = backgroundBands.reduce((count, band) => count + Math.ceil(112 / band[1]) * 2, 0);
    const background = new T.InstancedMesh(backgroundGeometry, backgroundMaterial, backgroundCount); let backgroundIndex = 0;
    for (const side of [-1, 1]) for (let band = 0; band < backgroundBands.length; band++) {
      const [offset, spacing, radius] = backgroundBands[band], count = Math.ceil(112 / spacing);
      for (let j = 0; j < count; j++) {
        const z = 225 - (chunk + (j + backgroundRandom(.05, .95)) / count) * 112;
        dummy.position.set(center(z) + side * (width(z) + offset + backgroundRandom(-3, 3)), backgroundRandom(6.5, 10.5) + band * .3, z);
        dummy.rotation.set(backgroundRandom(-.1, .1), backgroundRandom(0, 6.28), backgroundRandom(-.1, .1));
        dummy.scale.set(radius * backgroundRandom(.83, 1.12), backgroundRandom(1.8, 2.7), radius * backgroundRandom(.8, 1.17)); dummy.updateMatrix(); background.setMatrixAt(backgroundIndex, dummy.matrix);
        color.setHSL(backgroundRandom(.235, .27), backgroundRandom(.04, .11), backgroundRandom(.79, .94)); background.setColorAt(backgroundIndex++, color);
      }
    }
    background.name='Distant mangrove crowns';background.computeBoundingSphere(); background.receiveShadow = false; group.add(background);
    for (let variant = 0; variant < 3; variant++) {
      const count = 16, tree = variants[variant];
      const trunk = new T.InstancedMesh(tree.trunk, bark, count), roots = new T.InstancedMesh(tree.roots, bark, count), leaf = new T.InstancedMesh(tree.near, leafMaterials[variant], count), core = new T.InstancedMesh(tree.farCore, coreMaterial, count);
      for (let i = 0; i < count; i++) {
        const side = i % 2 ? 1 : -1, row = Math.floor(i / 2) % 3, along = Math.floor(i / 6);
        const z = 225 - (chunk + (along + variant / 3 + row * .18 + random(-.21, .25)) / 3) * 112;
        const offset = [4, 13.5, 25][row] + random(-2.2, 2.8), height = random(.74, 1.35) * (row === 2 ? 1.12 : 1), radius = random(1.05, 1.6);
        dummy.position.set(center(z) + side * (width(z) + offset), offset < 8 ? .12 : 1.45, z);
        dummy.rotation.set(random(-.035, .035), random(0, Math.PI * 2), random(-.075, .075)); dummy.scale.set(radius, height, radius); dummy.updateMatrix();
        trunk.setMatrixAt(i, dummy.matrix); roots.setMatrixAt(i, dummy.matrix); leaf.setMatrixAt(i, dummy.matrix); core.setMatrixAt(i, dummy.matrix);
        const barkTone=.88+.08*Math.sin(dummy.position.x*.21+dummy.position.z*.17);
        color.setRGB(barkTone,barkTone*.99,barkTone*.94);trunk.setColorAt(i,color);roots.setColorAt(i,color);
        color.setHSL(random(.21, .28), random(.06, .17), random(.8, .99)); color.setScalar(.92+.08*color.g); leaf.setColorAt(i, color);
      }
      for (const mesh of [trunk, roots, leaf, core]) { mesh.castShadow = mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh); }
      // Bounds include the larger distant proxy, even while displaying the small
      // recessed support in the near view.
      core.geometry=tree.core;
      leaf.castShadow = false;
      leaf.customDepthMaterial = depthMaterials[variant]; leaf.userData.variant = trunk.userData.variant = roots.userData.variant = core.userData.variant = variant;
      leaves.push(leaf); detail.push(roots); trunks.push(trunk); cores.push(core);propRoots.push(roots);
    }
    const breaths = new T.InstancedMesh(rootGeometry, bark, 650);
    for (let i = 0; i < 650; i++) {
      const z = 225 - (chunk + random()) * 112, side = i % 2 ? 1 : -1, offset = random(.25, 10), height = random(.12, .61);
      dummy.position.set(center(z) + side * (width(z) + offset), Math.min(1.3, offset * .12) + height * .25 - .2, z);
      dummy.rotation.set(random(-.18, .18), random(0, Math.PI * 2), random(-.18, .18)); dummy.scale.set(random(.75, 1.2), height, random(.75, 1.2)); dummy.updateMatrix(); breaths.setMatrixAt(i, dummy.matrix);
    }
    breaths.receiveShadow = true; breaths.computeBoundingSphere(); group.add(breaths); detail.push(breaths);
    const shrubs = new T.InstancedMesh(shrubGeometry, leafMaterials[2], 72);
    for (let i = 0; i < 72; i++) {
      const side = i % 2 ? 1 : -1, row = Math.floor(i / 2) % 3, along = Math.floor(i / 6);
      const z = 225 - (chunk + (along + row * .27 + random(-.35, .35)) / 12) * 112;
      dummy.position.set(center(z) + side * (width(z) + [8.5, 17, 28][row] + random(-2.4, 2.6)), .9 + row * .2, z);
      dummy.rotation.set(random(-.09, .09), random(0, Math.PI * 2), random(-.1, .1)); dummy.scale.set(random(1.05, 1.6), random(.38, 1.0), random(.8, 1.65)); dummy.updateMatrix(); shrubs.setMatrixAt(i, dummy.matrix);
    }
    shrubs.receiveShadow = true; shrubs.computeBoundingSphere(); group.add(shrubs); detail.push(shrubs);
    sections.push({ group, leaves, detail, trunks, cores, propRoots, breaths, shrubs, background, distance:Infinity, far: false }); root.add(group);
    onProgress('Filling the creek banks', .42 + (chunk + 3) / 17 * .55); await pause();
  }
  let enabled = false, disposed = false, visibleSections = 0, reflectionRestore = null;
  function endReflection(){
    if(!reflectionRestore)return;
    for(const [mesh,geometry,visible] of reflectionRestore){mesh.geometry=geometry;mesh.visible=visible;}
    reflectionRestore=null;
  }
  scene.add(root); onProgress('Mangroves ready', 1);
  return {
    setEnabled(value) { if (disposed) return;endReflection(); enabled = Boolean(value); root.visible = enabled; world.setHighDetail?.(enabled); world.setHighBankMaterial?.(enabled ? mud : null); renderer.shadowMap.needsUpdate = true; },
    update(value, boatPosition) {
      if (!enabled || disposed) return;
      endReflection();
      time.value = value; visibleSections = 0;
      for (const section of sections) {
        const distance = Math.abs(section.group.userData.centerZ - boatPosition.z);
        section.distance=distance;
        section.group.visible = distance < 430;
        if (!section.group.visible) continue;
        visibleSections++;
        const far = distance > (section.far ? 105 : 125);
        if (far !== section.far) {
          section.far = far;
          for (const leaf of section.leaves) leaf.geometry = variants[leaf.userData.variant][far ? 'mid' : 'near'];
          for (const trunk of section.trunks) trunk.geometry = variants[trunk.userData.variant][far ? 'midTrunk' : 'trunk'];
        }
        // Beyond this scale, silhouettes and broad shading carry the tree. Tiny
        // alpha fragments no longer contribute useful screen-space information.
        for (const leaf of section.leaves) leaf.visible = distance < 205;
        for(const core of section.cores)core.geometry=variants[core.userData.variant][distance<205?'core':'farCore'];
        for(const roots of section.propRoots){roots.visible=distance<145;roots.castShadow=distance<100;}
        section.breaths.visible=distance<110;section.shrubs.visible=distance<205;
        for (const mesh of [...section.cores, ...section.trunks]) mesh.castShadow = distance < 125;
      }
    },
    beginReflection(){
      if(!enabled||disposed||reflectionRestore)return;
      reflectionRestore=[];
      const save=mesh=>reflectionRestore.push([mesh,mesh.geometry,mesh.visible]);
      for(const section of sections){
        if(!section.group.visible)continue;
        for(const trunk of section.trunks){save(trunk);trunk.geometry=variants[trunk.userData.variant].midTrunk;}
        for(const leaf of section.leaves){save(leaf);leaf.geometry=variants[leaf.userData.variant].mid;}
        // Preserve coarse prop-root contact at the nearby bank, while omitting
        // tiny breathing roots and low shrubs that cannot survive reflection.
        for(const roots of section.propRoots){save(roots);roots.geometry=variants[roots.userData.variant].midRoots;roots.visible=roots.visible&&section.distance<95;}
        save(section.breaths);section.breaths.visible=false;save(section.shrubs);section.shrubs.visible=false;
      }
    },
    endReflection,
    getStats() { return { enabled, detailedTrees: sections.length * 48, activeSections: visibleSections,reflectionPass:Boolean(reflectionRestore),backgroundTrianglesPerMass:backgroundGeometry.index.count/3,backgroundInstances:sections.reduce((n,s)=>n+(s.group.visible?s.background.count:0),0) }; },
    dispose() { if (disposed) return; this.setEnabled(false); disposed = true; release(); }
  };
  } catch (error) { release(); throw error; }
}
