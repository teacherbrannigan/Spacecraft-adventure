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
// TIMER & NAVIGATION
// ==========================================
setInterval(() => {
  const elapsedSec = Math.floor((Date.now() - gameState.startTime) / 1000);
  const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const secs = String(elapsedSec % 60).padStart(2, '0');
  const timerEl = document.getElementById('mission-timer');
  timerEl.textContent = `ELAPSED: ${mins}:${secs} / 20:00 TARGET`;
  if (elapsedSec > 1200) timerEl.style.color = '#ef4444';
}, 1000);

function navigate(room) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${room}`).classList.add('active');

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

function setShipCondition(newCondition) {
  gameState.condition = newCondition;
  updateBridgeUI();
}

function cycleShipCondition() {
  const order = ['functional', 'damaged', 'crippled'];
  const next = order[(order.indexOf(gameState.condition) + 1) % order.length];
  setShipCondition(next);
}

function updateBridgeUI() {
  const badge = document.getElementById('ship-status-badge');
  const img = document.getElementById('ship-condition-img');
  const overlay = document.getElementById('ship-condition-text');

  badge.className = 'badge';
  if (gameState.condition === 'functional') {
    badge.textContent = 'STATUS: FUNCTIONAL';
    img.src = 'assets/ship_functional.jpg';
    overlay.textContent = 'HULL INTEGRITY: 100% — FUNCTIONAL';
    overlay.style.borderColor = '#22c55e';
  } else if (gameState.condition === 'damaged') {
    badge.textContent = 'STATUS: DAMAGED';
    badge.classList.add('damaged');
    img.src = 'assets/ship_damaged.jpg';
    overlay.textContent = 'HULL INTEGRITY: 45% — DAMAGED';
    overlay.style.borderColor = '#f59e0b';
  } else {
    badge.textContent = 'STATUS: CRIPPLED';
    badge.classList.add('crippled');
    img.src = 'assets/ship_crippled.jpg';
    overlay.textContent = 'HULL INTEGRITY: 10% — CRIPPLED';
    overlay.style.borderColor = '#ef4444';
  }

  document.getElementById('chk-maint').textContent =
    `${gameState.maintenanceDone ? '✅' : '❌'} Maintenance: Fuel & Control Lines`;
  document.getElementById('chk-engine').textContent =
    `${gameState.engineDone ? '✅' : '❌'} Engineering: 4 Engines Reset`;
  document.getElementById('chk-cockpit').textContent =
    `${gameState.cockpitDone ? '✅' : '❌'} Cockpit: Debris Field Navigation`;
  document.getElementById('chk-hangar').textContent =
    `${gameState.hangarDone ? '✅' : '❌'} Hangar: Shuttle Launch`;
}

// ==========================================
// 1. MAINTENANCE — 5-LINE PIPE PUZZLE
// ==========================================
let pipeInitialized = false;
const pipeLines = [
  { name: 'Port Fuel', color: '#ef4444' },
  { name: 'Starboard Fuel', color: '#3b82f6' },
  { name: 'Port Controls', color: '#22c55e' },
  { name: 'Starboard Ctrl', color: '#eab308' },
  { name: 'Reverse Fuel', color: '#a855f7' }
];
// 5 rows x 5 cols. 0 or 180 deg = horizontal connected; 90 or 270 = vertical disconnected
let pipeAngles = [];

function initPipeGame() {
  pipeInitialized = true;
  const grid = document.getElementById('pipe-grid');
  grid.innerHTML = '';

  for (let r = 0; r < 5; r++) {
    pipeAngles[r] = [];
    // Left Input Label
    const leftLbl = document.createElement('div');
    leftLbl.className = 'pipe-label';
    leftLbl.style.color = pipeLines[r].color;
    leftLbl.textContent = `IN: ${pipeLines[r].name}`;
    grid.appendChild(leftLbl);

    for (let c = 0; c < 5; c++) {
      // Randomize initial angle (90 or 270 so it starts broken)
      const startAngle = [90, 180, 270][Math.floor(Math.random() * 3)];
      pipeAngles[r][c] = startAngle;

      const cell = document.createElement('div');
      cell.className = 'pipe-cell';
      cell.innerHTML = `
        <svg width="60" height="60" viewBox="0 0 60 60">
          <rect x="0" y="24" width="60" height="12" rx="4" fill="${pipeLines[r].color}" />
          <circle cx="30" cy="30" r="8" fill="#0f172a" stroke="${pipeLines[r].color}" stroke-width="3"/>
        </svg>
      `;
      cell.style.transform = `rotate(${startAngle}deg)`;
      cell.onclick = () => {
        pipeAngles[r][c] = (pipeAngles[r][c] + 90) % 360;
        cell.style.transform = `rotate(${pipeAngles[r][c]}deg)`;
        checkPipesSolved();
      };
      grid.appendChild(cell);
    }

    // Right Output Label
    const rightLbl = document.createElement('div');
    rightLbl.className = 'pipe-label';
    rightLbl.style.color = pipeLines[r].color;
    rightLbl.textContent = `OUT: ${pipeLines[r].name}`;
    grid.appendChild(rightLbl);
  }
}

function checkPipesSolved() {
  const allAligned = pipeAngles.every(row =>
    row.every(angle => angle % 180 === 0)
  );
  if (allAligned) {
    gameState.maintenanceDone = true;
    const banner = document.getElementById('maint-status');
    banner.textContent = 'STATUS: ALL 5 FUEL & CONTROL LINES RECONNECTED!';
    banner.classList.add('complete');
  }
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

// WebSerial API for Real BBC micro:bit
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

// Expected serial messages from microbit_code.py: "SELECT:pinIndex:digit" or "LOCK:pinIndex:digit"
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

// Simulator fallback handlers
function simCycleDigit() {
  currentSimDigit = (currentSimDigit + 1) % 10;
  const pinIdx = parseInt(document.getElementById('sim-pin-select').value, 10);
  document.querySelector(`#eng-${pinIdx} .digit`).textContent = currentSimDigit;
}

function simConfirmDigit() {
  const pinIdx = parseInt(document.getElementById('sim-pin-select').value, 10);
  verifyEngineInput(pinIdx, currentSimDigit);
}

function verifyEngineInput(pinIdx, digit) {
  if (gameState.engineDone) return;

  // Must match current engine in sequence AND exact digit (3, 6, 4, 5)
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
    // Wrong pin or wrong number -> reset from the beginning!
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
  if (cockpitRenderer) return;

  cockpitScene = new THREE.Scene();
  cockpitScene.fog = new THREE.FogExp2(0x050811, 0.015);

  cockpitCamera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 200);
  cockpitCamera.position.set(0, 3, 10);
  cockpitCamera.lookAt(0, 0, -10);

  cockpitRenderer = new THREE.WebGLRenderer({ antialias: true });
  cockpitRenderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(cockpitRenderer.domElement);

  // Lights
  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(5, 10, 7);
  cockpitScene.add(light);
  cockpitScene.add(new THREE.AmbientLight(0x404040));

  // Player Ship
  const shipGeo = new THREE.ConeGeometry(0.8, 2.5, 6);
  shipGeo.rotateX(-Math.PI / 2);
  const shipMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 });
  shipMesh = new THREE.Mesh(shipGeo, shipMat);
  cockpitScene.add(shipMesh);

  // Grid floor reference
  const grid = new THREE.GridHelper(100, 40, 0x1e293b, 0x0f172a);
  grid.position.y = -4;
  cockpitScene.add(grid);

  cockpitRenderer.render(cockpitScene, cockpitCamera);
}

function startCockpitGame() {
  if (cockpitRunning) return;
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

    // Responsiveness depends on whether Engine activity was completed
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

    // Spawn obstacles
    spawnTimer += dt;
    if (spawnTimer > 0.45) {
      spawnTimer = 0;
      const geo = new THREE.DodecahedronGeometry(0.9 + Math.random() * 0.7);
      const mat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 });
      const rock = new THREE.Mesh(geo, mat);
      rock.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 7, -60);
      cockpitScene.add(rock);
      asteroids.push(rock);
    }

    // Move obstacles & check collisions
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
      alert('✅ 60 SECONDS SURVIVED! Debris field cleared.');
      return;
    }

    cockpitRenderer.render(cockpitScene, cockpitCamera);
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

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
// 4. HANGAR — 360 EQUIRECTANGULAR & OUTCOMES
// ==========================================
let hangarInitialized = false;
let hangarSequence = [];
const TARGET_HANGAR_SEQ = ['HYDRAULICS', 'FUEL', 'THROTTLE', 'IGNITION'];

function resetHangarSequence() {
  hangarSequence = [];
  document.getElementById('hangar-seq-display').textContent = '[ _ , _ , _ , _ ]';
}

function initHangar360() {
  if (hangarInitialized) return;
  hangarInitialized = true;

  const container = document.getElementById('hangar-360-container');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Equirectangular Sphere
  const sphereGeo = new THREE.SphereGeometry(50, 60, 40);
  sphereGeo.scale(-1, 1, 1);

  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load(
    'assets/cockpit_360.jpg',
    undefined,
    undefined,
    () => {
      // Fallback generated canvas texture if image isn't in assets/ yet
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
      ctx.font = '48px monospace';
      ctx.fillText('SHUTTLE COCKPIT 360° PROJECTION (DRAG TO LOOK AROUND)', 350, 512);
      sphereMat.map = new THREE.CanvasTexture(canvas);
      sphereMat.needsUpdate = true;
    }
  );

  const sphereMat = new THREE.MeshBasicMaterial({ map: texture });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  scene.add(sphere);

  // Interactive AR Switch Zones (matching the cockpit layout)
  const zones = [
    { id: 'HYDRAULICS', label: '1. HYDRAULICS', pos: [-6, 12, -25], color: 0x38bdf8 },
    { id: 'FUEL', label: '2. FUEL VALVES', pos: [6, 12, -25], color: 0xeab308 },
    { id: 'THROTTLE', label: '3. THROTTLE LEVERS', pos: [0, -8, -22], color: 0x22c55e },
    { id: 'IGNITION', label: '4. IGNITION RELEASE', pos: [14, -4, -20], color: 0xef4444 }
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

  // Drag Camera Controls & Raycast Click
  let isDragging = false, prevX = 0, prevY = 0, lon = 0, lat = 0;
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  renderer.domElement.addEventListener('mousedown', e => {
    isDragging = true;
    prevX = e.clientX;
    prevY = e.clientY;
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
    if (isDragging && Math.abs(e.clientX - prevX) < 3) {
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

  let videoSrc = '';
  let title = '';
  let description = '';

  // Outcome Logic Matrix
  if (!gameState.maintenanceDone) {
    if (!isDamaged) {
      videoSrc = 'assets/crash_no_maint.mp4';
      title = 'OUTCOME: SHUTTLE CRASH (FUEL LINE FAILURE)';
      description = 'Maintenance conduits were never reconnected! Fuel pressure ruptured on takeoff.';
    } else {
      videoSrc = 'assets/crash_damaged.mp4';
      title = 'OUTCOME: CATASTROPHIC SHUTTLE CRASH (HULL & FUEL FAILURE)';
      description = 'With unfixed fuel lines and a damaged hull, the shuttle broke apart during launch.';
    }
  } else if (gameState.maintenanceDone && gameState.cockpitDone) {
    if (!isDamaged) {
      if (elapsedMinutes <= 20) {
        videoSrc = 'assets/depart_fast.mp4';
        title = 'VICTORY: OPTIMAL DEPARTURE (< 20 MINUTES)';
        description = `Shuttle launched cleanly in ${elapsedMinutes.toFixed(1)} minutes with a functional ship!`;
      } else {
        videoSrc = 'assets/depart_slow.mp4';
        title = 'MISSION COMPLETE: DELAYED DEPARTURE (> 20 MINUTES)';
        description = `Shuttle departed safely in ${elapsedMinutes.toFixed(1)} minutes, though past the 20-minute window.`;
      }
    } else {
      if (elapsedMinutes <= 20) {
        videoSrc = 'assets/depart_damaged_fast.mp4';
        title = 'ESCAPED: DAMAGED SHUTTLE DEPARTURE (< 20 MINUTES)';
        description = 'The shuttle escaped under 20 minutes, trailing sparks from hull damage.';
      } else {
        videoSrc = 'assets/depart_slow.mp4';
        title = 'ESCAPED: DELAYED & DAMAGED DEPARTURE (> 20 MINUTES)';
        description = 'The damaged shuttle limped out of the hangar after the 20-minute mark.';
      }
    }
  } else {
    // Maintenance done, but Cockpit obstacle run was skipped
    videoSrc = isDamaged ? 'assets/crash_damaged.mp4' : 'assets/crash_no_maint.mp4';
    title = 'OUTCOME: SHUTTLE CRASH (DEBRIS FIELD NOT CLEARED)';
    description = 'Without clearing the cockpit navigation course, the shuttle struck debris immediately after exit.';
  }

  showVideoModal(title, description, videoSrc);
}

function showVideoModal(title, desc, src) {
  const modal = document.getElementById('hangar-video-modal');
  const video = document.getElementById('outcome-video');
  const fallback = document.getElementById('video-fallback-box');

  document.getElementById('outcome-title').textContent = title;
  document.getElementById('outcome-desc').textContent = desc;

  video.classList.remove('hidden');
  fallback.classList.add('hidden');
  video.src = src;

  video.onerror = () => {
    video.classList.add('hidden');
    fallback.classList.remove('hidden');
    fallback.innerHTML = `<strong>[VIDEO FILE PLACEHOLDER: ${src}]</strong><br><br>${desc}`;
  };

  modal.classList.remove('hidden');
}

function closeVideoModal() {
  document.getElementById('outcome-video').pause();
  document.getElementById('hangar-video-modal').classList.add('hidden');
}
