import * as THREE from 'three';
import { routeAt, offsetFromRoute, elevationAt, ROUTE_LENGTH, ROAD_WIDTH } from './route';
import { climateAt } from './climate';
import { carRouteDistance, createTraffic, stepTraffic, type TrafficCar } from './traffic';
import { clamp, lerp, seeded, smoothstep } from '../core/random';
import { BIOMES, type Biome, type Quality, type Settings } from '../core/types';

/** Length of one road/terrain segment in metres. */
const SEG = 20;
const SEG_COUNT = Math.round(ROUTE_LENGTH / SEG);
/** Segments per InstancedMesh chunk; chunks outside the view frustum are culled. */
const CHUNK = 128;
const GROUND_WIDTH = 1600;
const GROUND_DROP = .3;
const PROP_SPACING = 14;

const GROUND_COLORS: Record<Biome, THREE.Color> = {
  dunes: new THREE.Color('#c9a46e'), 'rock-desert': new THREE.Color('#a9714b'), scrubland: new THREE.Color('#a58b5c'),
  farmland: new THREE.Color('#6f8a4f'), forest: new THREE.Color('#4f6e46'), 'alpine-forest': new THREE.Color('#41594a'),
  'alpine-rock': new THREE.Color('#6e7378'), snow: new THREE.Color('#d5dde2'),
};
const FOLIAGE_COLORS: Record<Biome, THREE.Color> = {
  dunes: new THREE.Color('#b88b55'), 'rock-desert': new THREE.Color('#8f5a3c'), scrubland: new THREE.Color('#8a7a4a'),
  farmland: new THREE.Color('#7a9a54'), forest: new THREE.Color('#3f6b3a'), 'alpine-forest': new THREE.Color('#2f5a45'),
  'alpine-rock': new THREE.Color('#5f6468'), snow: new THREE.Color('#e6edf0'),
};

/** Weighted blend of per-biome colours. */
function mixBiomes(weights: Record<Biome, number>, table: Record<Biome, THREE.Color>, out = new THREE.Color()): THREE.Color {
  out.setRGB(0, 0, 0);
  for (const b of BIOMES) { const c = table[b], w = weights[b]; out.r += c.r * w; out.g += c.g * w; out.b += c.b * w; }
  return out;
}

const CAMERA_RIG: Record<Settings['camera'], { dist: number; height: number }> = {
  standard: { dist: 15, height: 6.3 }, far: { dist: 22, height: 8.5 }, cinematic: { dist: 10.5, height: 3.4 },
};

export interface RenderState {
  distance: number; lateral: number; speed: number; steer: number;
  /** Vehicle yaw relative to the road, positive = pointing right. */
  heading: number;
  /** Seconds of simulation to advance ambient traffic by this frame (0 while paused). */
  dt: number;
  /** Time of day in seconds since midnight. */
  time: number;
  reduceMotion: boolean;
  camera: Settings['camera'];
  /** 1 = clear air; smaller values pull the fog in (weather). */
  visibility: number;
}

export class WorldScene {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(66, 1, .5, 1800);
  renderer: THREE.WebGLRenderer;
  car = new THREE.Group();
  road = new THREE.Group();
  scenery = new THREE.Group();
  traffic = new THREE.Group();

  private quality: Quality = 'balanced';
  private readonly seed = 6359;
  private bg = new THREE.Color('#9fb3bd');
  private fog = new THREE.Fog('#9fb3bd', 120, 850);
  private hemi = new THREE.HemisphereLight('#dce8ee', '#59604e', 2);
  private sun = new THREE.DirectionalLight('#ffe2b2', 2.2);
  private frames: THREE.Matrix4[] = [];
  private trafficCars: TrafficCar[] = [];
  private trafficMeshes: THREE.Group[] = [];
  private trafficShared: { body: THREE.BoxGeometry; cabin: THREE.BoxGeometry; wheel: THREE.CylinderGeometry; materials: THREE.MeshStandardMaterial[]; glass: THREE.MeshStandardMaterial; tyre: THREE.MeshStandardMaterial } | null = null;
  private driveSide: Settings['driveSide'] = 'left';
  private snap = true;
  private fogFar = 850;
  private visibility = 1;
  private readonly white = new THREE.Color('#ffffff');

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.scene.background = this.bg;
    this.scene.fog = this.fog;
    this.scene.add(this.road, this.scenery, this.traffic, this.car, this.hemi, this.sun);
    this.sun.position.set(-100, 180, 80);
    this.buildCar();
    this.buildFrames();
    this.buildRoad();
    this.buildScenery();
    this.resize();
  }

  private mat(color: string, roughness = .85): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness });
  }

  private buildCar(): void {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.05, .62, 4.25), this.mat('#263b43', .42));
    body.position.y = .9;
    this.car.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, .72, 2.05), new THREE.MeshStandardMaterial({ color: '#8da5a9', roughness: .25, metalness: .2 }));
    cabin.position.set(0, 1.48, -.25);
    this.car.add(cabin);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.8, .18, 1.1), this.mat('#344c53', .5));
    hood.position.set(0, 1.22, 1.25);
    this.car.add(hood);
    const wheelGeo = new THREE.CylinderGeometry(.39, .39, .24, 16).rotateZ(Math.PI / 2);
    const wheelMat = this.mat('#15191a', .95);
    for (const x of [-.95, .95]) for (const z of [-1.35, 1.35]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(x, .48, z);
      this.car.add(w);
    }
    const lampMat = new THREE.MeshBasicMaterial({ color: '#fff1c2' });
    for (const x of [-.68, .68]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(.38, .13, .06), lampMat);
      l.position.set(x, 1, 2.14);
      this.car.add(l);
    }
    this.car.rotation.order = 'YXZ';
  }

  /** Pre-compute one local frame (position + yaw + pitch) per road segment. */
  private buildFrames(): void {
    const obj = new THREE.Object3D();
    obj.rotation.order = 'YXZ';
    for (let i = 0; i < SEG_COUNT; i++) {
      const mid = (i + .5) * SEG, p = routeAt(mid);
      const pitch = Math.atan2(elevationAt(mid + SEG / 2) - elevationAt(mid - SEG / 2), SEG);
      obj.position.set(p.x, p.y, p.z);
      obj.rotation.set(-pitch, p.heading, 0);
      obj.updateMatrix();
      this.frames.push(obj.matrix.clone());
    }
  }

  /** One InstancedMesh per CHUNK segments, with `locals.length` instances per segment. */
  private buildLayer(group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, locals: THREE.Matrix4[], colorOf?: (segment: number) => THREE.Color): void {
    const per = locals.length, m = new THREE.Matrix4();
    for (let start = 0; start < SEG_COUNT; start += CHUNK) {
      const n = Math.min(CHUNK, SEG_COUNT - start);
      const mesh = new THREE.InstancedMesh(geometry, material, n * per);
      for (let s = 0; s < n; s++) {
        for (let j = 0; j < per; j++) {
          m.multiplyMatrices(this.frames[start + s], locals[j]);
          mesh.setMatrixAt(s * per + j, m);
          if (colorOf) mesh.setColorAt(s * per + j, colorOf(start + s));
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
  }

  private buildRoad(): void {
    const at = (x: number, y: number) => new THREE.Matrix4().makeTranslation(x, y, 0);
    const asphalt = this.mat('#343b3d', .98);
    const line = new THREE.MeshBasicMaterial({ color: '#d7d1b8' });
    this.buildLayer(this.road, new THREE.BoxGeometry(ROAD_WIDTH, .16, SEG + .6), asphalt, [at(0, -.13)]);
    this.buildLayer(this.road, new THREE.BoxGeometry(.13, .025, SEG + .2), line, [at(-6.2, -.035), at(6.2, -.035)]);
    this.buildLayer(this.road, new THREE.BoxGeometry(.13, .025, 6), line, [at(0, -.025)]);

    // Terrain ribbon that follows the road, tinted by the local climate.
    const ground = new THREE.PlaneGeometry(GROUND_WIDTH, SEG + 8).rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
    const color = new THREE.Color();
    const groundColor = (segment: number) => {
      const d = (segment + .5) * SEG;
      return mixBiomes(climateAt(d).weights, GROUND_COLORS, color).clone();
    };
    this.buildLayer(this.road, ground, groundMat, [at(0, -GROUND_DROP)], groundColor);
  }

  private buildScenery(): void {
    interface Prop { x: number; y: number; z: number; yaw: number; scale: number; color: THREE.Color; }
    const props: Prop[] = [];
    const tmp = new THREE.Color();
    for (let k = 0; k * PROP_SPACING < ROUTE_LENGTH; k++) {
      for (const side of [-1, 1]) {
        const idx = k * 2 + (side > 0 ? 1 : 0);
        const d = k * PROP_SPACING + seeded(this.seed + 4, idx) * PROP_SPACING;
        const w = climateAt(d).weights;
        const density = clamp(.1 + w.forest * .9 + w['alpine-forest'] * .8 + w.farmland * .35 + w.scrubland * .3 + w['rock-desert'] * .15, 0, 1);
        if (seeded(this.seed + 5, idx) > density) continue;
        const p = routeAt(d);
        const lateral = side * (10 + Math.pow(seeded(this.seed + 1, idx), 2.2) * 85);
        const o = offsetFromRoute(p, lateral);
        const dry = w.dunes + w['rock-desert'] + w.scrubland;
        const scale = (.55 + seeded(this.seed + 3, idx) * 1.2) * (1 - dry * .35);
        mixBiomes(w, FOLIAGE_COLORS, tmp);
        tmp.offsetHSL(0, 0, (seeded(this.seed + 6, idx) - .5) * .08);
        props.push({ x: o.x, y: p.y - GROUND_DROP, z: o.z, yaw: seeded(this.seed + 2, idx) * Math.PI * 2, scale, color: tmp.clone() });
      }
    }
    const foliageGeo = new THREE.ConeGeometry(1.5, 7, 6).translate(0, 4.5, 0);
    const trunkGeo = new THREE.CylinderGeometry(.18, .28, 2.2, 5).translate(0, 1, 0);
    const foliageMat = this.mat('#ffffff', 1), trunkMat = this.mat('#51463a');
    const obj = new THREE.Object3D();
    const PER_CHUNK = 600;
    for (let start = 0; start < props.length; start += PER_CHUNK) {
      const n = Math.min(PER_CHUNK, props.length - start);
      const foliage = new THREE.InstancedMesh(foliageGeo, foliageMat, n);
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
      for (let i = 0; i < n; i++) {
        const pr = props[start + i];
        obj.position.set(pr.x, pr.y, pr.z);
        obj.rotation.set(0, pr.yaw, 0);
        obj.scale.setScalar(pr.scale);
        obj.updateMatrix();
        foliage.setMatrixAt(i, obj.matrix);
        trunks.setMatrixAt(i, obj.matrix);
        foliage.setColorAt(i, pr.color);
      }
      for (const mesh of [foliage, trunks]) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        this.scenery.add(mesh);
      }
      if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;
    }
  }

  /** (Re)create the ambient traffic fleet around `playerDistance`. */
  setTraffic(count: number, driveSide: Settings['driveSide'], playerDistance: number): void {
    this.driveSide = driveSide;
    for (const g of this.trafficMeshes) this.traffic.remove(g);
    this.trafficMeshes = [];
    if (!this.trafficShared) {
      const colors = ['#a9b0ad', '#526b76', '#9c674b', '#d4c9a8', '#34444a', '#7f8c68'];
      this.trafficShared = {
        body: new THREE.BoxGeometry(1.8, .72, 3.8), cabin: new THREE.BoxGeometry(1.48, .62, 1.9),
        wheel: new THREE.CylinderGeometry(.3, .3, .18, 10).rotateZ(Math.PI / 2),
        materials: colors.map(c => this.mat(c, .55)), glass: this.mat('#789097', .35), tyre: this.mat('#15191a'),
      };
    }
    const sh = this.trafficShared;
    const n = Math.max(0, Math.min(40, Math.round(count)));
    this.trafficCars = createTraffic(n, this.seed, playerDistance, driveSide);
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(sh.body, sh.materials[i % sh.materials.length]);
      body.position.y = .75;
      const cabin = new THREE.Mesh(sh.cabin, sh.glass);
      cabin.position.set(0, 1.35, -.25);
      g.add(body, cabin);
      for (const x of [-.84, .84]) for (const z of [-1.15, 1.15]) {
        const wheel = new THREE.Mesh(sh.wheel, sh.tyre);
        wheel.position.set(x, .38, z);
        g.add(wheel);
      }
      this.traffic.add(g);
      this.trafficMeshes.push(g);
    }
  }

  private updateTraffic(dt: number, playerDistance: number): void {
    if (dt > 0) stepTraffic(this.trafficCars, dt, playerDistance, this.seed);
    this.trafficCars.forEach((c, i) => {
      const p = routeAt(carRouteDistance(c)), o = offsetFromRoute(p, c.lane), g = this.trafficMeshes[i];
      g.position.set(o.x, p.y, o.z);
      g.rotation.y = p.heading + (c.dir === 1 ? 0 : Math.PI);
    });
  }

  setQuality(q: Quality): void {
    this.quality = q;
    const ratio = q === 'low' ? .65 : q === 'balanced' ? .85 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratio));
    this.fogFar = q === 'low' ? 470 : 850;
  }

  /** Jump the camera straight to its follow position on the next frame (after a teleport/restart). */
  resetCamera(): void { this.snap = true; }

  resize(): void {
    const w = this.renderer.domElement.clientWidth || innerWidth, h = this.renderer.domElement.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(s: RenderState): void {
    const p = routeAt(s.distance);
    const o = offsetFromRoute(p, s.lateral);
    const slope = Math.atan2(elevationAt(s.distance + 2) - elevationAt(s.distance - 2), 4);
    this.car.position.set(o.x, p.y, o.z);
    this.car.rotation.set(-slope, p.heading - s.heading - s.steer * .035, 0);
    this.updateTraffic(s.dt, s.distance);

    const rig = CAMERA_RIG[s.camera];
    const camDist = (s.reduceMotion ? rig.dist * .87 : rig.dist + Math.min(s.speed / 20, 4));
    const target = new THREE.Vector3(o.x - Math.sin(p.heading) * camDist, p.y + rig.height, o.z - Math.cos(p.heading) * camDist);
    if (this.snap) { this.camera.position.copy(target); this.snap = false; }
    else this.camera.position.lerp(target, 1 - Math.exp(-Math.max(s.dt, 1 / 60) * 9));
    this.camera.lookAt(o.x + Math.sin(p.heading) * 8, p.y + 1.2, o.z + Math.cos(p.heading) * 8);

    // Sky, fog and light follow time of day and the local climate.
    const c = climateAt(s.distance), w = c.weights;
    const sunHeight = -Math.cos((s.time / 86400) * Math.PI * 2);
    const day = smoothstep(-.35, .35, sunHeight);
    const warm = clamp(w.dunes + w['rock-desert'] + w.scrubland, 0, 1);
    this.bg.setHSL(lerp(.58, .1, warm * .45), .2 + warm * .08, lerp(.05, .52, day));
    this.fog.color.copy(this.bg);
    this.visibility = lerp(this.visibility, clamp(s.visibility, .2, 1), .02);
    this.fog.near = 120 * this.visibility;
    this.fog.far = this.fogFar * this.visibility;
    this.hemi.intensity = lerp(.55, 2, day);
    this.sun.intensity = lerp(0, 2.2, day);
    this.hemi.color.copy(this.bg).lerp(this.white, .5);

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void { this.renderer.dispose(); }
}
