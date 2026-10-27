// 《你为什么画星星？》数字编织 V6 — 继承 V5 真实三维星网展厅 + 匿名云端协作
// 依赖 CDN Three.js 0.180.0；必须通过 Live Server 或 HTTP(s) 打开。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildReferenceGallery, buildReferenceSculpture } from './installation_reference.js';
import { connectCloud, isCloudConfigured } from './cloud.js';

const $ = id => document.getElementById(id);
const COLORS = [['朱红','#ed6255'],['橙','#f3a14a'],['黄','#f4d15b'],['薄荷绿','#62cb9a'],['湖蓝','#45b8db'],['钴蓝','#6f7fec'],['紫','#b48bdf'],['玫红','#ea80b4'],['银白','#f0ebdc']];
const STORAGE_V3 = 'yuzhenli_weave_v3_local';
const STORAGE_V2 = 'yuzhenli_weave_v2_local';
const MAX_STROKES = 18, MAX_POINTS_PER_STROKE = 300, MAX_WORKS = 80;
const ANCHORS = [new THREE.Vector3(-2.55,1.92,0.56),new THREE.Vector3(0,1.42,0.85),new THREE.Vector3(2.54,1.95,0.63)]; // 旧装置临时造型的参考点，观众作品不依赖锚点。
const state = { color:COLORS[0][1],thickness:5,depth:0,studioMode:'draw',drawing:false,active:[],draft:[],works:[],selected:null,transformMode:'translate',ready:false };
const stageEl=$('stage'), studioEl=$('studio');
let stageRenderer,stageScene,stageCamera,stageOrbit,transformControls,oldWires,spaceRoot,installationRoot,visitorRoot;
let studioRenderer,studioScene,studioCamera,studioOrbit,workplane,grid,studioDraftRoot,liveLine;
const pickRay=new THREE.Raycaster(), studioRay=new THREE.Raycaster(), studioPlane=new THREE.Plane();
const workGroups=new Map();
const remoteWorks=new Map();   // 其他访客的作品，仅供查看；不写入本地备份。
const CLOUD_PUBLISHED_KEY='yuzhenli_weave_v6_published_ids';
let savedPublished=[];
try{savedPublished=JSON.parse(localStorage.getItem(CLOUD_PUBLISHED_KEY)||'[]');}catch(e){}
const cloudKnown=new Set(Array.isArray(savedPublished)?savedPublished.filter(isUUID):[]); // 离线也能识别已发布的作品。
function rememberPublished(id){cloudKnown.add(id);try{localStorage.setItem(CLOUD_PUBLISHED_KEY,JSON.stringify([...cloudKnown].slice(-300)));}catch(e){}}
function forgetPublished(id){cloudKnown.delete(id);try{localStorage.setItem(CLOUD_PUBLISHED_KEY,JSON.stringify([...cloudKnown].slice(-300)));}catch(e){}}
const publishing=new Set();
const cloudTimers=new Map();
let cloud=null, cloudReady=false, cloudLoading=false;
function isUUID(id){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'');}
function ownWork(id){return state.works.find(w=>w.id===id);}
function cloudStatus(message){const el=$('cloudStatus');if(el)el.textContent=message;}
function updateMode(){
 $('saveMode').textContent=cloudReady?'云端共享已连接 · 自动读取公共作品':(isCloudConfigured(config)?'云端连接中／失败 · 本机仍可创作':'本机创作 · 尚未填写 Supabase 配置');
 $('syncLocal').disabled=!cloudReady;
 $('refreshCloud').disabled=!cloudReady;
 updateCounter();
}

const ndc=new THREE.Vector2();
let stageDown=null, lastStatus='';
const config=window.WEAVE_CONFIG || {};
function status(message,error=false){lastStatus=message;const el=$('status');el.textContent=message;el.style.color=error?'#ffc0a9':'#e3e9dd';}
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
function round(n){return Number(n.toFixed(4));}
function uid(){return (crypto?.randomUUID?.() || `wire_${Date.now()}_${Math.random().toString(36).slice(2)}`);}
function rnd(seed){let x=seed>>>0;return ()=>((x=(1664525*x+1013904223)>>>0)/4294967296);}
function safeNum(n){return typeof n==='number' && Number.isFinite(n);}
function finiteVec(arr,n=3){return Array.isArray(arr)&&arr.length===n&&arr.every(safeNum);}
function validStroke(s){return !!s&&/^#[0-9a-f]{6}$/i.test(s.color||'')&&Number.isInteger(s.thickness)&&s.thickness>=2&&s.thickness<=9&&Array.isArray(s.points)&&s.points.length>=2&&s.points.length<=MAX_POINTS_PER_STROKE&&s.points.every(p=>finiteVec(p)&&Math.abs(p[0])<=4&&Math.abs(p[1])<=3&&Math.abs(p[2])<=2);}
function validWork(w){return !!w&&typeof w.id==='string'&&w.id.length<90&&Array.isArray(w.strokes)&&w.strokes.length>=1&&w.strokes.length<=MAX_STROKES&&w.strokes.every(validStroke)&&w.transform&&finiteVec(w.transform.position)&&finiteVec(w.transform.rotation)&&finiteVec(w.transform.scale)&&w.transform.position.every(x=>Math.abs(x)<40)&&w.transform.rotation.every(x=>Math.abs(x)<60)&&w.transform.scale.every(x=>x>0.04&&x<6);}
function dispose(obj){obj.traverse(o=>{o.geometry?.dispose?.();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}
function clearGroup(g){while(g.children.length){const ch=g.children[0];g.remove(ch);dispose(ch);}}
function createTube(points,color,thickness,old=false){
 const vertices=points.map(p=>p instanceof THREE.Vector3?p:new THREE.Vector3(...p));
 if(vertices.length<2)return null;
 const curve=new THREE.CatmullRomCurve3(vertices,false,'centripetal');
 const tubularSegments=clamp(Math.ceil(vertices.length*1.45),15,380);
 const geom=new THREE.TubeGeometry(curve,tubularSegments,old?thickness:(.012+thickness*.0045),7,false);
 const mat=new THREE.MeshStandardMaterial({color,roughness:old?.92:.28,metalness:old?.46:.39});
 return new THREE.Mesh(geom,mat);
}
function makeRenderer(element){const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setPixelRatio(Math.min(devicePixelRatio||1,1.7));r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.35;element.prepend(r.domElement);return r;}
function watchSize(el,renderer,camera){function fit(){const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}new ResizeObserver(fit).observe(el);fit();}

// V4 的新空间和固定钢丝装置独立放在 installation_reference.js。
// 观众自行绘制的几何物始终独立存储，切换基本装置不会删掉创作。
function addSpace(){ buildReferenceGallery(spaceRoot); }
function addOldWires(){
 oldWires = new THREE.Group();
 oldWires.name='REFERENCE GALLERY COLORED STEEL WIRE INSTALLATION';
 installationRoot.add(oldWires);
 buildReferenceSculpture(oldWires);
}

async function loadOptionalModels(){
 const loader=new GLTFLoader();
 const tasks=[['galleryModelUrl',spaceRoot,'场馆'],['installationModelUrl',installationRoot,'基础装置']];
 for(const [key,root,name] of tasks){
   const url=typeof config[key]==='string'?config[key].trim():'';
   if(!url)continue;
   try {
     const gltf=await loader.loadAsync(url);
     // 保留展馆灯光、相机与观众作品；仅替换相应的占位模型。
     clearGroup(root);
     root.add(gltf.scene);
     if(root===spaceRoot){ // 占位场馆灯光一起移除后补光
       stageScene.add(new THREE.HemisphereLight(0xf0f1eb,0x5b524a,2));
       const keyLight=new THREE.DirectionalLight(0xfff0e0,2.4);keyLight.position.set(-5,10,8);stageScene.add(keyLight);
     }
     status(`已载入正式${name} GLB 模型。可以继续创作，观众铁丝与场馆模型相互独立。`);
   } catch(err){console.warn('GLB loading failed',url,err);status(`${name}模型加载失败，继续使用占位场景：${String(err.message||err).slice(0,70)}`,true);}
 }
}
function createInstallationWork(work){
 const g=new THREE.Group();g.name='visitor work '+work.id;g.userData.workId=work.id;
 for(const stroke of work.strokes){
   const pts=stroke.points.map(p=>new THREE.Vector3(p[0]*.78,p[1]*.78,p[2]*.78));
   const mesh=createTube(pts,stroke.color,stroke.thickness);
   if(mesh){mesh.userData.workId=work.id;g.add(mesh);}
 }
 g.position.fromArray(work.transform.position);g.rotation.fromArray([...work.transform.rotation,'XYZ']);g.scale.fromArray(work.transform.scale);
 visitorRoot.add(g);workGroups.set(work.id,g);return g;
}
function updateCounter(){
 const n=state.works.length+remoteWorks.size;
 $('wireCount').textContent=cloudReady?`${n} 组可见作品 · ${state.works.length} 组归当前浏览器管理`:`${state.works.length} 组本机作品`;
}
function removeSceneObject(id){
 const group=workGroups.get(id);
 if(!group)return;
 visitorRoot.remove(group);dispose(group);workGroups.delete(id);
}
function swapIdToUUID(w){
 if(isUUID(w.id))return;
 const previous=w.id;const next=uid();
 if(!isUUID(next))throw Error('当前网页环境不能安全生成 UUID，请通过 Live Server/HTTPS 打开。');
 const group=workGroups.get(previous);
 if(group){
   workGroups.delete(previous);workGroups.set(next,group);group.name='visitor work '+next;
   group.userData.workId=next;group.traverse(o=>{if(o.userData?.workId===previous)o.userData.workId=next;});
 }
 if(state.selected===previous)state.selected=next;
 w.id=next;saveWorks();
}
async function publishOwned(w,silent=false){
 if(!cloudReady||!cloud||!w||publishing.has(w.id))return false;
 try{
  swapIdToUUID(w);
  publishing.add(w.id);
  // 仅保存 3D 路径、颜色、粗细和变换；不会上传观众姓名与浏览器本地内容。
  await cloud.save(w,cloudKnown.has(w.id));
  rememberPublished(w.id);
  if(!silent)status('作品已经发布到云端！其他观众将看到它。以后仍可在本机调整它的位置。');
  void refreshShared();return true;
 }catch(error){
  const code=String(error.code||'');
  if(code==='23505'&&!cloudKnown.has(w.id)){
   // 可能因断网后重试而插入同一个 ID；只允许更新当前账号自己的行。
   rememberPublished(w.id);
   publishing.delete(w.id);
   return publishOwned(w,silent);
  }
  status(`云端提交失败，本机作品保留：${error.message||error}`,true);
  return false;
 }finally{publishing.delete(w.id);}
}
function scheduleCloudUpdate(id){
 if(!cloudReady||!cloudKnown.has(id))return;
 clearTimeout(cloudTimers.get(id));
 cloudTimers.set(id,setTimeout(()=>{
  cloudTimers.delete(id);
  const w=ownWork(id);if(w)void publishOwned(w,true);
 },650));
}
function renderCloudRow(row){
 if(!row||!isUUID(row.id))return null;
 const work={id:row.id,strokes:row.strokes,transform:row.transform,createdAt:row.created_at};
 return validWork(work)?work:null;
}
async function refreshShared(strict=false){
 if(!cloudReady||cloudLoading)return;
 cloudLoading=true;
 try{
  const rows=await cloud.list(),visible=new Set();
  let ignored=0;
  for(const row of rows){
   const work=renderCloudRow(row);
   if(!work){ignored++;continue;}
   visible.add(work.id);
   if(row.owner_id===cloud.userId){
    rememberPublished(work.id);
    if(!ownWork(work.id) && state.works.length<MAX_WORKS){
     state.works.push(work);createInstallationWork(work);saveWorks();
    }
    continue;
   }
   const prev=remoteWorks.get(work.id);
   if(prev?.stamp===row.updated_at)continue;
   removeSceneObject(work.id);
   createInstallationWork(work);
   remoteWorks.set(work.id,{stamp:row.updated_at});
  }
  for(const id of [...remoteWorks.keys()]){
   if(!visible.has(id)){removeSceneObject(id);remoteWorks.delete(id);}
  }
  updateCounter();
  cloudStatus(`已连接 · 可见 ${state.works.length+remoteWorks.size} 组作品 · 自动同步（最多显示最近 350 组）${ignored?` · 跳过 ${ignored} 组异常记录`:''}`);
 }catch(err){
  cloudStatus('云端读取失败：'+String(err.message||err).slice(0,130));
  if(strict)throw err;
 }finally{cloudLoading=false;}
}
async function initCloud(){
 updateMode();
 if(!isCloudConfigured(config)){
  cloudStatus('尚未填写 config.js。当前仍可在本机创作和备份；配置完成后将自动读取公共作品。');return;
 }
 cloudStatus('正在登录匿名访客并连接云端……');
 try{
  cloud=await connectCloud(config,()=>void refreshShared(),state=>{
   if(state==='polling')cloudStatus('实时通知暂时不可用；仍会每 30 秒自动读取云端。');
  });
  cloudReady=true;updateMode();
  await refreshShared(true);
  status('云端已连接。所有访客的作品可以相互观看；点击「确认位置并发布」将你的新作品公开。');
 }catch(err){
  cloud?.disconnect?.();cloudReady=false;cloud=null;updateMode();
  cloudStatus('连接失败：'+String(err.message||err).slice(0,160));
  status('云端连接失败，但本机绘制仍可使用。请检查 URL、Publishable key 和匿名登录设置。',true);
 }
}

function saveWorks(){try{localStorage.setItem(STORAGE_V3,JSON.stringify(state.works.slice(-MAX_WORKS)));}catch(err){status('本机存储已满，当前画面仍保留；请减少作品数量或另行备份。',true);}}
function migrateV2(saved){
 const old=JSON.parse(localStorage.getItem(STORAGE_V2)||'[]');
 if(!Array.isArray(old)||!old.length)return saved;
 let index=0;
 for(const w of old.slice(-25)){
  if(!Array.isArray(w.points)||w.points.length<2)continue;
  const pts=w.points.filter(p=>Array.isArray(p)&&p.length===2&&p.every(safeNum))
    .map(p=>[round((p[0]-.5)*5.1),round((.5-p[1])*3.2),round(.05*Math.sin(index++*.32))]).slice(0,MAX_POINTS_PER_STROKE);
  if(pts.length<2)continue;
  saved.push({id:uid(),strokes:[{color:/^#[\da-f]{6}$/i.test(w.color||'')?w.color:COLORS[0][1],thickness:clamp(Number(w.thickness)||5,2,9),points:pts}],transform:{position:[0,2.8,.6],rotation:[0,0,0],scale:[1,1,1]},createdAt:new Date().toISOString()});
 }
 return saved;
}
function loadWorks(){
 try{
   const json=localStorage.getItem(STORAGE_V3);const saved=json?JSON.parse(json):null;
   if(Array.isArray(saved)){state.works=saved.filter(validWork).slice(-MAX_WORKS);return;}
   const migrated=migrateV2([]).filter(validWork).slice(-MAX_WORKS);
   state.works=migrated;if(migrated.length)saveWorks();
 }catch(err){console.warn('Loading local works',err);state.works=[];}
}
function syncSelectedTransform(){
 if(!state.selected)return;
 const work=state.works.find(w=>w.id===state.selected),group=workGroups.get(state.selected);
 if(!work||!group)return;
 work.transform={position:group.position.toArray().map(round),rotation:[group.rotation.x,group.rotation.y,group.rotation.z].map(round),scale:group.scale.toArray().map(round)};
}
function commitTransform(){const id=state.selected;syncSelectedTransform();saveWorks();if(id)scheduleCloudUpdate(id);}
function selectWork(id){
 const group=workGroups.get(id);
 if(group&&!ownWork(id)){
  state.selected=null;transformControls.detach();
  $('selectionInfo').textContent='这根铁丝由其他观众创作，可以观看，但不能修改或删除。';
  $('confirmPlacement').disabled=true;$('removeSelected').disabled=true;
  return;
 }
 if(!group){state.selected=null;transformControls.detach();}

 else{state.selected=id;transformControls.attach(group);transformControls.setMode(state.transformMode);}
 $('confirmPlacement').disabled=!state.selected;
 $('removeSelected').disabled=!state.selected;
 $('selectionInfo').textContent=state.selected?'已选中彩色铁丝作品。用三轴手柄拖动或旋转、缩放。点击「确认位置」保存；之后还可以重新选中修改。':'尚未选中作品。左侧点击自己添加的彩色铁丝即可继续调整。';
}
function setTransformMode(mode){state.transformMode=mode;transformControls.setMode(mode);for(const [id,value] of [['moveMode','translate'],['rotateMode','rotate'],['scaleMode','scale']]){$(id).setAttribute('aria-pressed',String(value===mode));}}
function installStagePicking(){
 const canvas=stageRenderer.domElement;
 canvas.addEventListener('pointerdown',e=>{stageDown=[e.clientX,e.clientY];});
 canvas.addEventListener('pointerup',e=>{
  if(!stageDown||Math.hypot(e.clientX-stageDown[0],e.clientY-stageDown[1])>5||transformControls.dragging||transformControls.axis){stageDown=null;return;} stageDown=null;
  const r=canvas.getBoundingClientRect();ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
  pickRay.setFromCamera(ndc,stageCamera);
  const hits=pickRay.intersectObjects([...workGroups.values()],true);
  if(hits.length){let o=hits[0].object;while(o&&!o.userData.workId)o=o.parent;if(o?.userData.workId){
   selectWork(o.userData.workId);
   status(ownWork(o.userData.workId)?'已选中你的作品，可以移动、旋转或缩放，再拖动三轴手柄。':'这是其他观众的作品，你可以旋转观看，但不能编辑。');
  }}
 });
}
function initStage(){
 stageScene=new THREE.Scene();stageScene.background=new THREE.Color('#6b6159');stageScene.fog=new THREE.Fog('#6b6159',34,78);
 stageCamera=new THREE.PerspectiveCamera(47,1,.1,120);stageCamera.position.set(8.5,7.4,25.0);
 stageRenderer=makeRenderer(stageEl);stageRenderer.toneMappingExposure=1.12;
 stageOrbit=new OrbitControls(stageCamera,stageRenderer.domElement);stageOrbit.enableDamping=true;stageOrbit.target.set(0,7.15,-3.2);stageOrbit.minDistance=3.5;stageOrbit.maxDistance=52;stageOrbit.update();
 spaceRoot=new THREE.Group();spaceRoot.name='REPLACEABLE GALLERY';stageScene.add(spaceRoot);
 installationRoot=new THREE.Group();installationRoot.name='REPLACEABLE INSTALLATION';stageScene.add(installationRoot);
 visitorRoot=new THREE.Group();visitorRoot.name='VISITOR SUBMISSIONS NEVER REPLACED';stageScene.add(visitorRoot);
 addSpace();addOldWires();
 transformControls=new TransformControls(stageCamera,stageRenderer.domElement);
 stageScene.add(transformControls.getHelper());transformControls.size=.65;
 transformControls.addEventListener('mouseDown',()=>{stageOrbit.enabled=false;});
 transformControls.addEventListener('mouseUp',()=>{stageOrbit.enabled=true;commitTransform();});
 // 更新本机坐标不依赖观众只能提交一次的旧式固定锚点。
 transformControls.addEventListener('objectChange',()=>{syncSelectedTransform();});
 watchSize(stageEl,stageRenderer,stageCamera);installStagePicking();
 stageRenderer.setAnimationLoop(()=>{stageOrbit.update();stageRenderer.render(stageScene,stageCamera);});
 loadWorks();for(const w of state.works)createInstallationWork(w);updateCounter();
}

// --- 独立真实 3D 编织工作台：逐笔画在线性平面上，深度不同，产生 xyz 坐标。
function initStudio(){
 studioScene=new THREE.Scene();studioScene.background=new THREE.Color('#2e3630');
 studioScene.add(new THREE.HemisphereLight(0xffffff,0x3f453c,2.3));
 const d=new THREE.DirectionalLight(0xffead2,2.7);d.position.set(2,5,8);studioScene.add(d);
 studioCamera=new THREE.PerspectiveCamera(43,1,.1,80);studioCamera.position.set(0,1.1,10);
 studioRenderer=makeRenderer(studioEl);
 studioOrbit=new OrbitControls(studioCamera,studioRenderer.domElement);studioOrbit.enableDamping=true;studioOrbit.target.set(0,0,0);studioOrbit.enablePan=true;studioOrbit.minDistance=4;studioOrbit.maxDistance=18;studioOrbit.update();studioOrbit.enabled=false;
 workplane=new THREE.Mesh(new THREE.PlaneGeometry(6.9,4.5),new THREE.MeshBasicMaterial({color:'#718475',transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));studioScene.add(workplane);
 grid=new THREE.GridHelper(6.8,14,0x849588,0x4c6254);grid.rotation.x=Math.PI/2;grid.position.z=-.016;grid.material.transparent=true;grid.material.opacity=.31;studioScene.add(grid);
 const bounding=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6.8,4.5,2.8)),new THREE.LineBasicMaterial({color:0x7c8b7b,transparent:true,opacity:.38}));studioScene.add(bounding);
 studioDraftRoot=new THREE.Group();studioScene.add(studioDraftRoot);
 watchSize(studioEl,studioRenderer,studioCamera);setDepth(0);installStudioDrawing();
 studioRenderer.setAnimationLoop(()=>{studioOrbit.update();studioRenderer.render(studioScene,studioCamera);});
}
function setDepth(z){state.depth=clamp(z,-1.4,1.4);$('depthVal').textContent=state.depth.toFixed(1);if(workplane){workplane.position.z=state.depth;grid.position.z=state.depth-.018;}}
function setStudioMode(mode){state.studioMode=mode;studioOrbit.enabled=mode==='view';studioRenderer.domElement.style.cursor=mode==='draw'?'crosshair':'grab';$('modeDraw').setAttribute('aria-pressed',String(mode==='draw'));$('modeView').setAttribute('aria-pressed',String(mode==='view'));$('studioModeLabel').textContent=mode==='draw'?'拖动绘制一段新的铁丝':'拖动旋转视角 / 滚轮缩放';$('studioHint').textContent=mode==='draw'?'绘制模式：按住鼠标拖动 · 松开完成一段 · 深度可调':'观察模式：左键旋转 · 滚轮缩放 · 右键平移；返回绘制模式继续画';}
function studioPointerPoint(e){
 const r=studioRenderer.domElement.getBoundingClientRect();
 const p=new THREE.Vector2(2*(e.clientX-r.left)/r.width-1,1-2*(e.clientY-r.top)/r.height);
 studioRay.setFromCamera(p,studioCamera);studioPlane.set(new THREE.Vector3(0,0,1),-state.depth);
 const hit=studioRay.ray.intersectPlane(studioPlane,new THREE.Vector3());
 if(!hit||!Number.isFinite(hit.x)||Math.abs(hit.x)>20||Math.abs(hit.y)>20)return null;
 hit.x=clamp(hit.x,-3.35,3.35);hit.y=clamp(hit.y,-2.2,2.2);
 return [round(hit.x),round(hit.y),round(state.depth)];
}
function stageStrokeMeshes(group,stroke){
 const points=stroke.points.map(p=>new THREE.Vector3(...p));const mesh=createTube(points,stroke.color,stroke.thickness);if(mesh)group.add(mesh);
}
function redrawDraft(){
 clearGroup(studioDraftRoot);
 for(const s of state.draft)stageStrokeMeshes(studioDraftRoot,s);
 $('segmentCount').textContent=`${state.draft.length} 段 · ${state.draft.reduce((n,s)=>n+s.points.length,0)} 个路径点`;
}
function renderCurrentStroke(){
 if(liveLine){studioScene.remove(liveLine);dispose(liveLine);liveLine=null;}
 if(state.active.length<2)return;
 const geometry=new THREE.BufferGeometry().setFromPoints(state.active.map(p=>new THREE.Vector3(...p)));
 liveLine=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:state.color,linewidth:2}));studioScene.add(liveLine);
}
function sampleAndSimplify(path){
 // 长线不自动截断：采集期间按比例抽稀，提交时进一步均匀抽样到合理点数。
 if(path.length<=MAX_POINTS_PER_STROKE)return path.map(p=>p.slice());
 const last=path.length-1, result=[];
 for(let i=0;i<MAX_POINTS_PER_STROKE;i++)result.push(path[Math.round(i*last/(MAX_POINTS_PER_STROKE-1))].slice());
 return result;
}
function finishStroke(){
 if(!state.drawing)return;
 state.drawing=false;
 if(state.active.length>=2&&state.draft.length<MAX_STROKES){
  const stroke={color:state.color,thickness:state.thickness,points:sampleAndSimplify(state.active)};
  if(validStroke(stroke)){state.draft.push(stroke);status(`第 ${state.draft.length} 段铁丝已完成。可以换颜色或深度继续画，最后一起放置。`);}
 }
 state.active=[];
 if(liveLine){studioScene.remove(liveLine);dispose(liveLine);liveLine=null;}
 redrawDraft();
}
function installStudioDrawing(){
 const canvas=studioRenderer.domElement;
 canvas.addEventListener('pointerdown',e=>{
  if(state.studioMode!=='draw'||state.draft.length>=MAX_STROKES)return;
  if(e.button!==0&&e.pointerType==='mouse')return;
  const p=studioPointerPoint(e);if(!p)return;
  state.active=[p];state.drawing=true;canvas.setPointerCapture(e.pointerId);renderCurrentStroke();
 });
 canvas.addEventListener('pointermove',e=>{
  if(!state.drawing)return;
  const p=studioPointerPoint(e);if(!p)return;
  const last=state.active.at(-1);
  if(last&&Math.hypot(last[0]-p[0],last[1]-p[1])<.025)return;
  state.active.push(p);
  if(state.active.length>650){ // 允许持续画很长的线，而不是画到限制就停止
    state.active=state.active.filter((_,i)=>i%2===0||i===state.active.length-1);
  }
  renderCurrentStroke();
 });
 canvas.addEventListener('pointerup',finishStroke);canvas.addEventListener('pointercancel',finishStroke);canvas.addEventListener('lostpointercapture',finishStroke);
}
function exampleStrokes(){
 state.active=[];state.draft=[];
 for(let j=0;j<3;j++){
  const points=[], z=[-.6,.3,.9][j];
  for(let i=0;i<90;i++){
   const t=i/89,theta=t*(6.6+j*3.3)+j*.8,rad=.14+1.25*t;
   points.push([round((j-1)*.6+Math.cos(theta)*rad),round(Math.sin(theta)*rad*.82),z]);
  }
  state.draft.push({color:COLORS[[0,4,7][j]][1],thickness:[4,6,3][j],points});
 }
 redrawDraft();status('生成了三个不同深度、不同颜色的独立线段。切换到「观察模式」并旋转，看看它们的空间层次。');
}
function addWork(){
 if(state.drawing)finishStroke();
 if(state.draft.length===0){status('请先在右侧三维工作台画出至少一段铁丝。',true);return;}
 const work={id:uid(),strokes:state.draft.map(s=>({color:s.color,thickness:s.thickness,points:s.points.map(p=>p.slice())})),transform:{position:[0,2.65,3.25],rotation:[0,0,0],scale:[1,1,1]},createdAt:new Date().toISOString()};
 if(!validWork(work)){status('当前草稿中有无法保存的点坐标，请重画这一段。',true);return;}
 state.works.push(work);if(state.works.length>MAX_WORKS){const oldest=state.works.shift();const obj=workGroups.get(oldest.id);if(obj){visitorRoot.remove(obj);dispose(obj);}workGroups.delete(oldest.id);}
 createInstallationWork(work);selectWork(work.id);saveWorks();updateCounter();
 state.draft=[];redrawDraft();status('已加入左侧真三维装置！当前作品被选中。请点击移动 / 旋转 / 缩放，然后拖动三轴手柄决定位置。');
}
async function removeWork(){
 if(!state.selected)return;
 const id=state.selected;
 if(!ownWork(id))return;
 if(cloudKnown.has(id)){
  if(!cloudReady){status('此作品已发布，当前离线：为避免其他观众继续看到它，请联网后再删除。',true);return;}
  try{
   await cloud.remove(id);forgetPublished(id);
  }catch(err){status('云端删除失败，作品未被删除：'+String(err.message||err),true);return;}
 }
 selectWork(null);removeSceneObject(id);
 state.works=state.works.filter(w=>w.id!==id);
 saveWorks();updateCounter();status('你的作品已删除。若之前发布过，云端也已同步删除。');
}
async function publishSelected(){
 commitTransform();const id=state.selected;
 if(!id)return;
 const w=ownWork(id);
 if(cloudReady){
   const ok=await publishOwned(w);
   if(ok)selectWork(null);
 }else{
   selectWork(null);
   status('作品位置已保存到本机。填写 Supabase 配置后可点击「上传本机作品」分享。');
 }
}
async function uploadLocalWorks(){
 if(!cloudReady){cloudStatus('尚未连接云端');return;}
 const pending=state.works.filter(w=>!cloudKnown.has(w.id));
 if(!pending.length){status('没有待上传的本机作品。');return;}
 if(!window.confirm(`即将公开上传 ${pending.length} 组本机作品。其他访客都能观看，确定继续吗？`))return;
 let sent=0;
 for(const w of pending){if(await publishOwned(w,true))sent++;}
 await refreshShared();
 status(`上传完成：${sent}/${pending.length} 组。本机作品继续保留在你的浏览器中。`,sent!==pending.length);
}

function setupUI(){
 for(const [i,[name,hex]] of COLORS.entries()){
  const b=document.createElement('button');b.className='swatch';b.style.backgroundColor=hex;b.title=name;b.setAttribute('aria-label',name);b.setAttribute('aria-pressed',String(i===0));
  b.onclick=()=>{state.color=hex;[...$('palette').children].forEach(ch=>ch.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true');};$('palette').appendChild(b);
 }
 $('thickness').oninput=e=>{state.thickness=Number(e.target.value);$('thicknessVal').textContent=state.thickness;};
 $('depth').oninput=e=>setDepth(Number(e.target.value));
 $('modeDraw').onclick=()=>setStudioMode('draw');$('modeView').onclick=()=>setStudioMode('view');
 $('resetStudio').onclick=()=>{studioCamera.position.set(0,1.1,10);studioOrbit.target.set(0,0,0);studioOrbit.update();status('三维编织工作台视角已重置。');};
 $('undo').onclick=()=>{if(state.draft.length){state.draft.pop();redrawDraft();status('已撤销最后一段，可以继续绘制。');}};
 $('clearDrawing').onclick=()=>{state.active=[];state.draft=[];redrawDraft();status('已清空工作台上的草稿，展馆里保存的作品不会被删除。');};
 $('example').onclick=exampleStrokes;
 $('addWire').onclick=addWork;
 $('moveMode').onclick=()=>setTransformMode('translate');$('rotateMode').onclick=()=>setTransformMode('rotate');$('scaleMode').onclick=()=>setTransformMode('scale');
 $('confirmPlacement').onclick=()=>void publishSelected();
 $('removeSelected').onclick=()=>void removeWork();
 $('syncLocal').onclick=()=>void uploadLocalWorks();
 $('refreshCloud').onclick=()=>void refreshShared();
 $('resetCamera').onclick=()=>{stageCamera.position.set(7,5.3,12);stageOrbit.target.set(0,3,0);stageOrbit.update();};
 $('deselect').onclick=()=>selectWork(null);
 $('screenShot').onclick=()=>{stageRenderer.render(stageScene,stageCamera);const a=document.createElement('a');a.download='你为什么画星星_数字编织V6.png';a.href=stageRenderer.domElement.toDataURL('image/png');a.click();};
 $('exportBackup').onclick=()=>{
  syncSelectedTransform();saveWorks();
  const data=JSON.stringify({format:'yuzhenli-weaving-v3',version:6,exportedAt:new Date().toISOString(),works:state.works},null,2);
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
  a.href=url;a.download='你为什么画星星_编织作品备份V6.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  status('已导出作品备份 JSON。之后换电脑或修改程序，可以从该文件恢复本机作品。');
 };
 $('importBackup').onclick=()=>$('importFile').click();
 $('importFile').onchange=async e=>{
   const file=e.target.files?.[0];if(!file)return;
   try{
     if(file.size>1500000)throw Error('备份文件过大，请检查是否选错。');
     const data=JSON.parse(await file.text());
     if(data?.format!=='yuzhenli-weaving-v3'||!Array.isArray(data.works))throw Error('不是 V3 作品备份 JSON。');
     const restored=data.works.filter(validWork).slice(-MAX_WORKS);
     if(restored.length!==data.works.length)throw Error('备份存在格式不符合要求的作品，未执行导入。');
     if(state.works.length&&!window.confirm('恢复备份会覆盖当前浏览器里自己保存的作品（不修改云端他人的作品）。确定继续吗？'))return;
     selectWork(null);
     for(const w of state.works)removeSceneObject(w.id);
     state.works=restored;
     for(const w of state.works){if(!workGroups.has(w.id))createInstallationWork(w);}
     // 恢复备份只修改本机，不自动公开上传；云端提交须由观众明确点击。

     saveWorks();updateCounter();status(`已成功恢复 ${restored.length} 组作品。`);
   }catch(err){status('导入失败：'+String(err?.message||err).slice(0,110),true);}finally{e.target.value='';}
 };

 document.addEventListener('keydown',e=>{
  if(e.target?.matches?.('input,textarea'))return;
  if(e.key.toLowerCase()==='g')setTransformMode('translate');
  if(e.key.toLowerCase()==='r')setTransformMode('rotate');
  if(e.key.toLowerCase()==='s')setTransformMode('scale');
  if(e.key==='Escape')selectWork(null);
 });
}
async function main(){
 try{
  initStage();initStudio();setupUI();redrawDraft();setStudioMode('draw');setTransformMode('translate');
  state.ready=true;
  status(state.works.length?`欢迎回来：已恢复 ${state.works.length} 组本机作品。可以继续多笔绘制。`:'V5 星网装置已准备好。右侧可以多笔绘制，再将作品自由放置到左侧。');
  updateMode();
  await loadOptionalModels();
  await initCloud();
 }catch(err){console.error('Initialization error:',err);$('stageError').style.display='flex';$('studioError').style.display='flex';status('三维场景启动失败：'+String(err?.message||err).slice(0,120),true);}
}
main();
