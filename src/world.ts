import * as THREE from 'three';
import { applyWind } from './wind';

export interface World {
  group: THREE.Group;
  torches: { flame: THREE.Group; glow: THREE.PointLight; baseScale: number }[];
  rain: THREE.Points;
  embers: THREE.Points;
  playerTorchLight: THREE.PointLight;
  playerFlame: THREE.Group;
  sword: THREE.Group;
  update: (time: number, dt: number, moving: boolean, bobTime: number) => void;
}

// --- Path e terreno ---
const pathX = (z: number) => Math.sin((z + 30) * 0.038) * 4.2;
export const terrainHeight = (x: number, z: number) => {
  const undulation = Math.sin(x * 0.09) * 0.32 + Math.sin(z * 0.052) * 0.38;
  const pathDip = Math.exp(-Math.pow(x - pathX(z), 2) / 35) * 0.25;
  return undulation - pathDip;
};

function seededRandom(seed = 317) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function createMistTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 18; i++) {
    const x = 30 + Math.random() * 196;
    const y = 28 + Math.random() * 72;
    const radius = 18 + Math.random() * 38;
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, 'rgba(188,164,219,.23)');
    g.addColorStop(0.48, 'rgba(92,68,135,.12)');
    g.addColorStop(1, 'rgba(22,12,42,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createRadialGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const glow = ctx.createRadialGradient(128, 128, 18, 128, 128, 126);
  glow.addColorStop(0, 'rgba(255,255,255,.92)');
  glow.addColorStop(0.22, 'rgba(211,196,255,.38)');
  glow.addColorStop(0.55, 'rgba(145,94,219,.12)');
  glow.addColorStop(1, 'rgba(100,52,170,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPuddleGeometry(radius: number, seed: number) {
  const random = seededRandom(seed);
  const shape = new THREE.Shape();
  const points = Array.from({ length: 22 }, (_, i) => {
    const angle = (i / 22) * Math.PI * 2;
    const wobble = 0.68 + random() * 0.45 + Math.sin(angle * 3 + seed) * 0.08;
    return new THREE.Vector2(Math.cos(angle) * radius * wobble, Math.sin(angle) * radius * wobble);
  });
  shape.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => shape.lineTo(point.x, point.y));
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

export function createWorld(camera: THREE.PerspectiveCamera): World {
  const group = new THREE.Group();
  const random = seededRandom();
  const torches: { flame: THREE.Group; glow: THREE.PointLight; baseScale: number }[] = [];

  // --- Sky dome (shader gradiente) ---
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(350, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x05020b) },
        horizonColor: { value: new THREE.Color(0x2e0e52) },
      },
      vertexShader: 'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec3 vPos;uniform vec3 topColor;uniform vec3 horizonColor;void main(){float h=clamp(normalize(vPos).y*.72+.28,0.,1.);vec3 c=mix(horizonColor,topColor,smoothstep(.05,.74,h));gl_FragColor=vec4(c,1.);}',
    }),
  );
  group.add(sky);

  // --- Luzes base ---
  group.add(new THREE.HemisphereLight(0x6f4aa0, 0x130b0a, 0.85));
  const moonLight = new THREE.DirectionalLight(0x8ea4ff, 1.15);
  moonLight.position.set(35, 58, -95);
  group.add(moonLight);
  const stormLight = new THREE.PointLight(0x6c27c7, 0, 180);
  stormLight.position.set(-20, 45, -70);
  group.add(stormLight);

  // --- Terreno com path ---
  const groundGeo = new THREE.PlaneGeometry(220, 400, 70, 120);
  const groundPos = groundGeo.attributes.position;
  for (let i = 0; i < groundPos.count; i++) {
    const x = groundPos.getX(i);
    const localY = groundPos.getY(i);
    groundPos.setZ(i, terrainHeight(x, -localY));
  }
  groundGeo.rotateX(-Math.PI / 2);
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ color: 0x172014, roughness: 1, metalness: 0 }),
  );
  group.add(ground);

  // --- Trilha ---
  const pathVertices: number[] = [];
  const pathIndices: number[] = [];
  const pathSteps = 66;
  for (let i = 0; i < pathSteps; i++) {
    const z = 30 - i * 3.05;
    const center = pathX(z);
    const width = 2.8 + Math.sin(i * 1.7) * 0.38;
    const yL = terrainHeight(center - width, z) + 0.035;
    const yR = terrainHeight(center + width, z) + 0.035;
    pathVertices.push(center - width, yL, z, center + width, yR, z);
    if (i < pathSteps - 1) {
      const a = i * 2;
      pathIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const pathGeo = new THREE.BufferGeometry();
  pathGeo.setAttribute('position', new THREE.Float32BufferAttribute(pathVertices, 3));
  pathGeo.setIndex(pathIndices);
  pathGeo.computeVertexNormals();
  const path = new THREE.Mesh(
    pathGeo,
    new THREE.MeshStandardMaterial({ color: 0x3d2b1e, roughness: 1, side: THREE.DoubleSide }),
  );
  group.add(path);

  // --- Pedras grandes ---
  const stoneGeo = new THREE.DodecahedronGeometry(0.65, 0);
  const stones = new THREE.InstancedMesh(
    stoneGeo,
    new THREE.MeshStandardMaterial({ color: 0x514b4f, roughness: 0.96 }),
    145,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 145; i++) {
    const z = 25 - random() * 170;
    const side = random() > 0.5 ? 1 : -1;
    const x = pathX(z) + side * (5.7 + random() * 44);
    const s = 0.35 + random() * 1.65;
    dummy.position.set(x, terrainHeight(x, z) + s * 0.32, z);
    dummy.rotation.set(random() * 2, random() * 2, random() * 2);
    dummy.scale.set(s * (0.8 + random()), s * 0.6, s);
    dummy.updateMatrix();
    stones.setMatrixAt(i, dummy.matrix);
  }
  group.add(stones);

  // --- Pedregulhos na trilha ---
  const trailPebbleGeo = new THREE.DodecahedronGeometry(0.32, 0);
  const trailPebbles = new THREE.InstancedMesh(
    trailPebbleGeo,
    new THREE.MeshStandardMaterial({ color: 0x766552, roughness: 1 }),
    230,
  );
  for (let i = 0; i < 230; i++) {
    const z = 28 - random() * 188;
    const x = pathX(z) + (random() - 0.5) * 5.1;
    const s = 0.18 + random() * 0.72;
    dummy.position.set(x, terrainHeight(x, z) + 0.08 + s * 0.08, z);
    dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    dummy.scale.set(s * (0.75 + random() * 0.8), s * 0.22, s);
    dummy.updateMatrix();
    trailPebbles.setMatrixAt(i, dummy.matrix);
  }
  group.add(trailPebbles);

  // --- Campo de ossos ---
  const boneMaterial = new THREE.MeshStandardMaterial({ color: 0xb7aa8f, roughness: 0.88 });
  const boneShaftGeo = new THREE.CylinderGeometry(0.075, 0.1, 1.15, 7);
  boneShaftGeo.rotateZ(Math.PI / 2);
  const boneKnobGeo = new THREE.SphereGeometry(0.14, 7, 5);
  const skullMaterial = new THREE.MeshStandardMaterial({ color: 0x9f9277, roughness: 0.94 });
  const boneField = new THREE.Group();
  const addBone = (x: number, z: number, length: number, rotation: number) => {
    const bone = new THREE.Group();
    const shaft = new THREE.Mesh(boneShaftGeo, boneMaterial);
    shaft.scale.x = length;
    bone.add(shaft);
    [-0.62 * length, 0.62 * length].forEach((end) => {
      const knobA = new THREE.Mesh(boneKnobGeo, boneMaterial);
      knobA.position.set(end, 0.04, 0.07);
      const knobB = knobA.clone();
      knobB.position.z = -0.07;
      bone.add(knobA, knobB);
    });
    bone.position.set(x, terrainHeight(x, z) + 0.16, z);
    bone.rotation.set(0, rotation, (random() - 0.5) * 0.15);
    bone.scale.setScalar(0.65 + random() * 0.75);
    boneField.add(bone);
  };
  for (let i = 0; i < 22; i++) {
    const z = 12 - random() * 152;
    const x = pathX(z) + (random() - 0.5) * 5.2;
    addBone(x, z, 0.75 + random() * 0.65, random() * Math.PI);
  }
  [-18, -58, -103].forEach((z, index) => {
    const x = pathX(z) + (index % 2 ? 1.7 : -1.8);
    const skull = new THREE.Group();
    const cranium = new THREE.Mesh(new THREE.DodecahedronGeometry(0.52, 1), skullMaterial);
    cranium.scale.set(0.88, 0.8, 0.78);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.48), skullMaterial);
    jaw.position.set(0, -0.38, 0.05);
    const socketMaterial = new THREE.MeshBasicMaterial({ color: 0x080609 });
    [-0.19, 0.19].forEach((eyeX) => {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 6), socketMaterial);
      socket.position.set(eyeX, 0.03, 0.39);
      skull.add(socket);
    });
    skull.add(cranium, jaw);
    skull.position.set(x, terrainHeight(x, z) + 0.54, z);
    skull.rotation.y = random() * Math.PI * 2;
    skull.rotation.z = (random() - 0.5) * 0.35;
    skull.scale.setScalar(0.75 + random() * 0.3);
    boneField.add(skull);
  });
  group.add(boneField);

  // --- Árvores (250 instâncias, 6 InstancedMesh: tronco + 3 copas + 2 branches) ---
  const treeCount = 250;
  const treePositions: THREE.Vector2[] = [];
  const trunkGeo = new THREE.CylinderGeometry(0.48, 0.84, 8.5, 8, 3);
  const crownGeo = new THREE.ConeGeometry(3.8, 7.4, 10, 3);
  const branchGeo = new THREE.CylinderGeometry(0.12, 0.25, 3.2, 6);
  const trunks = new THREE.InstancedMesh(
    trunkGeo,
    new THREE.MeshStandardMaterial({ color: 0x201116, roughness: 1, flatShading: true }),
    treeCount,
  );
  const crownLowerMat = new THREE.MeshLambertMaterial({ color: 0x08130f, flatShading: true });
  applyWind(crownLowerMat, 0.18, 0.6);
  const crownLower = new THREE.InstancedMesh(crownGeo, crownLowerMat, treeCount);
  const crownMiddleMat = new THREE.MeshLambertMaterial({ color: 0x0a1712, flatShading: true });
  applyWind(crownMiddleMat, 0.22, 0.7);
  const crownMiddle = new THREE.InstancedMesh(crownGeo, crownMiddleMat, treeCount);
  const crownTopMat = new THREE.MeshLambertMaterial({ color: 0x0d1915, flatShading: true });
  applyWind(crownTopMat, 0.28, 0.8);
  const crownTop = new THREE.InstancedMesh(crownGeo, crownTopMat, treeCount);
  const branchesA = new THREE.InstancedMesh(branchGeo, new THREE.MeshStandardMaterial({ color: 0x1c0d12, roughness: 1 }), treeCount);
  const branchesB = new THREE.InstancedMesh(branchGeo, new THREE.MeshStandardMaterial({ color: 0x170b0f, roughness: 1 }), treeCount);
  for (let i = 0; i < treeCount; i++) {
    const z = 36 - random() * 205;
    const side = random() > 0.5 ? 1 : -1;
    const x = pathX(z) + side * (8.7 + Math.pow(random(), 0.72) * 72);
    const scale = 0.74 + random() * 1.42;
    const y = terrainHeight(x, z);
    const lean = (random() - 0.5) * 0.07;
    const turn = random() * Math.PI * 2;
    treePositions.push(new THREE.Vector2(x, z));

    dummy.position.set(x, y + 4.25 * scale, z);
    dummy.rotation.set(lean, turn, lean * 0.7);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);

    const crownTurn = random() * Math.PI;
    dummy.position.set(x + lean * 2, y + 8.6 * scale, z);
    dummy.rotation.set(0, crownTurn, 0);
    dummy.scale.set(scale * 1.2, scale * 0.98, scale * (1 + random() * 0.2));
    dummy.updateMatrix();
    crownLower.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x + lean * 3, y + 11.5 * scale, z);
    dummy.rotation.set(0, crownTurn + 0.8, lean * 0.4);
    dummy.scale.set(scale, scale * 0.9, scale * 0.9);
    dummy.updateMatrix();
    crownMiddle.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x + lean * 4.1, y + 14.2 * scale, z);
    dummy.rotation.set(0, crownTurn + 1.7, lean * 0.7);
    dummy.scale.set(scale * 0.72, scale * 0.84, scale * 0.74);
    dummy.updateMatrix();
    crownTop.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x + Math.cos(turn) * 0.7 * scale, y + 6.6 * scale, z + Math.sin(turn) * 0.7 * scale);
    dummy.rotation.set(Math.cos(turn) * 0.95, turn, Math.sin(turn) * 0.95);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    branchesA.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x - Math.cos(turn) * 0.55 * scale, y + 8.1 * scale, z - Math.sin(turn) * 0.55 * scale);
    dummy.rotation.set(-Math.cos(turn) * 1.05, turn + Math.PI * 0.55, -Math.sin(turn) * 1.05);
    dummy.scale.set(scale * 0.78, scale * 0.84, scale * 0.78);
    dummy.updateMatrix();
    branchesB.setMatrixAt(i, dummy.matrix);
  }
  group.add(trunks, crownLower, crownMiddle, crownTop, branchesA, branchesB);

  // --- Montanhas ---
  const mountainMat = new THREE.MeshLambertMaterial({ color: 0x110b1e });
  for (let i = 0; i < 12; i++) {
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(21 + random() * 22, 55 + random() * 70, 5), mountainMat);
    mountain.position.set(-140 + i * 27, 18 + random() * 8, -220 - random() * 38);
    mountain.scale.z = 0.65 + random() * 0.5;
    mountain.rotation.y = random() * Math.PI;
    group.add(mountain);
  }

  // --- Lua + halo ---
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(13.5, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0xe1ddff, fog: false }),
  );
  moon.position.set(48, 66, -205);
  group.add(moon);
  const moonGlowTexture = createRadialGlowTexture();
  const moonHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: moonGlowTexture,
      color: 0xb58aff,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      depthTest: true,
      fog: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  moonHalo.position.copy(moon.position);
  moonHalo.position.z += 0.2;
  moonHalo.scale.set(58, 58, 1);
  group.add(moonHalo);

  // --- Nuvens e neblina de chão ---
  const mistTexture = createMistTexture();
  const clouds: THREE.Sprite[] = [];
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: mistTexture, color: i % 3 === 0 ? 0x6a2c91 : 0x3a244f, transparent: true, opacity: 0.38, depthWrite: false, fog: false }),
    );
    cloud.position.set(-130 + random() * 270, 36 + random() * 39, -145 - random() * 100);
    cloud.scale.set(45 + random() * 70, 13 + random() * 20, 1);
    clouds.push(cloud);
    group.add(cloud);
  }
  const groundMist: THREE.Sprite[] = [];
  for (let i = 0; i < 24; i++) {
    const mist = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: mistTexture, color: 0x716088, transparent: true, opacity: 0.12 + random() * 0.14, depthWrite: false }),
    );
    mist.position.set(-55 + random() * 110, 1 + random() * 2, 20 - random() * 170);
    mist.scale.set(22 + random() * 34, 6 + random() * 8, 1);
    groundMist.push(mist);
    group.add(mist);
  }

  // --- Castelo ---
  const castle = new THREE.Group();
  const castleZ = -184;
  castle.position.set(pathX(-170), terrainHeight(pathX(-170), castleZ), castleZ);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x292634, roughness: 0.94, flatShading: true });
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x171420, roughness: 0.96, flatShading: true });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x09070f, roughness: 0.86, metalness: 0.08 });
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xff742a, toneMapped: false });
  const windowDimMat = new THREE.MeshBasicMaterial({ color: 0x9f2f1e, toneMapped: false });

  const foundation = new THREE.Mesh(new THREE.BoxGeometry(58, 6, 22), darkStoneMat);
  foundation.position.y = 3;
  castle.add(foundation);
  const mainKeep = new THREE.Mesh(new THREE.BoxGeometry(31, 38, 18), stoneMat);
  mainKeep.position.set(0, 22, -1);
  castle.add(mainKeep);
  const upperKeep = new THREE.Mesh(new THREE.BoxGeometry(19, 21, 15), darkStoneMat);
  upperKeep.position.set(0, 50, -2);
  castle.add(upperKeep);
  const centralRoof = new THREE.Mesh(new THREE.ConeGeometry(12.8, 22, 8), roofMat);
  centralRoof.position.set(0, 71, -2);
  centralRoof.rotation.y = Math.PI / 8;
  castle.add(centralRoof);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.7, 13, 8), roofMat);
  spire.position.set(0, 87, -2);
  castle.add(spire);

  const addBattlements = (width: number, y: number, z: number, count: number, centerX = 0) => {
    for (let i = 0; i < count; i++) {
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(1.65, 2.7, 1.8), darkStoneMat);
      merlon.position.set(centerX - width / 2 + (i / (count - 1)) * width, y, z);
      castle.add(merlon);
    }
  };
  addBattlements(28, 42.2, 8.7, 11);

  const towerData = [
    { x: -25, height: 43, radius: 7.2 },
    { x: -13.5, height: 53, radius: 6.2 },
    { x: 13.5, height: 53, radius: 6.2 },
    { x: 25, height: 43, radius: 7.2 },
  ];
  towerData.forEach(({ x, height, radius }, towerIndex) => {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.9, radius, height, 10), towerIndex % 2 ? darkStoneMat : stoneMat);
    tower.position.set(x, height / 2 + 4, 0);
    castle.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.25, 15, 10), roofMat);
    roof.position.set(x, height + 11.5, 0);
    roof.rotation.y = towerIndex * 0.21;
    castle.add(roof);
    const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.4, 5.5, 6), roofMat);
    finial.position.set(x, height + 21.5, 0);
    castle.add(finial);
    for (let c = 0; c < 8; c++) {
      const angle = (c / 8) * Math.PI * 2;
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.3, 1.35), stoneMat);
      merlon.position.set(x + Math.cos(angle) * radius * 0.72, height + 4.9, Math.sin(angle) * radius * 0.72);
      merlon.rotation.y = -angle;
      castle.add(merlon);
    }
    [15, 25, 35].forEach((windowY, windowIndex) => {
      if (windowY > height - 3) return;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.7), windowIndex === 1 ? windowDimMat : windowMat);
      win.position.set(x, windowY + 4, radius + 0.05);
      castle.add(win);
    });
  });

  [-19.5, 19.5].forEach((x) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 23, 16), stoneMat);
    wall.position.set(x, 15.5, 0);
    castle.add(wall);
    addBattlements(8.4, 28.2, 8, 4, x);
  });
  [-10.5, -5.2, 5.2, 10.5].forEach((x, i) => {
    const buttress = new THREE.Mesh(new THREE.BoxGeometry(2.2, 27 + (i % 2) * 5, 2.8), darkStoneMat);
    buttress.position.set(x, 17, 9.2);
    buttress.rotation.z = x * 0.001;
    castle.add(buttress);
  });

  const gateShape = new THREE.Shape();
  gateShape.moveTo(-3.6, 0);
  gateShape.lineTo(3.6, 0);
  gateShape.lineTo(3.6, 6.5);
  gateShape.absarc(0, 6.5, 3.6, 0, Math.PI, false);
  gateShape.lineTo(-3.6, 0);
  const gate = new THREE.Mesh(new THREE.ShapeGeometry(gateShape), new THREE.MeshBasicMaterial({ color: 0x050407 }));
  gate.position.set(0, 3, 9.06);
  castle.add(gate);
  const portcullisMat = new THREE.MeshStandardMaterial({ color: 0x241b19, roughness: 0.7, metalness: 0.72 });
  for (let i = -3; i <= 3; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 9.5, 0.14), portcullisMat);
    bar.position.set(i * 0.9, 7.1, 9.17);
    castle.add(bar);
  }
  for (let i = 0; i < 3; i++) {
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.16, 0.14), portcullisMat);
    crossbar.position.set(0, 4.5 + i * 2.2, 9.19);
    castle.add(crossbar);
  }

  [-6.8, 0, 6.8].forEach((x, i) => {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 3.1), i === 1 ? windowMat : windowDimMat);
    win.position.set(x, 30, 8.04);
    castle.add(win);
  });
  [-4.2, 4.2].forEach((x) => {
    const upperWindow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.4), windowMat);
    upperWindow.position.set(x, 52, 5.53);
    castle.add(upperWindow);
  });

  [-13.5, 13.5].forEach((x, i) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 10, 6), portcullisMat);
    pole.position.set(x, 72, 0);
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 6.8),
      new THREE.MeshStandardMaterial({ color: i ? 0x3b0e19 : 0x250b19, roughness: 0.88, side: THREE.DoubleSide }),
    );
    banner.position.set(x + 2.25, 70.2, 0);
    castle.add(pole, banner);
  });
  group.add(castle);

  // --- Tochas ao longo do caminho ---
  const torchPositions = [14, -10, -34, -60, -87, -114, -75, -98, -55, -30];
  const outerFlameMat = new THREE.MeshBasicMaterial({
    color: 0xff5b16, transparent: true, opacity: 0.74,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const middleFlameMat = new THREE.MeshBasicMaterial({
    color: 0xffa126, transparent: true, opacity: 0.86,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const coreFlameMat = new THREE.MeshBasicMaterial({ color: 0xfff0bc, toneMapped: false });
  const brazierMat = new THREE.MeshStandardMaterial({ color: 0x30231e, roughness: 0.65, metalness: 0.72 });
  const createFlame = (scale = 1) => {
    const flame = new THREE.Group();
    const outerBase = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), outerFlameMat);
    outerBase.scale.set(1.08, 1.35, 0.92);
    outerBase.position.y = -0.06;
    const outerLobe = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), outerFlameMat);
    outerLobe.scale.set(0.88, 1.65, 0.78);
    outerLobe.position.set(0.08, 0.38, 0);
    const middle = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), middleFlameMat);
    middle.scale.set(0.9, 1.55, 0.8);
    middle.position.set(-0.07, 0.12, 0.04);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 9, 7), coreFlameMat);
    core.scale.set(0.88, 1.55, 0.8);
    core.position.set(0.02, -0.08, 0.08);
    flame.add(outerBase, outerLobe, middle, core);
    flame.scale.setScalar(scale);
    return flame;
  };
  torchPositions.forEach((z, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const x = pathX(z) + side * 4.8;
    const y = terrainHeight(x, z);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.22, 2.5, 7),
      new THREE.MeshStandardMaterial({ color: 0x2a140a, roughness: 1 }),
    );
    pole.position.set(x, y + 1.25, z);
    group.add(pole);

    const basket = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.065, 7, 14), brazierMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.22;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.17, 0.34, 10), brazierMat);
    bowl.position.y = 0.02;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.18, 8), brazierMat);
    collar.position.y = -0.21;
    basket.add(ring, bowl, collar);
    for (let tine = 0; tine < 4; tine++) {
      const angle = (tine / 4) * Math.PI * 2;
      const metalTine = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.38, 0.055), brazierMat);
      metalTine.position.set(Math.cos(angle) * 0.27, 0.05, Math.sin(angle) * 0.27);
      metalTine.rotation.z = -Math.cos(angle) * 0.24;
      metalTine.rotation.x = Math.sin(angle) * 0.24;
      basket.add(metalTine);
    }
    basket.position.set(x, y + 2.69, z);
    group.add(basket);

    const flame = createFlame();
    flame.position.set(x, y + 3.1, z);
    group.add(flame);
    const glow = new THREE.PointLight(0xff5a16, 12, 19, 2);
    glow.position.copy(flame.position);
    group.add(glow);
    torches.push({ flame, glow, baseScale: 0.86 + random() * 0.22 });
  });

  // --- Poças de sangue ---
  const bloodMat = new THREE.MeshBasicMaterial({
    color: 0x72020b, transparent: true, opacity: 0.88,
    depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
  });
  const bloodPuddles = [
    [2.2, 5, 1.2], [-2.6, -21, 1.7], [1.1, -43, 1.05], [-1.3, -65, 2.1],
    [2.5, -83, 1.4], [-1.8, -105, 1.75], [0.5, -126, 2.25], [2.2, -145, 1.1],
  ];
  bloodPuddles.forEach(([offset, z, radius], i) => {
    const x = pathX(z) + offset;
    const puddle = new THREE.Mesh(createPuddleGeometry(radius, 520 + i * 13), bloodMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.rotation.z = i * 1.9;
    puddle.scale.y = 0.52 + (i % 3) * 0.11;
    puddle.position.set(x, terrainHeight(x, z) + 0.135, z);
    puddle.renderOrder = 4;
    group.add(puddle);
    for (let drop = 0; drop < 3; drop++) {
      const dx = (random() - 0.5) * radius * 3.1;
      const dz = (random() - 0.5) * radius * 2.8;
      const dropMesh = new THREE.Mesh(new THREE.CircleGeometry(0.09 + random() * 0.18, 10), bloodMat);
      dropMesh.rotation.x = -Math.PI / 2;
      dropMesh.position.set(x + dx, terrainHeight(x + dx, z + dz) + 0.14, z + dz);
      dropMesh.renderOrder = 4;
      group.add(dropMesh);
    }
  });

  // --- Chuva ---
  const rainCount = 3200;
  const rainPositions = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3] = (random() - 0.5) * 150;
    rainPositions[i * 3 + 1] = random() * 62;
    rainPositions[i * 3 + 2] = 42 - random() * 220;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.Points(
    rainGeo,
    new THREE.PointsMaterial({ color: 0x8c83ac, size: 0.065, transparent: true, opacity: 0.72, depthWrite: false }),
  );
  group.add(rain);

  // --- Brasas das tochas ---
  const emberPositions = new Float32Array(260 * 3);
  for (let i = 0; i < 260; i++) {
    const z = torchPositions[i % torchPositions.length];
    const side = (i % torchPositions.length) % 2 === 0 ? -1 : 1;
    emberPositions[i * 3] = pathX(z) + side * 4.8 + (random() - 0.5) * 2.3;
    emberPositions[i * 3 + 1] = terrainHeight(pathX(z), z) + 2.4 + random() * 5;
    emberPositions[i * 3 + 2] = z + (random() - 0.5) * 2.3;
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: 0xff6a18, size: 0.09, transparent: true, opacity: 0.82 }));
  group.add(embers);

  // --- Tufts de grama (InstancedMesh: 2 planos cruzados por tuft, 1 draw call) ---
  // Textura com gradiente vertical: base escura (AO fake), topo claro
  const grassTexture = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 64);
    // Gradiente vertical: base (y=64) escura, topo (y=0) clara
    const grad = ctx.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, '#4a5a2a'); // topo
    grad.addColorStop(0.5, '#2e3a18');
    grad.addColorStop(1, '#14180a'); // base escura (AO)
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) {
      const x = 8 + (i / 12) * 48;
      ctx.beginPath();
      ctx.moveTo(x, 64);
      ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 8, 32, x + (Math.random() - 0.5) * 6, 4);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const x = 12 + (i / 8) * 40;
      ctx.beginPath();
      ctx.moveTo(x, 64);
      ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 6, 36, x + (Math.random() - 0.5) * 4, 8);
      ctx.stroke();
    }
    return new THREE.CanvasTexture(canvas);
  })();

  const grassBladeGeo = new THREE.PlaneGeometry(0.5, 0.6);
  grassBladeGeo.translate(0, 0.3, 0); // pivô na base
  const grassMat = new THREE.MeshLambertMaterial({
    map: grassTexture,
    transparent: true,
    alphaTest: 0.3,
    side: THREE.DoubleSide,
  });
  applyWind(grassMat, 0.2, 2.5); // grama balança suave
  // Mais grama, em tufos agrupados (clusters) fora da estrada
  const grassCount = 3000;
  const grassInstanced = new THREE.InstancedMesh(grassBladeGeo, grassMat, grassCount * 2);
  // Gera centros de clusters, depois coloca tufos ao redor de cada centro
  const clusterCount = 200;
  const clusters: { x: number; z: number; count: number }[] = [];
  for (let c = 0; c < clusterCount; c++) {
    const z = 30 - random() * 200;
    const side = random() > 0.5 ? 1 : -1;
    const distFromPath = 6 + Math.pow(random(), 0.6) * 50;
    const x = pathX(z) + side * distFromPath;
    clusters.push({ x, z, count: 0 });
  }
  for (let i = 0; i < grassCount; i++) {
    // Escolhe um cluster aleatório e posiciona perto dele (agrupado)
    const cluster = clusters[i % clusterCount];
    const spread = 1.2; // tufos juntos num raio pequeno
    const offsetX = (random() - 0.5) * spread;
    const offsetZ = (random() - 0.5) * spread;
    const x = cluster.x + offsetX;
    const z = cluster.z + offsetZ;
    const s = 0.6 + random() * 0.8;
    const rotY = random() * Math.PI;
    const y = terrainHeight(x, z);
    // Blade 1
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    grassInstanced.setMatrixAt(i * 2, dummy.matrix);
    // Blade 2 (perpendicular)
    dummy.rotation.set(0, rotY + Math.PI / 2, 0);
    dummy.updateMatrix();
    grassInstanced.setMatrixAt(i * 2 + 1, dummy.matrix);
  }
  group.add(grassInstanced);

  // --- Vaga-lumes (30 pontos amarelos flutuando) ---
  const fireflyCount = 30;
  const fireflyGeo = new THREE.BufferGeometry();
  const fireflyPositions = new Float32Array(fireflyCount * 3);
  const fireflyData: { origin: THREE.Vector3; phase: number; speed: number; radius: number }[] = [];
  for (let i = 0; i < fireflyCount; i++) {
    const z = 20 - random() * 150;
    const x = pathX(z) + (random() - 0.5) * 20;
    const y = 1 + random() * 3;
    fireflyPositions[i * 3] = x;
    fireflyPositions[i * 3 + 1] = y;
    fireflyPositions[i * 3 + 2] = z;
    fireflyData.push({
      origin: new THREE.Vector3(x, y, z),
      phase: random() * Math.PI * 2,
      speed: 0.3 + random() * 0.5,
      radius: 1 + random() * 2,
    });
  }
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3));
  const fireflies = new THREE.Points(
    fireflyGeo,
    new THREE.PointsMaterial({ color: 0xffee66, size: 0.15, transparent: true, opacity: 0.9 }),
  );
  group.add(fireflies);

  // --- Espada (anexada à câmera, first-person) ---
  const sword = new THREE.Group();
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.075, 0);
  bladeShape.lineTo(0.075, 0);
  bladeShape.lineTo(0.058, 1.28);
  bladeShape.lineTo(0, 1.62);
  bladeShape.lineTo(-0.058, 1.28);
  bladeShape.closePath();
  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9d0da, metalness: 0.96, roughness: 0.18,
    emissive: 0x171929, emissiveIntensity: 0.28,
  });
  const blade = new THREE.Mesh(
    new THREE.ExtrudeGeometry(bladeShape, { depth: 0.042, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.018, bevelThickness: 0.012 }),
    bladeMaterial,
  );
  blade.position.z = -0.021;
  const fuller = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, 1.18, 0.018),
    new THREE.MeshStandardMaterial({ color: 0x4f5665, metalness: 0.92, roughness: 0.24 }),
  );
  fuller.position.set(0, 0.63, 0.052);

  const guardMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, metalness: 0.82, roughness: 0.3 });
  const guardCore = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.09, 0.12), guardMaterial);
  const guardGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.095, 0),
    new THREE.MeshStandardMaterial({ color: 0x622e93, emissive: 0x4b167a, emissiveIntensity: 1.5, metalness: 0.25, roughness: 0.25 }),
  );
  guardGem.position.set(0, 0.015, 0.09);
  [-1, 1].forEach((direction) => {
    const quillon = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.065, 0.34, 7), guardMaterial);
    quillon.position.set(direction * 0.34, 0.035, 0);
    quillon.rotation.z = direction * (Math.PI / 2 - 0.22);
    const guardTip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.18, 7), guardMaterial);
    guardTip.position.set(direction * 0.54, 0.085, 0);
    guardTip.rotation.z = -direction * Math.PI / 2;
    sword.add(quillon, guardTip);
  });

  const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x321514, roughness: 0.88 });
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.072, 0.54, 10), gripMaterial);
  grip.position.y = -0.31;
  for (let wrap = 0; wrap < 5; wrap++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.073, 0.009, 5, 10), guardMaterial);
    band.rotation.x = Math.PI / 2;
    band.position.y = -0.11 - wrap * 0.1;
    sword.add(band);
  }
  const pommel = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), guardMaterial);
  pommel.position.y = -0.64;
  const pommelGem = guardGem.clone();
  pommelGem.scale.setScalar(0.55);
  pommelGem.position.set(0, -0.66, 0.1);

  const runeMaterial = new THREE.MeshBasicMaterial({ color: 0xa46cff, toneMapped: false });
  [0.42, 0.68, 0.94].forEach((runeY, i) => {
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.018 + i * 0.004, 0.095), runeMaterial);
    rune.position.set(i % 2 ? 0.014 : -0.012, runeY, 0.064);
    rune.rotation.z = i % 2 ? 0.48 : -0.48;
    sword.add(rune);
  });

  const gauntletMaterial = new THREE.MeshStandardMaterial({ color: 0x292a34, metalness: 0.68, roughness: 0.42 });
  const swordHand = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25, 0.2), gauntletMaterial);
  palm.position.set(0.03, -0.4, 0.04);
  swordHand.add(palm);
  for (let finger = 0; finger < 3; finger++) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.15, 0.19), gauntletMaterial);
    plate.position.set(-0.065 + finger * 0.068, -0.27, 0.07);
    plate.rotation.z = (finger - 1) * 0.08;
    swordHand.add(plate);
  }
  sword.add(blade, fuller, guardCore, guardGem, grip, pommel, pommelGem, swordHand);
  sword.position.set(0.7, -0.68, -1.35);
  sword.rotation.set(-0.08, 0.04, -0.48);
  camera.add(sword);

  // --- Tocha do player (anexada à câmera) ---
  const playerTorch = new THREE.Group();
  const playerHandle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.075, 1.25, 8),
    new THREE.MeshStandardMaterial({ color: 0x35190d, roughness: 1 }),
  );
  playerHandle.position.y = -0.52;
  const playerCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.09, 0.24, 8), brazierMat);
  playerCollar.position.y = 0.16;
  const playerRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 12), brazierMat);
  playerRing.rotation.x = Math.PI / 2;
  playerRing.position.y = 0.3;
  const playerFlame = createFlame(0.67);
  playerFlame.position.y = 0.62;
  const torchHand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.19), gauntletMaterial);
  torchHand.position.set(0.03, -0.66, 0.03);
  const torchCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.28, 8), gauntletMaterial);
  torchCuff.position.y = -0.9;
  playerTorch.add(playerHandle, playerCollar, playerRing, playerFlame, torchHand, torchCuff);
  playerTorch.position.set(-0.74, -0.44, -1.22);
  playerTorch.rotation.set(0.08, -0.08, 0.2);
  camera.add(playerTorch);
  const playerTorchLight = new THREE.PointLight(0xff6a1f, 10.5, 23, 1.7);
  playerTorchLight.position.set(-0.18, 0.58, -0.05);
  playerTorch.add(playerTorchLight);

  // --- Update loop ---
  function update(time: number, dt: number, moving: boolean, bobTime: number) {
    const elapsed = time;

    // Flicker tochas
    torches.forEach((torch, index) => {
      const flicker = 0.86 + Math.sin(elapsed * (8.4 + index * 0.7)) * 0.1 + Math.sin(elapsed * 19.3 + index) * 0.06;
      torch.flame.scale.set(torch.baseScale * flicker, 0.9 + flicker * 0.23, torch.baseScale * flicker);
      torch.flame.rotation.y = Math.sin(elapsed * 5.2 + index) * 0.16;
      torch.flame.rotation.z = Math.sin(elapsed * 7.7 + index * 0.8) * 0.07;
      torch.glow.intensity = 10 + flicker * 4.2;
    });

    // Flicker tocha do player
    const playerFlicker = 0.88 + Math.sin(elapsed * 10.3) * 0.08 + Math.sin(elapsed * 22.7) * 0.045;
    playerFlame.scale.set(0.67 * playerFlicker, 0.67 * (0.95 + playerFlicker * 0.16), 0.67 * playerFlicker);
    playerFlame.rotation.z = Math.sin(elapsed * 8.4) * 0.06;
    playerTorchLight.intensity = 9.5 + playerFlicker * 3.1;

    // Bob da espada e tocha
    sword.position.y = -0.68 + (moving ? Math.sin(bobTime) * 0.034 : Math.sin(elapsed * 1.3) * 0.009);
    sword.rotation.z = -0.48 + (moving ? Math.cos(bobTime * 0.5) * 0.022 : 0);
    playerTorch.position.y = -0.44 + (moving ? Math.sin(bobTime + Math.PI) * 0.042 : Math.sin(elapsed * 1.15) * 0.012);
    playerTorch.rotation.z = 0.2 + (moving ? Math.cos(bobTime * 0.5 + Math.PI) * 0.026 : Math.sin(elapsed * 0.8) * 0.008);

    // Chuva
    const rainAttr = rainGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < rainCount; i++) {
      let y = rainAttr.getY(i) - dt * (25 + (i % 11));
      let x = rainAttr.getX(i) + dt * 2.1;
      if (y < -1) y = 55 + (i % 9);
      if (x > 76) x = -76;
      rainAttr.setXY(i, x, y);
    }
    rainAttr.needsUpdate = true;
    rain.rotation.y = Math.sin(elapsed * 0.035) * 0.03;

    // Brasas
    const emberAttr = emberGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < emberAttr.count; i++) {
      let y = emberAttr.getY(i) + dt * (0.35 + (i % 7) * 0.08);
      if (y > 8.5) y -= 5.8;
      emberAttr.setY(i, y);
    }
    emberAttr.needsUpdate = true;

    // Nuvens e neblina
    clouds.forEach((cloud, i) => { cloud.position.x += dt * (0.18 + (i % 4) * 0.045); });
    groundMist.forEach((mist, i) => { mist.position.x += Math.sin(elapsed * 0.1 + i) * dt * 0.09; });

    // Vaga-lumes: orbitam suavemente ao redor da origem, piscam
    const fireflyAttr = fireflyGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fireflyCount; i++) {
      const d = fireflyData[i];
      const t = elapsed * d.speed + d.phase;
      fireflyAttr.setX(i, d.origin.x + Math.sin(t) * d.radius);
      fireflyAttr.setY(i, d.origin.y + Math.sin(t * 1.3) * 0.5);
      fireflyAttr.setZ(i, d.origin.z + Math.cos(t) * d.radius);
    }
    fireflyAttr.needsUpdate = true;
    // Pisca os vaga-lumes
    fireflies.material.opacity = 0.5 + Math.sin(elapsed * 3) * 0.4;
  }

  return { group, torches, rain, embers, playerTorchLight, playerFlame, sword, update };
}
