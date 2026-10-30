import { seeded } from '../core/random';
import { LANE_OFFSET, ROUTE_LENGTH } from './route';

/**
 * Lightweight deterministic ambient traffic. Cars live on an unwrapped distance
 * axis and are recycled around the player, so a small fleet always feels like a
 * road with traffic on it. There is no collision or car-following yet.
 */
export interface TrafficCar {
  /** Unwrapped route distance in metres (wrap with ROUTE_LENGTH when sampling the route). */
  pos: number;
  /** Speed in m/s along the car's own direction of travel. */
  speed: number;
  /** +1 travels with the player, -1 is oncoming. */
  dir: 1 | -1;
  /** Lateral lane offset (metres to the right of the road centre). */
  lane: number;
  respawns: number;
}

const BEHIND = -250, AHEAD = 1500;

export function createTraffic(count: number, seed: number, playerDistance: number, driveSide: 'left' | 'right'): TrafficCar[] {
  const own = driveSide === 'left' ? -LANE_OFFSET : LANE_OFFSET;
  const cars: TrafficCar[] = [];
  for (let i = 0; i < count; i++) {
    const dir: 1 | -1 = i % 3 === 2 ? -1 : 1;
    cars.push({
      pos: playerDistance + 120 + seeded(seed + 9, i) * 1100,
      speed: 18 + seeded(seed + 10, i) * 18,
      dir,
      lane: dir === 1 ? own : -own,
      respawns: 0,
    });
  }
  return cars;
}

export function stepTraffic(cars: TrafficCar[], dt: number, playerDistance: number, seed: number): void {
  cars.forEach((c, i) => {
    c.pos += c.dir * c.speed * dt;
    const rel = c.pos - playerDistance;
    if (rel >= BEHIND && rel <= AHEAD) return;
    const r = seeded(seed + 11, i * 7919 + c.respawns++);
    if (c.dir === 1) c.pos = rel < BEHIND ? playerDistance + 450 + r * 900 : playerDistance - 120 - r * 120;
    else c.pos = playerDistance + 600 + r * 800;
  });
}

/** Route distance (wrapped) to sample for drawing a car. */
export function carRouteDistance(c: TrafficCar): number {
  return ((c.pos % ROUTE_LENGTH) + ROUTE_LENGTH) % ROUTE_LENGTH;
}
