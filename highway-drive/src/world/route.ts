import { clamp, smoothstep } from '../core/random';
export const ROUTE_LENGTH=118000;
export interface RoutePoint {x:number;z:number;y:number;heading:number;curvature:number;}
const anchors=[
 [0,0,0,0],[9000,420,150,0.000018],[18000,1250,-300,-0.00002],[27000,500,-1250,0.00001],[36000,-450,-1900,0.000025],[45000,-1550,-1200,-0.00002],[54000,-2100,100,0.000015],[63000,-1350,1450,0.000018],[72000,0,2200,-0.00002],[81000,1500,1250,0.000012],[90000,1900,-200,-0.000025],[99000,900,-1450,0.00002],[108000,-450,-1500,-0.000015],[118000,0,0,0]
] as const;
export function routeAt(distance:number):RoutePoint {
 const d=((distance%ROUTE_LENGTH)+ROUTE_LENGTH)%ROUTE_LENGTH; let i=0; while(i<anchors.length-2&&d>anchors[i+1][0])i++;
 const a=anchors[i],b=anchors[i+1],t=(d-a[0])/(b[0]-a[0]); const h=t*t*(3-2*t);
 const x=a[1]+(b[1]-a[1])*h,z=a[2]+(b[2]-a[2])*h;
 const dx=b[1]-a[1],dz=b[2]-a[2],heading=Math.atan2(dx,dz);
 const y=elevationAt(d); return {x,z,y,heading,curvature:clamp((b[3]||0),-.00004,.00004)};
}
export function elevationAt(d:number):number {
 const climb=smoothstep(68000,86000,d), descent=smoothstep(90000,108000,d);
 return 30+climb*1850-descent*1800+Math.sin(d/9500)*18;
}
export function regionAt(d:number):'Ember Reach'|'Greenmarch'|'Frostspine' {
 const p=((d%ROUTE_LENGTH)+ROUTE_LENGTH)%ROUTE_LENGTH;
 if(p<26000||p>103000)return 'Ember Reach'; if(p<68000)return 'Greenmarch'; return 'Frostspine';
}
export function nextPlace(d:number):string {
 const places:[[number,string],...Array<[number,string]>]=[[0,'Dunmarrow'],[6500,'Redrock Gap'],[14500,'Tamarisk Wells'],[26000,'Oxmoor'],[35500,'Hollin Wood'],[47000,'Port Halvard'],[59000,'Lake Sorrel / Ketterby'],[70000,'Skarra Pass'],[81000,'Kettle Springs'],[93000,'Glass Tarn'],[101000,'Long Hush Tunnel']];
 const p=((d%ROUTE_LENGTH)+ROUTE_LENGTH)%ROUTE_LENGTH; return places.find(([at])=>at>p)?.[1]??'Dunmarrow';
}
