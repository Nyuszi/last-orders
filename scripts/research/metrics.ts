import { dailyLevel } from '../../src/generator';
import { replay } from '../../src/solver';
const DEG=Math.PI/180;
function gauss(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
for (const date of ['2026-11-22','2026-11-23']) {
  const d=dailyLevel(date); const L=d.level; const sol=d.solution;
  for (let i=0;i<sol.length;i++){
    const pre=sol.slice(0,i), s=sol[i];
    const ok=(sh:any)=>{const r=replay(L,[...pre,sh]); return r.orders[i].served && r.left.size===0 && r.status!=='failed';};
    const t=performance.now(); let sims=0;
    // 1D tolerance windows: walk out from solution
    const win=(f:(x:number)=>any, step:number, max:number)=>{let lo=0,hi=0;for(let x=step;x<=max;x+=step){sims++;if(ok(f(x)))hi=x;else break;}for(let x=step;x<=max;x+=step){sims++;if(ok(f(-x)))lo=x;else break;}return [lo,hi];};
    const aw=win(x=>({...s,angle:s.angle+x*DEG}),0.1,6);
    const pw=win(x=>({...s,power:Math.min(1,Math.max(0.02,s.power*(1+x)))}),0.01,0.5);
    // success prob under 3 noise levels (angle sd deg, rel power sd)
    const res:string[]=[];
    for (const [sa,sp] of [[0.5,0.03],[1,0.06],[2,0.10]]) { let k=0,M=300; for(let m=0;m<M;m++){sims++; if(ok({...s,angle:s.angle+gauss()*sa*DEG,power:Math.min(1,Math.max(0.02,s.power*(1+sp*gauss())))}))k++;} const p=k/M; res.push(`sd(${sa}deg,${sp*100}%):p=${p.toFixed(2)} E[tries]=${p>0?(1/p).toFixed(1):'inf'}`);}
    console.log(`${date} order${i+1} angle window -${aw[0].toFixed(1)}/+${aw[1].toFixed(1)}deg, power window -${(pw[0]*100).toFixed(0)}%/+${(pw[1]*100).toFixed(0)}% | ${res.join(' ')} | ${sims} sims ${(performance.now()-t).toFixed(0)}ms`);
  }
}
