import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";

/* ---------- DOM refs ---------- */
const viewer = document.getElementById("viewer");
const statusEl = document.getElementById("status");
const fileInput = document.getElementById("fileInput");
const btnClear = document.getElementById("btnClear");

const gapEl = document.getElementById("gap");
const zoomEl = document.getElementById("zoom");
const yBothEl = document.getElementById("yBoth");
const yDiffEl = document.getElementById("yDiff");

const swapEyesEl = document.getElementById("swapEyes");
const flipVerticalEl = document.getElementById("flipVertical");
const btnExitVR = document.getElementById("btnExitVR");
const vrMount = document.getElementById("vrMount");

/* ---------- Three.js core ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local");
renderer.xr.setFramebufferScaleFactor?.(0.8); // reduce carga en móviles y evita negro
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 1);
viewer.appendChild(renderer.domElement);

// VR Button (WebXR)
const vrBtn = VRButton.createButton(renderer);
vrMount.appendChild(vrBtn);

// Botón Modo Compatibilidad (SBS sin WebXR)
const btnCompat = document.createElement("button");
btnCompat.className = "btn";
btnCompat.textContent = "Modo VR Compatibilidad";
vrMount.appendChild(btnCompat);

// Scene & Camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(60, viewer.clientWidth / viewer.clientHeight, 0.01, 100);
camera.position.set(0, 0, 1.5);
scene.add(camera);

// Luz sutil
const light = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(light);

/* ---------- Planos izquierdo y derecho ---------- */
const groupLeft = new THREE.Group();
const groupRight = new THREE.Group();
scene.add(groupLeft);
scene.add(groupRight);

const geometry = new THREE.PlaneGeometry(1, 1); // base 1x1 (escala via "zoom")
let matLeft = new THREE.MeshBasicMaterial({ color: 0x222222 });
let matRight = new THREE.MeshBasicMaterial({ color: 0x222222 });

const meshLeft = new THREE.Mesh(geometry, matLeft);
const meshRight = new THREE.Mesh(geometry, matRight);
groupLeft.add(meshLeft);
groupRight.add(meshRight);

// Capas por ojo en WebXR
meshLeft.layers.set(1);   // Ojo izquierdo
meshRight.layers.set(2);  // Ojo derecho

// En pantalla normal (no XR), la cámara ve ambas capas
camera.layers.enable(1);
camera.layers.enable(2);

/* ---------- Estado de imagen ---------- */
let currentMode = "mono"; // "mono" o "sbs"
let baseTexture = null;
let texLeft = null;
let texRight = null;

/* ---------- Modo Compatibilidad (sin WebXR) ---------- */
let compatActive = false;
let prevViewerStyle = null;

function enterCompatVR(){
  if (compatActive) return;
  compatActive = true;

  // Guardar estilo previo y forzar fullscreen del viewer
  prevViewerStyle = {
    position: viewer.style.position,
    left: viewer.style.left,
    top: viewer.style.top,
    width: viewer.style.width,
    height: viewer.style.height,
    zIndex: viewer.style.zIndex,
    background: viewer.style.background
  };
  viewer.style.position = "fixed";
  viewer.style.left = "0";
  viewer.style.top = "0";
  viewer.style.width = "100vw";
  viewer.style.height = "100vh";
  viewer.style.zIndex = "9999";
  viewer.style.background = "#000";

  // Intentar pantalla completa (no es obligatorio para funcionar)
  const el = viewer;
  const reqFS = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  try { reqFS && reqFS.call(el); } catch(e){ /* ignore */ }

  btnExitVR.hidden = false;
  setStatus("Modo VR Compatibilidad activo (sin WebXR).");
}

function exitCompatVR(){
  if (!compatActive) return;
  compatActive = false;

  // Restaurar estilo previo
  if (prevViewerStyle){
    viewer.style.position = prevViewerStyle.position ?? "";
    viewer.style.left = prevViewerStyle.left ?? "";
    viewer.style.top = prevViewerStyle.top ?? "";
    viewer.style.width = prevViewerStyle.width ?? "";
    viewer.style.height = prevViewerStyle.height ?? "";
    viewer.style.zIndex = prevViewerStyle.zIndex ?? "";
    viewer.style.background = prevViewerStyle.background ?? "";
  }
  prevViewerStyle = null;

  // Salir de pantalla completa si lo estamos
  const d = document;
  const exitFS = d.exitFullscreen || d.webkitExitFullscreen || d.msExitFullscreen;
  try { exitFS && exitFS.call(d); } catch(e){ /* ignore */ }

  btnExitVR.hidden = true;
  setStatus("Saliste del Modo VR Compatibilidad.");
}

/* ---------- Helpers UI ---------- */
const $ = (sel) => document.querySelector(sel);
const modeRadios = document.querySelectorAll('input[name="mode"]');
modeRadios.forEach(r => r.addEventListener("change", e => {
  currentMode = e.target.value;
  if (baseTexture) applyTexturesForMode();
}));

btnClear.addEventListener("click", () => {
  fileInput.value = "";
  setStatus("Sin imagen cargada.");
  baseTexture = null;
  setMaterials(new THREE.MeshBasicMaterial({ color: 0x222222 }), new THREE.MeshBasicMaterial({ color: 0x222222 }));
});

swapEyesEl.addEventListener("change", () => { if (baseTexture) applyTexturesForMode(); });
flipVerticalEl.addEventListener("change", () => { if (baseTexture) applyTexturesForMode(); });

gapEl.addEventListener("input", applyTransforms);
zoomEl.addEventListener("input", applyTransforms);
yBothEl.addEventListener("input", applyTransforms);
yDiffEl.addEventListener("input", applyTransforms);

btnCompat.addEventListener("click", () => {
  enterCompatVR();
});

/* ---------- Carga de imagen ---------- */
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    const tex = new THREE.Texture(image);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy?.() || 1;
    tex.needsUpdate = true;

    baseTexture = tex;
    applyTexturesForMode();
    URL.revokeObjectURL(url);
    setStatus(`Imagen cargada: ${file.name} (${image.width}×${image.height}) — Modo: ${currentMode.toUpperCase()}`);
  };
  image.onerror = () => {
    setStatus("No se pudo cargar la imagen. Intenta con otro archivo.");
  };
  image.src = url;
});

/* ---------- Aplicar texturas según modo ---------- */
function applyTexturesForMode(){
  if (!baseTexture) return;

  const flipY = !!flipVerticalEl.checked;

  if (currentMode === "mono"){
    texLeft = baseTexture.clone();
    texRight = baseTexture.clone();
    texLeft.needsUpdate = texRight.needsUpdate = true;
    texLeft.flipY = texRight.flipY = flipY;

    texLeft.offset.set(0, 0);
    texRight.offset.set(0, 0);
    texLeft.repeat.set(1, 1);
    texRight.repeat.set(1, 1);
  } else {
    const swapped = !!swapEyesEl.checked;

    const tL = baseTexture.clone();
    const tR = baseTexture.clone();
    tL.needsUpdate = tR.needsUpdate = true;

    if (!swapped){
      tL.offset.set(0.0, 0.0); tL.repeat.set(0.5, 1.0);
      tR.offset.set(0.5, 0.0); tR.repeat.set(0.5, 1.0);
    } else {
      tL.offset.set(0.5, 0.0); tL.repeat.set(0.5, 1.0);
      tR.offset.set(0.0, 0.0); tR.repeat.set(0.5, 1.0);
    }
    tL.flipY = tR.flipY = flipY;

    texLeft = tL;
    texRight = tR;
  }

  const mL = new THREE.MeshBasicMaterial({ map: texLeft });
  const mR = new THREE.MeshBasicMaterial({ map: texRight });
  setMaterials(mL, mR);

  applyTransforms();
}

/* ---------- Posiciones / escala ---------- */
function applyTransforms(){
  const userGap = parseFloat(gapEl.value);
  const zoom = parseFloat(zoomEl.value);
  const yBoth = parseFloat(yBothEl.value);
  const yDiff = parseFloat(yDiffEl.value);

  // Evitar cruce con zoom alto
  const minGap = zoom * 1.02;
  const gap = Math.max(userGap, minGap);

  groupLeft.position.set(-gap * 0.5, yBoth + (+yDiff), 0);
  groupRight.position.set(+gap * 0.5, yBoth + (-yDiff), 0);

  meshLeft.scale.set(zoom, zoom, 1);
  meshRight.scale.set(zoom, zoom, 1);
}

/* ---------- Material setter ---------- */
function setMaterials(mLeft, mRight){
  matLeft.dispose(); matRight.dispose();
  matLeft = mLeft;   matRight = mRight;
  meshLeft.material = matLeft;
  meshRight.material = matRight;
}

/* ---------- Estado ---------- */
function setStatus(msg){
  statusEl.textContent = msg;
}

/* ---------- Resize ---------- */
function onResize(){
  const w = viewer.clientWidth;
  const h = viewer.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", onResize);

/* ---------- WebXR: detección de render en VR ---------- */
let xrFrameRendered = false;
let xrCheckTimer = null;

// Marcar cuando haya al menos un frame XR dibujado
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  if (renderer.xr.isPresenting) {
    xrFrameRendered = true;
  }
});

/* ---------- VR session hooks ---------- */
renderer.xr.addEventListener("sessionstart", () => {
  btnExitVR.hidden = false;

  // Configurar capas por ojo con fallback (algunos móviles reportan 1 cámara XR)
  const xrCam = renderer.xr.getCamera();
  if (xrCam.isArrayCamera && xrCam.cameras?.length === 2){
    const leftCam  = xrCam.cameras[0];
    const rightCam = xrCam.cameras[1];
    leftCam.layers.enable(1);  leftCam.layers.disable(2);
    rightCam.layers.enable(2); rightCam.layers.disable(1);
  } else {
    // Fallback: muestra ambas capas si hay una sola cámara XR (SBS visible)
    xrCam.layers.enable(1);
    xrCam.layers.enable(2);
  }

  // Reiniciar marcador y programar verificación
  xrFrameRendered = false;
  if (xrCheckTimer) clearTimeout(xrCheckTimer);
  xrCheckTimer = setTimeout(async () => {
    // Si tras ~1.2s no se dibujó ningún frame XR, salimos y activamos compat
    if (!xrFrameRendered) {
      const session = renderer.xr.getSession();
      try { session && await session.end(); } catch(e){ /* ignore */ }
      setStatus("El modo WebXR no dibujó ningún cuadro. Activando Modo VR Compatibilidad.");
      enterCompatVR();
    }
  }, 1200);

  // Asegura tamaño correcto al entrar a XR
  onResize();
});

renderer.xr.addEventListener("sessionend", () => {
  btnExitVR.hidden = true;
  camera.layers.enable(1);
  camera.layers.enable(2);
  if (xrCheckTimer) { clearTimeout(xrCheckTimer); xrCheckTimer = null; }
  // Si estábamos en Compat, no tocar (se controla con exitCompatVR)
});

btnExitVR.addEventListener("click", async () => {
  // Salir de XR si está activo
  const session = renderer.xr.getSession();
  if (session) {
    try { await session.end(); } catch(e){ /* ignore */ }
  }
  // Salir de compat si está activo
  if (compatActive) exitCompatVR();
});

/* ---------- Inicial ---------- */
applyTransforms();
setStatus("Sin imagen cargada. Elige 'Imagen única' o 'SBS' y sube tu archivo.");
onResize();
