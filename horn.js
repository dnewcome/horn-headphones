(function (root) {
  'use strict';
  const V = {
    add: (a,b) => a.map((x,i)=>x+b[i]), sub: (a,b) => a.map((x,i)=>x-b[i]),
    mul: (a,s) => a.map(x=>x*s), dot: (a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),
    cross: (a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
    unit: a=>{const n=Math.hypot(...a); return a.map(x=>x/n);}
  };
  const defaults = {length:220,diameter:38,segments:18,sides:7,curl:115,sweep:35,twist:30,taper:0.85,bend:1.1,oval:1,tip:1.2,lean:0,swivel:0};
  const presets = {
    'Swept goat': {...defaults},
    'Ram curl': {...defaults,length:210,diameter:42,segments:26,curl:275,sweep:12,bend:0.85,taper:1.1,twist:0},
    'Twisted ibex': {...defaults,length:190,diameter:32,segments:22,curl:55,sweep:130,twist:200,oval:0.75,taper:0.75}
  };
  const limits = {length:[40,300],diameter:[10,70],segments:[4,64],sides:[3,24],curl:[0,320],sweep:[-180,180],twist:[-360,360],taper:[0.4,1.8],bend:[0.5,2.5],oval:[0.5,1.5],tip:[0.5,4],lean:[-45,45],swivel:[-180,180]};
  function validate(input) {
    const p={...defaults,...input};
    for (const [k,[lo,hi]] of Object.entries(limits)) {
      if (!Number.isFinite(p[k]) || p[k]<lo || p[k]>hi) throw Error(`${k} must be between ${lo} and ${hi}`);
    }
    if (!Number.isInteger(p.segments)||!Number.isInteger(p.sides)) throw Error('Mesh counts must be integers');
    p.meshType=p.meshType??'quads';p.detail=p.detail??25;
    if(!['quads','split','triangles','decimated'].includes(p.meshType)) throw Error('Unknown mesh face type');
    if(!Number.isFinite(p.detail)||p.detail<5||p.detail>100) throw Error('Detail must be between 5 and 100');
    return p;
  }
  function generate(input) {
    const p=validate(input), rad=Math.PI/180;
    if(p.meshType==='decimated') {
      const source=generate({...p,meshType:'triangles',segments:Math.min(64,p.segments*2),sides:Math.min(24,p.sides*2)});
      const simplify=typeof module!=='undefined'?require('./decimate.js'):root.HornDecimate;
      const result=simplify(source,Math.round(source.faces.length*p.detail/100),source.parameters.sides);
      return {...result,parameters:p};
    }
    // Ease the lean through the root so the mounting face stays horizontal.
    const orient=([x,y,z],t)=>{const u0=Math.min(1,t/Math.min(0.65,p.diameter*1.5/p.length)),ease=u0*u0*(3-2*u0),a=p.lean*rad*ease,b=p.swivel*rad,u=x*Math.cos(a)+z*Math.sin(a),v=-x*Math.sin(a)+z*Math.cos(a);return [u*Math.cos(b)-y*Math.sin(b),u*Math.sin(b)+y*Math.cos(b),v];};
    const tangent=t=>{const a=p.curl*rad*Math.pow(t,p.bend), b=p.sweep*rad*t; return orient([Math.sin(a)*Math.cos(b),Math.sin(a)*Math.sin(b),Math.cos(a)],t);};
    // Fixed integration resolution keeps the underlying curve independent of mesh density.
    const steps=4096, path=[[0,0,0]];
    for(let i=0;i<steps;i++) path.push(V.add(path[i],V.mul(tangent((i+0.5)/steps),p.length/steps)));
    const at=t=>{const u=t*steps,i=Math.min(steps-1,Math.floor(u));return V.add(path[i],V.mul(V.sub(path[i+1],path[i]),u-i));};
    const vertices=[],faces=[],centers=[];
    const triangular=p.meshType==='triangles';
    const phase=i=>triangular?(i%2)*Math.PI/p.sides:0;
    function connect(i) {
      const a=(i-1)*p.sides,b=i*p.sides;
      for(let j=0;j<p.sides;j++) {
        const k=(j+1)%p.sides;
        if(!triangular) faces.push([a+j,a+k,b+k,b+j]);
        else if(i%2) faces.push([a+j,a+k,b+j],[a+k,b+k,b+j]);
        else faces.push([a+j,a+k,b+k],[a+j,b+k,b+j]);
      }
    }
    let normal=[1,0,0];
    for(let i=0;i<p.segments;i++) {
      const t=i/p.segments, center=at(t), axis=i===0?[0,0,1]:tangent(t);
      normal=V.unit(V.sub(normal,V.mul(axis,V.dot(normal,axis))));
      const binormal=V.cross(axis,normal), radius=p.tip/2+(p.diameter/2-p.tip/2)*Math.pow(1-t,p.taper);
      centers.push(center);
      for(let j=0;j<p.sides;j++) {
        const a=j*2*Math.PI/p.sides+p.twist*rad*t+phase(i);
        vertices.push(V.add(center,V.add(V.mul(normal,radius*Math.cos(a)),V.mul(binormal,radius*p.oval*Math.sin(a)))));
      }
      if(i) connect(i);
    }
    // Small planar tip cap is less fragile than a mathematical point.
    const t=1,center=at(t),axis=tangent(t);
    normal=V.unit(V.sub(normal,V.mul(axis,V.dot(normal,axis))));
    const binormal=V.cross(axis,normal),base=vertices.length;
    for(let j=0;j<p.sides;j++) {const a=j*2*Math.PI/p.sides+p.twist*rad+phase(p.segments);vertices.push(V.add(center,V.add(V.mul(normal,p.tip/2*Math.cos(a)),V.mul(binormal,p.tip/2*p.oval*Math.sin(a)))));}
    connect(p.segments);
    faces.push(Array.from({length:p.sides},(_,j)=>p.sides-1-j));
    faces.push(Array.from({length:p.sides},(_,j)=>base+j));
    centers.push(center);
    return {vertices,faces:p.meshType!=='quads'?triangles({faces}):faces,centers,parameters:p};
  }
  function triangles(mesh){return mesh.faces.flatMap(f=>Array.from({length:f.length-2},(_,i)=>[f[0],f[i+1],f[i+2]]));}
  function mirror(mesh){return {...mesh,vertices:mesh.vertices.map(([x,y,z])=>[-x,y,z]),faces:mesh.faces.map(f=>f.slice().reverse()),centers:mesh.centers.map(([x,y,z])=>[-x,y,z])};}
  function bounds(mesh){const min=[0,1,2].map(i=>Math.min(...mesh.vertices.map(v=>v[i]))),max=[0,1,2].map(i=>Math.max(...mesh.vertices.map(v=>v[i])));return {min,max,size:V.sub(max,min)};}
  function obj(mesh,triangulate=false){return '# Horn Lab; coordinates in millimeters\n'+mesh.vertices.map(v=>'v '+v.join(' ')).join('\n')+'\n'+(triangulate?triangles(mesh):mesh.faces).map(f=>'f '+f.map(i=>i+1).join(' ')).join('\n')+'\n';}
  function stl(mesh){return 'solid horn\n'+triangles(mesh).map(f=>{const [a,b,c]=f.map(i=>mesh.vertices[i]),n=V.unit(V.cross(V.sub(b,a),V.sub(c,a)));return `facet normal ${n.join(' ')}\n outer loop\n${[a,b,c].map(v=>'  vertex '+v.join(' ')).join('\n')}\n endloop\nendfacet`;}).join('\n')+'\nendsolid horn\n';}
  const api={V,defaults,presets,limits,validate,generate,triangles,mirror,bounds,obj,stl};
  if(typeof module!=='undefined') module.exports=api; else root.Horn=api;
})(typeof globalThis!=='undefined'?globalThis:this);
