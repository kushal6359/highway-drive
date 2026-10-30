import { describe, it, expect } from 'vitest';
import { routeAt, offsetFromRoute, laneCenter, ROUTE_LENGTH, LANE_OFFSET } from '../src/world/route';

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

describe('Route geometry', () => {
  it('uses true arc length: one metre of distance is one metre of road', () => {
    let prev = routeAt(0);
    for (let d = 25; d <= ROUTE_LENGTH; d += 25) {
      const p = routeAt(d);
      const step = Math.hypot(p.x - prev.x, p.z - prev.z);
      expect(step).toBeGreaterThan(24.5);
      expect(step).toBeLessThan(25.5);
      prev = p;
    }
  });

  it('closes the loop with matching position and heading', () => {
    const a = routeAt(0), b = routeAt(ROUTE_LENGTH - 1e-6);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(0.01);
    expect(Math.abs(angleDiff(a.heading, b.heading))).toBeLessThan(1e-6);
  });

  it('turns smoothly (no heading kinks) with gentle highway curves', () => {
    for (let d = 0; d < ROUTE_LENGTH; d += 10) {
      const a = routeAt(d), b = routeAt(d + 10);
      expect(Math.abs(angleDiff(b.heading, a.heading))).toBeLessThan(0.01);
      if (Math.abs(a.curvature) > 1e-9) expect(1 / Math.abs(a.curvature)).toBeGreaterThan(1000);
    }
  });

  it('reports curvature with the sign of the heading change', () => {
    for (let d = 100; d < ROUTE_LENGTH; d += 997) {
      const fd = angleDiff(routeAt(d + 1).heading, routeAt(d - 1).heading) / 2;
      expect(routeAt(d).curvature).toBeCloseTo(fd, 5);
    }
  });

  it('wraps negative and over-length distances', () => {
    const a = routeAt(1234), b = routeAt(1234 + ROUTE_LENGTH), c = routeAt(1234 - ROUTE_LENGTH);
    expect(b.x).toBeCloseTo(a.x, 3);
    expect(c.z).toBeCloseTo(a.z, 3);
  });
});

describe('Road-space offsets', () => {
  it('puts positive lateral on the right of the direction of travel', () => {
    // Facing +Z (heading 0) a driver's right hand is world -X; facing +X it is world +Z.
    const north = offsetFromRoute({ x: 0, z: 0, heading: 0 }, 2);
    expect(north.x).toBeCloseTo(-2);
    expect(north.z).toBeCloseTo(0);
    const east = offsetFromRoute({ x: 0, z: 0, heading: Math.PI / 2 }, 2);
    expect(east.x).toBeCloseTo(0);
    expect(east.z).toBeCloseTo(2);
  });

  it('keeps left-hand traffic in the left lane and right-hand traffic in the right lane', () => {
    expect(laneCenter('left')).toBe(-LANE_OFFSET);
    expect(laneCenter('right')).toBe(LANE_OFFSET);
  });
});
