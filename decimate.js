(function(root){
  'use strict';
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const normal=(a,b,c)=>cross(sub(b,a),sub(c,a));
  const add=(a,b)=>a.map((v,i)=>v+b[i]);
  function error(q,p){const v=[...p,1];let sum=0;for(let i=0;i<4;i++)for(let j=0;j<4;j++)sum+=v[i]*q[i*4+j]*v[j];return Math.max(0,sum);}
  function optimum(q){
    const rows=[0,1,2].map(i=>[q[i*4],q[i*4+1],q[i*4+2],-q[i*4+3]]);
    for(let i=0;i<3;i++){
      let pivot=i;for(let j=i+1;j<3;j++)if(Math.abs(rows[j][i])>Math.abs(rows[pivot][i]))pivot=j;
      if(Math.abs(rows[pivot][i])<1e-10)return null;
      [rows[i],rows[pivot]]=[rows[pivot],rows[i]];
      const scale=rows[i][i];for(let k=i;k<4;k++)rows[i][k]/=scale;
      for(let j=0;j<3;j++)if(j!==i){const f=rows[j][i];for(let k=i;k<4;k++)rows[j][k]-=f*rows[i][k];}
    }
    const p=rows.map(r=>r[3]);return p.every(Number.isFinite)?p:null;
  }
  function decimate(mesh,target,ringSize){
    const vertices=mesh.vertices.map(v=>v.slice());let faces=mesh.faces.map(f=>f.slice());
    const quadrics=vertices.map(()=>Array(16).fill(0));
    // Keep the mounting perimeter, tip perimeter and their planar caps intact.
    const locked=vertices.map((_,i)=>i<ringSize||i>=vertices.length-ringSize);
    for(const f of faces){const [a,b,c]=f.map(i=>vertices[i]),n=normal(a,b,c),length=Math.hypot(...n),unit=n.map(v=>v/length),plane=[...unit,-dot(unit,a)];for(const index of f)for(let i=0;i<4;i++)for(let j=0;j<4;j++)quadrics[index][i*4+j]+=plane[i]*plane[j];}
    const sourceFaceCount=faces.length;
    while(faces.length>target){
      const neighbors=vertices.map(()=>new Set()),incident=vertices.map(()=>[]),edges=new Map();
      faces.forEach((f,fi)=>{for(const v of f)incident[v].push(fi);for(let i=0;i<3;i++){const a=f[i],b=f[(i+1)%3];neighbors[a].add(b);neighbors[b].add(a);const lo=Math.min(a,b),hi=Math.max(a,b);edges.set(lo*vertices.length+hi,[lo,hi]);}});
      let best=null;
      for(const [a,b] of edges.values()){
        if(locked[a]||locked[b])continue;
        const q=add(quadrics[a],quadrics[b]),mid=vertices[a].map((v,i)=>(v+vertices[b][i])/2),solution=optimum(q);
        const choices=[vertices[a],vertices[b],mid];if(solution)choices.push(solution);
        let point=choices[0],cost=Infinity;
        for(const p of choices){const value=error(q,p);if(value<cost){cost=value;point=p;}}
        // A tiny length penalty resolves planar ties without random perturbation.
        const delta=sub(vertices[a],vertices[b]);cost+=dot(delta,delta)*1e-5;
        if(best&&cost>=best.cost)continue;
        let shared=0;for(const v of neighbors[a])if(neighbors[b].has(v))shared++;
        if(shared!==2)continue; // Manifold edge-collapse link condition.
        const affected=new Set([...incident[a],...incident[b]]);let valid=true;
        for(const fi of affected){const f=faces[fi];if(f.includes(a)&&f.includes(b))continue;const old=f.map(i=>vertices[i]),next=f.map(i=>i===a||i===b?point:vertices[i]);const n0=normal(...old),n1=normal(...next),l0=Math.hypot(...n0),l1=Math.hypot(...n1);
          if(l1<1e-9||dot(n0,n1)<0.2*l0*l1){valid=false;break;}
        }
        if(valid)best={a,b,point,cost,q};
      }
      if(!best)break;
      const {a,b,point,q}=best;vertices[a]=point.slice();quadrics[a]=q;
      faces=faces.filter(f=>!(f.includes(a)&&f.includes(b))).map(f=>f.map(i=>i===b?a:i));
    }
    const used=[...new Set(faces.flat())].sort((a,b)=>a-b),remap=new Map(used.map((v,i)=>[v,i]));
    return {...mesh,vertices:used.map(i=>vertices[i]),faces:faces.map(f=>f.map(i=>remap.get(i))),sourceFaceCount,targetFaceCount:target};
  }
  if(typeof module!=='undefined')module.exports=decimate;else root.HornDecimate=decimate;
})(typeof globalThis!=='undefined'?globalThis:this);
