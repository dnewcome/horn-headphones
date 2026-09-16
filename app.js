'use strict';
const $=id=>document.getElementById(id);
let params={...Horn.defaults},mesh,yaw=-0.65,pitch=0.2,zoom=1;
const fields=[
  ['Curve & silhouette',[['length','Centerline length',1,'mm'],['diameter','Base diameter',1,'mm'],['curl','Curl',1,'°'],['sweep','3D sweep',1,'°'],['bend','Bend distribution',0.05,''],['taper','Taper exponent',0.05,''],['tip','Tip diameter',0.1,'mm']]],
  ['Facets & twist',[['segments','Lengthwise segments',1,''],['sides','Cross-section sides',1,''],['twist','Cross-section twist',1,'°'],['oval','Oval ratio',0.05,'']]],
  ['Mounting orientation',[['lean','Lean from base normal',1,'°'],['swivel','Swivel around base',1,'°']]]
];
for(const [title,items] of fields){const section=document.createElement('section');section.innerHTML=`<h2>${title}</h2>`;for(const [key,label,step,unit] of items){const [min,max]=Horn.limits[key],div=document.createElement('div');div.className='control';div.innerHTML=`<label for="${key}">${label}<span class="value"><input aria-label="${label} value" id="${key}-number" type="number" min="${min}" max="${max}" step="${step}" value="${params[key]}">${unit}</span></label><input id="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${params[key]}">`;section.append(div);for(const suffix of ['', '-number'])div.querySelector('#'+key+suffix).addEventListener('input',e=>{const value=Number(e.target.value);if(e.target.value===''||!e.target.validity.valid)return;params[key]=value;$(key+(suffix?'':'-number')).value=value;$('shape-name').textContent='Custom shape';rebuild();});} $('controls').append(section);}
for(const name of Object.keys(Horn.presets))$('preset').add(new Option(name,name));
function sync(){for(const key of Object.keys(Horn.limits)){ $(key).value=params[key];$(key+'-number').value=params[key]; }rebuild();}
$('preset').onchange=()=>{params={...Horn.presets[$('preset').value]};$('shape-name').textContent=$('preset').value;sync();};
function rebuild(){const meshType=$('mesh-type').value;$('decimation-controls').hidden=meshType!=='decimated';$('detail-value').textContent=$('detail').value+'%';mesh=Horn.generate({...params,meshType,detail:Number($('detail').value)});const size=Horn.bounds(mesh).size;$('stats').innerHTML=`${mesh.vertices.length} VERTICES / ${$('mesh-type').value!=='quads'?mesh.faces.length+' TRIANGLES':mesh.faces.length+' POLYGONS (QUADS + CAPS)'}<br>${size.map(n=>n.toFixed(1)).join(' × ')} mm · ONE HORN`;$('message').textContent=params.curl>240||params.diameter/params.length>0.35||Math.abs(params.twist)/params.segments>30?'Tight or coarse geometry can intersect itself. Inspect in your slicer before printing.':'';draw();}
const canvas=$('view'),ctx=canvas.getContext('2d');
function draw(){if(!mesh)return;const w=canvas.clientWidth,h=canvas.clientHeight,dpr=devicePixelRatio||1;if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const pair=$('paired').checked,bounds=Horn.bounds(mesh),gap=params.diameter*0.8;
  // Put the original on the right and its mirror on the left, curving outward.
  const models=pair?[{m:mesh,offset:gap},{m:Horn.mirror(mesh),offset:-gap}]:[{m:mesh,offset:0}];
  const all=models.flatMap(({m,offset})=>m.vertices.map(([x,y,z])=>[x+offset,y,z]));
  const min=[0,1,2].map(i=>Math.min(...all.map(v=>v[i]))),max=[0,1,2].map(i=>Math.max(...all.map(v=>v[i]))),center=min.map((v,i)=>(v+max[i])/2);
  const scale=Math.min(w*0.8/Math.max(max[0]-min[0],max[1]-min[1],40),h*0.68/Math.max(max[2]-min[2],60))*zoom;
  const rotate=v=>{const x=v[0]-center[0],y=v[1]-center[1],z=v[2]-center[2],a=x*Math.cos(yaw)-y*Math.sin(yaw),b=x*Math.sin(yaw)+y*Math.cos(yaw);return [a,b*Math.cos(pitch)-z*Math.sin(pitch),b*Math.sin(pitch)+z*Math.cos(pitch)];};
  const project=v=>[w/2+v[0]*scale,h/2-v[2]*scale];
  // Subtle ground grid at the mounting plane.
  ctx.strokeStyle='#72816622';ctx.lineWidth=1;
  const extent=Math.max(params.length,100);
  for(let i=-extent;i<=extent;i+=20)for(const line of [[[i,-extent,0],[i,extent,0]],[[-extent,i,0],[extent,i,0]]]){const [a,b]=line.map(v=>project(rotate(v)));ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}
  const polygons=[];
  for(const {m,offset} of models){const verts=m.vertices.map(([x,y,z])=>rotate([x+offset,y,z]));for(const f of m.faces){const vs=f.map(i=>verts[i]),n=Horn.V.unit(Horn.V.cross(Horn.V.sub(vs[1],vs[0]),Horn.V.sub(vs[2],vs[0])));polygons.push({vs,depth:vs.reduce((s,v)=>s+v[1],0)/vs.length,n});}}
  polygons.sort((a,b)=>b.depth-a.depth);
  for(const {vs,n} of polygons){const light=Math.max(0,Horn.V.dot(n,Horn.V.unit([-0.4,-0.7,1]))),shade=29+light*43;ctx.beginPath();vs.map(project).forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=`hsl(72 22% ${shade}%)`;ctx.fill();if($('edges').checked){ctx.strokeStyle='#152013a6';ctx.lineWidth=0.75;ctx.stroke();}}
}
let drag=null;
canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(!drag)return;yaw+=(e.clientX-drag[0])*0.008;pitch=Math.max(-1.5,Math.min(1.5,pitch+(e.clientY-drag[1])*0.008));drag=[e.clientX,e.clientY];draw();};
canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(0.35,Math.min(4,zoom*Math.exp(-e.deltaY*0.001)));draw();},{passive:false});
$('reset').onclick=()=>{yaw=-0.65;pitch=0.2;zoom=1;draw();};
for(const id of ['paired','edges'])$(id).onchange=draw;
$('mesh-type').onchange=rebuild;
$('detail').oninput=rebuild;
new ResizeObserver(draw).observe(canvas);
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
for(const format of ['stl','obj'])$(format).onclick=()=>{const mirrored=$('right').checked,m=mirrored?Horn.mirror(mesh):mesh;download(`horn-${mirrored?'mirrored':'original'}.${format}`,format==='stl'?Horn.stl(m):Horn.obj(m),'text/plain');};
$('save').onclick=()=>download('horn-settings.json',JSON.stringify({version:1,parameters:params,meshType:$('mesh-type').value,detail:Number($('detail').value)},null,2),'application/json');
$('load').onclick=()=>$('file').click();
$('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.version!==1||!data.parameters)throw Error('Expected Horn Lab settings version 1');const meshType=data.meshType??'quads';if(!['quads','split','triangles','decimated'].includes(meshType))throw Error('Unknown mesh face type');const detail=data.detail??25;const validated=Horn.validate({...data.parameters,meshType,detail});params=validated;$('mesh-type').value=meshType;$('detail').value=detail;$('shape-name').textContent='Loaded shape';sync();}catch(error){$('message').textContent='Could not load settings: '+error.message;}e.target.value='';};
rebuild();
