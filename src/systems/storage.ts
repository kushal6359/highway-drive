import { DEFAULT_SETTINGS, type Settings } from '../core/types';

const KEY = 'aldmere.settings.v1';

const num = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
};
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

/** Validate arbitrary stored data into a complete Settings object; unknown or bad fields fall back to defaults. */
export function sanitizeSettings(x: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (!x || typeof x !== 'object') return { ...d };
  const s = x as Record<string, unknown>;
  return {
    quality: pick(s.quality, ['low', 'balanced', 'high'], d.quality),
    traffic: Math.round(num(s.traffic, 0, 40, d.traffic)),
    driveSide: pick(s.driveSide, ['left', 'right'], d.driveSide),
    drivingFeel: pick(s.drivingFeel, ['relaxed', 'realistic'], d.drivingFeel),
    camera: pick(s.camera, ['standard', 'far', 'cinematic'], d.camera),
    reduceMotion: bool(s.reduceMotion, d.reduceMotion),
    horizonLock: num(s.horizonLock, 0, 1, d.horizonLock),
    metric: bool(s.metric, d.metric),
    masterVolume: num(s.masterVolume, 0, 1, d.masterVolume),
    engineVolume: num(s.engineVolume, 0, 1, d.engineVolume),
    ambienceVolume: num(s.ambienceVolume, 0, 1, d.ambienceVolume),
    music: bool(s.music, d.music),
    autoThrottle: bool(s.autoThrottle, d.autoThrottle),
    laneAssist: bool(s.laneAssist, d.laneAssist),
    cruise: bool(s.cruise, d.cruise),
    minimalHud: bool(s.minimalHud, d.minimalHud),
    noFlashes: bool(s.noFlashes, d.noFlashes),
    textScale: num(s.textScale, .8, 1.5, d.textScale),
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizeSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* Private browsing or quota: defaults remain usable. */ }
}
