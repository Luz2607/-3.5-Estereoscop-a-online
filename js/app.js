// ====== 2D (SBS viewer) ======
const viewer = document.getElementById('viewer');
const left = document.getElementById('left');
const right = document.getElementById('right');

const btnSBS = document.getElementById('btnSBS');
const btnTwo = document.getElementById('btnTwo');
const sbsInputs = document.getElementById('sbsInputs');
const twoInputs = document.getElementById('twoInputs');

const fileSBS = document.getElementById('fileSBS');
const fileL = document.getElementById('fileL');
const fileR = document.getElementById('fileR');

const btnDemoSBS = document.getElementById('btnDemoSBS');
const btnDemoTwo = document.getElementById('btnDemoTwo');

const zoom = document.getElementById('zoom');
const offX = document.getElementById('offX');
const offY = document.getElementById('offY');
const flipH = document.getElementById('flipH');
const flipV = document.getElementById('flipV');
const swapEyes = document.getElementById('swapEyes');

const zoomVal = document.getElementById('zoomVal');
const offXVal = document.getElementById('offXVal');
const offYVal = document.getElementById('offYVal');

const btnFullscreen = document.getElementById('btnFullscreen');
const btnHideUI = document.getElementById('btnHideUI');
const btnShowUI = document.getElementById('btnShowUI');
const ui = document.getElementById('ui');

// NUEVO: Auto-ajuste
const autoFitChk = document.getElementById('autoFit');
const btnAutoFitNow = document.getElementById('btnAutoFitNow');

let mode = 'sbs'; // 'sbs' | 'two'
let srcSBS = null;
let srcL = null;
let srcR = null;

function applySBS(url){
  srcSBS = url; srcL = srcR = null;
  left.className = 'eye sbs left';
  right.className = 'eye sbs right';
  left.style.backgroundImage = `url("${url}")`;
  right.style.backgroundImage = `url("${url}")`;
}
function applyTwo(urlL, urlR){
  srcSBS = null; srcL = urlL; srcR = urlR;
  left.className = 'eye';
  right.className = 'eye';
  left.style.backgroundImage = `url("${urlL}")`;
  right.style.backgroundImage = `url("${urlR}")`;
}

// Switch de modos
btnSBS.addEventListener('click', () => {
  mode = 'sbs';
  sbsInputs.hidden = false; twoInputs.hidden = true;
  srcL = srcR = null;
  if (srcSBS) applySBS(srcSBS);
  xrRefresh({autoFit:true});
});
btnTwo.addEventListener('click', () => {
  mode = 'two';
  sbsInputs.hidden = true; twoInputs.hidden = false;
  srcSBS = null;
  if (srcL && srcR) applyTwo(srcL, srcR);
  xrRefresh({autoFit:true});
});

// Carga de archivos / demos
fileSBS.addEventListener('change', e => {
  const f = e.target.files?.[0]; if(!f) return;
  const url = URL.createObjectURL(f);
  applySBS(url); xrRefresh({autoFit:true});
});
fileL.addEventListener('change', e => {
  const f = e.target.files?.[0]; if(!f) return;
  srcL = URL.createObjectURL(f);
  if (srcL && srcR) applyTwo(srcL, srcR);
  xrRefresh({autoFit:true});
});
fileR.addEventListener('change', e => {
  const f = e.target.files?.[0]; if(!f) return;
  srcR = URL.createObjectURL(f);
  if (srcL && srcR) applyTwo(srcL, srcR);
  xrRefresh({autoFit:true});
});
btnDemoSBS.addEventListener('click', () => { applySBS('css/catarina.jpg'); xrRefresh({autoFit:true}); });
btnDemoTwo.addEventListener('click', () => { applyTwo('left.jpg','right.jpg'); xrRefresh({autoFit:true}); });

// Ajustes visuales 2D (sin rotación ni IPD)
function updateUIValues(){
  zoomVal.textContent = Number(zoom.value).toFixed(2);
  offXVal.textContent = offX.value;
  offYVal.textContent = offY.value;
}
function buildTransform(){
  const scale = parseFloat(zoom.value);
  const flipScaleX = flipH.checked ? -1 : 1;
  const flipScaleY = flipV.checked ? -1 : 1;
  const ox = parseInt(offX.value,10);
  const oy = parseInt(offY.value,10);
  return `translate(${ox}px, ${oy}px) scale(${flipScaleX * scale}, ${flipScaleY * scale})`;
}
function applyTransforms2D(){
  updateUIValues();
  // Sin separación simulada: usamos zIndex para swap y transform para zoom/offset/flip
  if (swapEyes.checked){ left.style.zIndex = 1; right.style.zIndex = 0; }
  else { left.style.zIndex = 0; right.style.zIndex = 1; }
  const t = buildTransform();
  left.style.transform = t;
  right.style.transform = t;
}
[zoom, offX, offY, flipH, flipV, swapEyes].forEach(el =>
  el.addEventListener('input', () => { applyTransforms2D(); xrRefresh(); })
);

// Pantalla completa + UI
btnFullscreen.addEventListener('click', () => {
  const el = document.documentElement;
  if (!document.fullscreenElement) el.requestFullscreen?.(); else document.exitFullscreen?.();
});
function hideUI(){ ui.style.display='none'; btnShowUI.hidden=false; }
function showUI(){ ui.style.display=''; btnShowUI.hidden=true; }
btnHideUI.addEventListener('click', hideUI);
btnShowUI.addEventListener('click', showUI);

let lastTap = 0;
viewer.addEventListener('touchend', () => { const now=Date.now(); if(now-lastTap<350) { (ui.style.display==='none')?showUI():hideUI(); } lastTap=now; });
viewer.addEventListener('dblclick', () => { (ui.style.display==='none')?showUI():hideUI(); });

applyTransforms2D();


// ====== VR (WebXR) ======
// ====== VR (WebXR) ======
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

const xrCanvas = document.getElementById('xrCanvas');
const btnEnterVR = document.getElementById('btnEnterVR');
const btnExitVR  = document.getElementById('btnExitVR');
const xrHud = document.getElementById('xrHud');
const xrExitMobile = document.getElementById('xrExitMobile');

const renderer = new THREE.WebGLRenderer({ canvas: xrCanvas, antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, window.innerWidth/window.innerHeight, 0.01, 100);
camera.position.set(0,1.55,0);
scene.add(camera);

// luz suave (igual que tu bloque actual)
scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 0.2));

// Planos por ojo
const planeGeom = new THREE.PlaneGeometry(1, 1);
const matL = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped:false, depthTest:false });
const matR = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped:false, depthTest:false });
const meshL = new THREE.Mesh(planeGeom, matL);
const meshR = new THREE.Mesh(planeGeom, matR);

// Distancia/Separación (adapta del código 1 para llenar mejor)
const baseDistance = 0.95;   // un poco más cerca que 0.9
const fixedSep    = 0.06;    // separación fija aprox. por ojo

meshL.position.set(-fixedSep/2, 1.55, -baseDistance);
meshR.position.set( fixedSep/2, 1.55, -baseDistance);
meshL.layers.set(1); meshR.layers.set(2);

// Mantener visibles para evitar pantalla negra al entrar
meshL.visible = true;
meshR.visible = true;

scene.add(meshL, meshR);

// Estado aspect del ojo
let eyeAspect = 1;

// Loader/texturas con SAFE (SBS) — igual a tu enfoque actual
const loader = new THREE.TextureLoader();
const maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 8;
const SAFE = 0.0020;

function baseTex(t){
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.anisotropy = maxAniso;
  t.colorSpace = THREE.SRGBColorSpace;
  t.center.set(0.5,0.5);
  return t;
}
function loadSingle(url, {flipH=false, flipV=false}){
  const tex = baseTex(loader.load(url, (tt) => {
    const w = tt.image?.naturalWidth || tt.image?.width || 1;
    const h = tt.image?.naturalHeight || tt.image?.height || 1;
    eyeAspect = w / h;
    if (autoFitChk.checked) autoFitZoom();
    applyTransformsXR(); showMeshesIfReady();
  }));
  const sx = (flipH ? -1 : 1);
  const sy = (flipV ? -1 : 1);
  tex.repeat.set(sx, sy);
  tex.offset.set(0,0);
  tex.needsUpdate = true;
  return tex;
}
function loadSBSHalf(url, which, {flipH=false, flipV=false}){
  const tex = baseTex(loader.load(url, (tt) => {
    const w = tt.image?.naturalWidth || tt.image?.width || 1;
    const h = tt.image?.naturalHeight || tt.image?.height || 1;
    eyeAspect = (w*0.5)/h;
    if (autoFitChk.checked) autoFitZoom();
    applyTransformsXR(); showMeshesIfReady();
  }));
  const half = 0.5 - SAFE*2;
  let ox = (which === 'L') ? (0.0 + SAFE) : (0.5 + SAFE);
  let sx = half;
  if (flipH){ sx = -half; ox = ox + half; }
  const sy = (flipV ? -1 : 1);
  tex.repeat.set(sx, sy);
  tex.offset.set(ox, 0);
  tex.needsUpdate = true;
  return tex;
}

// Construye materiales según modo/estado (con swap y flips)
function updateXRMaterials(){
  if (matL.map){ matL.map.dispose?.(); matL.map = null; }
  if (matR.map){ matR.map.dispose?.(); matR.map = null; }
  // Dejamos los planos visibles; se cubrirán con la textura en cuanto cargue

  const common = {
    flipH:  flipH.checked,
    flipV:  flipV.checked
  };

  if (mode === 'sbs' && srcSBS){
    const tL = loadSBSHalf(srcSBS, 'L', common);
    const tR = loadSBSHalf(srcSBS, 'R', common);
    matL.map = swapEyes.checked ? tR : tL;
    matR.map = swapEyes.checked ? tL : tR;
  } else if (mode === 'two' && srcL && srcR){
    const tL = loadSingle(srcL, common);
    const tR = loadSingle(srcR, common);
    matL.map = swapEyes.checked ? tR : tL;
    matR.map = swapEyes.checked ? tL : tR;
  }
  matL.needsUpdate = matR.needsUpdate = true;
}

function showMeshesIfReady(){
  const ready = !!(matL.map && matR.map);
  meshL.visible = ready;
  meshR.visible = ready;
}

// ====== Auto-ajustar (alto) ======
// Llenar ~92% del alto visible a la distancia base (ajuste del código 1)
function autoFitZoom(){
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  const visibleHeight = 2 * baseDistance * Math.tan(fovRad / 2);
  const target = visibleHeight * 0.92;
  zoom.value = target.toFixed(2);
  updateUIValues();
}
btnAutoFitNow?.addEventListener('click', () => { autoFitZoom(); applyTransformsXR(); });

// Escala en VR (sin IPD dinámico en UI, mantenemos fixedSep)
function applyTransformsXR(){
  const s = parseFloat(zoom.value);
  meshL.scale.set(eyeAspect * s, 1 * s, 1);
  meshR.scale.set(eyeAspect * s, 1 * s, 1);
}

// Si ya estamos en VR, refresca de inmediato
function xrRefresh({autoFit=false} = {}){
  applyTransforms2D();
  if (renderer.xr.isPresenting){
    if (autoFit && autoFitChk.checked) autoFitZoom();
    updateXRMaterials();
    applyTransformsXR();
  }
}

// Resize
function onResize(){
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (renderer.xr.isPresenting && autoFitChk.checked) { autoFitZoom(); applyTransformsXR(); }
}
window.addEventListener('resize', onResize);

// Sesión XR helpers (como en código 1)
function onXREnd() {
  showUI();
  xrCanvas.style.display = 'none';
  btnExitVR.hidden = true;
  btnEnterVR.disabled = false;
  if (xrHud) xrHud.hidden = true;
}
async function exitVR() {
  try {
    const session = renderer.xr.getSession?.();
    if (session) await session.end();
  } catch(e){ console.warn(e); }
  finally { onXREnd(); }
}

// Entrar a VR (con refrescos extra como en código 1)
btnEnterVR.addEventListener('click', async () => {
  try{
    // Verifica que haya al menos una fuente cargada
    if ((mode==='sbs' && !srcSBS) || (mode==='two' && (!srcL || !srcR))){
      alert('Carga primero una imagen SBS o ambas L/R.');
      return;
    }

    updateXRMaterials();
    if (autoFitChk.checked) autoFitZoom();
    applyTransformsXR();

    xrCanvas.style.display = 'block';

    const vrBtn = VRButton.createButton(renderer);
    vrBtn.style.display = 'none';
    document.body.appendChild(vrBtn);

    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'layers', 'dom-overlay'],
      domOverlay: { root: document.body }
    });
    await renderer.xr.setSession(session);

    // Enlazar capas por ojo
    const xrCam = renderer.xr.getCamera(camera);
    if (xrCam && xrCam.isArrayCamera && xrCam.cameras?.length === 2){
      xrCam.cameras[0].layers.enable(1); // left-eye
      xrCam.cameras[1].layers.enable(2); // right-eye
    }

    // Refrescos extra por si la textura termina de cargar justo al entrar
    updateXRMaterials(); applyTransformsXR();
    setTimeout(()=>{ updateXRMaterials(); applyTransformsXR(); }, 180);

    ui.style.display='none'; btnShowUI.hidden=false;
    btnExitVR.hidden = false;
    if (xrHud) xrHud.hidden = false;

    session.addEventListener('end', onXREnd);
    showMeshesIfReady();

  }catch(err){
    alert('WebXR no disponible (usa HTTPS + Chrome Android).');
    console.error(err);
    onXREnd();
  }
});

// Salir de VR
btnExitVR.addEventListener('click', exitVR);
if (xrExitMobile) xrExitMobile.addEventListener('click', exitVR);
window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'x') exitVR(); });

// Loop
renderer.setAnimationLoop(() => { renderer.render(scene, camera); });

// Año dinámico
const y = document.getElementById('yearNow');
if (y) y.textContent = new Date().getFullYear();
