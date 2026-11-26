// ==========================================
// GLOBAL GAME STATE
// ==========================================
const gameState = {
  condition: 'functional', // 'functional' | 'damaged' | 'crippled'
  startTime: Date.now(),
  maintenanceDone: false,
  engineUnlocked: false,
  engineDone: false,
  cockpitDone: false,
  hangarDone: false
};

// ==========================================
// SMART ASSET LOADER
// ==========================================
function loadAssetWithFallback(imgEl, baseName, fallbackText) {
  if (!imgEl) return;
  const candidates = [
    `assets/${baseName}.jpg`,
    `assets/${baseName}.JPG`,
    `assets/${baseName}.png`,
    `assets/${baseName}.PNG`,
    `assets/${baseName}.jpeg`,
    `${baseName}.jpg`,
    `${baseName}.png`
  ];
  let idx = 0;

  function tryNext() {
    if (idx >= candidates.length) {
      imgEl.onerror = null;
      imgEl.src = `https://placehold.co/900x500/0b1320/38bdf8?text=${encodeURIComponent(fallbackText)}`;
      const warnBar = document.getElementById('asset-warning-bar');
      if (warnBar) {
        warnBar.classList.remove('hidden');
        warnBar.textContent = `⚠️ Asset not found: Upload "assets/${baseName}.jpg" (or .png) with exact lowercase naming.`;
      }
      return;
    }
    imgEl.src = candidates[idx++];
  }

  imgEl.onerror = tryNext;
  tryNext();
}

// ==========================================
// TIMER & NAVIGATION
// ==========================================
function navigate(room) {
  const targetView = document.getElementById(`view-${room}`);
  if (!targetView) {
    console.error(`Room view not found: view-${room}`);
    return;
  }

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  targetView.classList.add('active');

  const backBtn = document.getElementById('btn-back-bridge');
  const titleEl = document.getElementById('current-room-title');

  if (room === 'bridge') {
    backBtn.classList.add('hidden');
    titleEl.textContent = 'EMERGENCY BRIDGE';
    updateBridgeUI();
  } else {
    backBtn.classList.remove('hidden');
    titleEl.textContent = room.toUpperCase();
  }

  if (room === 'maintenance' && !pipeInitialized) initPipeGame();
  if (room === 'cockpit') initCockpit3D();
  if (room === 'hangar') initHangar360();
}

window.navigate = navigate;

window.addEventListener('DOMContentLoaded', () => {
  loadAssetWithFallback(
    document.getElementById('briefing-img'),
    'mission_briefing',
    'ICE FIELD ALERT'
  );
  updateBridgeUI();

  setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - gameState.startTime) / 1000);
    const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const secs = String(elapsedSec % 60).padStart(2, '0');
    const timerEl = document.getElementById('mission-timer');
    if (timerEl) {
      timerEl.textContent = `ELAPSED: ${mins}:${secs} / 20:00 TARGET`;
      if (elapsedSec > 1200) timerEl.style.color = '#ef4444';
    }
  }, 1000);
});

function setShipCondition(newCondition) {
  gameState.condition = newCondition;
  updateBridgeUI();
}

function cycleShipCondition() {
  const order = ['functional', 'damaged', 'crippled'];
  const next = order[(order.indexOf(gameState.condition) + 1) % order.length];
  setShipCondition(next);
}

window.cycleShipCondition = cycleShipCondition;

function updateBridgeUI() {
  const badge = document.getElementById('ship-status-badge');
  const img = document.getElementById('ship-condition-img');
  const overlay = document.getElementById('ship-condition-text');
  if (!badge || !img || !overlay) return;

  badge.className = 'badge';
  if (gameState.condition === 'functional') {
    badge.textContent = 'STATUS: FUNCTIONAL';
    loadAssetWithFallback(img, 'ship_functional', 'SHIP FUNCTIONAL');
    overlay.textContent = 'HULL INTEGRITY: 100% — FUNCTIONAL';
    overlay.style.borderColor = '#22c55e';
  } else if (gameState.condition === 'damaged') {
    badge.textContent = 'STATUS: DAMAGED';
    badge.classList.add('damaged');
    loadAssetWithFallback(img, 'ship_damaged', 'SHIP DAMAGED');
    overlay.textContent = 'HULL INTEGRITY: 45% — DAMAGED';
    overlay.style.borderColor = '#f59e0b';
  } else {
    badge.textContent = 'STATUS: CRIPPLED';
    badge.classList.add('crippled');
    loadAssetWithFallback(img, 'ship_crippled', 'SHIP CRIPPLED');
    overlay.textContent = 'HULL INTEGRITY: 10% — CRIPPLED';
    overlay.style.borderColor = '#ef4444';
  }

  document.getElementById('chk-maint').textContent =
    `${gameState.maintenanceDone ? '✅' : '❌'} Maintenance: Fuel & Control Lines`;
  document.getElementById('chk-engine').textContent =
    `${gameState.engineDone ? '✅' : '❌'} Engineering: 4 Engines Reset`;
  document.getElementById('chk-cockpit').textContent =
    `${gameState.cockpitDone ? '✅' : '❌'} Cockpit: Ice Field Navigation`;
  document.getElementById('chk-hangar').textContent =
    `${gameState.hangarDone ? '✅' : '❌'} Hangar: Shuttle Launch`;
}

// ==========================================
// 1. MAINTENANCE — 5 CROSSING PIPES NETWORK
// ==========================================
let pipeInitialized = false;
const PIPE_COLORS = [
  { name: 'Port Fuel', color: '#ef4444' },      // 0: Red
  { name: 'Starboard Fuel', color: '#3b82f6' }, // 1: Blue
  { name: 'Port Controls', color: '#22c55e' },  // 2: Green
  { name: 'Starboard Ctrl', color: '#eab308' }, // 3: Yellow
  { name: 'Reverse Fuel', color: '#a855f7' }    // 4: Purple
];

const MASTER_PIPE_GRID = [
  // Row 0: IN 0 (Red) | OUT 0 (Blue)
  [
    { type: 'elbow', c1: 0, valid: [0] },
    { type: 'elbow', c1: 1, valid: [270] },
    { type: 'straight', c1: 1, valid: [0, 180] },
    { type: 'straight', c1: 1, valid: [0, 180] },
    { type: 'straight', c1: 1, valid: [0, 180] }
  ],
  // Row 1: IN 1 (Blue) | OUT 1 (Green)
  [
    { type: 'cross', c1: 1, c2: 0, valid: [0, 180] },
    { type: 'elbow', c1: 1, valid: [90] },
    { type: 'elbow', c1: 2, valid: [270] },
    { type: 'straight', c1: 2, valid: [0, 180] },
    { type: 'straight', c1: 2, valid: [0, 180] }
  ],
  // Row 2: IN 2 (Green) | OUT 2 (Yellow)
  [
    { type: 'cross', c1: 2, c2: 0, valid: [0, 180] },
    { type: 'straight', c1: 2, valid: [0, 180] },
    { type: 'elbow', c1: 2, valid: [90] },
    { type: 'elbow', c1: 3, valid: [270] },
    { type: 'straight', c1: 3, valid: [0, 180] }
  ],
  // Row 3: IN 3 (Yellow) | OUT 3 (Purple)
  [
    { type: 'cross', c1: 3, c2: 0, valid: [0, 180] },
    { type: 'straight', c1: 3, valid: [0, 180] },
    { type: 'straight', c1: 3, valid: [0, 180] },
    { type: 'elbow', c1: 3, valid: [90] },
    { type: 'elbow', c1: 4, valid: [270] }
  ],
  // Row 4: IN 4 (Purple) | OUT 4 (Red)
  [
    { type: 'cross', c1: 4, c2: 0, valid: [0, 180] },
    { type: 'straight', c1: 4, valid: [0, 180] },
    { type: 'straight', c1: 4, valid: [0, 180] },
    { type: 'straight', c1: 4, valid: [0, 180] },
    { type: 'elbow', c1: 4, valid: [90] }
  ]
];

const RIGHT_OUTPUT_ORDER = [1, 2, 3, 4, 0];
let currentPipeRotations = [];

function renderPipeSVG(cellDef) {
  const color1 = PIPE_COLORS[cellDef.c1].color;
  if (cellDef.type === 'straight') {
    return `
      <svg width="68" height="68" viewBox="0 0 68 68">
        <rect x="0" y="27" width="68" height="14" fill="${color1}" />
        <rect x="28" y="24" width="12" height="20" rx="2" fill="#0f172a" stroke="${color1}" stroke-width="2.5"/>
      </svg>`;
  } else if (cellDef.type === 'elbow') {
    return `
      <svg width="68" height="68" viewBox="0 0 68 68">
        <path d="M 0 34 L 28 34 Q 34 34 34 40 L 34 68" fill="none" stroke="${color1}" stroke-width="14" stroke-linecap="butt"/>
        <circle cx="34" cy="34" r="7" fill="#0f172a" stroke="${color1}" stroke-width="2.5"/>
      </svg>`;
  } else {
    const color2 = PIPE_COLORS[cellDef.c2].color;
    return `
      <svg width="68" height="68" viewBox="0 0 68 68">
        <rect x="27" y="0" width="14" height="68" fill="${color2}" />
        <rect x="0" y="25" width="68" height="18" fill="#090d16" />
        <rect x="0" y="27" width="68" height="14" fill="${color1}" />
        <circle cx="34" cy="34" r="6" fill="#0f172a" stroke="${color1}" stroke-width="2"/>
      </svg>`;
  }
}

function initPipeGame() {
  pipeInitialized = true;
  const grid = document.getElementById('pipe-grid');
  grid.innerHTML = '';

  for (let r = 0; r < 5; r++) {
    currentPipeRotations[r] = [];

    const leftLbl = document.createElement('div');
    leftLbl.className = 'pipe-label';
    leftLbl.style.color = PIPE_COLORS[r].color;
    leftLbl.style.borderLeft = `4px solid ${PIPE_COLORS[r].color}`;
    leftLbl.textContent = `IN: ${PIPE_COLORS[r].name}`;
    grid.appendChild(leftLbl);

    for (let c = 0; c < 5; c++) {
      const def = MASTER_PIPE_GRID[r][c];
      const wrongRots = [0, 90, 180, 270].filter(ang => !def.valid.includes(ang));
      const startRot = wrongRots[Math.floor(Math.random() * wrongRots.length)];
      currentPipeRotations[r][c] = startRot;

      const cell = document.createElement('div');
      cell.className = 'pipe-cell';
      cell.id = `pipe-${r}-${c}`;
      cell.innerHTML = renderPipeSVG(def);
      cell.style.transform = `rotate(${startRot}deg)`;

      cell.onclick = () => {
        if (gameState.maintenanceDone) return;
        currentPipeRotations[r][c] = (currentPipeRotations[r][c] + 90) % 360;
        cell.style.transform = `rotate(${currentPipeRotations[r][c]}deg)`;
        checkPipesSolved();
      };
      grid.appendChild(cell);
    }

    const outIdx = RIGHT_OUTPUT_ORDER[r];
    const rightLbl = document.createElement('div');
    rightLbl.className = 'pipe-label';
    rightLbl.style.color = PIPE_COLORS[outIdx].color;
    rightLbl.style.borderRight = `4px solid ${PIPE_COLORS[outIdx].color}`;
    rightLbl.textContent = `OUT: ${PIPE_COLORS[outIdx].name}`;
    grid.appendChild(rightLbl);
  }
}

function resetPipePuzzle() {
  gameState.maintenanceDone = false;
  const banner = document.getElementById('maint-status');
  banner.textContent = 'STATUS: CONDUITS DISCONNECTED';
  banner.classList.remove('complete');
  initPipeGame();
}
window.resetPipePuzzle = resetPipePuzzle;

function checkPipesSolved() {
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (!MASTER_PIPE_GRID[r][c].valid.includes(currentPipeRotations[r][c])) {
        return;
      }
    }
  }
  gameState.maintenanceDone = true;
  const banner = document.getElementById('maint-status');
  banner.textContent = 'STATUS: ALL 5 CROSS-ROUTED CONDUITS RECONNECTED!';
  banner.classList.add('complete');
}

// ==========================================
// 2. ENGINE ROOM — PASSCODE & MICRO:BIT
// ==========================================
const ENGINE_DOOR_CODE = '6494';
const ENGINE_TARGET_SEQUENCE = [3, 6, 4, 5];
let engineStep = 0;
let currentSimDigit = 0;

function unlockEngineRoom() {
  const val = document.getElementById('engine-passcode-input').value.trim();
  if (val === ENGINE_DOOR_CODE) {
    gameState.engineUnlocked = true;
    document.getElementById('engine-lock-screen').classList.add('hidden');
    document.getElementById('engine-room-content').classList.remove('hidden');
  } else {
    document.getElementById('engine-lock-msg').textContent = 'ACCESS DENIED: INVALID CODE';
  }
}
window.unlockEngineRoom = unlockEngineRoom;

async function connectMicrobit() {
  if (!('serial' in navigator)) {
    alert('WebSerial is not supported in this browser. Use Chrome/Edge or the On-Screen Simulator.');
    return;
  }
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    document.getElementById('mb-connection-status').textContent = '✅ Micro:bit Connected!';

    const decoder = new TextDecoderStream();
    port.readable.pipeTo(decoder.writable);
    const reader = decoder.readable.getReader();

    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        handleMicrobitMessage(line.trim());
      }
    }
  } catch (err) {
    console.error(err);
  }
}
window.connectMicrobit = connectMicrobit;

function handleMicrobitMessage(msg) {
  const parts = msg.split(':');
  if (parts.length !== 3) return;
  const [action, pinStr, digitStr] = parts;
  const pinIdx = parseInt(pinStr, 10);
  const digit = parseInt(digitStr, 10);

  if (action === 'SELECT') {
    document.querySelector(`#eng-${pinIdx} .digit`).textContent = digit;
  } else if (action === 'LOCK') {
    verifyEngineInput(pinIdx, digit);
  }
}

function simCycleDigit() {
  currentSimDigit = (currentSimDigit + 1) % 10;
  const pinIdx = parseInt(document.getElementById('sim-pin-select').value, 10);
  document.querySelector(`#eng-${pinIdx} .digit`).textContent = currentSimDigit;
}
window.simCycleDigit = simCycleDigit;

function simConfirmDigit() {
  const pinIdx = parseInt(document.getElementById('sim-pin-select').value, 10);
  verifyEngineInput(pinIdx, currentSimDigit);
}
window.simConfirmDigit = simConfirmDigit;

function verifyEngineInput(pinIdx, digit) {
  if (gameState.engineDone) return;

  if (pinIdx === engineStep && digit === ENGINE_TARGET_SEQUENCE[engineStep]) {
    document.getElementById(`eng-${engineStep}`).classList.add('solved');
    document.querySelector(`#eng-${engineStep} .digit`).textContent = digit;
    engineStep++;
    currentSimDigit = 0;

    if (engineStep === 4) {
      gameState.engineDone = true;
      const banner = document.getElementById('engine-status');
      banner.textContent = 'STATUS: ALL 4 ENGINES RESET & STABILIZED! COCKPIT THRUSTERS RESPONSIVE.';
      banner.classList.add('complete');
    }
  } else {
    engineStep = 0;
    currentSimDigit = 0;
    for (let i = 0; i < 4; i++) {
      document.getElementById(`eng-${i}`).classList.remove('solved');
      document.querySelector(`#eng-${i} .digit`).textContent = '-';
    }
    const banner = document.getElementById('engine-status');
    banner.textContent = '⚠️ INCORRECT PIN OR CODE! SEQUENCE RESET TO ENGINE 1.';
  }
}

// ==========================================
// 3. COCKPIT — 3D OBSTACLE AVOIDANCE (60s)
// ==========================================
let cockpitScene, cockpitCamera, cockpitRenderer, shipMesh;
let asteroids = [];
let cockpitRunning = false;
let cockpitTimeLeft = 60.0;
let cockpitCrashes = 0;
const keysPressed = {};

window.addEventListener('keydown', e => (keysPressed[e.key] = true));
window.addEventListener('keyup', e => (keysPressed[e.key] = false));

function initCockpit3D() {
  const statusBadge = document.getElementById('cockpit-handling-status');
  if (gameState.engineDone) {
    statusBadge.textContent = 'HANDLING: HIGHLY RESPONSIVE (ENGINES ONLINE)';
    statusBadge.className = 'badge';
  } else {
    statusBadge.textContent = 'HANDLING: SLUGGISH & DELAYED (ENGINES OFFLINE)';
    statusBadge.className = 'badge damaged';
  }

  const container = document.getElementById('cockpit-canvas-container');
  if (cockpitRenderer || typeof THREE === 'undefined') return;

  cockpitScene = new THREE.Scene();
  cockpitScene.fog = new THREE.FogExp2(0x050811, 0.015);

  cockpitCamera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 200);
  cockpitCamera.position.set(0, 3, 10);
  cockpitCamera.lookAt(0, 0, -10);

  cockpitRenderer = new THREE.WebGLRenderer({ antialias: true });
  cockpitRenderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(cockpitRenderer.domElement);

  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(5, 10, 7);
  cockpitScene.add(light);
  cockpitScene.add(new THREE.AmbientLight(0x404040));

  const shipGeo = new THREE.ConeGeometry(0.8, 2.5, 6);
  shipGeo.rotateX(-Math.PI / 2);
  const shipMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 });
  shipMesh = new THREE.Mesh(shipGeo, shipMat);
  cockpitScene.add(shipMesh);

  const grid = new THREE.GridHelper(100, 40, 0x1e293b, 0x0f172a);
  grid.position.y = -4;
  cockpitScene.add(grid);

  cockpitRenderer.render(cockpitScene, cockpitCamera);
}

function startCockpitGame() {
  if (cockpitRunning || !cockpitRenderer) return;
  cockpitRunning = true;
  cockpitTimeLeft = 60.0;
  cockpitCrashes = 0;
  shipMesh.position.set(0, 0, 0);
  asteroids.forEach(a => cockpitScene.remove(a));
  asteroids = [];
  document.getElementById('cockpit-crashes').textContent = '0 / 5';

  let lastFrame = performance.now();
  let spawnTimer = 0;
  let shipVelX = 0;
  let shipVelY = 0;

  function animate(now) {
    if (!cockpitRunning) return;
    const dt = (now - lastFrame) / 1000;
    lastFrame = now;

    cockpitTimeLeft = Math.max(0, cockpitTimeLeft - dt);
    document.getElementById('cockpit-timer').textContent = `${cockpitTimeLeft.toFixed(1)}s`;

    const accel = gameState.engineDone ? 45.0 : 9.0;
    const damping = gameState.engineDone ? 0.82 : 0.96;

    if (keysPressed['ArrowLeft']) shipVelX -= accel * dt;
    if (keysPressed['ArrowRight']) shipVelX += accel * dt;
    if (keysPressed['ArrowUp']) shipVelY += accel * dt;
    if (keysPressed['ArrowDown']) shipVelY -= accel * dt;

    shipVelX *= damping;
    shipVelY *= damping;

    shipMesh.position.x = Math.max(-7, Math.min(7, shipMesh.position.x + shipVelX * dt));
    shipMesh.position.y = Math.max(-3.2, Math.min(4.5, shipMesh.position.y + shipVelY * dt));
    shipMesh.rotation.z = -shipVelX * 0.08;

    spawnTimer += dt;
    if (spawnTimer > 0.45) {
      spawnTimer = 0;
      const geo = new THREE.DodecahedronGeometry(0.9 + Math.random() * 0.7);
      const mat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, roughness: 0.4 });
      const rock = new THREE.Mesh(geo, mat);
      rock.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 7, -60);
      cockpitScene.add(rock);
      asteroids.push(rock);
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
      const rock = asteroids[i];
      rock.position.z += 28 * dt;
      rock.rotation.x += dt;
      rock.rotation.y += dt;

      if (rock.position.distanceTo(shipMesh.position) < 1.4) {
        cockpitScene.remove(rock);
        asteroids.splice(i, 1);
        cockpitCrashes++;
        document.getElementById('cockpit-crashes').textContent = `${cockpitCrashes} / 5`;

        if (cockpitCrashes > 5) {
          cockpitRunning = false;
          applyCrashPenalty();
          return;
        }
      } else if (rock.position.z > 12) {
        cockpitScene.remove(rock);
        asteroids.splice(i, 1);
      }
    }

    if (cockpitTimeLeft <= 0) {
      cockpitRunning = false;
      gameState.cockpitDone = true;
      alert('✅ 60 SECONDS SURVIVED! Ice field cleared.');
      return;
    }

    cockpitRenderer.render(cockpitScene, cockpitCamera);
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}
window.startCockpitGame = startCockpitGame;

function applyCrashPenalty() {
  if (gameState.condition === 'functional') {
    setShipCondition('damaged');
    alert('⚠️ MORE THAN 5 COLLISIONS! Hull status degraded to DAMAGED.');
  } else if (gameState.condition === 'damaged') {
    setShipCondition('crippled');
    alert('🚨 CRITICAL HULL BREACH! Ship status degraded to CRIPPLED.');
  } else {
    alert('🚨 SHIP ALREADY CRIPPLED!');
  }
}

// ==========================================
// 4. HANGAR — 360 EQUIRECTANGULAR & VIDEO OUTCOMES
// ==========================================
let hangarInitialized = false;
let hangarSequence = [];
const TARGET_HANGAR_SEQ = ['HYDRAULICS', 'FUEL', 'THROTTLE', 'IGNITION'];

function resetHangarSequence() {
  hangarSequence = [];
  document.getElementById('hangar-seq-display').textContent = '[ _ , _ , _ , _ ]';
}
window.resetHangarSequence = resetHangarSequence;

function initHangar360() {
  if (hangarInitialized || typeof THREE === 'undefined') return;
  hangarInitialized = true;

  const container = document.getElementById('hangar-360-container');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const sphereGeo = new THREE.SphereGeometry(50, 60, 40);
  sphereGeo.scale(-1, 1, 1);

  const sphereMat = new THREE.MeshBasicMaterial();
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  scene.add(sphere);

  const texCandidates = [
    'assets/cockpit_360.jpg',
    'assets/cockpit_360.JPG',
    'assets/cockpit_360.png',
    'assets/cockpit_360.PNG'
  ];
  const loader = new THREE.TextureLoader();
  let tIdx = 0;

  function loadNextTexture() {
    if (tIdx >= texCandidates.length) {
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 2048, 1024);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      for (let x = 0; x < 2048; x += 128) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke();
      }
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '44px monospace';
      ctx.fillText('SHUTTLE COCKPIT 360° PROJECTION (assets/cockpit_360.jpg)', 320, 512);
      sphereMat.map = new THREE.CanvasTexture(canvas);
      sphereMat.needsUpdate = true;
      return;
    }
    loader.load(
      texCandidates[tIdx++],
      tex => {
        sphereMat.map = tex;
        sphereMat.needsUpdate = true;
      },
      undefined,
      loadNextTexture
    );
  }
  loadNextTexture();

  const zones = [
    { id: 'HYDRAULICS', pos: [-6, 12, -25], color: 0x38bdf8 },
    { id: 'FUEL', pos: [6, 12, -25], color: 0xeab308 },
    { id: 'THROTTLE', pos: [0, -8, -22], color: 0x22c55e },
    { id: 'IGNITION', pos: [14, -4, -20], color: 0xef4444 }
  ];

  const interactiveMeshes = [];
  zones.forEach(z => {
    const geo = new THREE.BoxGeometry(5, 2.5, 0.5);
    const mat = new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0.65 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...z.pos);
    mesh.lookAt(0, 0, 0);
    mesh.userData = { id: z.id };
    scene.add(mesh);
    interactiveMeshes.push(mesh);
  });

  let isDragging = false, downX = 0, downY = 0, prevX = 0, prevY = 0, lon = 0, lat = 0;
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  renderer.domElement.addEventListener('mousedown', e => {
    isDragging = true;
    downX = prevX = e.clientX;
    downY = prevY = e.clientY;
  });

  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    lon += (prevX - e.clientX) * 0.2;
    lat += (e.clientY - prevY) * 0.2;
    lat = Math.max(-85, Math.min(85, lat));
    prevX = e.clientX;
    prevY = e.clientY;
  });

  window.addEventListener('mouseup', e => {
    if (isDragging && Math.hypot(e.clientX - downX, e.clientY - downY) < 6) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(interactiveMeshes);
      if (hits.length > 0) {
        registerHangarSwitch(hits[0].object.userData.id);
      }
    }
    isDragging = false;
  });

  function render360() {
    requestAnimationFrame(render360);
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    camera.lookAt(
      50 * Math.sin(phi) * Math.cos(theta),
      50 * Math.cos(phi),
      50 * Math.sin(phi) * Math.sin(theta)
    );
    renderer.render(scene, camera);
  }
  render360();
}

function registerHangarSwitch(zoneId) {
  if (hangarSequence.includes(zoneId) || hangarSequence.length >= 4) return;
  hangarSequence.push(zoneId);

  const padded = [...hangarSequence, '_', '_', '_', '_'].slice(0, 4);
  document.getElementById('hangar-seq-display').textContent = `[ ${padded.join(' , ')} ]`;

  if (hangarSequence.length === 4) {
    evaluateLaunchOutcome();
  }
}

function evaluateLaunchOutcome() {
  const isSequenceCorrect = hangarSequence.every((val, i) => val === TARGET_HANGAR_SEQ[i]);

  if (!isSequenceCorrect) {
    alert('❌ INCORRECT STARTUP SEQUENCE! The shuttle engines fail to ignite. Resetting switches.');
    resetHangarSequence();
    return;
  }

  gameState.hangarDone = true;
  const elapsedMinutes = (Date.now() - gameState.startTime) / 60000;
  const isDamaged = gameState.condition !== 'functional';

  let videoBase = '';
  let title = '';
  let description = '';

  if (!gameState.maintenanceDone) {
    if (!isDamaged) {
      videoBase = 'crash_no_maint';
      title = 'OUTCOME: SHUTTLE CRASH (FUEL LINE FAILURE)';
      description = 'Maintenance conduits were never reconnected! Fuel pressure ruptured on takeoff.';
    } else {
      videoBase = 'crash_damaged';
      title = 'OUTCOME: CATASTROPHIC SHUTTLE CRASH (HULL & FUEL FAILURE)';
      description = 'With unfixed fuel lines and a damaged hull, the shuttle broke apart during launch.';
    }
  } else if (gameState.maintenanceDone && gameState.cockpitDone) {
    if (!isDamaged) {
      if (elapsedMinutes <= 20) {
        videoBase = 'depart_fast';
        title = 'VICTORY: OPTIMAL DEPARTURE (< 20 MINUTES)';
        description = `Shuttle launched cleanly in ${elapsedMinutes.toFixed(1)} minutes and recovered the drifting engineer!`;
      } else {
        videoBase = 'depart_slow';
        title = 'MISSION COMPLETE: DELAYED DEPARTURE (> 20 MINUTES)';
        description = `Shuttle departed safely in ${elapsedMinutes.toFixed(1)} minutes, though past the 20-minute window.`;
      }
    } else {
      if (elapsedMinutes <= 20) {
        videoBase = 'depart_damaged_fast';
        title = 'ESCAPED: DAMAGED SHUTTLE DEPARTURE (< 20 MINUTES)';
        description = 'The shuttle escaped under 20 minutes, trailing sparks from hull damage.';
      } else {
        videoBase = 'depart_slow';
        title = 'ESCAPED: DELAYED & DAMAGED DEPARTURE (> 20 MINUTES)';
        description = 'The damaged shuttle limped out of the hangar after the 20-minute mark.';
      }
    }
  } else {
    videoBase = isDamaged ? 'crash_damaged' : 'crash_no_maint';
    title = 'OUTCOME: SHUTTLE CRASH (ICE FIELD NOT CLEARED)';
    description = 'Without clearing the cockpit ice field course, the shuttle struck ice immediately after exit.';
  }

  showVideoModal(title, description, videoBase);
}

function showVideoModal(title, desc, videoBase) {
  const modal = document.getElementById('hangar-video-modal');
  const video = document.getElementById('outcome-video');
  const fallback = document.getElementById('video-fallback-box');

  document.getElementById('outcome-title').textContent = title;
  document.getElementById('outcome-desc').textContent = desc;

  video.classList.remove('hidden');
  fallback.classList.add('hidden');

  const candidates = [
    `assets/${videoBase}.mp4`,
    `assets/${videoBase}.MP4`,
    `assets/${videoBase}.webm`,
    `assets/${videoBase}.mov`,
    `${videoBase}.mp4`
  ];
  let vIdx = 0;

  function tryNextVideo() {
    if (vIdx >= candidates.length) {
      video.onerror = null;
      video.classList.add('hidden');
      fallback.classList.remove('hidden');
      fallback.innerHTML = `<strong>[VIDEO FILE NOT FOUND: assets/${videoBase}.mp4]</strong><br><br>${desc}`;
      return;
    }
    video.src = candidates[vIdx++];
    video.load();
    video.play().catch(() => {});
  }

  video.onerror = tryNextVideo;
  tryNextVideo();

  modal.classList.remove('hidden');
}

function closeVideoModal() {
  document.getElementById('outcome-video').pause();
  document.getElementById('hangar-video-modal').classList.add('hidden');
}
window.closeVideoModal = closeVideoModal;
