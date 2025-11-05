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
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.xr.enabled = true;
viewer.appendChild(renderer.domElement);

// VR Button
const vrBtn = VRButton.createButton(renderer);
vrMount.appendChild(vrBtn);

// Scene & Camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(60, viewer.clientWidth / viewer.clientHeight, 0.01, 100);
camera.position.set(0, 0, 1.5);
scene.add(camera);

// Luz sutil (no afecta a MeshBasicMaterial pero queda listo si cambias material)
const light = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(light);

/* ---------- Planos izquierdo y derecho ---------- */
const groupLeft = new THREE.Group();
const groupRight = new THREE.Group();
scene.add(groupLeft);
scene.add(groupRight);

const geometry = new THREE.PlaneGeometry(1, 1); // tamaño base (escala se ajusta con "zoom")
let matLeft = new THREE.MeshBasicMaterial({ color: 0x222222 });
let matRight = new THREE.MeshBasicMaterial({ color: 0x222222 });

const meshLeft = new THREE.Mesh(geometry, matLeft);
const meshRight = new THREE.Mesh(geometry, matRight);
groupLeft.add(meshLeft);
groupRight.add(meshRight);

// Capas para dirigir cada plano a un ojo en VR:
meshLeft.layers.set(1);   // Ojo izquierdo
meshRight.layers.set(2);  // Ojo derecho

// En pantalla normal (no VR), la cámara debe ver ambas capas
camera.layers.enable(1);
camera.layers.enable(2);

/* ---------- Estado de imagen ---------- */
let currentMode = "mono"; // "mono" o "sbs"
let baseTexture = null;   // textura original cargada
let texLeft = null;       // textura (o clon con offset/repeat) para ojo izq
let texRight = null;      // idem ojo der

/* ---------- Helpers UI ---------- */
const $ = (sel) => document.querySelector(sel);
const modeRadios = document.querySelectorAll('input[name="mode"]');
modeRadios.forEach(r => r.addEventListener("change", e => {
  currentMode = e.target.value;
  // Si ya había textura, re-arma materiales con el nuevo modo
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

/* ---------- Carga de imagen ---------- */
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    // Crear textura base
    const tex = new THREE.Texture(image);
    tex.colorSpace = THREE.SRGBColorSpace;
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
    // Duplicar la misma imagen en ambos ojos (SBS sintético)
    texLeft = baseTexture.clone();
    texRight = baseTexture.clone();
    texLeft.needsUpdate = texRight.needsUpdate = true;
    texLeft.flipY = texRight.flipY = flipY;

    // Asegurar UV completos
    texLeft.offset.set(0, 0);
    texRight.offset.set(0, 0);
    texLeft.repeat.set(1, 1);
    texRight.repeat.set(1, 1);
  } else {
    // Imagen ya en SBS: mitad izquierda/derecha
    const swapped = !!swapEyesEl.checked;

    const tL = baseTexture.clone();
    const tR = baseTexture.clone();
    tL.needsUpdate = tR.needsUpdate = true;

    // Cada mitad ocupa 0.5 del ancho
    // Ojo izquierdo = mitad [0 .. 0.5], ojo derecho = [0.5 .. 1.0]
    // Si swapEyes => invierte halves
    if (!swapped){
      tL.offset.set(0.0, 0.0);
      tL.repeat.set(0.5, 1.0);

      tR.offset.set(0.5, 0.0);
      tR.repeat.set(0.5, 1.0);
    } else {
      tL.offset.set(0.5, 0.0);
      tL.repeat.set(0.5, 1.0);

      tR.offset.set(0.0, 0.0);
      tR.repeat.set(0.5, 1.0);
    }

    tL.flipY = tR.flipY = flipY;

    texLeft = tL;
    texRight = tR;
  }

  // Aplicar materiales
  const mL = new THREE.MeshBasicMaterial({ map: texLeft });
  const mR = new THREE.MeshBasicMaterial({ map: texRight });
  setMaterials(mL, mR);

  applyTransforms();
}

/* ---------- Posiciones / escala ---------- */
function applyTransforms(){
  const gap = parseFloat(gapEl.value);      // distancia horizontal entre centros
  const zoom = parseFloat(zoomEl.value);    // escala uniforme
  const yBoth = parseFloat(yBothEl.value);  // desplaza ambos ojos en Y
  const yDiff = parseFloat(yDiffEl.value);  // diferencial (izq↑ / der↓)

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

/* ---------- VR session hooks ---------- */
renderer.xr.addEventListener("sessionstart", () => {
  btnExitVR.hidden = false;
  // Configurar capas por ojo
  const xrCam = renderer.xr.getCamera();
  if (xrCam.isArrayCamera && xrCam.cameras?.length === 2){
    // Izquierdo ve capa 1
    xrCam.cameras[0].layers.enable(1);
    xrCam.cameras[0].layers.disable(2);
    // Derecho ve capa 2
    xrCam.cameras[1].layers.enable(2);
    xrCam.cameras[1].layers.disable(1);
  }
});

renderer.xr.addEventListener("sessionend", () => {
  btnExitVR.hidden = true;
  // Vista normal: habilitar ambas capas
  camera.layers.enable(1);
  camera.layers.enable(2);
});

btnExitVR.addEventListener("click", async () => {
  const session = renderer.xr.getSession();
  if (session) await session.end();
});

/* ---------- Animación ---------- */
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
});

/* ---------- Inicial ---------- */
applyTransforms();
setStatus("Sin imagen cargada. Elige 'Imagen única' o 'SBS' y sube tu archivo.");
onResize();
