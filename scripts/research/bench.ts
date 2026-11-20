import { dailyLevel } from '../../src/generator';
import { replay } from '../../src/solver';
import { Sim } from '../../src/sim';
const dates = ['2026-11-21','2026-11-22','2026-11-23'];
function gauss(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
for (const date of dates) {
  let t=Date.now(); const d = dailyLevel(date); const gen=Date.now()-t;
  const L=d.level; const sol=d.solution;
  // throughput: replay of first shot only, many times, and steps count
  const N=300; t=performance.now(); let steps=0;
  for(let i=0;i<N;i++){ const s=new Sim(L); s.playShot(sol[0]); steps+=s.tick; }
  const dt=performance.now()-t;
  // noisy agent on first order: angle sd 1deg, power sd 4% relative
  const DEG=Math.PI/180; const M=400; let ok=0; t=performance.now();
  for(let i=0;i<M;i++){ const sh={...sol[0], angle: sol[0].angle+gauss()*1.0*DEG, power: Math.min(1,Math.max(0.05, sol[0].power*(1+0.04*gauss())))}; const s=replay(L,[sh]); if(s.orders[0].served) ok++; }
  const dt2=performance.now()-t;
  console.log(`${date}: gen ${gen}ms, ${L.orders.length} orders, bodies ${new Sim(L).engine.world.bodies.length}; first-shot sim ${(dt/N).toFixed(2)}ms avg (${(steps/N).toFixed(0)} steps, ${(dt*1000/steps).toFixed(1)}us/step) => ${(1000*N/dt).toFixed(0)} shots/s/core; noisy P(serve order1 | sd 1deg,4%) = ${(ok/M).toFixed(2)} in ${(dt2/M).toFixed(2)}ms/sample`);
}
