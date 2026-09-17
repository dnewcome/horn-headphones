const assert=require('node:assert/strict');
const {test}=require('node:test');
const H=require('../horn.js');
function check(mesh){
  const edges=new Map();let volume=0;
  for(const f of H.triangles(mesh)){
    const [a,b,c]=f.map(i=>mesh.vertices[i]);
    assert.ok(Math.hypot(...H.V.cross(H.V.sub(b,a),H.V.sub(c,a)))>1e-9,'non-degenerate triangle');
    volume+=H.V.dot(a,H.V.cross(b,c))/6;
    for(let i=0;i<3;i++){const a=f[i],b=f[(i+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');const entry=edges.get(key)||[0,0];entry[0]++;entry[1]+=a<b?1:-1;edges.set(key,entry);}
  }
  for(const [count,balance] of edges.values()){assert.equal(count,2,'closed manifold edges');assert.equal(balance,0,'consistent winding');}
  assert.ok(volume>0,'outward winding');
  assert.equal(mesh.vertices.length-edges.size+H.triangles(mesh).length,2,'sphere topology');
  assert.ok(mesh.vertices.flat().every(Number.isFinite));
}
for(const [name,p] of Object.entries(H.presets))test(name+' closed outward mesh and mirror',()=>{const m=H.generate(p);check(m);check(H.mirror(m));assert.deepEqual(H.bounds(m).size,H.bounds(H.mirror(m)).size);assert.equal(m.vertices.length,(p.segments+1)*p.sides);assert.ok(m.vertices.slice(0,p.sides).every(v=>v[2]===0));});
test('mesh extremes and straight horns remain valid',()=>{for(const sides of [3,24])for(const segments of [4,64])check(H.generate({...H.defaults,sides,segments,curl:0}));});
test('centerline endpoint independent of tessellation',()=>{const a=H.generate({...H.defaults,segments:4}),b=H.generate({...H.defaults,segments:64});assert.deepEqual(a.centers.at(-1),b.centers.at(-1));});
test('exports contain complete geometry',()=>{const m=H.generate(H.defaults),n=H.triangles(m).length;assert.equal(H.stl(m).match(/facet normal/g).length,n);assert.equal(H.obj(m).match(/^v /gm).length,m.vertices.length);assert.equal(H.obj(m).match(/^f /gm).length,m.faces.length);assert.equal(H.obj(m,true).match(/^f /gm).length,n);});
test('reject invalid imported geometry',()=>{for(const p of [{sides:2},{segments:3.5},{length:NaN},{tip:0},{taper:10}])assert.throws(()=>H.generate(p));});
test('mounting orientation preserves flat root and changes silhouette',()=>{const original=H.generate(H.defaults);for(const lean of [-45,45])for(const swivel of [-90,90]){const m=H.generate({...H.defaults,lean,swivel});check(m);assert.ok(m.vertices.slice(0,H.defaults.sides).every(v=>v[2]===0));assert.notDeepEqual(m.centers.at(-1),original.centers.at(-1));}});
test('split triangles preserve quad vertices and diagonals',()=>{const q=H.generate(H.defaults),m=H.generate({...H.defaults,meshType:'split'});assert.deepEqual(q.vertices,m.vertices);assert.deepEqual(H.triangles(q),m.faces);check(m);});
test('triangular lattice resamples positions rather than splitting quads',()=>{const p={...H.defaults,curl:0,sweep:0,twist:0},q=H.generate(p),m=H.generate({...p,meshType:'triangles'});check(m);assert.ok(m.faces.every(f=>f.length===3));assert.notDeepEqual(m.vertices[p.sides],q.vertices[p.sides]);assert.ok(Math.abs(Math.atan2(m.vertices[p.sides][1],m.vertices[p.sides][0])-Math.PI/p.sides)<1e-10);});
for(const [name,p] of Object.entries(H.presets))test(name+' decimated mesh retains manifold and mounting base',()=>{
  const m=H.generate({...p,meshType:'decimated',detail:25});check(m);check(H.mirror(m));
  assert.ok(m.faces.every(f=>f.length===3));assert.ok(m.faces.length<m.sourceFaceCount*0.4);
  const source=H.generate({...p,meshType:'triangles',segments:Math.min(64,p.segments*2),sides:Math.min(24,p.sides*2)});
  const base=source.vertices.slice(0,source.parameters.sides);
  assert.deepEqual(m.vertices.slice(0,base.length),base);
  // Collapsed vertices move off the original rings, giving irregular topology.
  const original=new Set(source.vertices.map(v=>v.join(',')));
  assert.ok(m.vertices.some(v=>!original.has(v.join(','))));
});
test('decimation detail controls density',()=>{const p={...H.defaults,meshType:'decimated'};const coarse=H.generate({...p,detail:10}),fine=H.generate({...p,detail:60});check(coarse);check(fine);assert.ok(coarse.faces.length<fine.faces.length);});
test('corkscrew centerline winds through the specified turns',()=>{
  const p={...H.presets.Corkscrew,turns:2,coilTaper:0,segments:64},m=H.generate(p);
  const angles=m.centers.slice(1).map((v,i)=>{const d=H.V.sub(v,m.centers[i]);return Math.atan2(d[1],d[0]);});
  let rotation=0;for(let i=1;i<angles.length;i++){let d=angles[i]-angles[i-1];while(d>Math.PI)d-=2*Math.PI;while(d< -Math.PI)d+=2*Math.PI;rotation+=d;}
  assert.ok(Math.abs(rotation-4*Math.PI)<0.3,'two full revolutions of centerline tangent');
  assert.ok(m.centers.every((v,i)=>!i||v[2]>m.centers[i-1][2]),'positive helix pitch');
  const coarse=H.generate({...p,segments:16});assert.deepEqual(m.centers.at(-1),coarse.centers.at(-1));
  assert.deepEqual(m.centers,H.generate({...p,twist:180}).centers,'cross-section twist is independent');
});
test('corkscrew works in each topology and legacy settings keep original mode',()=>{
  for(const meshType of ['quads','split','triangles']){const m=H.generate({...H.presets.Corkscrew,meshType});check(m);check(H.mirror(m));}
  const straight=H.generate({...H.presets.Corkscrew,coilAngle:0});assert.ok(straight.centers.every(v=>v[0]===0&&v[1]===0));
  assert.equal(H.validate({length:220}).curveMode,'curl');
  for(const p of [{curveMode:'bad'},{turns:0},{coilAngle:90},{coilTaper:2}])assert.throws(()=>H.generate(p));
});
