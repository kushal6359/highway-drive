import {clamp,lerp} from '../core/random';
import type {InputState} from '../core/types';
export interface VehicleState {speed:number; lateral:number; heading:number; steer:number; pitch:number; roll:number; gear:number;}
export function createVehicle():VehicleState{return {speed:0,lateral:0,heading:0,steer:0,pitch:0,roll:0,gear:1};}
export function stepVehicle(v:VehicleState,input:InputState,dt:number,grip=1,realistic=false):VehicleState {
 const maxSpeed=realistic?58:72, throttle=input.throttle, brake=input.brake;
 const accel=throttle*10*grip-brake*(realistic?24:28)-v.speed*.032-(v.speed*v.speed)*.0012;
 v.speed=clamp(v.speed+accel*dt,0,maxSpeed);
 const steerLimit=lerp(1.35,.42,clamp(v.speed/55,0,1)); const target=input.steer*steerLimit;
 v.steer=lerp(v.steer,target,1-Math.exp(-dt*5)); v.heading+=v.steer*v.speed*.013*dt;
 v.lateral+=Math.sin(v.heading)*v.speed*dt; v.lateral=clamp(v.lateral,-7.2,7.2);
 v.pitch=lerp(v.pitch,(throttle-brake)*.055,1-Math.exp(-dt*6)); v.roll=lerp(v.roll,-input.steer*.09,1-Math.exp(-dt*4));
 v.gear=v.speed<1?1:clamp(Math.floor(v.speed/11)+1,1,6); return v;
}
