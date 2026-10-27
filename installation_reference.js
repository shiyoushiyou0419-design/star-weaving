/**
 * 《你为什么画星星？》 V5
 * 用户 2026-10-27 最终提供的“石壁空间里多层立体五角星＋稠密多彩铁丝编织面”参考。
 * 本模块是原创的程序化 3D *近似重建*，不是单张透视图精确反求的模型。
 * 独立于观众创作功能：不会修改、删除、合并访客自己创建的铁丝。
 */
import * as THREE from 'three';
const rng=(function(){let n=20261027;return()=>((n=(n*1664525+1013904223)>>>0)/4294967296)})();
const col=(s)=>new THREE.Color(s);
const MATERIAL=new Map();
const RUST=['#5d3f30','#74513b','#825b41','#533a32','#86634d'];
const STAR_PALETTE=['#c69032','#a74738','#47708e','#717f4e','#79648f','#c48c3b','#a94337','#536e80','#627b63','#aa5641'];
const V=(v)=>new THREE.Vector3(...v);
function mat(hex,metal=.35){let key=hex+'_'+metal;if(!MATERIAL.has(key)) MATERIAL.set(key,new THREE.MeshStandardMaterial({color:hex,roughness:.84,metalness:metal,side:THREE.DoubleSide}));return MATERIAL.get(key);}
function roughColor(c,amount=.11){const v=col(c);v.offsetHSL((rng()-.5)*.016,(rng()-.5)*amount,(rng()-.5)*amount);return '#'+v.getHexString();}
const tubeBaseGeom=new THREE.CylinderGeometry(1,1,1,6,1);
// Thousands of rods are batched into InstancedMesh groups, avoiding a draw call per wire.
const rodBatches=new WeakMap();
const rodMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.85,metalness:.32,side:THREE.DoubleSide});
function rod(group,a,b,r,color){
 const start=V(a),end=V(b),dif=end.clone().sub(start),len=dif.length();if(len<.001)return;
 const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dif.normalize());
 const mid=start.add(end).multiplyScalar(.5),scale=new THREE.Vector3(r,len,r);
 const matrix=new THREE.Matrix4().compose(mid,q,scale);
 let batch=rodBatches.get(group);if(!batch){batch=[];rodBatches.set(group,batch);}
 batch.push({matrix,color});
}
function flushRods(group){
 const batch=rodBatches.get(group);if(!batch?.length)return;
 const mesh=new THREE.InstancedMesh(tubeBaseGeom,rodMaterial,batch.length);
 for(let i=0;i<batch.length;i++){
  mesh.setMatrixAt(i,batch[i].matrix);mesh.setColorAt(i,col(batch[i].color));
 }
 mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
 mesh.computeBoundingSphere();mesh.frustumCulled=false;
 mesh.name='Batched handmade steel wires';group.add(mesh);rodBatches.delete(group);
}
function rope(group,a,b,rad,c,distort=.05){
 let A=V(a),B=V(b),mid=A.clone().lerp(B,.5);
 mid.x+=(rng()-.5)*distort;mid.y+=(rng()-.5)*distort;mid.z+=(rng()-.5)*distort*2;
 rod(group,A.toArray(),mid.toArray(),rad,c);rod(group,mid.toArray(),B.toArray(),rad,c);
}
function between(a,b,t){return [a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t,a[2]*(1-t)+b[2]*t];}
function starRing(R,angle=-Math.PI/2,depth=0){const out=[];for(let i=0;i<10;i++){const a=angle+i*Math.PI/5,rr=(i%2===0?R:R*.455)*(1+.013*(rng()-.5));out.push([Math.cos(a)*rr,Math.sin(a)*rr,depth+.35*Math.sin(i*1.6)]);}return out;}
function starAssembly(root,{x,y,z,r,rot=0,tilt=0,thickness=1,wireFill=1}){
 const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=tilt;group.rotation.z=rot;root.add(group);
 const front=starRing(r,-Math.PI/2,thickness*.48);const back=starRing(r*.92,-Math.PI/2+.045,-thickness*.57);
 const cores=[[0,.0,.64*thickness],[.04,.12,-.7*thickness]];
 // Face-by-face colored lattice, not flat star outlines: hundreds of lengths across triangular facets.
 for(let depth=0;depth<2;depth++){
  let ring=depth===0?front:back,cen=cores[depth];
  for(let i=0;i<10;i++){
   const A=ring[i],B=ring[(i+1)%10],base=STAR_PALETTE[(i+((depth===0)?0:3))%STAR_PALETTE.length];
   const n=Math.max(8,Math.round((r>5.0?19:12)*wireFill));
   // Consecutive tightly spaced cross chords turn triangular sections into actual surfaces.
   for(let k=1;k<=n;k++){
    let t=k/(n+1);
    let l=between(cen,A,t),rr=between(cen,B,t);
    let jitter=(rng()-.5)*.19;
    l[2]+=.13*Math.sin(i+t*9)+jitter;
    rr[2]+=.13*Math.cos(i+t*10)-jitter;
    rope(group,l,rr,Math.max(.012,r*.0029),roughColor(base,.14),.045);
   }
   // A sparse perpendicular weave gives physical depth to the star's woven surfaces.
   for(let k=1;k<=Math.max(4,Math.round(n*.33));k++){
    let t=k/(Math.max(4,Math.round(n*.33))+1);
    rope(group,between(cen,A,t),between(A,B,t),.010,roughColor(base,.08),.095);
   }
   rope(group,cen,A,.034,roughColor(RUST[i%RUST.length]),.12);
   rope(group,A,B,.037,roughColor(STAR_PALETTE[i]),.10);
  }
 }
 // Structural connecting bars make one star a true 3-D frame, rather than a plane.
 for(let i=0;i<10;i++){
  rope(group,front[i],back[i],.027,roughColor(RUST[i%RUST.length]),.16);
  if(i%2===0){rope(group,cores[0],front[i],.037,roughColor(STAR_PALETTE[(i+4)%10]),.13);rope(group,cores[1],back[i],.03,roughColor(STAR_PALETTE[(i+5)%10]),.12);}
 }
 // Tangled short ties, unequal gauges and imperfections at star frame joints.
 for(let i=0;i<10;i++){
  const a=front[i];for(let j=0;j<2;j++){
   const p=[a[0]+(rng()-.5)*.12,a[1]+(rng()-.5)*.12,a[2]+.04];
   const q=[p[0]+(rng()-.5)*.40,p[1]+(rng()-.5)*.38,p[2]+(rng()-.5)*.22];
   rope(group,p,q,.016,roughColor(RUST[(i+j)%RUST.length]),.10);
  }
 }
 flushRods(group);
 return {group,front,back};
}
function coloredTerrain(w,h,sx,sy,materialColors,warp,vertical=true){
 const geo=new THREE.PlaneGeometry(w,h,sx,sy);const p=geo.attributes.position,colors=[];
 const c0=col(materialColors[0]),c1=col(materialColors[1]);
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i);
  const n=(Math.sin(x*2.93+y*1.17)*Math.sin(x*4.13-y*.97)+Math.cos(y*3.25-x*.81)*.51);
  p.setZ(i,n*warp+(rng()-.5)*warp*.55);
  const v=Math.max(0,Math.min(1,.5+.23*n+(.5-rng())*.26));
  let c=c0.clone().lerp(c1,v);colors.push(c.r,c.g,c.b);
 }
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
 return new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide}));
}
function placeRockWall(parent,w,h,x,y,z,rotation=0){const panel=coloredTerrain(w,h,84,56,['#6e665e','#b1a397'],.17);panel.position.set(x,y,z);panel.rotation.y=rotation;parent.add(panel);return panel;}
function track(root,a,b){rod(root,a,b,.025,'#1f221f');}
export function buildReferenceGallery(root){
 // Rough stone cavern, deliberately *not* the bright white industrial hall mistakenly built in V4.
 placeRockWall(root,35,18,0,8.9,-12);
 placeRockWall(root,26,18,-16.7,8.9,0,Math.PI/2);
 placeRockWall(root,26,18,16.7,8.9,0,-Math.PI/2);
 const floor=coloredTerrain(36,27,90,64,['#8d8172','#d5c4af'],.18);floor.rotation.x=-Math.PI/2;floor.position.set(0,-.08,-.1);root.add(floor);
 const ceiling=coloredTerrain(36,27,90,64,['#675f58','#ada096'],.30);ceiling.rotation.x=Math.PI/2;ceiling.position.set(0,17.7,-.1);root.add(ceiling);
 for(const z of [-7,-2.8,1.6,6.6]){track(root,[-13.8,17.25,z],[13.8,17.25,z]);}
 const spotMat=mat('#292e2b',.52),glass=mat('#ead8ab',0);
 for(const x of [-11,-7.2,-2.8,2,7,11])for(const z of [-7.0,.8]){
  const shell=new THREE.Mesh(new THREE.CylinderGeometry(.10,.13,.28,8),spotMat);shell.position.set(x,17.08,z);root.add(shell);
  const glow=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),glass);glow.position.set(x,16.85,z);root.add(glow);
 }
 root.add(new THREE.HemisphereLight(0xfff4e1,0x3c3530,2.6));
 root.add(new THREE.AmbientLight(0xffe9cd,.38));
 let key=new THREE.DirectionalLight(0xffe0b0,2.3);key.position.set(-5,16,8);root.add(key);
 key=new THREE.DirectionalLight(0xc5d2df,1.5);key.position.set(9,13,0);root.add(key);
 // A tire wall on the left is present in the user's chosen reference scene.
 const tireMat=mat('#3a3b39',.08),tireSide=mat('#55534e',.09);
 const tireGeo=new THREE.TorusGeometry(.41,.16,7,17);
 for(let yy=1;yy<=6.2;yy+=.86){let j=0;for(let zz=-10;zz<=7;zz+=.90){
  const tire=new THREE.Mesh(tireGeo,tireMat);tire.position.set(-16.32,yy+(j%2)*.035,zz);tire.rotation.y=Math.PI/2;tire.rotation.x=(rng()-.5)*.10;tire.scale.setScalar(.85+.18*rng());root.add(tire);j++;
 }}
 // The right-side reused-object tower is represented schematically, not presented as an artist-original.
 const mound=new THREE.Group();mound.position.set(11.3,0.0,-3.5);root.add(mound);
 const moundMat=mat('#7a7569',0),bottleMat=[mat('#738778',.2),mat('#a29b87',.1),mat('#515c5d',.25),mat('#9e8070',.1)];
 const solid=new THREE.Mesh(new THREE.ConeGeometry(3.1,6.4,15,6),moundMat);solid.position.y=3.2;mound.add(solid);
 const cylGeo=new THREE.CylinderGeometry(.07,.085,.22,7);
 for(let j=0;j<17;j++){const yy=.45+j*.34,rr=3*(1-yy/6.7);const around=Math.max(9,Math.round(rr*13));for(let i=0;i<around;i++){
  const a=i/around*Math.PI*2+(j%2)*.12;
  const b=new THREE.Mesh(cylGeo,bottleMat[(i+j)%4]);b.position.set(Math.cos(a)*rr,yy,Math.sin(a)*rr);b.rotation.z=(rng()-.5)*.3;mound.add(b);
 }}
 flushRods(root);
}
export function buildReferenceSculpture(root){
 // Main giant filled star: its network *fills the interior* and has strong 3D layering.
 let A=starAssembly(root,{x:-.25,y:7.35,z:-2.2,r:7.3,tilt:.16,thickness:2.4,wireFill:1.04});
 // Interleaved rear stars, each at different angles and depths, provide the user's requested mass.
 let B=starAssembly(root,{x:-5.9,y:9.15,z:-7.3,r:3.4,rot:-.28,tilt:-.57,thickness:1.2,wireFill:.92});
 let C=starAssembly(root,{x:5.9,y:6.35,z:-7.0,r:3.55,rot:.37,tilt:.6,thickness:1.45,wireFill:.93});
 let D=starAssembly(root,{x:-6.65,y:4.65,z:-.8,r:3.25,rot:.51,tilt:.34,thickness:1.15,wireFill:.84});
 let E=starAssembly(root,{x:7.0,y:3.6,z:-2.9,r:2.35,rot:-.58,tilt:-.36,thickness:1.0,wireFill:.8});
 let F=starAssembly(root,{x:1.1,y:6.9,z:-7.4,r:3.75,rot:.21,tilt:.73,thickness:1.05,wireFill:.80});
 // Lower tangled buttresses and inter-star structural links; walk-through voids remain.
 const support=[
  [[-5.2,.04,1.7],[-4.6,2.45,-1.1],[-2.2,5.1,-1.5]],
  [[4.75,.04,1.55],[3.5,2.6,-1.0],[1.7,5.2,-2]],
  [[-7.4,.04,-2.8],[-5.9,2.4,-4.5],[-4.4,5.0,-3.0]],
  [[6.85,.04,-3.4],[6.15,3.2,-4.3],[4.2,5.55,-3.4]],
  [[-2.4,.04,-6.4],[-1.6,3.1,-6.8],[.1,5.6,-5.8]],
  [[3.1,.04,-8.2],[2.7,2.3,-6.9],[.4,4.6,-5.4]],
 ];
 for(let k=0;k<support.length;k++){
  let pts=support[k],base=STAR_PALETTE[[1,3,4,7,0,2][k]];
  for(let j=0;j<5;j++){
   let a=pts[0].map((v,i)=>v+(rng()-.5)*(.5+i*.1));
   let b=pts[1].map((v,i)=>v+(rng()-.5)*.6);
   let c=pts[2].map((v,i)=>v+(rng()-.5)*.5);
   rope(root,a,b,.030,roughColor(base,.10),.25);rope(root,b,c,.023,roughColor(RUST[(k+j)%5]),.23);
  }
 }
 // Bridging star figures with loose weathered wires, not isolated icons.
 for(const [one,two] of [[A,B],[A,C],[A,D],[A,E],[A,F],[B,D],[C,E]]){
  for(let j=0;j<3;j++){
   const i=(j*3+2)%10, k=(j*4+1)%10;
   let aa=one.group.localToWorld(V(one.front[i]).clone()).toArray();
   let bb=two.group.localToWorld(V(two.front[k]).clone()).toArray();
   rope(root,aa,bb,.014,roughColor(STAR_PALETTE[(j+i)%10]),.45);
  }
 }
 flushRods(root);
 root.userData.additionZone={x:[-7.5,7.5],y:[.5,4.8],z:[-8.2,3.2]};
}
