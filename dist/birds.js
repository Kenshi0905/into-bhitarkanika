import * as T from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { center, width } from './channel.js';

// The five species are documented in the Bhitarkanika field survey by Gopi & Pandav.
// Static coloured parts are merged into one mesh per bird; only two wings animate.
const featherMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: .84, side: T.DoubleSide });
const sphere = new T.SphereGeometry(1, 10, 7);
const v = (x, y, z) => new T.Vector3(x, y, z);
function painted(geometry, color) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const c = new T.Color(color), values = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < values.length; i += 3) { values[i] = c.r; values[i + 1] = c.g; values[i + 2] = c.b; }
  g.setAttribute('color', new T.BufferAttribute(values, 3));
  return g;
}
function bodyPart(parts, color, position, scale) {
  const g = painted(sphere, color); g.scale(...scale); g.translate(...position); parts.push(g);
}
function linePart(parts, color, a, b, radius) {
  const d = v(...b).sub(v(...a)), g = new T.CylinderGeometry(radius * .7, radius, d.length(), 6);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(v(0, 1, 0), d.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  parts.push(painted(g, color)); g.dispose();
}
function bill(parts, color, x, y, z, length, radius) {
  const g = new T.ConeGeometry(radius, length, 6); g.rotateX(-Math.PI / 2); g.translate(x, y, z - length / 2);
  parts.push(painted(g, color)); g.dispose();
}
function combine(parts) { const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); return g; }
function wingGeometry(color, span, chord, broad = false) {
  const s = new T.Shape(); s.moveTo(0, -.10); s.quadraticCurveTo(span * .48, -chord * .62, span, -chord * .17);
  if (broad) { for (let i = 0; i < 5; i++) { s.lineTo(span - i * span * .045, chord * (.03 + i * .16)); s.lineTo(span - (i + 1) * span * .057, chord * (.02 + i * .14)); } }
  else s.lineTo(span * .82, chord * .4);
  s.quadraticCurveTo(span * .4, chord * .64, 0, chord * .37); s.closePath();
  const g = new T.ShapeGeometry(s, 7); g.rotateX(Math.PI / 2); const result = painted(g, color); g.dispose();
  if (broad) {
    const position = result.attributes.position, colors = result.attributes.color, darkTip = new T.Color(0x302c26), base = new T.Color(color), shade = new T.Color();
    for (let i = 0; i < position.count; i++) { shade.copy(base).lerp(darkTip, T.MathUtils.smoothstep(position.getX(i) / span, .71, .93)); colors.setXYZ(i, shade.r, shade.g, shade.b); }
  }
  return result;
}
function template(kind, flying) {
  const p = [], white = 0xe9eadf, dark = 0x202d29;
  const egret = kind === 'little-egret', kite = kind === 'brahminy-kite', common = kind === 'common-kingfisher', capped = kind === 'black-capped-kingfisher';
  let span, wingColor, wingY = 0, wingZ = 0;
  if (egret) {
    bodyPart(p, white, [0, .67, .06], [.23, .29, .45]);
    const neck = flying ? [[0, .87, -.13], [0, .97, -.4], [0, 1.13, -.27], [0, 1.27, -.43]] : [[0, .78, -.12], [0, 1.05, -.3], [0, 1.33, -.16], [0, 1.55, -.34]];
    const curve = new T.CatmullRomCurve3(neck.map(a => v(...a)));
    const ng = new T.TubeGeometry(curve, 12, .058, 6, false); p.push(painted(ng, white)); ng.dispose();
    const head = neck.at(-1); bodyPart(p, white, head, [.09, .11, .16]); bill(p, dark, 0, head[1] - .015, head[2] - .12, .28, .034);
    for (const side of [-1, 1]) {
      bodyPart(p, 0x182421, [side * .083, head[1] + .02, head[2] - .055], [.015, .018, .017]);
      if (flying) { linePart(p, dark, [side * .095, .57, .2], [side * .1, .49, .88], .014); linePart(p, 0xbaa438, [side * .1, .49, .88], [side * .1, .48, 1.03], .019); }
      else { linePart(p, dark, [side * .1, .65, .08], [side * .1, .31, .025], .019); linePart(p, dark, [side * .1, .31, .025], [side * .1, .02, .045], .014); for (let n = -1; n <= 1; n++) linePart(p, 0xb3ad39, [side * .1, .025, .05], [side * .1 + n * .055, .015, -.11], .014); }
    }
    bodyPart(p, white, [0, .66, .46], [.15, .095, .23]); span = .96; wingColor = white; wingY = .83; wingZ = .03;
  } else if (kite) {
    bodyPart(p, 0x92472b, [0, 0, .04], [.19, .15, .39]); bodyPart(p, white, [0, .09, -.33], [.14, .13, .24]);
    bill(p, 0x53635c, 0, .075, -.5, .1, .037);
    bodyPart(p, 0xb87545, [0, -.02, .49], [.21, .035, .24]);
    for (const side of [-1, 1]) { bodyPart(p, dark, [side * .11, .12, -.39], [.016, .02, .02]); linePart(p, 0xbca655, [side * .08, -.1, .05], [side * .08, -.2, .23], .027); }
    span = 1.12; wingColor = 0x955436; wingY = .035;
  } else {
    const back = common ? 0x118c9d : capped ? 0x226ac1 : 0x188eaa;
    const head = common ? 0x1e8597 : capped ? 0x1c2526 : 0x6b3a28;
    bodyPart(p, back, [0, .23, .04], [.16, .2, .31]);
    bodyPart(p, common ? 0xd4853e : capped ? 0xd8c1a4 : white, [0, .22, -.12], [.122, .18, .16]);
    bodyPart(p, head, [0, .45, -.14], [.175, .16, .185]);
    if (capped) bodyPart(p, white, [0, .315, -.125], [.17, .058, .155]);
    if (common) for (const side of [-1, 1]) bodyPart(p, white, [side * .15, .4, -.085], [.04, .04, .065]);
    bill(p, common ? 0x303b34 : 0xba4028, 0, .43, -.29, common ? .27 : .33, .042);
    for (const side of [-1, 1]) { bodyPart(p, 0x101915, [side * .16, .49, -.19], [.021, .024, .024]); linePart(p, 0xab4d31, [side * .07, .11, .05], [side * .07, 0, -.02], .02); }
    bodyPart(p, back, [0, .16, .37], [.09, .035, .18]); span = common ? .39 : .52; wingColor = back; wingY = .30; wingZ = .05;
  }
  if (!flying) for (const side of [-1, 1]) bodyPart(p, wingColor, [side * (egret ? .19 : .13), wingY - (egret ? .11 : .025), wingZ + .09], [egret ? .11 : .065, egret ? .2 : .13, egret ? .38 : .25]);
  return { body: combine(p), wing: flying ? wingGeometry(wingColor, span, kite ? .52 : egret ? .43 : .28, kite) : null, wingY, wingZ };
}
export function buildBirds(scene) {
  const birds = [], templates = new Map();
  function add(kind, z, side, flight, phase) {
    const key = kind + flight; if (!templates.has(key)) templates.set(key, template(kind, flight));
    const t = templates.get(key), group = new T.Group(), body = new T.Mesh(t.body, featherMaterial); group.add(body); body.castShadow = true;
    const wings = [];
    if (t.wing) for (const sign of [-1, 1]) { const wing = new T.Mesh(t.wing, featherMaterial); wing.scale.x = sign; wing.position.set(0, t.wingY, t.wingZ); group.add(wing); wings.push(wing); }
    // Slightly enlarged kingfishers keep their markings legible from the boat camera.
    const scale = kind.includes('kingfisher') ? (kind === 'common-kingfisher' ? 1 : 1.18) : 1;
    group.scale.setScalar(scale);
    const x = center(z) + side * (width(z) + (kind === 'little-egret' ? .1 : -1.5));
    const y = kind === 'little-egret' ? .13 : 2.1 + phase % 3;
    if (!flight && kind.includes('kingfisher')) {
      const branchParts = []; linePart(branchParts, 0x605747, [x + side * 3, .1, z + .3], [x, y - .04, z], .05);
      linePart(branchParts, 0x716a53, [x, y - .04, z], [x - side * .7, y + .02, z - .2], .032);
      const branch = new T.Mesh(combine(branchParts), featherMaterial); branch.castShadow = true; scene.add(branch);
    }
    group.position.set(x, y, z); group.rotation.y = side * Math.PI / 2; scene.add(group);
    birds.push({ species: kind, position: group.position, mesh: group, wings, flight, home: v(x, y, z), phase, side });
  }
  for (const [z, side, kind] of [[-27, -1, 'white-throated-kingfisher'], [-78, 1, 'common-kingfisher'], [-170, -1, 'black-capped-kingfisher'], [-290, 1, 'white-throated-kingfisher'], [-450, -1, 'common-kingfisher'], [-630, 1, 'black-capped-kingfisher'], [-770, -1, 'white-throated-kingfisher'], [-930, 1, 'common-kingfisher']]) add(kind, z, side, false, birds.length * 1.37);
  for (const [z, side] of [[-15, 1], [-46, -1], [-130, 1], [-340, -1], [-520, 1], [-830, -1]]) add('little-egret', z, side, false, birds.length * .72);
  for (const [kind, z, side] of [['little-egret', -60, 1], ['little-egret', -76, 1], ['common-kingfisher', -115, -1], ['brahminy-kite', -145, 1], ['little-egret', -410, -1], ['white-throated-kingfisher', -390, 1], ['brahminy-kite', -680, -1], ['little-egret', -940, 1]]) add(kind, z, side, true, birds.length * .64);
  return { birds, update(t, boatPosition) {
    for (const bird of birds) {
      const { mesh, home, phase, species, wings } = bird;
      if (bird.flight) {
        const kite = species === 'brahminy-kite', king = species.includes('kingfisher');
        const speed = kite ? .055 : king ? .15 : .082, a = t * speed + phase;
        const z = home.z + Math.sin(a) * (kite ? 65 : 44), x = center(z) + Math.cos(a) * (kite ? 25 : 22);
        mesh.position.set(x, kite ? 23 + Math.sin(a * .7) * 3 : king ? 1.6 + Math.sin(a * 2) * .5 : 7 + Math.sin(a * 1.3) * 1.5, z);
        const aheadZ = home.z + Math.sin(a + .01) * (kite ? 65 : 44), aheadX = center(aheadZ) + Math.cos(a + .01) * (kite ? 25 : 22);
        mesh.rotation.y = Math.atan2(-(aheadX - x), -(aheadZ - z)); mesh.rotation.z = Math.cos(a) * .10;
        const flap = kite ? .10 + Math.sin(t * 1.7 + phase) * .07 : Math.sin(t * (king ? 17 : 4.1) + phase) * (king ? .82 : .51);
        wings[0].rotation.z = flap; wings[1].rotation.z = -flap;
      } else {
        mesh.rotation.y = bird.side * Math.PI / 2 + Math.sin(t * .3 + phase) * .12;
        if (species === 'little-egret') { mesh.position.z = home.z + Math.sin(t * .12 + phase) * .65; mesh.rotation.x = Math.max(0, Math.sin(t * .31 + phase) - .82) * 1.2; }
        if (boatPosition && Math.hypot(mesh.position.x - boatPosition.x, mesh.position.z - boatPosition.z) < 18) mesh.rotation.y += Math.sin(t * .5) * .16;
      }
    }
  } };
}
