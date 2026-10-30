import { clamp, lerp } from '../core/random';
import type { InputState } from '../core/types';

/**
 * Arcade vehicle state in road space.
 * - `lateral`: metres to the RIGHT of the road centre line (negative = left).
 * - `heading`: yaw relative to the road tangent in radians, positive = pointing right.
 * - `steer`: smoothed steering input in [-1, 1], positive = right.
 */
export interface VehicleState { speed: number; lateral: number; heading: number; steer: number; pitch: number; roll: number; gear: number; }

export const ROAD_LIMIT = 7.2;

export function createVehicle(): VehicleState {
  return { speed: 0, lateral: 0, heading: 0, steer: 0, pitch: 0, roll: 0, gear: 1 };
}

export function stepVehicle(v: VehicleState, input: InputState, dt: number, grip = 1, realistic = false): VehicleState {
  const maxSpeed = realistic ? 58 : 72, throttle = input.throttle, brake = input.brake;
  const accel = throttle * 10 * grip - brake * (realistic ? 24 : 28) - v.speed * .032 - (v.speed * v.speed) * .0012;
  v.speed = clamp(v.speed + accel * dt, 0, maxSpeed);

  // Steering sets a target yaw relative to the road; the car self-aligns when the
  // input is released, so a tap moves it sideways a little rather than forever.
  const speedT = clamp(v.speed / 55, 0, 1);
  v.steer = lerp(v.steer, input.steer, 1 - Math.exp(-dt * 6));
  const maxYaw = lerp(.2, .07, speedT) * (.4 + .6 * grip);
  v.heading = lerp(v.heading, v.steer * maxYaw, 1 - Math.exp(-dt * 3.5));

  v.lateral += Math.sin(v.heading) * v.speed * dt;
  if (Math.abs(v.lateral) >= ROAD_LIMIT) { v.lateral = clamp(v.lateral, -ROAD_LIMIT, ROAD_LIMIT); v.heading *= .5; }

  v.pitch = lerp(v.pitch, (throttle - brake) * .055, 1 - Math.exp(-dt * 6));
  v.roll = lerp(v.roll, -input.steer * .09, 1 - Math.exp(-dt * 4));
  v.gear = v.speed < 1 ? 1 : clamp(Math.floor(v.speed / 11) + 1, 1, 6);
  return v;
}
