export type Biome = 'dunes'|'rock-desert'|'scrubland'|'farmland'|'forest'|'alpine-forest'|'alpine-rock'|'snow';
export type Region = 'Ember Reach'|'Greenmarch'|'Frostspine';
export type Quality = 'low'|'balanced'|'high';
export type Weather = 'clear'|'overcast'|'rain'|'storm'|'fog'|'snow'|'blizzard'|'dust';
export interface Climate { temperature:number; moisture:number; wind:number; elevation:number; weights:Record<Biome,number>; region:Region; }
export interface Settings { quality:Quality; traffic:number; driveSide:'left'|'right'; drivingFeel:'relaxed'|'realistic'; camera:'standard'|'far'|'cinematic'; reduceMotion:boolean; horizonLock:number; metric:boolean; masterVolume:number; engineVolume:number; ambienceVolume:number; music:boolean; autoThrottle:boolean; laneAssist:boolean; cruise:boolean; minimalHud:boolean; noFlashes:boolean; textScale:number; }
export interface InputState { steer:number; throttle:number; brake:number; handbrake:boolean; indicator:number; }
export interface GameState { speed:number; gear:number; distance:number; lap:number; paused:boolean; photoMode:boolean; timeOfDay:number; weather:Weather; fps:number; seed:number; }
export const DEFAULT_SETTINGS:Settings={quality:'balanced',traffic:24,driveSide:'left',drivingFeel:'relaxed',camera:'standard',reduceMotion:false,horizonLock:.65,metric:true,masterVolume:.7,engineVolume:.65,ambienceVolume:.55,music:false,autoThrottle:false,laneAssist:false,cruise:false,minimalHud:false,noFlashes:false,textScale:1};
export const BIOMES:Biome[]=['dunes','rock-desert','scrubland','farmland','forest','alpine-forest','alpine-rock','snow'];
