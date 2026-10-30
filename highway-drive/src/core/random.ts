export function hash32(n:number):number { n|=0; n=Math.imul(n^(n>>>16),0x7feb352d); n=Math.imul(n^(n>>>15),0x846ca68b); return (n^(n>>>16))>>>0; }
export function seeded(seed:number,index:number):number { return hash32((seed|0)^Math.imul(index|0,0x9e3779b1))/4294967296; }
export function smoothstep(a:number,b:number,x:number):number { const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); }
export function lerp(a:number,b:number,t:number):number{return a+(b-a)*t;}
export function clamp(v:number,a:number,b:number):number{return Math.max(a,Math.min(b,v));}
