import type {Biome,Climate} from '../core/types';
import {BIOMES} from '../core/types';
import {clamp,smoothstep} from '../core/random';
import {elevationAt,regionAt,ROUTE_LENGTH} from './route';
export function climateAt(distance:number):Climate {
 const d=((distance%ROUTE_LENGTH)+ROUTE_LENGTH)%ROUTE_LENGTH, elevation=elevationAt(d);
 const desert=1-smoothstep(19000,32000,d); const desertReturn=smoothstep(101000,112000,d); const frost=smoothstep(64000,79000,d)*(1-smoothstep(93000,104000,d));
 const green=Math.max(0,1-desert-desertReturn-frost);
 const altitude=clamp((elevation-550)/1500,0,1); const cold=clamp(frost*.68+altitude*.5,0,1);
 const raw:Record<Biome,number>={dunes:desert*.54, 'rock-desert':desert*.22+desertReturn*.45,scrubland:desert*.24+desertReturn*.55,farmland:green*.52,forest:green*.48*(1-altitude*.7),'alpine-forest':frost*.38+green*altitude*.4,'alpine-rock':frost*.4+altitude*.25,snow:frost*.22+altitude*.45};
 const sum=Object.values(raw).reduce((a,b)=>a+b,0)||1; const weights={} as Record<Biome,number>; for(const b of BIOMES)weights[b]=raw[b]/sum;
 const region=regionAt(d); return {temperature:29-desert*4-cold*28,moisture:clamp(green*.75+frost*.25,0,1),wind:clamp(.25+Math.sin(d/8000)*.18+frost*.28,0,1),elevation,weights,region};
}
export function climateBlend(a:Climate,b:Climate,t:number):Climate {const weights={} as Record<Biome,number>; for(const k of BIOMES)weights[k]=a.weights[k]+(b.weights[k]-a.weights[k])*t; const sum=Object.values(weights).reduce((x,y)=>x+y,0)||1; for(const k of BIOMES)weights[k]/=sum; return {...a,temperature:a.temperature+(b.temperature-a.temperature)*t,moisture:a.moisture+(b.moisture-a.moisture)*t,wind:a.wind+(b.wind-a.wind)*t,elevation:a.elevation+(b.elevation-a.elevation)*t,weights};}
