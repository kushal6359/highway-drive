import './ui/styles.css';
import { WorldScene } from './world/scene';
import { climateAt } from './world/climate';
import { laneCenter, nextPlace, ROUTE_LENGTH } from './world/route';
import { createVehicle, stepVehicle } from './vehicle/physics';
import { loadSettings, saveSettings } from './systems/storage';
import { AudioEngine } from './systems/audio';
import { clamp, lerp } from './core/random';
import type { InputState, Settings, Weather } from './core/types';

const STEP = 1 / 60;
const TRAFFIC_LEVELS = [0, 12, 24, 40];

const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `<canvas id="game" aria-label="3D highway driving view"></canvas>
<div class="hud hidden" id="hud"><div class="hud-top"><div class="hud-place"><div class="location" id="region">ALDMERE · EMBER REACH</div><div class="weather" id="weather">Clear · 24°C</div></div><div class="hud-actions"><button class="hud-button" id="photo">Photo</button><button class="hud-button" id="pause">Pause</button></div></div><div class="route-progress"><div class="route-label">Grand Circuit · <span id="lap">Lap 1</span></div><div class="route-next" id="next">Dunmarrow</div><div class="progress-track"><div class="progress-fill" id="progress"></div></div></div><div class="speedbox"><div class="speed" id="speed">0</div><div class="speed-unit" id="unit">KM/H</div><div class="gear" id="gear">GEAR 1 · D</div></div></div>
<div class="controls hidden" id="controls"><div class="control-side"><div class="steer-row"><button class="steer" id="left" aria-label="Steer left">‹</button><button class="steer" id="right" aria-label="Steer right">›</button></div></div><div class="control-side"><button class="pedal" id="brake" aria-label="Brake"><small>BRAKE</small></button><button class="pedal accel" id="accelerate" aria-label="Drive"><small>DRIVE</small></button></div></div>
<div id="overlay" class="overlay"><section class="panel" id="menu"><div class="menu-brand">HIGHWAY DRIVE / ALDMERE</div><h1>The road is<br>the destination.</h1><p class="menu-sub">A continuous journey through a country of wide deserts, green valleys and high mountain roads. No score. No rush. Just drive.</p><div class="panel-actions"><button class="primary" id="start">Begin journey</button><button class="secondary" id="setup">Drive settings</button></div><p class="menu-note">A quiet driving experience · Grand Circuit · Offline-ready after first load</p></section></div><div id="toast" class="toast hidden"></div><div id="debug" class="debug hidden"></div>`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('game');
const world = new WorldScene(canvas);
const audio = new AudioEngine();
let settings: Settings = loadSettings();
world.setQuality(settings.quality);
world.setTraffic(settings.traffic, settings.driveSide, 0);

const vehicle = createVehicle();
const input: InputState = { steer: 0, throttle: 0, brake: 0, handbrake: false, indicator: 0 };

let distance = 0, elapsed = 0, last = performance.now(), accumulator = 0;
let paused = true, photo = false, started = false, toastTimer = 0;
let fps = 60, frameCount = 0, fpsTime = 0;
let weather: Weather = 'clear', weatherPeriod = -1;
let currentTime = 7 * 3600 + 30 * 60;
let showDebug = false;

const weatherNames: Record<Weather, string> = { clear: 'Clear', overcast: 'Overcast', rain: 'Light rain', storm: 'Storm', fog: 'Valley mist', snow: 'Snowfall', blizzard: 'Blizzard', dust: 'Dust haze' };
const weatherVisibility: Record<Weather, number> = { clear: 1, overcast: .9, rain: .7, storm: .5, fog: .45, snow: .65, blizzard: .3, dust: .45 };

const hud = $('hud'), controls = $('controls'), overlay = $('overlay');

function toast(message: string): void {
  const el = $('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.add('hidden'), 2200);
}

// ---------------------------------------------------------------- menus

function showMenu(): void {
  paused = true;
  audio.pause();
  releaseInputs();
  controls.classList.add('hidden');
  overlay.classList.remove('hidden');
  $('menu').innerHTML = `<div class="menu-brand">HIGHWAY DRIVE / ALDMERE</div><h1>${started ? 'Take your time.' : 'The road is'}<br>${started ? 'The road will wait.' : 'the destination.'}</h1><p class="menu-sub">${started ? 'Your journey is paused. Resume whenever you are ready.' : 'A continuous journey through a country of wide deserts, green valleys and high mountain roads. No score. No rush. Just drive.'}</p><div class="panel-actions"><button class="primary" id="resume">${started ? 'Resume drive' : 'Begin journey'}</button><button class="secondary" id="setup">Settings</button>${started ? '<button class="secondary" id="exit">Exit to title</button>' : ''}</div><p class="menu-note">Your settings are saved locally on this device.</p>`;
  $('resume').addEventListener('click', () => void begin());
  $('setup').addEventListener('click', showSettings);
  $('exit')?.addEventListener('click', () => {
    started = false;
    distance = 0;
    hud.classList.add('hidden');
    showMenu();
  });
}

function showSettings(): void {
  overlay.classList.remove('hidden');
  $('menu').innerHTML = `<div class="eyebrow">Preferences</div><h2>Drive settings</h2><p>Comfort, performance and driving behaviour. Changes are saved on this device.</p><div class="setup-grid"><div class="field"><label for="quality">Graphics</label><select id="quality"><option value="low">Low · Battery saver</option><option value="balanced">Balanced</option><option value="high">High</option></select></div><div class="field"><label for="feel">Driving feel</label><select id="feel"><option value="relaxed">Relaxed</option><option value="realistic">Realistic</option></select></div><div class="field"><label for="traffic">Traffic density</label><select id="traffic"><option value="0">Empty road</option><option value="12">Light</option><option value="24">Balanced</option><option value="40">Busy</option></select></div><div class="field"><label for="camera">Camera</label><select id="camera"><option value="standard">Standard</option><option value="far">Far</option><option value="cinematic">Cinematic</option></select></div><div class="field"><label for="side">Drive side</label><select id="side"><option value="left">Left-hand traffic</option><option value="right">Right-hand traffic</option></select></div><div class="field"><label for="units">Units</label><select id="units"><option value="metric">km/h</option><option value="imperial">mph</option></select></div></div><div class="setting"><label for="motion">Reduce camera motion</label><input id="motion" type="checkbox"></div><div class="setting"><label for="auto">Auto throttle</label><input id="auto" type="checkbox"></div><div class="setting"><label for="lane">Lane assist</label><input id="lane" type="checkbox"></div><div class="setting"><label for="minimal">Minimal HUD</label><input id="minimal" type="checkbox"></div><div class="setting"><label for="flashes">Disable flashes</label><input id="flashes" type="checkbox"></div><div class="setting"><label for="volume">Master volume</label><input id="volume" type="range" min="0" max="1" step=".05"></div><div class="panel-actions"><button class="primary" id="save">Save settings</button><button class="secondary" id="back">Back</button></div>`;

  const sel = (id: string) => $<HTMLSelectElement>(id);
  const chk = (id: string) => $<HTMLInputElement>(id);
  const nearestTraffic = TRAFFIC_LEVELS.reduce((a, b) => (Math.abs(b - settings.traffic) < Math.abs(a - settings.traffic) ? b : a));
  sel('quality').value = settings.quality;
  sel('feel').value = settings.drivingFeel;
  sel('traffic').value = String(nearestTraffic);
  sel('camera').value = settings.camera;
  sel('side').value = settings.driveSide;
  sel('units').value = settings.metric ? 'metric' : 'imperial';
  chk('motion').checked = settings.reduceMotion;
  chk('auto').checked = settings.autoThrottle;
  chk('lane').checked = settings.laneAssist;
  chk('minimal').checked = settings.minimalHud;
  chk('flashes').checked = settings.noFlashes;
  chk('volume').value = String(settings.masterVolume);

  $('save').addEventListener('click', () => {
    const sideChanged = sel('side').value !== settings.driveSide;
    settings = {
      ...settings,
      quality: sel('quality').value as Settings['quality'],
      drivingFeel: sel('feel').value as Settings['drivingFeel'],
      traffic: Number(sel('traffic').value),
      camera: sel('camera').value as Settings['camera'],
      driveSide: sel('side').value as Settings['driveSide'],
      metric: sel('units').value === 'metric',
      reduceMotion: chk('motion').checked,
      autoThrottle: chk('auto').checked,
      laneAssist: chk('lane').checked,
      minimalHud: chk('minimal').checked,
      noFlashes: chk('flashes').checked,
      masterVolume: Number(chk('volume').value),
    };
    saveSettings(settings);
    world.setQuality(settings.quality);
    world.setTraffic(settings.traffic, settings.driveSide, distance);
    if (sideChanged && started) vehicle.lateral = laneCenter(settings.driveSide);
    audio.setMaster(settings.masterVolume);
    updateHud();
    toast('Settings saved');
    if (started) void begin(); else showMenu();
  });
  $('back').addEventListener('click', showMenu);
}

async function begin(): Promise<void> {
  if (!started) {
    started = true;
    distance = 0;
    Object.assign(vehicle, createVehicle());
    vehicle.lateral = laneCenter(settings.driveSide);
    world.setTraffic(settings.traffic, settings.driveSide, 0);
    world.resetCamera();
  }
  paused = false;
  accumulator = 0;
  last = performance.now();
  overlay.classList.add('hidden');
  hud.classList.remove('hidden');
  controls.classList.remove('hidden');
  (document.activeElement as HTMLElement | null)?.blur();
  try { await audio.start(); } catch { /* Audio is optional; the game stays playable without it. */ }
}

function enterPhoto(): void {
  photo = true;
  hud.classList.add('hidden');
  controls.classList.add('hidden');
  toast('Photo mode · tap or press Escape to return');
}

function exitPhoto(): void {
  photo = false;
  hud.classList.remove('hidden');
  controls.classList.remove('hidden');
  last = performance.now();
  toast('Photo mode closed');
}

$('start').addEventListener('click', () => void begin());
$('setup').addEventListener('click', showSettings);
$('pause').addEventListener('click', showMenu);
$('photo').addEventListener('click', enterPhoto);
canvas.addEventListener('pointerdown', () => { if (photo) exitPhoto(); });

// ---------------------------------------------------------------- input

const keys = new Set<string>();
/** On-screen control state, kept apart from keyboard state so neither overwrites the other. */
const held = { left: false, right: false, accel: false, brake: false };

function releaseInputs(): void {
  keys.clear();
  held.left = held.right = held.accel = held.brake = false;
}

function bindHold(id: string, key: keyof typeof held): void {
  const el = $(id);
  const press = (e: PointerEvent) => {
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch { /* not all pointers can be captured */ }
    held[key] = true;
  };
  const release = (e: Event) => { e.preventDefault(); held[key] = false; };
  el.addEventListener('pointerdown', press);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, release);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
bindHold('left', 'left');
bindHold('right', 'right');
bindHold('accelerate', 'accel');
bindHold('brake', 'brake');

const GAME_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd']);

window.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  // Only claim the keys while driving, so arrows/space still work in the settings form.
  if (!paused && !photo && GAME_KEYS.has(key)) e.preventDefault();
  keys.add(key);
  if (key === 'escape') {
    if (photo) exitPhoto();
    else if (!paused) showMenu();
    else if (started) void begin();
  }
  if (key === 'p') showDebug = !showDebug;
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', releaseInputs);
window.addEventListener('resize', () => world.resize());
document.addEventListener('visibilitychange', () => { if (document.hidden && !paused) showMenu(); });

function pollInput(): void {
  const down = (...names: string[]) => names.some(n => keys.has(n));
  input.steer = clamp((down('a', 'arrowleft') ? -1 : 0) + (down('d', 'arrowright') ? 1 : 0) + (held.left ? -1 : 0) + (held.right ? 1 : 0), -1, 1);
  input.brake = down('s', 'arrowdown', ' ') || held.brake ? 1 : 0;
  input.throttle = down('w', 'arrowup') || held.accel || (settings.autoThrottle && !input.brake) ? 1 : 0;
  const pad = navigator.getGamepads?.()[0];
  if (pad) {
    const axis = pad.axes[0] ?? 0;
    if (Math.abs(axis) > .12) input.steer = clamp(axis, -1, 1);
    input.throttle = Math.max(input.throttle, pad.buttons[7]?.value ?? 0);
    input.brake = Math.max(input.brake, pad.buttons[6]?.value ?? 0);
  }
}

// ---------------------------------------------------------------- simulation

/** Re-roll the weather once per 210 s of driving, weighted by the region we are in. */
function updateWeather(): void {
  const period = Math.floor(elapsed / 210);
  if (period === weatherPeriod) return;
  weatherPeriod = period;
  const region = climateAt(distance).region;
  const roll = Math.abs((Math.sin(period * 12.9898 + 42.2) * 43758.5453) % 1);
  let next: Weather = 'clear';
  if (region === 'Ember Reach') { if (roll > .93) next = 'dust'; else if (roll > .82) next = 'overcast'; }
  else if (region === 'Greenmarch') { if (roll > .88) next = 'rain'; else if (roll > .8) next = 'fog'; else if (roll > .7) next = 'overcast'; }
  else if (roll > .9) next = 'blizzard'; else if (roll > .76) next = 'snow'; else if (roll > .65) next = 'fog';
  weather = next;
}

function stepSimulation(): void {
  const c = climateAt(distance);
  const realistic = settings.drivingFeel === 'realistic';
  const grip = realistic ? clamp(1 - (c.weights.snow + c.weights['alpine-rock']) * .48 - (weather === 'rain' ? .2 : 0), .48, 1) : 1;
  stepVehicle(vehicle, input, STEP, grip, realistic);
  if (settings.laneAssist && Math.abs(input.steer) < .1) vehicle.lateral = lerp(vehicle.lateral, laneCenter(settings.driveSide), .018);
  distance += vehicle.speed * STEP;
  elapsed += STEP;
  // One real second is one game minute, so a full day passes in 24 minutes.
  currentTime = (currentTime + 1) % 86400;
}

function updateHud(): void {
  const c = climateAt(distance);
  $('region').textContent = `ALDMERE · ${c.region.toUpperCase()}`;
  $('weather').textContent = `${weatherNames[weather]} · ${Math.round(c.temperature)}°C`;
  $('speed').textContent = String(Math.round(vehicle.speed * (settings.metric ? 3.6 : 2.23694)));
  $('unit').textContent = settings.metric ? 'KM/H' : 'MPH';
  $('gear').textContent = `GEAR ${vehicle.gear} · D`;
  $('next').textContent = nextPlace(distance);
  $('lap').textContent = `Lap ${Math.floor(distance / ROUTE_LENGTH) + 1}`;
  $('progress').style.width = `${((distance % ROUTE_LENGTH) / ROUTE_LENGTH) * 100}%`;
  // Minimal HUD keeps the speedometer and the pause button (the only way to open the menu by touch).
  hud.classList.toggle('minimal', settings.minimalHud);
}

function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, .05);
  last = now;
  const running = !paused && !photo;
  if (running) {
    accumulator += dt;
    pollInput();
    while (accumulator >= STEP) { stepSimulation(); accumulator -= STEP; }
    updateWeather();
  }
  world.render({
    distance, lateral: vehicle.lateral, speed: vehicle.speed, steer: vehicle.steer, heading: vehicle.heading,
    dt: running ? dt : 0, time: currentTime, reduceMotion: settings.reduceMotion, camera: settings.camera,
    visibility: weatherVisibility[weather],
  });
  frameCount++;
  fpsTime += dt;
  if (fpsTime > 1) { fps = frameCount / fpsTime; frameCount = 0; fpsTime = 0; }
  const debug = $('debug');
  debug.classList.toggle('hidden', !showDebug);
  if (showDebug) debug.textContent = `${fps.toFixed(0)} FPS\n${Math.round(vehicle.speed * 3.6)} KM/H\nSEED 6359\n${climateAt(distance).region}`;
  if (running) {
    updateHud();
    audio.update(vehicle.speed, settings.masterVolume, settings.engineVolume, settings.ambienceVolume);
  }
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- service worker

// Register only in production builds: a cache-first worker in dev serves stale modules.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
  } else {
    // Clean up any worker an earlier build registered on this dev origin.
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => void r.unregister())).catch(() => {});
  }
}
