import {DEFAULT_SETTINGS,type Settings} from '../core/types';
const KEY='aldmere.settings.v1';
export function loadSettings():Settings {try{const raw=localStorage.getItem(KEY);if(!raw)return {...DEFAULT_SETTINGS};const x=JSON.parse(raw);if(!x||typeof x!=='object')return {...DEFAULT_SETTINGS};return {...DEFAULT_SETTINGS,...x,traffic:Math.max(0,Math.min(40,Number(x.traffic)||18)),masterVolume:Math.max(0,Math.min(1,Number(x.masterVolume)||0)),textScale:Math.max(.8,Math.min(1.5,Number(x.textScale)||1))};}catch{return {...DEFAULT_SETTINGS};}}
export function saveSettings(s:Settings):void {try{localStorage.setItem(KEY,JSON.stringify(s));}catch{/* Private browsing or quota: defaults remain usable. */}}
