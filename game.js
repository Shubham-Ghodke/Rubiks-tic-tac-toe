import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Game Configurations & Constants ---
const MOVES = [
  { layer: 'U', axis: 'y', angle: -Math.PI / 2, name: "U" },
  { layer: 'U', axis: 'y', angle: Math.PI / 2, name: "U'" },
  { layer: 'D', axis: 'y', angle: Math.PI / 2, name: "D" },
  { layer: 'D', axis: 'y', angle: -Math.PI / 2, name: "D'" },
  { layer: 'R', axis: 'x', angle: -Math.PI / 2, name: "R" },
  { layer: 'R', axis: 'x', angle: Math.PI / 2, name: "R'" },
  { layer: 'L', axis: 'x', angle: Math.PI / 2, name: "L" },
  { layer: 'L', axis: 'x', angle: -Math.PI / 2, name: "L'" },
  { layer: 'F', axis: 'z', angle: -Math.PI / 2, name: "F" },
  { layer: 'F', axis: 'z', angle: Math.PI / 2, name: "F'" },
  { layer: 'B', axis: 'z', angle: Math.PI / 2, name: "B" },
  { layer: 'B', axis: 'z', angle: -Math.PI / 2, name: "B'" },
  { layer: 'M', axis: 'x', angle: Math.PI / 2, name: "M" },
  { layer: 'M', axis: 'x', angle: -Math.PI / 2, name: "M'" },
  { layer: 'E', axis: 'y', angle: Math.PI / 2, name: "E" },
  { layer: 'E', axis: 'y', angle: -Math.PI / 2, name: "E'" },
  { layer: 'S', axis: 'z', angle: -Math.PI / 2, name: "S" },
  { layer: 'S', axis: 'z', angle: Math.PI / 2, name: "S'" }
];

// --- Engine Variables ---
let scene, camera, renderer, controls;
let cubeGroup;
let cubies = [];
let stickers = [];
let previewX, previewO;
let activeRotationArrow = null;
let activePreviewStickers = [];
let pointLightCyan, pointLightMagenta;

// --- Game State Variables ---
let gameMode = '2p'; // '2p' (Local 2 Player) or 'ai' (VS Computer)
let aiDifficulty = 'medium'; // 'easy', 'medium', or 'hard'
let currentPlayer = 1; // 1 for Player 1 (X), 2 for Player 2 (O)
let turnPhase = 'place'; // 'place' (place mark) or 'rotate' (rotate layer)
let movesCount = 0;
let gameOver = false;
let isAnimating = false;
let currentHoveredSticker = null;
let animationData = null; // for tracking active rotation interpolation
let winAnimationId = null;
let lastMarkedCubie = null;
let activeWinLines = [];
let player1Name = "Player 1";
let player2Name = "Player 2";
let player1Color = 0x00f3ff;
let player2Color = 0xff007f;

// --- Init Application ---
function init() {
  const container = document.getElementById('canvas-container');

  // Scene Setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b0f);

  // Camera Setup
  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  
  // Renderer Setup
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // OrbitControls Setup
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 4;
  controls.maxDistance = 10;
  controls.enablePan = false; // block panning to keep cube centered

  // Lighting Setup
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 0.6);
  mainLight.position.set(5, 8, 5);
  scene.add(mainLight);

  // Neon Specular Point Lights for Cinematic Glow
  pointLightCyan = new THREE.PointLight(player1Color, 1.5, 15);
  pointLightCyan.position.set(4, 4, 4);
  scene.add(pointLightCyan);

  pointLightMagenta = new THREE.PointLight(player2Color, 1.5, 15);
  pointLightMagenta.position.set(-4, -4, -4);
  scene.add(pointLightMagenta);

  // Create Rubik's Cube
  createCube();

  // Create Hover Previews
  createPreviews();

  // Position Camera
  resetCamera();

  // Handle Resize
  window.addEventListener('resize', onWindowResize);

  // Drag vs Click State Management
  let pointerDownPos = { x: 0, y: 0 };
  let pointerDownTime = 0;

  renderer.domElement.addEventListener('pointerdown', (e) => {
    pointerDownPos.x = e.clientX;
    pointerDownPos.y = e.clientY;
    pointerDownTime = performance.now();
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = performance.now() - pointerDownTime;

    if (dist < 5 && duration < 350) {
      onCanvasClick(e);
    }
  });

  renderer.domElement.addEventListener('pointermove', onPointerMove);

  // Initialize UI Text
  updateUI();

  // Start Loop
  animate();
}

// --- Create 3D Rubik's Cube Objects ---
function createCube() {
  cubeGroup = new THREE.Group();
  scene.add(cubeGroup);

  const cubieGeo = new THREE.BoxGeometry(0.92, 0.92, 0.92);
  const cubieMat = new THREE.MeshStandardMaterial({
    color: 0x141419,
    roughness: 0.6,
    metalness: 0.2
  });

  const stickerGeo = new THREE.PlaneGeometry(0.78, 0.78);
  const stickerMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.2,
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  const offset = 0.461;

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        // Core interior space has no mesh, only create cubes on exterior shells
        if (x === 0 && y === 0 && z === 0) continue;

        const cubie = new THREE.Mesh(cubieGeo, cubieMat);
        cubie.position.set(x, y, z);
        cubeGroup.add(cubie);
        cubies.push(cubie);

        // Helper to attach individual sticker plane
        const addSticker = (posX, posY, posZ, rotX, rotY, rotZ, faceName) => {
          const sticker = new THREE.Mesh(stickerGeo, stickerMat.clone());
          sticker.position.set(posX, posY, posZ);
          sticker.rotation.set(rotX, rotY, rotZ);
          cubie.add(sticker);
          stickers.push(sticker);

          sticker.userData = {
            mark: null,
            cubie: cubie,
            initialFace: faceName,
            originalColor: 0xffffff
          };
        };

        // Classify and offset stickers to make it look like a Rubik's cube
        if (x === 1)  addSticker(offset, 0, 0, 0, Math.PI / 2, 0, 'R');
        if (x === -1) addSticker(-offset, 0, 0, 0, -Math.PI / 2, 0, 'L');
        if (y === 1)  addSticker(0, offset, 0, -Math.PI / 2, 0, 0, 'U');
        if (y === -1) addSticker(0, -offset, 0, Math.PI / 2, 0, 0, 'D');
        if (z === 1)  addSticker(0, 0, offset, 0, 0, 0, 'F');
        if (z === -1) addSticker(0, 0, -offset, 0, Math.PI, 0, 'B');
      }
    }
  }
}

// --- Create Hover Glow Previews ---
function createPreviews() {
  // Preview X Mesh Group
  previewX = new THREE.Group();
  const barGeo = new THREE.BoxGeometry(0.46, 0.07, 0.04);
  const matX = new THREE.MeshStandardMaterial({
    color: 0x00f3ff,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
  });
  const bar1 = new THREE.Mesh(barGeo, matX);
  bar1.rotation.z = Math.PI / 4;
  const bar2 = new THREE.Mesh(barGeo, matX);
  bar2.rotation.z = -Math.PI / 4;
  previewX.add(bar1, bar2);
  previewX.position.set(0, 0, 0.02);
  previewX.visible = false;

  // Preview O Mesh
  const torusGeo = new THREE.TorusGeometry(0.22, 0.05, 8, 24);
  const matO = new THREE.MeshStandardMaterial({
    color: 0xff007f,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
  });
  previewO = new THREE.Mesh(torusGeo, matO);
  previewO.position.set(0, 0, 0.02);
  previewO.visible = false;
}

// --- Canvas Click/Tap Placement Handler ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onCanvasClick(e) {
  if (gameOver || isAnimating) return;
  if (currentPlayer === 2 && gameMode === 'ai') return;
  if (turnPhase !== 'place') {
    showToast("Please select a layer to rotate!");
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(stickers);

  if (intersects.length > 0) {
    const sticker = intersects[0].object;
    if (sticker.userData.mark === null) {
      placePlayerMark(sticker, currentPlayer);
    }
  }
}

// --- Pointer Hover Effects ---
function onPointerMove(e) {
  if (gameOver || isAnimating) {
    clearHover();
    return;
  }
  if (currentPlayer === 2 && gameMode === 'ai') {
    clearHover();
    return;
  }
  if (turnPhase !== 'place') {
    clearHover();
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(stickers);

  if (intersects.length > 0) {
    const sticker = intersects[0].object;
    if (sticker.userData.mark === null) {
      showHover(sticker);
      return;
    }
  }
  clearHover();
}

function showHover(sticker) {
  if (currentHoveredSticker === sticker) return;
  clearHover();
  currentHoveredSticker = sticker;

  const preview = currentPlayer === 1 ? previewX : previewO;
  sticker.add(preview);
  preview.visible = true;

  sticker.material.color.setHex(0xebebfa);
  playHoverSound();
}

function clearHover() {
  if (currentHoveredSticker) {
    currentHoveredSticker.material.color.setHex(currentHoveredSticker.userData.originalColor);
    currentHoveredSticker = null;
  }
  previewX.visible = false;
  previewO.visible = false;
  if (previewX.parent) previewX.parent.remove(previewX);
  if (previewO.parent) previewO.parent.remove(previewO);
}

// --- Place Mark Visual Mechanics ---
function placePlayerMark(sticker, player) {
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  playPlaceSound();
  clearHover();

  const symbol = player === 1 ? 'X' : 'O';
  sticker.userData.mark = symbol;

  let markMesh;
  if (symbol === 'X') {
    markMesh = new THREE.Group();
    const barGeo = new THREE.BoxGeometry(0.46, 0.07, 0.05);
    const matX = new THREE.MeshStandardMaterial({
      color: player1Color,
      emissive: player1Color,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.4
    });
    const bar1 = new THREE.Mesh(barGeo, matX);
    bar1.rotation.z = Math.PI / 4;
    const bar2 = new THREE.Mesh(barGeo, matX);
    bar2.rotation.z = -Math.PI / 4;
    markMesh.add(bar1, bar2);
  } else {
    const torusGeo = new THREE.TorusGeometry(0.22, 0.05, 8, 24);
    const matO = new THREE.MeshStandardMaterial({
      color: player2Color,
      emissive: player2Color,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.4
    });
    markMesh = new THREE.Mesh(torusGeo, matO);
  }

  markMesh.position.set(0, 0, 0.025);
  sticker.add(markMesh);

  // Growth expansion animation (scale-up)
  markMesh.scale.set(0.01, 0.01, 0.01);
  const duration = 250;
  const startTime = performance.now();

  function animScale() {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Out-elastic style curve
    const ease = Math.sin(progress * Math.PI / 2);
    markMesh.scale.set(ease, ease, ease);
    
    if (progress < 1) {
      requestAnimationFrame(animScale);
    }
  }
  requestAnimationFrame(animScale);

  lastMarkedCubie = sticker.userData.cubie;

  movesCount++;
  currentPlayer = currentPlayer === 1 ? 2 : 1; // Hand turn to opponent for rotation
  turnPhase = 'rotate';
  updateUI();

  // Trigger AI if it is the computer's turn to rotate
  if (gameMode === 'ai' && currentPlayer === 2) {
    runAITurn();
  }
}

// --- Rotate Cube Layer Animation System ---
function rotateLayer(layerCode, dir) {
  if (isAnimating || gameOver) return;

  if (turnPhase !== 'rotate') {
    showToast("Please place your mark first!");
    return;
  }

  // Validate that the rotated layer contains the last marked cubie
  if (!isLayerValidForCubie(layerCode, lastMarkedCubie)) {
    showToast("Must rotate a layer containing the placed mark!");
    return;
  }

  clearRotationPreview();

  // Find standard move properties
  const move = MOVES.find(m => m.layer === layerCode && (dir === 1 ? m.angle > 0 : m.angle < 0));
  if (!move) return;

  isAnimating = true;
  playRotateSound();

  // Gather cubies residing on this layer
  const targetCubies = [];
  cubies.forEach(cubie => {
    let match = false;
    if (layerCode === 'U' && cubie.position.y > 0.5) match = true;
    else if (layerCode === 'D' && cubie.position.y < -0.5) match = true;
    else if (layerCode === 'R' && cubie.position.x > 0.5) match = true;
    else if (layerCode === 'L' && cubie.position.x < -0.5) match = true;
    else if (layerCode === 'F' && cubie.position.z > 0.5) match = true;
    else if (layerCode === 'B' && cubie.position.z < -0.5) match = true;
    else if (layerCode === 'M' && Math.abs(cubie.position.x) < 0.5) match = true;
    else if (layerCode === 'E' && Math.abs(cubie.position.y) < 0.5) match = true;
    else if (layerCode === 'S' && Math.abs(cubie.position.z) < 0.5) match = true;

    if (match) targetCubies.push(cubie);
  });

  // Setup pivot transform parent
  const pivot = new THREE.Group();
  scene.add(pivot);

  targetCubies.forEach(cubie => {
    pivot.attach(cubie);
  });

  // Define interpolator
  animationData = {
    pivot: pivot,
    axis: move.axis,
    startAngle: 0,
    endAngle: move.angle,
    startTime: performance.now(),
    duration: 500, // ms duration
    onComplete: () => {
      // Reparent cubies back to central cubeGroup
      const children = [...pivot.children];
      children.forEach(cubie => {
        cubeGroup.attach(cubie);
      });

      scene.remove(pivot);

      // Snap coordinates to clean floating-point errors
      cubies.forEach(cubie => {
        cubie.position.x = Math.round(cubie.position.x);
        cubie.position.y = Math.round(cubie.position.y);
        cubie.position.z = Math.round(cubie.position.z);
        snapObjectRotation(cubie);
      });

      isAnimating = false;

      // Victory scan
      const wins = checkWin();
      if (wins.length > 0) {
        triggerWin(wins);
      } else {
        const empty = stickers.filter(s => s.userData.mark === null);
        if (empty.length === 0) {
          triggerDraw();
        } else {
          // Under new split rules, the player who rotated now places their mark
          lastMarkedCubie = null;
          turnPhase = 'place';
          updateUI();

          // Trigger AI placement if active
          if (gameMode === 'ai' && currentPlayer === 2) {
            runAITurn();
          }
        }
      }
    }
  };
}

// --- Mathematical Snapping Helper for Orthonormal Rotations ---
function snapObjectRotation(object) {
  object.updateMatrix();
  const mat = object.matrix;

  // Extract direction vectors from elements
  const x = new THREE.Vector3(mat.elements[0], mat.elements[1], mat.elements[2]).normalize();
  const y = new THREE.Vector3(mat.elements[4], mat.elements[5], mat.elements[6]).normalize();

  const snapVector = (v) => {
    const ax = Math.abs(v.x);
    const ay = Math.abs(v.y);
    const az = Math.abs(v.z);
    if (ax > ay && ax > az) return new THREE.Vector3(Math.sign(v.x), 0, 0);
    if (ay > ax && ay > az) return new THREE.Vector3(0, Math.sign(v.y), 0);
    return new THREE.Vector3(0, 0, Math.sign(v.z));
  };

  const snappedX = snapVector(x);
  let snappedY = snapVector(y);

  if (Math.abs(snappedX.dot(snappedY)) > 0.9) {
    snappedY = new THREE.Vector3(0, 1, 0);
  }

  const snappedZ = new THREE.Vector3().crossVectors(snappedX, snappedY).normalize();

  const snapMatrix = new THREE.Matrix4();
  snapMatrix.makeBasis(snappedX, snappedY, snappedZ);

  object.rotation.setFromRotationMatrix(snapMatrix);
  object.updateMatrix();
}

// --- Vector Math Helper for Simulated Evaluations ---
function rotateVectorAroundAxis(v, axis, angle) {
  const x = v.x, y = v.y, z = v.z;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  if (axis === 'x') {
    return {
      x: x,
      y: y * cos - z * sin,
      z: y * sin + z * cos
    };
  } else if (axis === 'y') {
    return {
      x: x * cos - z * sin,
      y: y,
      z: x * sin + z * cos
    };
  } else { // z axis
    return {
      x: x * cos - y * sin,
      y: x * sin + y * cos,
      z: z
    };
  }
}

// --- Map World Coords to standard 3x3 grids (returns 6 grids of 9 stickers) ---
function getFacesStickers() {
  scene.updateMatrixWorld(true);
  const faces = { U: [], D: [], L: [], R: [], F: [], B: [] };

  stickers.forEach(sticker => {
    const worldNormal = new THREE.Vector3();
    sticker.getWorldDirection(worldNormal);

    const worldPos = new THREE.Vector3();
    sticker.getWorldPosition(worldPos);

    if (worldNormal.y > 0.8) faces.U.push({ sticker, pos: worldPos });
    else if (worldNormal.y < -0.8) faces.D.push({ sticker, pos: worldPos });
    else if (worldNormal.x < -0.8) faces.L.push({ sticker, pos: worldPos });
    else if (worldNormal.x > 0.8) faces.R.push({ sticker, pos: worldPos });
    else if (worldNormal.z > 0.8) faces.F.push({ sticker, pos: worldPos });
    else if (worldNormal.z < -0.8) faces.B.push({ sticker, pos: worldPos });
  });

  // Sort each face's coordinates to standard 3x3 array layout
  faces.U.sort((a, b) => (Math.abs(a.pos.z - b.pos.z) > 0.1 ? a.pos.z - b.pos.z : a.pos.x - b.pos.x));
  faces.D.sort((a, b) => (Math.abs(a.pos.z - b.pos.z) > 0.1 ? b.pos.z - a.pos.z : a.pos.x - b.pos.x));
  faces.F.sort((a, b) => (Math.abs(a.pos.y - b.pos.y) > 0.1 ? b.pos.y - a.pos.y : a.pos.x - b.pos.x));
  faces.B.sort((a, b) => (Math.abs(a.pos.y - b.pos.y) > 0.1 ? b.pos.y - a.pos.y : b.pos.x - a.pos.x));
  faces.L.sort((a, b) => (Math.abs(a.pos.y - b.pos.y) > 0.1 ? b.pos.y - a.pos.y : a.pos.z - b.pos.z));
  faces.R.sort((a, b) => (Math.abs(a.pos.y - b.pos.y) > 0.1 ? b.pos.y - a.pos.y : b.pos.z - a.pos.z));

  const grids = {};
  for (const f in faces) {
    grids[f] = faces[f].map(item => item.sticker);
  }
  return grids;
}

// --- Scan 6 Faces for Tic-Tac-Toe Rows/Cols/Diags ---
function checkWin() {
  const grids = getFacesStickers();
  const winLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
    [0, 4, 8], [2, 4, 6]             // Diagonals
  ];

  const wins = [];

  for (const face in grids) {
    const grid = grids[face];
    if (grid.length !== 9) continue; // safety check

    for (const line of winLines) {
      const mark0 = grid[line[0]].userData.mark;
      const mark1 = grid[line[1]].userData.mark;
      const mark2 = grid[line[2]].userData.mark;

      if (mark0 && mark0 === mark1 && mark0 === mark2) {
        wins.push({
          face,
          player: mark0 === 'X' ? 1 : 2,
          line: line,
          stickers: [grid[line[0]], grid[line[1]], grid[line[2]]]
        });
      }
    }
  }

  return wins;
}

// --- Computer/AI Opponent Routine ---
function runAITurn() {
  document.getElementById('action-text').innerText = "Computer is calculating...";
  isAnimating = true;

  setTimeout(() => {
    if (turnPhase === 'place') {
      let move = null;
      const randVal = Math.random();
      let useRandom = false;

      if (aiDifficulty === 'easy') {
        useRandom = true;
      } else if (aiDifficulty === 'medium') {
        useRandom = randVal < 0.5; // 50% chance of random placement
      }

      if (useRandom) {
        const emptyIndices = [];
        stickers.forEach((s, idx) => {
          if (s.userData.mark === null) {
            emptyIndices.push(idx);
          }
        });
        if (emptyIndices.length > 0) {
          const randIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
          move = { stickerIndex: randIdx };
        }
      } else {
        move = computeBestAIPlacement();
      }

      if (!move) {
        isAnimating = false;
        triggerDraw();
        return;
      }

      // Place O mark
      const targetSticker = stickers[move.stickerIndex];
      placePlayerMark(targetSticker, 2);
      isAnimating = false; // Enable user to make their rotation response
    } else {
      let move = null;
      const randVal = Math.random();
      let useRandom = false;

      if (aiDifficulty === 'easy') {
        useRandom = true;
      } else if (aiDifficulty === 'medium') {
        useRandom = randVal < 0.5; // 50% chance of random rotation
      }

      if (useRandom) {
        const validMoves = [];
        MOVES.forEach(m => {
          if (isLayerValidForCubie(m.layer, lastMarkedCubie)) {
            validMoves.push(m);
          }
        });
        if (validMoves.length > 0) {
          const randMove = validMoves[Math.floor(Math.random() * validMoves.length)];
          move = { layer: randMove.layer, dir: randMove.angle > 0 ? 1 : -1 };
        }
      } else {
        move = computeBestAIRotation();
      }

      if (!move) {
        isAnimating = false;
        triggerDraw();
        return;
      }

      // Short pause, then rotate
      setTimeout(() => {
        isAnimating = false;
        rotateLayer(move.layer, move.dir);
      }, 900);
    }
  }, 600);
}

// --- Simulate board state mathematical projection ---
function simRotate(simStickers, move) {
  const nextStickers = simStickers.map(s => ({
    index: s.index,
    pos: { ...s.pos },
    normal: { ...s.normal },
    mark: s.mark
  }));

  nextStickers.forEach(s => {
    let inLayer = false;
    if (move.layer === 'U' && s.pos.y > 0.5) inLayer = true;
    else if (move.layer === 'D' && s.pos.y < -0.5) inLayer = true;
    else if (move.layer === 'R' && s.pos.x > 0.5) inLayer = true;
    else if (move.layer === 'L' && s.pos.x < -0.5) inLayer = true;
    else if (move.layer === 'F' && s.pos.z > 0.5) inLayer = true;
    else if (move.layer === 'B' && s.pos.z < -0.5) inLayer = true;
    else if (move.layer === 'M' && Math.abs(s.pos.x) < 0.5) inLayer = true;
    else if (move.layer === 'E' && Math.abs(s.pos.y) < 0.5) inLayer = true;
    else if (move.layer === 'S' && Math.abs(s.pos.z) < 0.5) inLayer = true;

    if (inLayer) {
      s.pos = rotateVectorAroundAxis(s.pos, move.axis, move.angle);
      s.normal = rotateVectorAroundAxis(s.normal, move.axis, move.angle);
      
      // Snap positions
      s.pos.x = Math.round(s.pos.x * 1000) / 1000;
      s.pos.y = Math.round(s.pos.y * 1000) / 1000;
      s.pos.z = Math.round(s.pos.z * 1000) / 1000;

      s.normal.x = Math.round(s.normal.x);
      s.normal.y = Math.round(s.normal.y);
      s.normal.z = Math.round(s.normal.z);
    }
  });

  return nextStickers;
}

// --- Sim evaluation to determine scores ---
function evaluateSimBoard(simStickers) {
  const faces = { U: [], D: [], L: [], R: [], F: [], B: [] };

  simStickers.forEach(s => {
    if (s.normal.y > 0.8) faces.U.push(s);
    else if (s.normal.y < -0.8) faces.D.push(s);
    else if (s.normal.x < -0.8) faces.L.push(s);
    else if (s.normal.x > 0.8) faces.R.push(s);
    else if (s.normal.z > 0.8) faces.F.push(s);
    else if (s.normal.z < -0.8) faces.B.push(s);
  });

  faces.U.sort((a, b) => (Math.abs(a.pos.z - b.pos.z) > 0.1 ? a.pos.z - b.pos.z : a.pos.x - b.pos.x));
  faces.D.sort((a, b) => (Math.abs(a.pos.z - b.pos.z) > 0.1 ? b.pos.z - a.pos.z : a.pos.x - b.pos.x));
  faces.F.sort((a, b) => (Math.abs(a.pos.y - b.pos.y) > 0.1 ? b.pos.y - a.pos.y : a.pos.x - b.pos.x));
  faces.B.sort((a, b) => (Math.abs(a.pos.y - b.pos.y) > 0.1 ? b.pos.y - a.pos.y : b.pos.x - a.pos.x));
  faces.L.sort((a, b) => (Math.abs(a.pos.y - b.pos.y) > 0.1 ? b.pos.y - a.pos.y : a.pos.z - b.pos.z));
  faces.R.sort((a, b) => (Math.abs(a.pos.y - b.pos.y) > 0.1 ? b.pos.y - a.pos.y : b.pos.z - a.pos.z));

  const winLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  let p1Wins = 0;
  let p2Wins = 0;
  let score = 0;

  for (const face in faces) {
    const grid = faces[face];
    if (grid.length !== 9) continue;

    for (const line of winLines) {
      const m0 = grid[line[0]].mark;
      const m1 = grid[line[1]].mark;
      const m2 = grid[line[2]].mark;

      if (m0 === 'X' && m1 === 'X' && m2 === 'X') {
        p1Wins++;
      } else if (m0 === 'O' && m1 === 'O' && m2 === 'O') {
        p2Wins++;
      } else {
        let xCount = 0;
        let oCount = 0;
        let emptyCount = 0;
        [m0, m1, m2].forEach(m => {
          if (m === 'X') xCount++;
          else if (m === 'O') oCount++;
          else emptyCount++;
        });

        if (oCount === 2 && emptyCount === 1) score += 100;
        else if (oCount === 1 && emptyCount === 2) score += 10;

        if (xCount === 2 && emptyCount === 1) score -= 300; // Block user!
        else if (xCount === 1 && emptyCount === 2) score -= 5;
      }
    }
  }

  return { p1Wins, p2Wins, score };
}

// --- Rule Helper for valid layer checks ---
function isLayerValidForCubie(layerCode, cubie) {
  if (!cubie) return false;
  const px = Math.round(cubie.position.x);
  const py = Math.round(cubie.position.y);
  const pz = Math.round(cubie.position.z);

  if (layerCode === 'U' && py > 0.5) return true;
  if (layerCode === 'D' && py < -0.5) return true;
  if (layerCode === 'R' && px > 0.5) return true;
  if (layerCode === 'L' && px < -0.5) return true;
  if (layerCode === 'F' && pz > 0.5) return true;
  if (layerCode === 'B' && pz < -0.5) return true;
  if (layerCode === 'M' && Math.abs(px) < 0.5) return true;
  if (layerCode === 'E' && Math.abs(py) < 0.5) return true;
  if (layerCode === 'S' && Math.abs(pz) < 0.5) return true;
  return false;
}

// --- AI Placement Search (Minimax lookahead under constraints) ---
function computeBestAIPlacement() {
  const emptyStickerIndices = [];
  stickers.forEach((s, idx) => {
    if (s.userData.mark === null) {
      emptyStickerIndices.push(idx);
    }
  });

  if (emptyStickerIndices.length === 0) return null;

  const simBoard = stickers.map((s, idx) => {
    const worldPos = new THREE.Vector3();
    s.getWorldPosition(worldPos);
    const worldNormal = new THREE.Vector3();
    s.getWorldDirection(worldNormal);

    return {
      index: idx,
      pos: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
      normal: { x: worldNormal.x, y: worldNormal.y, z: worldNormal.z },
      mark: s.userData.mark
    };
  });

  const candidates = [];

  for (const sIdx of emptyStickerIndices) {
    // Simulate placement of O
    const boardAfterPlace = simBoard.map(s => ({
      index: s.index,
      pos: { ...s.pos },
      normal: { ...s.normal },
      mark: s.index === sIdx ? 'O' : s.mark
    }));

    const placeStickerPos = boardAfterPlace[sIdx].pos;
    const cubiePos = {
      x: Math.round(placeStickerPos.x),
      y: Math.round(placeStickerPos.y),
      z: Math.round(placeStickerPos.z)
    };

    const isSimLayerValid = (layerCode, pos) => {
      if (layerCode === 'U' && pos.y > 0.5) return true;
      if (layerCode === 'D' && pos.y < -0.5) return true;
      if (layerCode === 'R' && pos.x > 0.5) return true;
      if (layerCode === 'L' && pos.x < -0.5) return true;
      if (layerCode === 'F' && pos.z > 0.5) return true;
      if (layerCode === 'B' && pos.z < -0.5) return true;
      if (layerCode === 'M' && Math.abs(pos.x) < 0.5) return true;
      if (layerCode === 'E' && Math.abs(pos.y) < 0.5) return true;
      if (layerCode === 'S' && Math.abs(pos.z) < 0.5) return true;
      return false;
    };

    // Valid rotation responses for opponent (Player 1)
    const validP1Moves = MOVES.filter(m => isSimLayerValid(m.layer, cubiePos));
    
    let minScore = Infinity;
    let p1WinPossible = false;

    for (const move of validP1Moves) {
      const boardAfterRot = simRotate(boardAfterPlace, move);
      const evalResult = evaluateSimBoard(boardAfterRot);
      if (evalResult.p1Wins > 0) {
        p1WinPossible = true;
      }
      if (evalResult.score < minScore) {
        minScore = evalResult.score;
      }
    }

    let finalScore = minScore;
    if (p1WinPossible) {
      finalScore -= 10000; // Penalize if it gives Player 1 a winning rotation response
    }

    candidates.push({
      stickerIndex: sIdx,
      score: finalScore
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const bestScore = candidates[0].score;
  const ties = candidates.filter(c => Math.abs(c.score - bestScore) < 0.1);
  return ties[Math.floor(Math.random() * ties.length)];
}

// --- AI Rotation Search (Max score choice under constraints) ---
function computeBestAIRotation() {
  const validMoves = [];
  MOVES.forEach(move => {
    if (isLayerValidForCubie(move.layer, lastMarkedCubie)) {
      validMoves.push(move);
    }
  });

  if (validMoves.length === 0) return null;

  const simBoard = stickers.map((s, idx) => {
    const worldPos = new THREE.Vector3();
    s.getWorldPosition(worldPos);
    const worldNormal = new THREE.Vector3();
    s.getWorldDirection(worldNormal);

    return {
      index: idx,
      pos: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
      normal: { x: worldNormal.x, y: worldNormal.y, z: worldNormal.z },
      mark: s.userData.mark
    };
  });

  const candidates = [];
  for (const move of validMoves) {
    const boardAfterRot = simRotate(simBoard, move);
    const evalResult = evaluateSimBoard(boardAfterRot);
    
    if (evalResult.p2Wins > 0 && evalResult.p1Wins === 0) {
      return { layer: move.layer, dir: move.angle > 0 ? 1 : -1 }; // immediate win
    }
    
    candidates.push({
      layer: move.layer,
      dir: move.angle > 0 ? 1 : -1,
      score: evalResult.score
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

// --- Trigger Win Mechanics ---
function triggerWin(wins) {
  gameOver = true;
  playVictorySound();
  clearHover();

  // Draw glowing winning lines
  wins.forEach(win => {
    const normal = new THREE.Vector3();
    win.stickers[0].getWorldDirection(normal);
    normal.normalize();

    // Offset the points outward along the normal so the cylinder floats above the marks
    const offsetDistance = 0.065; // slightly above the mark which is at 0.025
    
    const worldPosA = new THREE.Vector3();
    win.stickers[0].getWorldPosition(worldPosA);
    worldPosA.addScaledVector(normal, offsetDistance);

    const worldPosB = new THREE.Vector3();
    win.stickers[2].getWorldPosition(worldPosB);
    worldPosB.addScaledVector(normal, offsetDistance);

    const localPosA = worldPosA.clone();
    cubeGroup.worldToLocal(localPosA);

    const localPosB = worldPosB.clone();
    cubeGroup.worldToLocal(localPosB);

    const midpoint = new THREE.Vector3().addVectors(localPosA, localPosB).multiplyScalar(0.5);
    const direction = new THREE.Vector3().subVectors(localPosB, localPosA);
    const dist = direction.length();
    direction.normalize();

    const cylinderHeight = dist + 0.25; // extend slightly past the stickers
    const cylinderGeo = new THREE.CylinderGeometry(0.03, 0.03, cylinderHeight, 8, 1);
    
    const color = win.player === 1 ? player1Color : player2Color;
    const cylinderMat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 2.0,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85
    });

    const lineMesh = new THREE.Mesh(cylinderGeo, cylinderMat);
    lineMesh.position.copy(midpoint);

    const alignAxis = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(alignAxis, direction);
    lineMesh.quaternion.copy(quaternion);

    // Add to cubeGroup so it rotates with the cube
    cubeGroup.add(lineMesh);
    activeWinLines.push(lineMesh);

    // Drawing animation (scale Y from 0.01 to 1.0)
    lineMesh.scale.set(1, 0.01, 1);
    const animStartTime = performance.now();
    const animDuration = 400;

    function animateWinLine() {
      if (gameOver) {
        const elapsed = performance.now() - animStartTime;
        const progress = Math.min(elapsed / animDuration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // out-cubic
        lineMesh.scale.y = ease;

        if (progress < 1) {
          requestAnimationFrame(animateWinLine);
        }
      }
    }
    requestAnimationFrame(animateWinLine);
  });

  const winningStickers = new Set();
  wins.forEach(w => {
    w.stickers.forEach(s => winningStickers.add(s));
  });

  const startTime = performance.now();

  function flashWinningStickers() {
    if (!gameOver) return;

    const elapsed = performance.now() - startTime;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed / 120);

    winningStickers.forEach(sticker => {
      const markMesh = sticker.children[0];
      if (markMesh) {
        const scaleVal = 1 + 0.15 * Math.sin(elapsed / 120);
        markMesh.scale.set(scaleVal, scaleVal, scaleVal);

        if (markMesh.material) {
          markMesh.material.emissiveIntensity = 0.8 + 0.6 * Math.sin(elapsed / 120);
        } else {
          markMesh.children.forEach(c => {
            if (c.material) c.material.emissiveIntensity = 0.8 + 0.6 * Math.sin(elapsed / 120);
          });
        }
      }

      const pColor = wins[0].player === 1 ? player1Color : player2Color;
      sticker.material.color.setHex(pulse > 0.5 ? pColor : 0xffffff);
    });

    winAnimationId = requestAnimationFrame(flashWinningStickers);
  }

  flashWinningStickers();

  // Show Modal Overlay
  setTimeout(() => {
    const modal = document.getElementById('game-over-modal');
    const banner = document.getElementById('winner-banner');
    const title = document.getElementById('modal-title');
    const message = document.getElementById('modal-message');
    const statTurns = document.getElementById('stat-turns');
    const statMode = document.getElementById('stat-mode');

    banner.className = 'winner-glow';
    if (wins[0].player === 1) {
      banner.classList.add('x-won');
      banner.innerText = 'X';
      title.innerText = `${player1Name.toUpperCase()} WINS!`;
      title.style.color = 'var(--p1-color)';
    } else {
      banner.classList.add('o-won');
      banner.innerText = 'O';
      title.innerText = gameMode === 'ai' ? 'COMPUTER WINS!' : `${player2Name.toUpperCase()} WINS!`;
      title.style.color = 'var(--p2-color)';
    }

    const facesFullNames = {
      U: 'Up Face', D: 'Down Face', L: 'Left Face',
      R: 'Right Face', F: 'Front Face', B: 'Back Face'
    };
    const facesNames = wins.map(w => facesFullNames[w.face]).join(' & ');
    message.innerText = `${wins[0].player === 1 ? player1Name : player2Name} formed 3-in-a-row on the ${facesNames}!`;

    statTurns.innerText = movesCount;
    statMode.innerText = gameMode === '2p' ? 'Player to Player' : 'Player vs Computer';

    modal.classList.remove('hidden');
  }, 1000);
}

// --- Trigger Draw Mechanics ---
function triggerDraw() {
  gameOver = true;

  setTimeout(() => {
    const modal = document.getElementById('game-over-modal');
    const banner = document.getElementById('winner-banner');
    const title = document.getElementById('modal-title');
    const message = document.getElementById('modal-message');
    const statTurns = document.getElementById('stat-turns');
    const statMode = document.getElementById('stat-mode');

    banner.className = 'winner-glow draw';
    banner.innerText = '=';
    title.innerText = 'DRAW MATCH!';
    title.style.color = 'var(--text-secondary)';
    message.innerText = "No moves left! All stickers are fully marked.";

    statTurns.innerText = movesCount;
    statMode.innerText = gameMode === '2p' ? 'Player to Player' : 'Player vs Computer';

    modal.classList.remove('hidden');
  }, 500);
}

// --- Reset Camera to Isometric ---
function resetCamera() {
  const container = document.getElementById('canvas-container');
  const aspect = container ? container.clientWidth / container.clientHeight : 1.0;
  
  const basePos = new THREE.Vector3(4.2, 4.2, 5.8);
  if (aspect < 1) {
    // Zoom out proportionally for portrait viewports to prevent horizontal clipping
    const scale = 1 + 0.3 * (1 - aspect) / aspect;
    basePos.multiplyScalar(scale);
  }
  
  camera.position.copy(basePos);
  camera.lookAt(0, 0, 0);
  if (controls) {
    controls.target.set(0, 0, 0);
    controls.update();
  }
}

// --- Game Logic Controllers ---
function restartGame() {
  if (winAnimationId) {
    cancelAnimationFrame(winAnimationId);
    winAnimationId = null;
  }

  stickers.forEach(sticker => {
    sticker.userData.mark = null;
    sticker.material.color.setHex(sticker.userData.originalColor);

    const toRemove = [];
    sticker.children.forEach(c => {
      if (c !== previewX && c !== previewO) toRemove.push(c);
    });
    toRemove.forEach(c => sticker.remove(c));
  });

  // Clear winning lines
  activeWinLines.forEach(line => {
    cubeGroup.remove(line);
    if (line.geometry) line.geometry.dispose();
    if (line.material) line.material.dispose();
  });
  activeWinLines = [];

  // Restore modal state
  restoreModal();

  currentPlayer = 1;
  turnPhase = 'place';
  movesCount = 0;
  gameOver = false;
  isAnimating = false;

  previewX.visible = false;
  previewO.visible = false;
  if (previewX.parent) previewX.parent.remove(previewX);
  if (previewO.parent) previewO.parent.remove(previewO);
  clearRotationPreview();
  lastMarkedCubie = null;

  resetCamera();
  updateUI();
  showToast("Match restarted!");
}

function setGameMode(mode) {
  if (movesCount > 0) {
    if (!confirm("Changing game mode will restart the current match. Continue?")) {
      return;
    }
  }
  gameMode = mode;
  restartGame();
}

function setDifficulty(diff) {
  aiDifficulty = diff;
  updateUI();
  showToast(`Difficulty set to ${diff.toUpperCase()}`);
}

function closeModalAndRestart() {
  document.getElementById('game-over-modal').classList.add('hidden');
  restartGame();
}

function minimizeModal() {
  document.getElementById('game-over-modal').classList.add('minimized');
  document.getElementById('review-banner').classList.remove('hidden');
}

function restoreModal() {
  // Guard to ensure elements exist before accessing classes
  const modal = document.getElementById('game-over-modal');
  const banner = document.getElementById('review-banner');
  if (modal) modal.classList.remove('minimized');
  if (banner) banner.classList.add('hidden');
}

function updateUI() {
  const p1Card = document.getElementById('player1-card');
  const p2Card = document.getElementById('player2-card');
  const actionText = document.getElementById('action-text');
  const actionBanner = document.getElementById('turn-action-indicator');

  // Sync names with customization cards
  const p1CardName = document.querySelector('#player1-card .player-name');
  const p2CardName = document.querySelector('#player2-card .player-name');
  if (p1CardName) p1CardName.innerText = player1Name;
  if (p2CardName) p2CardName.innerText = player2Name;

  const p2Input = document.getElementById('input-p2-name');
  const p2CustomRow = document.getElementById('p2-custom-row');
  if (p2Input) {
    if (gameMode === 'ai') {
      p2Input.value = "Computer";
      p2Input.disabled = true;
      player2Name = "Computer";
      if (p2CustomRow) p2CustomRow.style.opacity = '0.5';
    } else {
      p2Input.disabled = false;
      player2Name = p2Input.value.trim() || "Player 2";
      if (p2CustomRow) p2CustomRow.style.opacity = '1.0';
    }
  }

  if (currentPlayer === 1) {
    p1Card.classList.add('active');
    p2Card.classList.remove('active');
  } else {
    p2Card.classList.add('active');
    p1Card.classList.remove('active');
  }

  const name = currentPlayer === 1 ? player1Name : (gameMode === 'ai' ? 'Computer' : player2Name);
  actionBanner.classList.remove('place-phase', 'rotate-phase');

  if (turnPhase === 'place') {
    actionBanner.classList.add('place-phase');
    actionText.innerText = `${name}: Click an empty sticker!`;
  } else {
    actionBanner.classList.add('rotate-phase');
    const opponentName = currentPlayer === 1 ? (gameMode === 'ai' ? "Computer's" : `${player2Name}'s`) : `${player1Name}'s`;
    actionText.innerText = `${name}: Rotate a layer containing ${opponentName} mark!`;
  }

  // Update controls grid based on valid moves
  const controlButtons = document.querySelectorAll('.btn-control');
  controlButtons.forEach(btn => {
    if (btn.id === 'btn-camera-reset') return;
    
    if (turnPhase === 'place' || gameOver) {
      btn.disabled = true;
      btn.classList.remove('valid-move');
    } else {
      const layerCode = btn.getAttribute('data-layer');
      const isValid = isLayerValidForCubie(layerCode, lastMarkedCubie);
      btn.disabled = !isValid;
      if (isValid) {
        btn.classList.add('valid-move');
      } else {
        btn.classList.remove('valid-move');
      }
    }
  });

  const mode2p = document.getElementById('mode-2p');
  const modeAi = document.getElementById('mode-ai');
  const p2Name = document.getElementById('p2-name');

  if (gameMode === '2p') {
    mode2p.classList.add('active');
    modeAi.classList.remove('active');
    p2Name.innerText = "Player 2";
  } else {
    modeAi.classList.add('active');
    mode2p.classList.remove('active');
    p2Name.innerText = "Computer";
  }

  // Update difficulty container state
  const diffContainer = document.getElementById('difficulty-selector-container');
  if (diffContainer) {
    if (gameMode === 'ai') {
      diffContainer.classList.remove('collapsed');
    } else {
      diffContainer.classList.add('collapsed');
    }
  }

  // Update active difficulty button styling
  const diffs = ['easy', 'medium', 'hard'];
  diffs.forEach(d => {
    const btn = document.getElementById(`diff-${d}`);
    if (btn) {
      if (aiDifficulty === d) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });
}

// --- Floating Toast Display ---
function showToast(message) {
  let toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.innerText = message;
  toast.classList.add('show');

  if (toast.timeoutId) clearTimeout(toast.timeoutId);

  toast.timeoutId = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

// --- Standard Window Resize handler ---
function onWindowResize() {
  const container = document.getElementById('canvas-container');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// --- Animation Render Loop ---
function animate() {
  requestAnimationFrame(animate);

  // Update OrbitControls
  controls.update();

  // Run rotation interpolation
  if (animationData) {
    const elapsed = performance.now() - animationData.startTime;
    const progress = Math.min(elapsed / animationData.duration, 1);

    // ease-in-out-cubic
    const ease = progress < 0.5 
      ? 4 * progress * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    const angle = animationData.startAngle + (animationData.endAngle - animationData.startAngle) * ease;

    animationData.pivot.rotation.set(0, 0, 0);
    if (animationData.axis === 'x') animationData.pivot.rotation.x = angle;
    if (animationData.axis === 'y') animationData.pivot.rotation.y = angle;
    if (animationData.axis === 'z') animationData.pivot.rotation.z = angle;

    if (progress >= 1) {
      const callback = animationData.onComplete;
      animationData = null;
      callback();
    }
  }

  if (activeRotationArrow) {
    activeRotationArrow.rotateZ(activeRotationArrow.userData.spinSpeed);
  }

  renderer.render(scene, camera);
}

// --- Web Audio API Synth Engine ---
let audioCtx = null;
let isMuted = false;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playHoverSound() {
  if (isMuted) return;
  initAudio();
  if (!audioCtx || audioCtx.state === 'suspended') return;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(750, audioCtx.currentTime);
  
  gain.gain.setValueAtTime(0.012, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.04);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.04);
}

function playPlaceSound() {
  if (isMuted) return;
  initAudio();
  if (!audioCtx || audioCtx.state === 'suspended') return;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(380, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1100, audioCtx.currentTime + 0.16);
  
  gain.gain.setValueAtTime(0.07, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.16);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.16);
}

function playRotateSound() {
  if (isMuted) return;
  initAudio();
  if (!audioCtx || audioCtx.state === 'suspended') return;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(170, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(75, audioCtx.currentTime + 0.45);
  
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(320, audioCtx.currentTime);
  filter.frequency.linearRampToValueAtTime(90, audioCtx.currentTime + 0.45);
  
  gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.45);
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.45);
}

function playVictorySound() {
  if (isMuted) return;
  initAudio();
  if (!audioCtx || audioCtx.state === 'suspended') return;
  
  const now = audioCtx.currentTime;
  const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
  
  notes.forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.value = freq;
    
    const startTime = now + idx * 0.08;
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.setValueAtTime(0.06, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.5);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(startTime);
    osc.stop(startTime + 0.5);
  });
}

function toggleSound() {
  isMuted = !isMuted;
  const btn = document.getElementById('btn-sound-toggle');
  if (btn) {
    if (isMuted) {
      btn.classList.add('muted');
      showToast("Audio muted");
    } else {
      btn.classList.remove('muted');
      initAudio();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      playHoverSound();
      showToast("Audio enabled");
    }
  }
}

// --- Rotation Preview Overlays ---
function createSingularChevron(ringMat) {
  const chevronGroup = new THREE.Group();
  
  // Create a flat, sharp triangular arrowhead by scaling a 3-sided cone along Z axis
  const coneGeo = new THREE.ConeGeometry(0.12, 0.24, 3);

  const mesh = new THREE.Mesh(coneGeo, ringMat);
  mesh.position.y = 0;
  // Flatten along the Z axis (thickness perpendicular to torus plane)
  mesh.scale.set(1.0, 1.0, 0.15);
  // Align rotation around Y so the flat side is orthogonal
  mesh.rotation.y = 0;
  chevronGroup.add(mesh);

  return chevronGroup;
}

function showRotationPreview(layerCode, dir) {
  if (isAnimating || gameOver) return;
  if (currentPlayer === 2 && gameMode === 'ai') return; // Hide preview during AI turn

  clearRotationPreview();

  // 1. Highlight stickers in the layer with warm amber
  stickers.forEach(s => {
    const worldPos = new THREE.Vector3();
    s.getWorldPosition(worldPos);
    let match = false;
    if (layerCode === 'U' && worldPos.y > 0.5) match = true;
    else if (layerCode === 'D' && worldPos.y < -0.5) match = true;
    else if (layerCode === 'R' && worldPos.x > 0.5) match = true;
    else if (layerCode === 'L' && worldPos.x < -0.5) match = true;
    else if (layerCode === 'F' && worldPos.z > 0.5) match = true;
    else if (layerCode === 'B' && worldPos.z < -0.5) match = true;
    else if (layerCode === 'M' && Math.abs(worldPos.x) < 0.5) match = true;
    else if (layerCode === 'E' && Math.abs(worldPos.y) < 0.5) match = true;
    else if (layerCode === 'S' && Math.abs(worldPos.z) < 0.5) match = true;

    if (match) {
      activePreviewStickers.push(s);
      s.material.color.setHex(0xffd60a); // Warm amber highlight
    }
  });

  const move = MOVES.find(m => m.layer === layerCode && (dir === 1 ? m.angle > 0 : m.angle < 0));
  if (!move) return;

  // 2. Create the rotating ring overlay group
  activeRotationArrow = new THREE.Group();
  scene.add(activeRotationArrow);

  let posX = 0, posY = 0, posZ = 0;
  if (layerCode === 'U') posY = 1.0;
  else if (layerCode === 'D') posY = -1.0;
  else if (layerCode === 'R') posX = 1.0;
  else if (layerCode === 'L') posX = -1.0;
  else if (layerCode === 'F') posZ = 1.0;
  else if (layerCode === 'B') posZ = -1.0;
  // Equator, Middle, and Standing slices are centered at 0, 0, 0
  activeRotationArrow.position.set(posX, posY, posZ);

  if (layerCode === 'U' || layerCode === 'D' || layerCode === 'E') {
    activeRotationArrow.rotation.x = Math.PI / 2;
  } else if (layerCode === 'R' || layerCode === 'L' || layerCode === 'M') {
    activeRotationArrow.rotation.y = Math.PI / 2;
  }

  // Torus geometry wrapping the layer outside its corners (distance to corner is ~2.06)
  const torusRadius = 2.15;
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffd60a,
    emissive: 0xffd60a,
    emissiveIntensity: 1.8,
    transparent: true,
    opacity: 0.9
  });

  const isCCW = move.angle > 0;
  // Invert spin direction to match physical layers
  const spinSpeed = 0.035 * (isCCW ? -1 : 1);
  activeRotationArrow.userData = { spinSpeed };

  // Create 3 holographic arc segments with double chevrons
  const numSegments = 3;
  for (let i = 0; i < numSegments; i++) {
    const startTheta = (i * 2 * Math.PI) / numSegments;

    // 60-degree arc geometry
    const arcGeo = new THREE.TorusGeometry(torusRadius, 0.02, 8, 24, Math.PI / 3);
    const arcMesh = new THREE.Mesh(arcGeo, ringMat);
    arcMesh.rotation.z = startTheta;
    activeRotationArrow.add(arcMesh);

    // Place chevron at leading edge (CW moves to startTheta, CCW moves to startTheta + PI/3)
    const chevronTheta = isCCW ? startTheta : startTheta + Math.PI / 3;
    const chevron = createSingularChevron(ringMat);
    chevron.position.set(torusRadius * Math.cos(chevronTheta), torusRadius * Math.sin(chevronTheta), 0);

    // Point in the direction of motion (CW tangent is theta - PI/2, CCW tangent is theta + PI/2)
    const tangentAngle = isCCW ? chevronTheta - Math.PI / 2 : chevronTheta + Math.PI / 2;
    chevron.rotation.z = tangentAngle;

    activeRotationArrow.add(chevron);
  }
}

function clearRotationPreview() {
  activePreviewStickers.forEach(s => {
    if (s.userData.mark === null) {
      s.material.color.setHex(s.userData.originalColor);
    } else {
      s.material.color.setHex(0xffffff); // reset to original white backing
    }
  });
  activePreviewStickers = [];

  if (activeRotationArrow) {
    scene.remove(activeRotationArrow);
    activeRotationArrow.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    activeRotationArrow = null;
  }
}

// --- Global Scope Exposes ---
window.rotateLayer = rotateLayer;
window.setGameMode = setGameMode;
window.setDifficulty = setDifficulty;
window.resetCamera = resetCamera;
window.restartGame = restartGame;
window.closeModalAndRestart = closeModalAndRestart;
window.minimizeModal = minimizeModal;
window.restoreModal = restoreModal;
window.toggleSound = toggleSound;
window.showRotationPreview = showRotationPreview;
window.clearRotationPreview = clearRotationPreview;
window.setPlayerColor = setPlayerColor;
window.onPlayerCustomizationChange = onPlayerCustomizationChange;

function getGlowColor(hexStr) {
  const r = parseInt(hexStr.slice(1, 3), 16);
  const g = parseInt(hexStr.slice(3, 5), 16);
  const b = parseInt(hexStr.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.25)`;
}

function setPlayerColor(playerNum, hexStr, buttonEl) {
  const hexNum = parseInt(hexStr.replace('#', '0x'));
  
  if (playerNum === 1) {
    player1Color = hexNum;
    document.documentElement.style.setProperty('--p1-color', hexStr);
    document.documentElement.style.setProperty('--p1-glow', getGlowColor(hexStr));
    
    if (pointLightCyan) pointLightCyan.color.setHex(hexNum);
    
    previewX.children.forEach(c => {
      if (c.material) {
        c.material.color.setHex(hexNum);
        c.material.emissive.setHex(hexNum);
      }
    });
    
    const previewEl = document.getElementById('p1-avatar-preview');
    if (previewEl) {
      previewEl.style.borderColor = hexStr;
      previewEl.style.background = getGlowColor(hexStr);
      previewEl.style.color = hexStr;
    }
  } else {
    player2Color = hexNum;
    document.documentElement.style.setProperty('--p2-color', hexStr);
    document.documentElement.style.setProperty('--p2-glow', getGlowColor(hexStr));
    
    if (pointLightMagenta) pointLightMagenta.color.setHex(hexNum);
    
    if (previewO && previewO.material) {
      previewO.material.color.setHex(hexNum);
      previewO.material.emissive.setHex(hexNum);
    }
    
    const previewEl = document.getElementById('p2-avatar-preview');
    if (previewEl) {
      previewEl.style.borderColor = hexStr;
      previewEl.style.background = getGlowColor(hexStr);
      previewEl.style.color = hexStr;
    }
  }
  
  if (buttonEl) {
    const siblings = buttonEl.parentNode.querySelectorAll('.color-dot');
    siblings.forEach(s => s.classList.remove('active'));
    buttonEl.classList.add('active');
  }
  
  updateExistingMarksColors();
  updateUI();
}

function updateExistingMarksColors() {
  stickers.forEach(sticker => {
    const symbol = sticker.userData.mark;
    if (symbol === 'X') {
      sticker.children.forEach(c => {
        if (c !== previewX && c !== previewO) {
          c.children.forEach(bar => {
            if (bar.material) {
              bar.material.color.setHex(player1Color);
              bar.material.emissive.setHex(player1Color);
            }
          });
        }
      });
    } else if (symbol === 'O') {
      sticker.children.forEach(c => {
        if (c !== previewX && c !== previewO) {
          if (c.material) {
            c.material.color.setHex(player2Color);
            c.material.emissive.setHex(player2Color);
          }
        }
      });
    }
  });
}

function onPlayerCustomizationChange() {
  const p1Input = document.getElementById('input-p1-name');
  const p2Input = document.getElementById('input-p2-name');
  
  if (p1Input) player1Name = p1Input.value.trim() || "Player 1";
  if (p2Input && gameMode !== 'ai') player2Name = p2Input.value.trim() || "Player 2";
  
  updateUI();
}

// Run initialization on load
window.addEventListener('DOMContentLoaded', init);
