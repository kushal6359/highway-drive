import { describe, it, expect } from 'vitest';
import { sanitizeSettings } from '../src/systems/storage';
import { DEFAULT_SETTINGS } from '../src/core/types';
import { createVehicle, stepVehicle, ROAD_LIMIT } from '../src/vehicle/physics';
import { createTraffic, stepTraffic } from '../src/world/traffic';

const idle = { steer: 0, throttle: 0, brake: 0, handbrake: false, indicator: 0 };

describe('Settings validation', () => {
  it('returns defaults for missing or malformed data', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps an empty road and a muted volume instead of resetting them', () => {
    const s = sanitizeSettings({ traffic: 0, masterVolume: 0 });
    expect(s.traffic).toBe(0);
    expect(s.masterVolume).toBe(0);
  });

  it('does not mute the game when the stored volume is missing', () => {
    expect(sanitizeSettings({ traffic: 12 }).masterVolume).toBe(DEFAULT_SETTINGS.masterVolume);
  });

  it('clamps numbers and rejects unknown enum values', () => {
    const s = sanitizeSettings({ traffic: 999, masterVolume: -3, quality: 'ultra', camera: 'far', driveSide: 'up', textScale: 9 });
    expect(s.traffic).toBe(40);
    expect(s.masterVolume).toBe(0);
    expect(s.quality).toBe(DEFAULT_SETTINGS.quality);
    expect(s.camera).toBe('far');
    expect(s.driveSide).toBe(DEFAULT_SETTINGS.driveSide);
    expect(s.textScale).toBe(1.5);
  });
});

describe('Vehicle steering', () => {
  it('steers right for positive input (positive lateral = right of the road)', () => {
    const v = createVehicle();
    v.speed = 25;
    for (let i = 0; i < 60; i++) stepVehicle(v, { ...idle, throttle: 1, steer: 1 }, 1 / 60);
    expect(v.lateral).toBeGreaterThan(0);
    expect(v.heading).toBeGreaterThan(0);
  });

  it('self-aligns after the steering input is released', () => {
    const v = createVehicle();
    v.speed = 25;
    for (let i = 0; i < 20; i++) stepVehicle(v, { ...idle, throttle: 1, steer: 1 }, 1 / 60);
    for (let i = 0; i < 300; i++) stepVehicle(v, { ...idle, throttle: 1 }, 1 / 60);
    expect(Math.abs(v.heading)).toBeLessThan(0.005);
    const settled = v.lateral;
    for (let i = 0; i < 60; i++) stepVehicle(v, { ...idle, throttle: 1 }, 1 / 60);
    expect(Math.abs(v.lateral - settled)).toBeLessThan(0.5);
    expect(Math.abs(v.lateral)).toBeLessThan(ROAD_LIMIT);
  });
});

describe('Ambient traffic', () => {
  it('is deterministic for a seed', () => {
    expect(createTraffic(10, 6359, 0, 'left')).toEqual(createTraffic(10, 6359, 0, 'left'));
  });

  it('puts same-direction traffic in the drive-side lane and oncoming traffic opposite', () => {
    for (const side of ['left', 'right'] as const) {
      for (const c of createTraffic(12, 6359, 0, side)) {
        const own = side === 'left' ? -2.1 : 2.1;
        expect(c.lane).toBe(c.dir === 1 ? own : -own);
      }
    }
  });

  it('keeps the fleet around the player however far they drive', () => {
    const cars = createTraffic(20, 6359, 0, 'left');
    let player = 0;
    for (let i = 0; i < 60 * 600; i++) {
      player += 50 / 60;
      stepTraffic(cars, 1 / 60, player, 6359);
    }
    for (const c of cars) {
      expect(c.pos - player).toBeGreaterThanOrEqual(-250 - 40);
      expect(c.pos - player).toBeLessThanOrEqual(1500 + 40);
    }
  });

  it('lets the player overtake slower cars', () => {
    const cars = createTraffic(1, 6359, 0, 'left').map(c => ({ ...c, dir: 1 as const, speed: 20, pos: 200 }));
    let player = 0, passed = false;
    for (let i = 0; i < 60 * 60 && !passed; i++) {
      player += 40 / 60;
      stepTraffic(cars, 1 / 60, player, 6359);
      if (cars[0].pos < player && cars[0].respawns === 0) passed = true;
    }
    expect(passed).toBe(true);
  });
});
