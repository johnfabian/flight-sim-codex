import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlight, stepFlight, checkpoints, terrainHeight, distanceToSegment, type Input } from '../src/simulation.ts';

const neutral: Input = { pitch:0,roll:0,yaw:0,throttle:0 };
const flying=()=>{const s=createFlight();s.status='flying';return s;};
test('a level flight advances north and preserves altitude at cruise',()=>{
  const s=flying();for(let i=0;i<600;i++)stepFlight(s,neutral,1/60);
  assert.ok(s.position.z < -280);assert.equal(s.position.y,280);assert.equal(s.status,'flying');assert.ok(Math.abs(s.elapsed-10)<1e-8);
});
test('pitch, bank, and rudder change the aircraft in the expected directions',()=>{
  const s=flying();for(let i=0;i<120;i++)stepFlight(s,{...neutral,pitch:1,roll:1},1/60);
  assert.ok(s.position.y>300);assert.ok(s.position.x>5);assert.ok(s.roll<0);
  const rudder=flying();for(let i=0;i<60;i++)stepFlight(rudder,{...neutral,yaw:1},1/60);assert.ok(rudder.position.x<0);
});
test('simulation is approximately consistent across frame rates',()=>{
  const a=flying(),b=flying();
  for(let i=0;i<300;i++)stepFlight(a,{...neutral,pitch:.3,roll:.4},1/30);
  for(let i=0;i<1440;i++)stepFlight(b,{...neutral,pitch:.3,roll:.4},1/144);
  assert.ok(Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y,a.position.z-b.position.z)<3);
});
test('paused, briefing, and completed flights do not advance',()=>{
  for(const status of ['paused','briefing','complete','crashed'] as const){const s=createFlight();s.status=status;const before=structuredClone(s);stepFlight(s,{pitch:1,roll:1,yaw:1,throttle:1},1);assert.deepEqual(s,before);}
});
test('throttle is bounded; a prolonged idle triggers a stall and descent',()=>{
  const s=flying();s.mode='free';s.position.y=1600;
  for(let i=0;i<1500;i++)stepFlight(s,{...neutral,throttle:-1},1/60,()=>-25);
  assert.equal(s.throttle,0);assert.equal(s.stall,true);assert.ok(s.verticalSpeed<0);
  const high=flying();high.throttle=.99;for(let i=0;i<60;i++)stepFlight(high,{...neutral,throttle:1},1/60);assert.equal(high.throttle,1);
});
test('terrain and water contact end a flight',()=>{
  const ocean=flying();ocean.position.y=2;stepFlight(ocean,neutral,1/60);assert.equal(ocean.status,'crashed');
  const land=flying();land.position={x:-1400,y:100,z:-1800};stepFlight(land,neutral,1/60);assert.equal(land.status,'crashed');
});
test('checkpoints are ordered, count once, and produce a completion state',()=>{
  const s=flying();s.position={...checkpoints[2]};stepFlight(s,neutral,1/60,()=>-25);assert.equal(s.checkpoint,0);
  checkpoints.forEach((gate,i)=>{s.position={...gate};stepFlight(s,neutral,1/60,()=>-25);assert.equal(s.checkpoint,i+1);});
  assert.equal(s.status,'complete');assert.equal(s.score,8000);
  const score=s.score;stepFlight(s,neutral,1/60);assert.equal(s.score,score);
});
test('free flight never collects checkpoints',()=>{
  const s=flying();s.mode='free';s.position={...checkpoints[0]};stepFlight(s,neutral,1/60);assert.equal(s.checkpoint,0);
});
test('a ring only counts when passing through its plane, not on approach',()=>{
  const s=flying();s.position={...checkpoints[0],z:checkpoints[0].z+50};stepFlight(s,neutral,1/60);assert.equal(s.checkpoint,0);
  s.position={...checkpoints[0],x:checkpoints[0].x+130};stepFlight(s,neutral,1/60);assert.equal(s.checkpoint,0);
});
test('a continuously steered expedition can finish without crossing terrain',()=>{
  const s=flying();
  for(let i=0;i<60*260&&s.status==='flying';i++){
    const gate=checkpoints[s.checkpoint];
    const dx=gate.x-s.position.x,dz=gate.z-s.position.z,dy=gate.y-s.position.y;
    const desiredHeading=Math.atan2(-dx,-dz);
    const error=Math.atan2(Math.sin(desiredHeading-s.heading),Math.cos(desiredHeading-s.heading));
    const pitch=Math.atan2(dy,Math.max(130,Math.hypot(dx,dz)));
    stepFlight(s,{...neutral,pitch:Math.max(-1,Math.min(1,pitch/.47)),roll:Math.max(-1,Math.min(1,-error*2.5))},1/60);
  }
  assert.equal(s.status,'complete');assert.equal(s.checkpoint,8);
});
test('swept segment distance catches a crossing between frames',()=>{
  assert.equal(distanceToSegment({x:0,y:0,z:0},{x:0,y:0,z:200},{x:0,y:0,z:-200}),0);
  assert.equal(distanceToSegment({x:10,y:0,z:0},{x:0,y:0,z:0},{x:0,y:0,z:0}),10);
});
test('route gates have clearance above procedural terrain',()=>{
  checkpoints.forEach(p=>assert.ok(p.y-terrainHeight(p.x,p.z)>125,`${p.name} is too close to terrain`));
  assert.equal(terrainHeight(-870,-70),13);
});
test('a suspended frame cannot jump the simulation ahead',()=>{
  const s=flying();stepFlight(s,neutral,90);assert.equal(s.elapsed,.05);assert.ok(s.distance<6);
});
