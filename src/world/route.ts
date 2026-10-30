import { smoothstep } from '../core/random';

/** Length of the closed Grand Circuit in metres of *driven* distance. */
export const ROUTE_LENGTH = 118000;
/** Total road width in metres (matches the deck mesh in the world scene). */
export const ROAD_WIDTH = 13;
/** Lateral offset of a lane centre from the road centre line, in metres. */
export const LANE_OFFSET = 2.1;

export interface RoutePoint {
  x: number;
  z: number;
  y: number;
  /** Compass-style heading: forward vector is (sin(heading), 0, cos(heading)). */
  heading: number;
  /** Signed rate of change of heading per metre (positive turns toward +X). */
  curvature: number;
}

/**
 * Control polygon of the circuit (x, z in arbitrary units; it is rescaled so the
 * closed curve is exactly ROUTE_LENGTH long). The curve is a closed uniform cubic
 * B-spline, so position, heading and curvature are all continuous, including at
 * the lap seam. Distance along the route is true arc length, so one metre of
 * vehicle travel is one metre of road.
 */
const CONTROL: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [420, 150], [1250, -300], [500, -1250], [-450, -1900], [-1550, -1200], [-2100, 100],
  [-1350, 1450], [0, 2200], [1500, 1250], [1900, -200], [900, -1450], [-450, -1500],
];
const N = CONTROL.length;
const SAMPLES_PER_SPAN = 256;

interface Eval { x: number; z: number; dx: number; dz: number; ddx: number; ddz: number; }

function evalSpline(u: number): Eval {
  const span = Math.min(N - 1, Math.max(0, Math.floor(u)));
  const t = u - span, t2 = t * t, t3 = t2 * t;
  const b0 = (1 - t) ** 3 / 6, b1 = (3 * t3 - 6 * t2 + 4) / 6, b2 = (-3 * t3 + 3 * t2 + 3 * t + 1) / 6, b3 = t3 / 6;
  const d0 = -((1 - t) ** 2) / 2, d1 = (3 * t2 - 4 * t) / 2, d2 = (-3 * t2 + 2 * t + 1) / 2, d3 = t2 / 2;
  const e0 = 1 - t, e1 = 3 * t - 2, e2 = -3 * t + 1, e3 = t;
  const p0 = CONTROL[span % N], p1 = CONTROL[(span + 1) % N], p2 = CONTROL[(span + 2) % N], p3 = CONTROL[(span + 3) % N];
  return {
    x: b0 * p0[0] + b1 * p1[0] + b2 * p2[0] + b3 * p3[0],
    z: b0 * p0[1] + b1 * p1[1] + b2 * p2[1] + b3 * p3[1],
    dx: d0 * p0[0] + d1 * p1[0] + d2 * p2[0] + d3 * p3[0],
    dz: d0 * p0[1] + d1 * p1[1] + d2 * p2[1] + d3 * p3[1],
    ddx: e0 * p0[0] + e1 * p1[0] + e2 * p2[0] + e3 * p3[0],
    ddz: e0 * p0[1] + e1 * p1[1] + e2 * p2[1] + e3 * p3[1],
  };
}

// Arc-length table: cumulative chord length at evenly spaced spline parameters.
const TABLE_SIZE = N * SAMPLES_PER_SPAN;
const cumulative = new Float64Array(TABLE_SIZE + 1);
{
  let prev = evalSpline(0);
  for (let i = 1; i <= TABLE_SIZE; i++) {
    const cur = evalSpline(Math.min(i / SAMPLES_PER_SPAN, N - 1e-9));
    cumulative[i] = cumulative[i - 1] + Math.hypot(cur.x - prev.x, cur.z - prev.z);
    prev = cur;
  }
}
const RAW_LENGTH = cumulative[TABLE_SIZE];
/** Metres per control-polygon unit. */
const SCALE = ROUTE_LENGTH / RAW_LENGTH;

function wrap(d: number): number {
  return ((d % ROUTE_LENGTH) + ROUTE_LENGTH) % ROUTE_LENGTH;
}

function paramAt(d: number): number {
  const target = (wrap(d) / ROUTE_LENGTH) * RAW_LENGTH;
  let lo = 0, hi = TABLE_SIZE;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] <= target) lo = mid; else hi = mid;
  }
  const seg = cumulative[hi] - cumulative[lo] || 1;
  return (lo + (target - cumulative[lo]) / seg) / SAMPLES_PER_SPAN;
}

export function routeAt(distance: number): RoutePoint {
  const d = wrap(distance);
  const e = evalSpline(Math.min(paramAt(d), N - 1e-9));
  const speed2 = e.dx * e.dx + e.dz * e.dz;
  const curvature = (e.dz * e.ddx - e.dx * e.ddz) / (Math.pow(speed2, 1.5) * SCALE);
  return { x: e.x * SCALE, z: e.z * SCALE, y: elevationAt(d), heading: Math.atan2(e.dx, e.dz), curvature };
}

/**
 * World position of a point `lateral` metres to the RIGHT of the road centre line
 * (negative = left), as seen by a driver facing along the route.
 */
export function offsetFromRoute(p: Pick<RoutePoint, 'x' | 'z' | 'heading'>, lateral: number): { x: number; z: number } {
  return { x: p.x - Math.cos(p.heading) * lateral, z: p.z + Math.sin(p.heading) * lateral };
}

/** Lane centre (lateral offset) a driver keeps to for the given traffic handedness. */
export function laneCenter(side: 'left' | 'right'): number {
  return side === 'left' ? -LANE_OFFSET : LANE_OFFSET;
}

export function elevationAt(d: number): number {
  const climb = smoothstep(68000, 86000, d), descent = smoothstep(90000, 108000, d);
  return 30 + climb * 1850 - descent * 1800 + Math.sin(d / 9500) * 18;
}

export function regionAt(d: number): 'Ember Reach' | 'Greenmarch' | 'Frostspine' {
  const p = wrap(d);
  if (p < 26000 || p > 103000) return 'Ember Reach';
  if (p < 68000) return 'Greenmarch';
  return 'Frostspine';
}

const PLACES: ReadonlyArray<readonly [number, string]> = [
  [0, 'Dunmarrow'], [6500, 'Redrock Gap'], [14500, 'Tamarisk Wells'], [26000, 'Oxmoor'], [35500, 'Hollin Wood'],
  [47000, 'Port Halvard'], [59000, 'Lake Sorrel / Ketterby'], [70000, 'Skarra Pass'], [81000, 'Kettle Springs'],
  [93000, 'Glass Tarn'], [101000, 'Long Hush Tunnel'],
];

/** Name of the next authored place ahead of route distance `d`. */
export function nextPlace(d: number): string {
  const p = wrap(d);
  return PLACES.find(([at]) => at > p)?.[1] ?? 'Dunmarrow';
}
