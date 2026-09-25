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

function bankMaterial(anisotropy, resources, reviewSection = null) {
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
  material.userData.weatherSurface = 'mud';
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 highBankWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nhighBankWorld = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.uniforms.highBankArtBounds = {value: new T.Vector2(reviewSection === null ? -100000 : 225 - (reviewSection + 1) * 112, reviewSection === null ? 100000 : 225 - reviewSection * 112)};
    shader.fragmentShader = `varying vec3 highBankWorld; uniform vec2 highBankArtBounds;
      float bankHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float bankNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(bankHash(i),bankHash(i+vec2(1.,0.)),f.x),mix(bankHash(i+vec2(0.,1.)),bankHash(i+vec2(1.)),f.x),f.y);}
      ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float bankArt=smoothstep(highBankArtBounds.x,highBankArtBounds.x+3.,highBankWorld.z)*(1.-smoothstep(highBankArtBounds.y-3.,highBankArtBounds.y,highBankWorld.z));
      float shoreOffset=abs(highBankWorld.x-(22.*sin(highBankWorld.z*.008)+11.*sin(highBankWorld.z*.021)))-(29.+5.*sin(highBankWorld.z*.011+1.)+3.*sin(highBankWorld.z*.028));
      float coastMud=1.-smoothstep(9.,21.,shoreOffset);
      float tideBand = .045 * sin(highBankWorld.z * .73) + .025 * sin(highBankWorld.x * .8 + highBankWorld.z * .23)+bankArt*(bankNoise(highBankWorld.xz*.085)*.53-.1);
      float drySilt = smoothstep(-.15, 1.45, highBankWorld.y - tideBand);
      diffuseColor.rgb *= mix(vec3(.66,.71,.66),vec3(1.0),drySilt);
      diffuseColor.rgb *= .95 + .05 * sin(highBankWorld.z * .31 + highBankWorld.x * .77);
      vec2 siltCoord=highBankWorld.xz*.12;
      float meander=bankNoise(siltCoord*.37+4.7);
      float tidalPatch=bankNoise(siltCoord+vec2(meander*2.,meander*.7));
      float wrack=bankNoise(siltCoord*3.1+vec2(8.2,-3.4));
      float dampPocket=smoothstep(.28,.68,tidalPatch)*coastMud*bankArt;
      diffuseColor.rgb*=mix(vec3(1.),vec3(.42,.51,.48),dampPocket);
      diffuseColor.rgb*=1.-bankArt*smoothstep(.59,.86,wrack)*coastMud*.18;
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.86,.98,.77),bankArt*smoothstep(.69,.87,tidalPatch)*smoothstep(.7,1.7,highBankWorld.y)*.28);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(mix(.58,.96,drySilt),.46,dampPocket*.68);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      float bankRelief = .018 * sin(highBankWorld.z * .8 + sin(highBankWorld.x * .5) * 2.0) * sin(highBankWorld.x * 1.4)+bankArt*coastMud*(.075*(tidalPatch-.5)+.035*(wrack-.5));
      normal = perturbNormalArb(-vViewPosition, normal, vec2(dFdx(bankRelief),dFdy(bankRelief)),faceDirection);`);
  };
  material.customProgramCacheKey = () => 'high-patchy-tidal-silt-v2'; resources.add(map); resources.add(material); return material;
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

function foliageGeometry(crowns, seed, count, cohesive = false) {
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
      : V(crown.x + Math.cos(yaw) * radius * (cohesive ? 1.04 : .92), crown.y + elevation * (cohesive ? .72 : .58) * r, crown.z + Math.sin(yaw) * radius * (cohesive ? 1.04 : .92));
    q.setFromEuler(new T.Euler(supported ? -Math.PI / 2 + random(-.1, .1) : random(-1.8, 1.8), yaw, supported ? random(-.1, .1) : random(-1.8, 1.8), supported ? 'YXZ' : 'XYZ'));
    const size = random(cohesive ? (supported ? 2.16 : 1.8) : supported ? 1.72 : 1.45, cohesive ? 2.45 : 2.0), base = pos.length / 3;
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

function makeTree(variant, cohesive = false) {
  const random = randomSource(1591 + variant * 519), parts = [], midParts = [], roots = [], midRoots = [], crowns = [];
  const lean = variant === 1 ? (cohesive ? -1.24 : -.8) : cohesive ? .92 : .54, tall = variant === 2 ? 1.18 : 1;
  const mainStem = [V(), V(lean * .18, 1.9, -.12), V(lean * .5, 4.1, .13), V(lean, 6.5 * tall, .2)];
  parts.push(taperedBranch(mainStem, .43, .095, 9)); midParts.push(taperedBranch(mainStem, .43, .095, 5));
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2 + random(-.33, .33), radius = random(1.5, 3.5);
    const start = V(lean * .3, random(2.3, 4.3), 0), fork = V(Math.cos(angle) * radius * .61 + lean, random(4.8, 6.4) * tall, Math.sin(angle) * radius * .54);
    const crownHeight = random(6.2, 8.8);
    // A branch-supported crown has a coherent envelope. Previously every fork
    // ended at an unrelated height, separating the canopy into tiny islands.
    const end = V(Math.cos(angle) * radius + lean, (cohesive ? 7.0 + (crownHeight - 7.5) * .42 + Math.sin(angle * 1.6 + variant) * .43 : crownHeight) * tall, Math.sin(angle) * radius);
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
  return { trunk: merge(parts), midTrunk: merge(midParts), roots: merge(roots), midRoots: merge(midRoots), core: innerCrownGeometry(crowns, variant), farCore: innerCrownGeometry(crowns,variant,true), near: foliageGeometry(crowns, 456 + variant, cohesive ? 144 : 108, cohesive), mid: foliageGeometry(crowns, 456 + variant, cohesive ? 64 : 44, cohesive) };
}

// Three authored growth habits share the same three instancing/material slots.
// Forks grow from different parts of the stem instead of a radial umbrella hub.
function makeNaturalTree(variant) {
  const random = randomSource(84013 + variant * 919), parts = [], midParts = [], roots = [], midRoots = [], crowns = [];
  const habits = [
    {name:'Leaning river elder',radius:.53,stems:[[[0,-.65,0],[.22,1.2,.12],[.92,2.8,-.1],[1.55,4.3,-.32],[2.45,5.9,-.2],[3.15,7.2,.05]],[[.65,2.3,-.1],[.4,3.9,-.6],[-.65,5.3,-1.1],[-1.2,7.4,-1.8]]], tips:[[-2.8,5.8,1.5],[-1.9,7.1,-3],[.1,8.9,-1.9],[2.1,9.2,-.1],[4.8,8.1,-1.5],[4.9,6.2,1.6],[2.7,5.3,3.2],[-.4,6.2,3],[.4,8.2,2.8]]},
    {name:'Old divided mangrove',radius:.61,stems:[[[0,-.65,0],[-.4,1.3,.3],[-.5,2.5,.6],[-1.2,4.3,.3],[-1.75,6.6,.5]],[[-.35,1.5,.4],[.2,2.7,.25],[1.3,4.3,-.2],[1.1,6.4,-.85],[1.8,8.5,-1.1]],[[.08,-.45,-.22],[.55,1.4,-.35],[.7,2.7,-.5],[.9,4.4,-.8]]],tips:[[-3.2,5.2,-1.1],[-3.5,7.3,.8],[-1.5,8.6,1.9],[-.3,6.2,3.6],[2.5,5.7,2.6],[3.8,7.8,.8],[3.1,9.0,-2],[.7,9.8,-2.7],[-1.7,6.4,-2.8]]},
    {name:'Intertwined upright clump',radius:.35,stems:[[[0,-.65,0],[.15,1.8,-.35],[-.4,3.5,-.1],[-.7,5.5,.4],[-.25,8.4,.6]],[[.62,-.62,.15],[.47,1.5,.58],[.9,3.1,.3],[1.8,5.1,.75],[1.35,7.1,1.15]],[[-.45,-.62,.38],[-.7,1.6,.7],[-1.25,3.5,.3],[-1.9,5.3,-.2]]],tips:[[-2.3,5.4,-1.1],[-2.9,7.3,.7],[-1.7,9.3,1.5],[.3,10.0,-.8],[2.0,8.6,-1.4],[2.9,6.4,1.8],[.7,7.4,3.0]]}
  ];
  const habit = habits[variant % habits.length], stemCurves = habit.stems.map(path=>new T.CatmullRomCurve3(path.map(p=>V(...p))));
  for (let s = 0; s < habit.stems.length; s++) {
    const points = habit.stems[s].map(p=>V(...p)), radius = habit.radius * (s === 0 ? 1 : s === 1 ? .65 : .47);
    parts.push(taperedBranch(points,radius,s===0?.072:.036,9)); midParts.push(taperedBranch(points,radius,s===0?.072:.036,5));
  }
  for (let i = 0; i < habit.tips.length; i++) {
    const end = V(...habit.tips[i]), curve = stemCurves[i % Math.min(2,stemCurves.length)];
    const start = curve.getPointAt(.37 + (i % 4) * .105), outward = end.clone().sub(start);
    const bend = start.clone().addScaledVector(outward,.45).add(V(random(-.38,.38),random(-.32,.17),random(-.34,.34)));
    const shoulder = start.clone().lerp(bend,.25).add(V(0,.18,0));
    const path = [start,shoulder,bend,end], radius = random(.13,.22) * (variant===2?.82:1);
    parts.push(taperedBranch(path,radius,.027,6));midParts.push(taperedBranch(path,radius,.027,4));crowns.push(end);
    const angle = Math.atan2(outward.z,outward.x);
    for(const side of [-1,1]){
      const tip=end.clone().add(V(Math.cos(angle+side*.94)*random(.75,1.38),random(-.42,.71),Math.sin(angle+side*.94)*random(.75,1.38)));
      const fork=end.clone().lerp(tip,.48).add(V(0,.2,0));
      parts.push(taperedBranch([bend.clone().lerp(end,.66),fork,tip],.058,.012,4));crowns.push(tip);
    }
  }
  // Root anchoring angles and attachment heights are intentionally unrelated.
  // S-shaped growth and buried forks replace eleven straight radial spokes.
  const rootAngles = variant===0?[.08,.48,1.17,1.65,2.8,3.18,3.7,4.55,5.15,5.78]:variant===1?[.15,.73,1.02,1.85,2.12,2.75,3.46,3.92,4.3,5.05,5.62,6.03]:[.22,.95,1.78,2.55,3.2,4.18,4.85,5.76];
  for(let i=0;i<rootAngles.length;i++){
    const angle=rootAngles[i]+random(-.12,.12),reach=random(2.0,3.6),curl=random(-.8,.8),height=random(1.35,3.4);
    const start=stemCurves[i%stemCurves.length].getPointAt(T.MathUtils.clamp(height/9,.08,.39));
    const lower=V(Math.cos(angle+.18)*reach*.82,.66+random(-.12,.24),Math.sin(angle+.18)*reach*.82);
    const base=V(Math.cos(angle)*reach,random(-.95,-.56),Math.sin(angle)*reach);
    const elbow=V(Math.cos(angle+curl)*reach*.41,start.y*.72+random(.05,.24),Math.sin(angle+curl)*reach*.41);
    const ankle=lower.clone().lerp(base,.56);ankle.y=.09;
    ankle.add(V(Math.sin(angle)*.12,0,-Math.cos(angle)*.12));
    const path=[start,start.clone().lerp(elbow,.42).add(V(Math.sin(angle)*.2,.1,-Math.cos(angle)*.2)),elbow,lower,ankle,base];
    const radius=random(.105,.2)*(variant===1?1.16:1);
    roots.push(taperedBranch(path,radius,.027,6));midRoots.push(taperedBranch(path,radius,.027,4));
    if(i%2===0){
      const toe=base.clone().add(V(Math.cos(angle+.9)*random(.35,.75),random(-.2,.12),Math.sin(angle+.9)*random(.35,.75)));
      const fork=[elbow.clone().lerp(lower,.6),lower.clone().lerp(toe,.47).add(V(.12,.16,-.1)),toe];
      roots.push(taperedBranch(fork,radius*.56,.014,5));
      if(i%4===0)midRoots.push(taperedBranch(fork,radius*.56,.014,3));
    }
    if(i%3===0){
      // Low knees emerge briefly from buried horizontal roots.
      const foot=base.clone().multiply(V(.74,1,.74));foot.y=-.54;
      roots.push(taperedBranch([foot,foot.clone().add(V(.12,.76,.16)),foot.clone().add(V(.42,.67,.38)),foot.clone().add(V(.61,-.06,.52))],.064,.025,5));
    }
  }
  const tree={trunk:merge(parts),midTrunk:merge(midParts),roots:merge(roots),midRoots:merge(midRoots),core:innerCrownGeometry(crowns,variant),farCore:innerCrownGeometry(crowns,variant,true),near:foliageGeometry(crowns,9156+variant,variant===2?144:168,true),mid:foliageGeometry(crowns,9156+variant,variant===2?64:76,true)};
  tree.trunk.userData.growthHabit=habit.name;
  return tree;
}

// The original bank ends 135 m beyond the channel. From a low camera its outer
// edge, plus unsupported high background crowns, exposed pale sky under trees.
// This skirt overlaps the back 23 m of that bank from below and continues the
// actual land. It never enters the navigable channel or replaces collision data.
export function createForestLandGeometry(chunk) {
  const offsets = [112, 128, 135, 151, 180, 221, 280, 360, 460, 590];
  const positions = [], uvs = [], colors = [], indices = [], rows = 16;
  for (const side of [-1, 1]) {
    const first = positions.length / 3;
    for (let i = 0; i <= rows; i++) {
      const z = 225 - (chunk + i / rows) * 112;
      for (let j = 0; j < offsets.length; j++) {
        const offset = offsets[j], x = center(z) + side * (width(z) + offset);
        const inland = T.MathUtils.smoothstep(offset, 128, 180);
        const y = 1.47 + inland * .37 + Math.sin(z * .035 + offset * .019) * .12 * inland;
        positions.push(x, y, z); uvs.push(offset / 135, (464 - z) / 2048.8);
        const shade = .47 + .07 * Math.sin(z * .03 + offset * .017);
        colors.push(shade * .92, shade, shade * .87);
      }
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < offsets.length - 1; j++) {
      const a = first + i * offsets.length + j, b = a + offsets.length;
      if (side > 0) indices.push(a, a + 1, b, b, a + 1, b + 1);
      else indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

function supportingTreeGeometry(natural = false) {
  const parts = [], crowns = [], stem = natural?[V(0,-.4,0),V(-.15,1.25,.25),V(.48,2.8,.18),V(.83,4.4,-.22),V(.42,5.2,-.36)]:[V(0, -.3, 0), V(.1, 1.4, .1), V(.38, 3.3, -.1), V(.58, 4.9, -.25)];
  parts.push(taperedBranch(stem, .24, .035, 5));
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4, end = natural?V(...[[-1.8,3.7,.6],[-1.15,5.5,1.9],[1.2,5.8,.4],[2.5,4.4,-.4],[.4,3.7,-1.8]][i]):V(Math.cos(a) * (1.55 + (i % 2) * .5) + .4, 4.2 + Math.sin(a) * .52, Math.sin(a) * 1.9);
    const fork = V(end.x * .53, (natural?end.y*.69:3.2) + Math.sin(a) * .2, end.z * .53);
    parts.push(taperedBranch([stem[natural?1+i%2:1], fork, end], .072, .018, 4)); crowns.push(end);
    crowns.push(end.clone().add(V(Math.cos(a + .8) * .65, .27, Math.sin(a + .8) * .65)));
  }
  return { trunk: merge(parts), midTrunk: taperedBranch(stem, .24, .035, 4), near: foliageGeometry(crowns, 8201, 72, true), mid: foliageGeometry(crowns, 8201, 36, true), far: innerCrownGeometry(crowns, 1, true) };
}

function groundCoverGeometry() {
  const crowns = [V(-1.4, .55, -.2), V(.25, 1.1, .1), V(1.3, .6, -.4), V(-.3, .45, 1.15)];
  return { near: foliageGeometry(crowns, 9702, 48, true), mid: foliageGeometry(crowns, 9702, 24, true) };
}

function organicDebrisGeometry() {
  const parts = [];
  parts.push(taperedBranch([V(-1.4, 0, -.15), V(-.3, .06, -.08), V(.7, .02, .1), V(1.55, -.04, .28)], .105, .035, 5));
  parts.push(taperedBranch([V(-.3, .06, -.08), V(.06, .08, -.53), V(.35, .02, -.9)], .05, .014, 4));
  return merge(parts);
}

export function createForestStudyGeometry(variant = 0) { return makeNaturalTree(variant); }

function addWind(material, time, wind, strength = 1) {
  material.onBeforeCompile = shader => {
    shader.uniforms.highForestTime = time;
    shader.uniforms.highForestWind = wind;
    shader.vertexShader = 'uniform float highForestTime; uniform vec4 highForestWind;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 forestWorld = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
      float forestFlex = .12 + .88 * smoothstep(1.6, 10.0, position.y);
      float treePhase = sin(dot(instanceMatrix[3].xz, vec2(1.71,.97))) * 3.14;
      float localGust = .68 + .22 * sin(forestWorld.x * .04 + forestWorld.z * .065 - highForestTime * .39 + treePhase);
      float windBend = highForestWind.z * (.055 + .055 * highForestWind.w) * localGust;
      float branchWave = sin(forestWorld.z * .13 + treePhase + highForestTime * (.52 + .08 * sin(treePhase))) * (.045 + highForestWind.z * .075);
      vec2 canopyMotion = highForestWind.xy * (windBend + branchWave) + vec2(-highForestWind.y,highForestWind.x) * sin(forestWorld.x * .16 + treePhase + highForestTime * .43) * .028;
      transformed.xz += canopyMotion * forestFlex * ${strength.toFixed(2)};`);
    if (material.isMeshStandardMaterial || material.isMeshLambertMaterial) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', T.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
    }
    if (material.isMeshLambertMaterial) {
      // Transmission is driven by the real incident light after its shadow test;
      // it vanishes when occluded and never adds a screen-space or emissive rim.
      const diffuse='reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_lambert_pars_fragment>',T.ShaderChunk.lights_lambert_pars_fragment.replace(diffuse,`${diffuse}
        float leafBackscatter=pow(saturate(dot(geometryViewDir,-directLight.direction)),3.0);
        float leafThickness=.36+.64*saturate(-dot(geometryNormal,directLight.direction));
        reflectedLight.directDiffuse+=material.diffuseColor*directLight.color*leafBackscatter*leafThickness*.17;`));
    }
  };
  material.customProgramCacheKey = () => `high-forest-wind-and-leaf-transmission-v3-${strength}`;
}

export async function buildHighForest({ scene, world, renderer, onProgress = () => {}, reviewSection = null }) {
  const root = new T.Group(); root.name = 'High detail mangrove forest'; root.visible = false;
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8), resources = new Set(), time = { value: 0 }, wind = { value: new T.Vector4(.87, .49, .35, 0) };
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
  bark.userData.weatherSurface = 'bark';
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
  const mud = bankMaterial(anisotropy, resources, reviewSection), backgroundMap = massTexture(anisotropy), backgroundGeometry = massGeometry(1712);
  // Match the nearby diffuse leaves. Multiplying their green albedo by another
  // green material and applying PBR to a solid proxy made the backdrop read as
  // black plastic, even though the individual leaf clusters were correctly lit.
  const backgroundMaterial = new T.MeshLambertMaterial({ map: backgroundMap, color: 0xffffff, vertexColors: true });
  resources.add(backgroundMap); resources.add(backgroundGeometry); resources.add(backgroundMaterial);
  const coreMaterial = new T.MeshLambertMaterial({ map: backgroundMap, color: 0xffffff, vertexColors: true }); resources.add(coreMaterial);
  const variants = [], originalVariants = [], leafMaterials = [], depthMaterials = [], dummy = new T.Object3D(), color = new T.Color(), sections = [];
  for (let i = 0; i < 3; i++) {
    const map = shootTexture(i, anisotropy);
    // Diffuse canopy shading is deliberate: a PBR specular lobe on the smoothed
    // normals of double-sided leaf cards creates silver Fresnel glints, even at
    // high roughness. These matte leaves retain direct light, shadows, and hue.
    const material = new T.MeshLambertMaterial({ map, color: 0xffffff, vertexColors: true, alphaTest: .28, alphaToCoverage: true, side: T.DoubleSide });
    material.userData.weatherSurface = 'leaf';
    material.shadowSide = T.DoubleSide;
    const depth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map, alphaTest: .28, side: T.DoubleSide });
    addWind(material, time, wind); addWind(depth, time, wind);
    resources.add(map); resources.add(material); resources.add(depth);
    leafMaterials.push(material); depthMaterials.push(depth);
    const tree = makeNaturalTree(i); Object.values(tree).forEach(geometry => resources.add(geometry)); variants.push(tree);
    if (reviewSection !== null) { const original = makeTree(i, true); Object.values(original).forEach(geometry => resources.add(geometry)); originalVariants.push(original); }
    onProgress('Growing layered mangrove canopies', .16 + i * .10); await pause();
  }
  const rootGeometry = taperedBranch([V(0,-.5,0),V(.04,-.1,.035),V(.025,.3,.045),V(-.02,.5,.03)],.046,.006,4); resources.add(rootGeometry);
  const shrubGeometry = foliageGeometry([V(-1.3, .7, -.3), V(.6, 1.7, .4), V(1.8, .95, -.7)], 743, 42); resources.add(shrubGeometry);
  const shrubMidGeometry = foliageGeometry([V(-1.3, .7, -.3), V(.6, 1.7, .4), V(1.8, .95, -.7)], 743, 24); resources.add(shrubMidGeometry);
  const supportGeometry = supportingTreeGeometry(true), previousSupportGeometry = reviewSection === null ? supportGeometry : supportingTreeGeometry(), groundCover = groundCoverGeometry(), debrisGeometry = organicDebrisGeometry();
  [...Object.values(supportGeometry), ...Object.values(previousSupportGeometry), ...Object.values(groundCover), debrisGeometry].forEach(geometry => resources.add(geometry));
  for (let chunk = -2; chunk < 15; chunk++) {
    const random = randomSource(97023 + (chunk + 2) * 773), group = new T.Group(), leaves = [], detail = [], trunks = [], cores = [], propRoots = [];
    const treated = true, artDirected = reviewSection === null || chunk === reviewSection, models = artDirected ? variants : originalVariants, supportModels = artDirected ? supportGeometry : previousSupportGeometry;
    group.name = `Mangrove section ${chunk} — cohesive`;
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
        const x = center(z) + side * (width(z) + offset + backgroundRandom(-3, 3)), canopyHeight = backgroundRandom(6.5, 10.5) + band * .3;
        dummy.position.set(x, treated ? 5.2 + (canopyHeight - 6.5) * .82 : canopyHeight, z);
        dummy.rotation.set(backgroundRandom(-.1, .1), backgroundRandom(0, 6.28), backgroundRandom(-.1, .1));
        dummy.scale.set(radius * backgroundRandom(.83, 1.12), backgroundRandom(1.8, 2.7), radius * backgroundRandom(.8, 1.17)); dummy.updateMatrix(); background.setMatrixAt(backgroundIndex, dummy.matrix);
        color.setHSL(backgroundRandom(.235, .27), backgroundRandom(.04, .11), backgroundRandom(.79, .94)); background.setColorAt(backgroundIndex++, color);
      }
    }
    background.name='Distant mangrove crowns';background.computeBoundingSphere(); background.receiveShadow = false; group.add(background);
    for (let variant = 0; variant < 3; variant++) {
      const count = 16, tree = models[variant];
      const trunk = new T.InstancedMesh(tree.trunk, bark, count), roots = new T.InstancedMesh(tree.roots, bark, count), leaf = new T.InstancedMesh(tree.near, leafMaterials[variant], count), core = new T.InstancedMesh(tree.farCore, coreMaterial, count);
      trunk.name = artDirected ? tree.trunk.userData.growthHabit : 'Previous mangrove trunk';
      roots.name = artDirected ? `Curved roots — ${tree.trunk.userData.growthHabit}` : 'Previous mangrove roots';
      for (let i = 0; i < count; i++) {
        const side = i % 2 ? 1 : -1, row = Math.floor(i / 2) % 3, along = Math.floor(i / 6);
        let z = 225 - (chunk + (along + variant / 3 + row * .18 + random(-.21, .25)) / 3) * 112;
        let offset = [4, 13.5, 25][row] + random(-2.2, 2.8);
        const height = random(.74, 1.35) * (row === 2 ? 1.12 : 1), radius = random(1.05, 1.6);
        if (artDirected) { z += Math.sin(z*.127+variant*2.1+side)*3.4; offset = Math.max(row===0?4.3:8.5,offset+Math.sin(z*.077+variant)*2.5); }
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
      let z = 225 - (chunk + random()) * 112; const side = i % 2 ? 1 : -1;
      let offset = random(.25, 10); const height = random(.12, .61);
      if(artDirected){const patch=Math.floor(i/50),phase=patch*2.17+chunk*1.31;z=225-(chunk+(patch+.4)/13)*112+Math.sin(phase)*2.1+Math.sin(i*3.1)*(1.4+2.4*Math.abs(Math.sin(phase)));offset=1.2+(patch%4)*1.45+Math.sin(i*.73+chunk)*1.05;}
      const ground=Math.min(2.25,offset*.16)-.25+Math.sin(z*.13+offset*.15)*.23;
      dummy.position.set(center(z) + side * (width(z) + offset), artDirected?ground+.06:Math.min(1.3, offset * .12) + height * .25 - .2, z);
      dummy.rotation.set(random(-.18, .18), random(0, Math.PI * 2), random(-.18, .18)); dummy.scale.set(random(.75, 1.2), height, random(.75, 1.2)); dummy.updateMatrix(); breaths.setMatrixAt(i, dummy.matrix);
    }
    breaths.receiveShadow = true; breaths.computeBoundingSphere(); group.add(breaths); detail.push(breaths);
    const shrubs = new T.InstancedMesh(shrubGeometry, leafMaterials[2], 72);
    for (let i = 0; i < 72; i++) {
      let side = i % 2 ? 1 : -1; const row = Math.floor(i / 2) % 3, along = Math.floor(i / 6);
      let z = 225 - (chunk + (along + row * .27 + random(-.35, .35)) / 12) * 112;
      let d = [8.5, 17, 28][row] + random(-2.4, 2.6);
      if(artDirected){
        const patch=Math.floor(i/6),member=i%6,phase=patch*1.83+chunk*2.1;side=patch%2?1:-1;
        z=225-(chunk+(Math.floor(patch/2)+.47+Math.sin(phase)*.16)/6)*112+(member%2?1:-1)*(1.4+(member%3)*1.4)+Math.sin(member*2.3+phase)*1.1;
        d=4.4+Math.floor(member/2)*2.9+Math.sin(phase+member*.72)*1.25;
      }
      const shrubGround=Math.min(2.25,d*.16)-.25+Math.sin(z*.13+d*.15)*.23;
      dummy.position.set(center(z) + side * (width(z) + d), artDirected?shrubGround+.08:.9 + row * .2, z);
      dummy.rotation.set(random(-.09, .09), random(0, Math.PI * 2), random(-.1, .1)); dummy.scale.set(random(1.05, 1.6), random(.38, 1.0), random(.8, 1.65)); dummy.updateMatrix(); shrubs.setMatrixAt(i, dummy.matrix);
      if(artDirected){
        const tall=1.0+.36*Math.sin(i*1.7+chunk);dummy.scale.y=tall;dummy.scale.x*=1.16;dummy.scale.z*=1.12;dummy.updateMatrix();
        // Check the actual rotated leaf envelope, not only the plant's origin,
        // so lush foreground patches remain entirely on the land side.
        const p=V(),positions=shrubGeometry.attributes.position;let clearance=Infinity;
        for(let vertex=0;vertex<positions.count;vertex++){p.fromBufferAttribute(positions,vertex).applyMatrix4(dummy.matrix);clearance=Math.min(clearance,side*(p.x-center(p.z))-width(p.z));}
        if(clearance<.35){d+=.35-clearance;dummy.position.x=center(z)+side*(width(z)+d);dummy.position.y=Math.min(2.25,d*.16)-.25+Math.sin(z*.13+d*.15)*.23+.08;dummy.updateMatrix();}
        shrubs.setMatrixAt(i,dummy.matrix);
      }
    }
    shrubs.name='Irregular leafy shoreline patches';
    shrubs.receiveShadow = true; shrubs.computeBoundingSphere(); group.add(shrubs); detail.push(shrubs);
    let supportTrunks = null, supportLeaves = null, lowerCanopy = null, debris = null, land = null;
    if (treated) {
      // Supporting saplings bridge crowns without multiplying hero-tree roots
      // and fine branches. They are deliberately interleaved with existing trees
      // rather than moving the established bank or the original tree positions.
      const filling = randomSource(29874 + (chunk + 2) * 991), supportCount = 72;
      supportTrunks = new T.InstancedMesh(supportModels.trunk, bark, supportCount);
      supportLeaves = new T.InstancedMesh(supportModels.near, leafMaterials[1], supportCount);
      for (let i = 0; i < supportCount; i++) {
        const side = i % 2 ? 1 : -1, row = Math.floor(i / 2) % 3, along = Math.floor(i / 6);
        let z = 225 - (chunk + (along + .42 + row * .22 + filling(-.16, .16)) / 12) * 112;
        let offset = [11.7, 23.4, 36][row] + filling(-2.0, 2.0);
        if(artDirected){z+=Math.sin(along*1.97+row+side)*2.8;offset+=Math.sin(z*.065+row*.9)*2.6;if(row===0)offset-=2.4;}
        const ground = Math.min(2.25, offset * .16) - .25 + Math.sin(z * .13 + offset * .15) * .23;
        dummy.position.set(center(z) + side * (width(z) + offset), ground - .14, z);
        dummy.rotation.set(filling(-.06, .06), filling(0, 6.28), filling(-.12, .12));
        dummy.scale.set(filling(1.0, 1.52), filling(.87, 1.28), filling(1.06, 1.53)); dummy.updateMatrix();
        supportTrunks.setMatrixAt(i, dummy.matrix); supportLeaves.setMatrixAt(i, dummy.matrix);
        const tone = filling(.88, 1.0); color.setScalar(tone); supportLeaves.setColorAt(i, color);
      }
      supportTrunks.name = 'Supporting mangrove stems'; supportLeaves.name = 'Overlapping supporting crowns';
      supportLeaves.customDepthMaterial = depthMaterials[1];
      for (const mesh of [supportTrunks, supportLeaves]) { mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh); }
      // Low foliage occupies the actual ground below the old floating backdrop.
      // The inexpensive opaque substitute is used only beyond leaf-card range.
      const lowBands = [[39, 10.4], [55, 11.8], [76, 13.1], [99, 14.4], [127, 15.2]];
      const lowCount = lowBands.reduce((n, band) => n + Math.ceil(112 / band[1]) * 2, 0);
      lowerCanopy = new T.InstancedMesh(groundCover.near, leafMaterials[2], lowCount); let lowIndex = 0;
      for (const side of [-1, 1]) for (const [offset, spacing] of lowBands) {
        const count = Math.ceil(112 / spacing);
        for (let i = 0; i < count; i++) {
          const z = 225 - (chunk + (i + filling(.12, .88)) / count) * 112, d = offset + filling(-2.3, 2.3);
          dummy.position.set(center(z) + side * (width(z) + d), 2.04, z);
          dummy.rotation.set(0, filling(0, 6.28), filling(-.035, .035));
          dummy.scale.set(filling(1.45, 2.15), filling(1.42, 2.10), filling(1.8, 2.5)); dummy.updateMatrix();
          lowerCanopy.setMatrixAt(lowIndex, dummy.matrix); color.setScalar(filling(.8, .94)); lowerCanopy.setColorAt(lowIndex++, color);
        }
      }
      lowerCanopy.name = 'Grounded forest understorey'; lowerCanopy.receiveShadow = true; lowerCanopy.computeBoundingSphere(); group.add(lowerCanopy);
      debris = new T.InstancedMesh(debrisGeometry, bark, 28);
      for (let i = 0; i < debris.count; i++) {
        let z = 225 - (chunk + filling(.03, .97)) * 112;const side = i % 2 ? 1 : -1;let d = filling(2.7, 10.5);
        if(artDirected){const patch=Math.floor(i/4);z=225-(chunk+(patch+.45)/7)*112+Math.sin(patch*2.7+chunk)*3.4+Math.sin(i*4.3)*2.8;d=3.4+(patch%3)*1.7+Math.sin(i*.81+chunk*1.6)*1.2;}
        const ground = Math.min(2.25, d * .16) - .25 + Math.sin(z * .13 + d * .15) * .23;
        dummy.position.set(center(z) + side * (width(z) + d), ground - .055, z);
        dummy.rotation.set(filling(-.065, .065), filling(0, 6.28), filling(-.09, .09)); dummy.scale.setScalar(filling(.55, 1.16)); dummy.updateMatrix(); debris.setMatrixAt(i, dummy.matrix);
      }
      debris.name = 'Partially buried tidal branches'; debris.receiveShadow = true; debris.computeBoundingSphere(); group.add(debris);
      const landGeometry = createForestLandGeometry(chunk); resources.add(landGeometry);
      land = new T.Mesh(landGeometry, mud); land.name = 'Continuous land behind bank'; land.receiveShadow = true; group.add(land);
    }
    sections.push({ group, leaves, detail, trunks, cores, propRoots, breaths, shrubs, background, models, supportModels, treated, artDirected, supportTrunks, supportLeaves, lowerCanopy, debris, land, distance:Infinity, far: false }); root.add(group);
    onProgress('Filling the creek banks', .42 + (chunk + 3) / 17 * .55); await pause();
  }
  let enabled = false, disposed = false, visibleSections = 0, reflectionRestore = null;
  const reflectedMeshes = new Map(), reflectedFrustum = new T.Frustum(), viewProjection = new T.Matrix4(), instanceTransform = new T.Matrix4(), worldTransform = new T.Matrix4(), instanceSphere = new T.Sphere();
  let reflectionInstances = { considered: 0, submitted: 0, culled: 0, consideredTriangles: 0, submittedTriangles: 0, savedTriangles: 0 };
  // A section spans both banks and 112 m along the river. Its single aggregate
  // bound used to submit every instance whenever one corner entered the mirror.
  // Separate reflection meshes keep compaction out of the original GPU buffers,
  // preserving all main/shadow instance order, colours, bounds and visibility.
  function compactReflection(mesh) {
    if (!mesh.visible || !mesh.isInstancedMesh) return;
    let reflected = reflectedMeshes.get(mesh);
    if (!reflected) {
      reflected = new T.InstancedMesh(mesh.geometry, mesh.material, mesh.instanceMatrix.count);
      reflected.name = `${mesh.name || 'Mangrove'} reflection instances`;
      reflected.userData.reflectionOnly = true;
      reflected.userData.sourceForestId = mesh.uuid;
      reflected.instanceMatrix.setUsage(T.DynamicDrawUsage);
      if (mesh.instanceColor) reflected.instanceColor = new T.InstancedBufferAttribute(new Float32Array(mesh.instanceColor.array.length), mesh.instanceColor.itemSize).setUsage(T.DynamicDrawUsage);
      reflected.matrixAutoUpdate = false; reflected.frustumCulled = false;
      reflected.castShadow = false; reflectedMeshes.set(mesh, reflected); mesh.parent.add(reflected);
    }
    reflected.geometry = mesh.geometry; reflected.material = mesh.material; reflected.receiveShadow = mesh.receiveShadow;
    reflected.matrix.copy(mesh.matrix); reflected.matrixWorld.copy(mesh.matrixWorld);
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const localSphere = mesh.geometry.boundingSphere, sourceMatrix = mesh.instanceMatrix.array, targetMatrix = reflected.instanceMatrix.array;
    const sourceColor = mesh.instanceColor?.array, targetColor = reflected.instanceColor?.array;
    let count = 0;
    for (let i = 0; i < mesh.count; i++) {
      instanceTransform.fromArray(sourceMatrix, i * 16); worldTransform.multiplyMatrices(mesh.matrixWorld, instanceTransform);
      instanceSphere.copy(localSphere); instanceSphere.radius += .65; instanceSphere.applyMatrix4(worldTransform);
      reflectionInstances.considered++;
      if (!reflectedFrustum.intersectsSphere(instanceSphere)) continue;
      // Avoid thousands of transient typed-array views each animation frame.
      for (let j = 0; j < 16; j++) targetMatrix[count * 16 + j] = sourceMatrix[i * 16 + j];
      if (sourceColor && targetColor) for (let j = 0; j < 3; j++) targetColor[count * 3 + j] = sourceColor[i * 3 + j];
      count++;
    }
    reflectionInstances.submitted += count; reflectionInstances.culled += mesh.count - count;
    const triangles = (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
    reflectionInstances.consideredTriangles += triangles * mesh.count;
    reflectionInstances.submittedTriangles += triangles * count;
    reflectionInstances.savedTriangles += triangles * (mesh.count - count);
    reflected.count = count; reflected.visible = count > 0;
    if (count) { reflected.instanceMatrix.needsUpdate = true; if (reflected.instanceColor) reflected.instanceColor.needsUpdate = true; }
    mesh.visible = false;
  }
  function endReflection(){
    if(!reflectionRestore)return;
    for (const reflected of reflectedMeshes.values()) reflected.visible = false;
    for(const [mesh,geometry,material,visible] of reflectionRestore){mesh.geometry=geometry;mesh.material=material;mesh.visible=visible;}
    reflectionRestore=null;
  }
  scene.add(root); onProgress('Mangroves ready', 1);
  return {
    setEnabled(value) { if (disposed) return;endReflection(); enabled = Boolean(value); root.visible = enabled; world.setHighDetail?.(enabled); world.setHighBankMaterial?.(enabled ? mud : null); renderer.shadowMap.needsUpdate = true; },
    update(value, boatPosition, climate) {
      if (!enabled || disposed) return;
      endReflection();
      time.value = value; visibleSections = 0;
      if (climate?.wind) {
        const shared = climate.wind, length = Math.hypot(shared.x, shared.z) || 1;
        wind.value.set(shared.x / length, shared.z / length, T.MathUtils.clamp(shared.strength ?? .35, 0, 3), T.MathUtils.clamp(shared.gust ?? 0, 0, 1));
      }
      for (const section of sections) {
        const distance = Math.abs(section.group.userData.centerZ - boatPosition.z);
        section.distance=distance;
        section.group.visible = distance < 430;
        if (!section.group.visible) continue;
        visibleSections++;
        const far = distance > (section.far ? 105 : 125);
        if (far !== section.far) {
          section.far = far;
          for (const leaf of section.leaves) leaf.geometry = section.models[leaf.userData.variant][far ? 'mid' : 'near'];
          for (const trunk of section.trunks) trunk.geometry = section.models[trunk.userData.variant][far ? 'midTrunk' : 'trunk'];
        }
        // Beyond this scale, silhouettes and broad shading carry the tree. Tiny
        // alpha fragments no longer contribute useful screen-space information.
        for (const leaf of section.leaves) { leaf.visible = distance < 205; leaf.castShadow = section.treated && distance < 96; }
        for(const core of section.cores)core.geometry=section.models[core.userData.variant][distance<205?'core':'farCore'];
        for(const roots of section.propRoots){roots.visible=distance<145;roots.castShadow=distance<100;}
        section.breaths.visible=distance<110;section.shrubs.visible=distance<205;
        for (const trunk of section.trunks) trunk.castShadow = distance < 125;
        // Actual alpha-tested foliage casts the approved canopy silhouette.
        // Tiny enclosed support cores contribute no visible shadow information.
        for (const core of section.cores) core.castShadow = !section.treated && distance < 125;
        if (section.treated) {
          // Keep a ground-connected stem even for the distant silhouette. Hiding
          // the stem while retaining a crown recreates the original floating gap.
          section.supportTrunks.geometry = section.supportModels[far ? 'midTrunk' : 'trunk']; section.supportTrunks.castShadow = distance < 88;
          section.supportLeaves.geometry = section.supportModels[distance > 215 ? 'far' : far ? 'mid' : 'near'];
          section.supportLeaves.material = distance > 215 ? coreMaterial : leafMaterials[1];
          section.supportLeaves.castShadow = distance < 88;
          section.lowerCanopy.geometry = distance > 230 ? backgroundGeometry : groundCover[far ? 'mid' : 'near'];
          section.lowerCanopy.material = distance > 230 ? backgroundMaterial : leafMaterials[2];
          section.debris.visible = distance < 120;
        }
      }
    },
    beginReflection(context){
      if(!enabled||disposed||reflectionRestore)return;
      reflectionRestore=[];
      reflectionInstances = { considered: 0, submitted: 0, culled: 0, consideredTriangles: 0, submittedTriangles: 0, savedTriangles: 0 };
      const saved = new Set(), save=mesh=>{if(saved.has(mesh))return;saved.add(mesh);reflectionRestore.push([mesh,mesh.geometry,mesh.material,mesh.visible]);};
      const camera = context?.camera;
      if (camera) reflectedFrustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      for(const section of sections){
        if(!section.group.visible)continue;
        for(const trunk of section.trunks){save(trunk);trunk.geometry=section.models[trunk.userData.variant].midTrunk;}
        for(const leaf of section.leaves){save(leaf);leaf.geometry=section.models[leaf.userData.variant].mid;}
        // Preserve coarse prop-root contact at the nearby bank, while omitting
        // tiny breathing roots and low shrubs that cannot survive reflection.
        for(const roots of section.propRoots){save(roots);roots.geometry=section.models[roots.userData.variant].midRoots;roots.visible=roots.visible&&section.distance<95;}
        save(section.breaths);section.breaths.visible=false;
        save(section.shrubs);section.shrubs.visible=section.artDirected&&section.distance<125;section.shrubs.geometry=shrubMidGeometry;
        if (section.treated) {
          save(section.supportTrunks); section.supportTrunks.geometry = section.supportModels.midTrunk;
          save(section.supportLeaves); if (section.distance < 215) section.supportLeaves.geometry = section.supportModels.mid;
          save(section.lowerCanopy); if (section.distance < 230) section.lowerCanopy.geometry = groundCover.mid;
          save(section.debris); section.debris.visible = false;
        }
        if (camera) for (const mesh of [...section.group.children]) {
          if (!mesh.isInstancedMesh || mesh.userData.reflectionOnly || !mesh.visible) continue;
          save(mesh); compactReflection(mesh);
        }
      }
    },
    endReflection,
    getStats() { return { enabled, detailedTrees: sections.length * 48, supportingTrees: sections.filter(s=>s.treated).length * 72, treatedSections: sections.filter(s=>s.treated).length, artDirectedSections:sections.filter(s=>s.artDirected).length, growthHabits:variants.map(tree=>tree.trunk.userData.growthHabit), reviewSection, activeSections: visibleSections, wind: wind.value.toArray(), reflectionPass:Boolean(reflectionRestore),reflectionInstances,backgroundTrianglesPerMass:backgroundGeometry.index.count/3,backgroundInstances:sections.reduce((n,s)=>n+(s.group.visible?s.background.count:0),0) }; },
    dispose() { if (disposed) return; this.setEnabled(false); disposed = true; release(); }
  };
  } catch (error) { release(); throw error; }
}
