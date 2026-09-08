/**
 * ThermoShelter — Procedural Shelter Geometry Builder
 * ====================================================
 * Builds a complete 3-D shelter mesh from user-supplied parameters.
 *
 * IMPORTANT: This module is purely for 3-D visualisation.
 * No thermal calculations (U-values, heat transfer, infiltration, solar gain)
 * are performed here — those remain in lib/thermoshelter.ts.
 */

import * as THREE from 'three';
import {
  buildThreeMaterial,
  buildWindowMaterial,
  buildDoorMaterial,
  buildGroundMaterial,
  buildThermalMaterial,
  getVisualConfig,
} from './materials';

// ──────────────────────────────────────────────────────────────────────────────
// Public configuration interface
// ──────────────────────────────────────────────────────────────────────────────

export interface ShelterConfig {
  length: number;
  width: number;
  height: number;
  shape: string;          // 'Rectangular' | 'Square'
  orientation: string;    // 'North' | 'South' | 'East' | 'West'
  windowAreaPercentage: number;
  doorArea: number;
  numberOfWindows: number;
  wallMaterialId: string;
  roofMaterialId: string;
  floorMaterialId: string;
}

export interface BuildResult {
  group: THREE.Group;
  boundingBox: THREE.Box3;
  disposables: Array<THREE.BufferGeometry | THREE.Material>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function deg(d: number) { return d * (Math.PI / 180); }

function orientationAngle(o: string): number {
  switch (o) {
    case 'North': return 0;
    case 'East':  return deg(-90);
    case 'South': return deg(180);
    case 'West':  return deg(90);
    default:      return 0;
  }
}

function track(list: Array<THREE.BufferGeometry | THREE.Material>) {
  return <T extends THREE.BufferGeometry | THREE.Material>(item: T): T => {
    list.push(item);
    return item;
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Main builder
// ──────────────────────────────────────────────────────────────────────────────

export function buildShelterGeometry(
  cfg: ShelterConfig,
  thermalMode = false,
  /** 0–1 — only used in thermal mode to tint walls */
  thermalHeatNormalized = 0,
): BuildResult {
  const disposables: Array<THREE.BufferGeometry | THREE.Material> = [];
  const reg = track(disposables);

  const L = Math.max(1, cfg.length);
  const W = Math.max(1, cfg.width);
  const H = Math.max(1, cfg.height);

  const wallVisual   = getVisualConfig(cfg.wallMaterialId);
  const roofVisual   = getVisualConfig(cfg.roofMaterialId);
  const floorVisual  = getVisualConfig(cfg.floorMaterialId);

  const wallMat  = thermalMode
    ? reg(buildThermalMaterial(thermalHeatNormalized, 0.75))
    : reg(buildThreeMaterial(wallVisual));

  const roofMat  = thermalMode
    ? reg(buildThermalMaterial(Math.min(1, thermalHeatNormalized * 0.7), 0.7))
    : reg(buildThreeMaterial(roofVisual));

  const floorMat = reg(buildThreeMaterial(floorVisual));
  const winMat   = reg(buildWindowMaterial());
  const doorMat  = reg(buildDoorMaterial());

  const group = new THREE.Group();

  // ── Orientation rotation ─────────────────────────────────────────────────
  group.rotation.y = orientationAngle(cfg.orientation);

  // ── Floor slab ───────────────────────────────────────────────────────────
  const floorGeo = reg(new THREE.BoxGeometry(L, 0.06, W));
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = -0.03;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // ── Four walls (box geometry per wall, hollow centre) ───────────────────
  const wallThick = Math.min(0.18, Math.min(L, W) * 0.04);

  function addWall(
    wx: number, wy: number, wz: number,
    px: number, py: number, pz: number,
    castShadow = true,
  ) {
    const g = reg(new THREE.BoxGeometry(wx, wy, wz));
    const m = new THREE.Mesh(g, wallMat);
    m.position.set(px, py, pz);
    m.castShadow = castShadow;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }

  // Front wall (–Z face — door side)
  // Back wall (+Z face)
  // Left wall (–X face)
  // Right wall (+X face)
  const wallMidY = H / 2;

  // Back wall (solid)
  addWall(L, H, wallThick, 0, wallMidY, W / 2);

  // Left wall (solid)
  addWall(wallThick, H, W, -L / 2, wallMidY, 0);

  // Right wall (solid)
  addWall(wallThick, H, W, L / 2, wallMidY, 0);

  // ── Front wall — split around door ──────────────────────────────────────
  const doorH = Math.min(H * 0.75, 2.2);
  const doorW = Math.min(L * 0.15, 1.2);
  const doorCentreX = 0; // centred on front face

  // Left chunk of front wall (beside door)
  const fwLeftW = L / 2 - doorW / 2;
  if (fwLeftW > 0.05) {
    addWall(fwLeftW, H, wallThick, -L / 2 + fwLeftW / 2, wallMidY, -W / 2);
  }
  // Right chunk
  if (fwLeftW > 0.05) {
    addWall(fwLeftW, H, wallThick, L / 2 - fwLeftW / 2, wallMidY, -W / 2);
  }
  // Lintel above door
  const lintelH = H - doorH;
  if (lintelH > 0.05) {
    addWall(doorW, lintelH, wallThick, doorCentreX, H - lintelH / 2, -W / 2);
  }

  // ── Door panel ───────────────────────────────────────────────────────────
  const doorGeo = reg(new THREE.BoxGeometry(doorW * 0.96, doorH, wallThick * 0.5));
  const doorMesh = new THREE.Mesh(doorGeo, doorMat);
  doorMesh.position.set(doorCentreX, doorH / 2, -W / 2 - wallThick * 0.26);
  doorMesh.castShadow = true;
  group.add(doorMesh);

  // Door handle (small sphere)
  const handleGeo = reg(new THREE.SphereGeometry(0.04, 8, 6));
  const handleMat = reg(new THREE.MeshStandardMaterial({ color: 0xd4a853, roughness: 0.3, metalness: 0.7 }));
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.set(doorCentreX + doorW * 0.35, doorH * 0.48, -W / 2 - wallThick * 0.52);
  group.add(handle);

  // ── Windows ──────────────────────────────────────────────────────────────
  const winCount = Math.max(0, Math.min(cfg.numberOfWindows, 8));
  if (winCount > 0) {
    placeWindows(group, disposables, L, W, H, wallThick, wallMidY, winCount, winMat, wallMat);
  }

  // ── Pitched roof ─────────────────────────────────────────────────────────
  buildPitchedRoof(group, disposables, L, W, H, wallThick, roofMat);

  // ── Ground plane ─────────────────────────────────────────────────────────
  const groundGeo = reg(new THREE.PlaneGeometry(L * 4, W * 4));
  const groundMat = reg(buildGroundMaterial());
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.065;
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // ── Grid helper (subtle) ─────────────────────────────────────────────────
  const gridSize = Math.ceil(Math.max(L, W) * 3);
  const grid = new THREE.GridHelper(gridSize, gridSize, 0x9ca3af, 0xd1d5db);
  (grid.material as THREE.Material).opacity = 0.25;
  (grid.material as THREE.Material).transparent = true;
  grid.position.y = -0.06;
  group.add(grid);

  // ── Compass indicator ────────────────────────────────────────────────────
  addCompass(group, L, W, H);

  // ── Dimension lines ──────────────────────────────────────────────────────
  addDimensionLines(group, disposables, L, W, H);

  // Compute bounding box (in world space after rotation is applied)
  group.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(group);

  return { group, boundingBox: bb, disposables };
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-builders
// ──────────────────────────────────────────────────────────────────────────────

function placeWindows(
  group: THREE.Group,
  disposables: Array<THREE.BufferGeometry | THREE.Material>,
  L: number,
  W: number,
  H: number,
  wallThick: number,
  wallMidY: number,
  winCount: number,
  winMat: THREE.Material,
  wallMat: THREE.Material,
) {
  const reg = track(disposables);

  const winH  = Math.min(H * 0.38, 1.0);
  const winW  = Math.min(L * 0.14, 0.9);
  const winY  = H * 0.6;  // window centre height

  // Distribute windows: first on right wall, then back wall, then left
  const walls: Array<{ axis: 'x' | 'z'; side: -1 | 1; maxCount: number; span: number }> = [
    { axis: 'z', side:  1, maxCount: 2, span: W },  // back wall along X
    { axis: 'x', side:  1, maxCount: 3, span: L },  // right wall along Z
    { axis: 'x', side: -1, maxCount: 3, span: L },  // left wall along Z
  ];

  let remaining = winCount;

  for (const wall of walls) {
    if (remaining <= 0) break;
    const n = Math.min(remaining, wall.maxCount);

    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : (i + 1) / (n + 1);
      const offset = (t - 0.5) * wall.span * 0.7;

      const geo = reg(new THREE.BoxGeometry(
        wall.axis === 'x' ? wallThick * 1.1 : winW,
        winH,
        wall.axis === 'x' ? winW : wallThick * 1.1,
      ));

      const mesh = new THREE.Mesh(geo, winMat);

      if (wall.axis === 'x') {
        mesh.position.set(wall.side * (L / 2 + 0.01), winY, offset);
      } else {
        mesh.position.set(offset, winY, wall.side * (W / 2 + 0.01));
      }
      group.add(mesh);

      // Window frame (thin box around glass)
      const frameW = wall.axis === 'x' ? wallThick * 0.5 : winW + 0.06;
      const frameH = winH + 0.06;
      const frameD = wall.axis === 'x' ? winW + 0.06 : wallThick * 0.5;
      const frameGeo = reg(new THREE.BoxGeometry(frameW, frameH, frameD));
      const frameMat = reg(new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.6, metalness: 0.2 }));
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.copy(mesh.position);
      group.add(frame);

      // Punch a notch in the corresponding wall section (visual only — just set window in front)
    }

    remaining -= n;
  }
}

function buildPitchedRoof(
  group: THREE.Group,
  disposables: Array<THREE.BufferGeometry | THREE.Material>,
  L: number,
  W: number,
  H: number,
  wallThick: number,
  roofMat: THREE.Material,
) {
  const reg = track(disposables);
  const ridgeHeight = H * 0.32;
  const overhang = 0.25;

  // The roof is made of two pitched planes.
  // We build each as a flat quad (plane geometry) and tilt it.
  const slopeAngle = Math.atan2(ridgeHeight, W / 2);
  const slopeLen   = Math.sqrt((W / 2) * (W / 2) + ridgeHeight * ridgeHeight) + overhang;

  for (const side of [-1, 1] as const) {
    const geo = reg(new THREE.BoxGeometry(L + overhang * 2, 0.06, slopeLen));
    const mesh = new THREE.Mesh(geo, roofMat);

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    mesh.position.set(
      0,
      H + ridgeHeight / 2,
      side * (W / 4 - overhang * 0.3),
    );
    mesh.rotation.x = side * slopeAngle;
    group.add(mesh);
  }

  // Ridge beam
  const ridgeGeo = reg(new THREE.BoxGeometry(L + overhang * 2, 0.09, 0.09));
  const ridgeMat = reg(new THREE.MeshStandardMaterial({ color: 0x5a3e28, roughness: 0.75, metalness: 0.0 }));
  const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
  ridge.position.set(0, H + ridgeHeight + 0.045, 0);
  ridge.castShadow = true;
  group.add(ridge);

  // Gable end triangles (left and right)
  for (const side of [-1, 1] as const) {
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2 - overhang, H);
    shape.lineTo(0, H + ridgeHeight);
    shape.lineTo(W / 2 + overhang, H);
    shape.lineTo(-W / 2 - overhang, H);

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 0.06,
      bevelEnabled: false,
    };

    const gableGeo = reg(new THREE.ExtrudeGeometry(shape, extrudeSettings));
    const gableMesh = new THREE.Mesh(gableGeo, roofMat);

    gableMesh.rotation.y = Math.PI / 2;
    gableMesh.position.set(side * (L / 2 + overhang), 0, 0);

    if (side === 1) gableMesh.position.z -= 0.06;
    gableMesh.castShadow = true;
    group.add(gableMesh);
  }
}

function addCompass(
  group: THREE.Group,
  L: number,
  W: number,
  H: number,
) {
  // Compass positioned to the front-right of the shelter
  const cx = L / 2 + 1.2;
  const cy = 0.05;
  const cz = -W / 2 - 1.2;

  const radius = 0.4;
  const ringGeo = new THREE.RingGeometry(radius - 0.04, radius, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x374151, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(cx, cy, cz);
  group.add(ring);

  const dirs: { label: string; angle: number; color: number }[] = [
    { label: 'N', angle: 0,            color: 0xef4444 },
    { label: 'S', angle: Math.PI,      color: 0x374151 },
    { label: 'E', angle: Math.PI / 2,  color: 0x374151 },
    { label: 'W', angle: -Math.PI / 2, color: 0x374151 },
  ];

  for (const d of dirs) {
    const arrowGeo = new THREE.ConeGeometry(0.06, 0.22, 6);
    const arrowMat = new THREE.MeshBasicMaterial({ color: d.color });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);

    const x = cx + Math.sin(d.angle) * (radius - 0.12);
    const z = cz + Math.cos(d.angle) * (radius - 0.12);
    arrow.position.set(x, cy + 0.12, z);
    arrow.rotation.x = Math.PI / 2;
    arrow.rotation.z = d.angle;
    group.add(arrow);
  }
}

function addDimensionLines(
  group: THREE.Group,
  disposables: Array<THREE.BufferGeometry | THREE.Material>,
  L: number,
  W: number,
  H: number,
) {
  const reg = track(disposables);
  const lineMat = reg(new THREE.LineBasicMaterial({ color: 0x6366f1, linewidth: 1.5 }));
  const dimOffset = 0.4;

  // Length line (along X, in front of shelter)
  const lenPoints = [
    new THREE.Vector3(-L / 2, H / 2, -W / 2 - dimOffset),
    new THREE.Vector3( L / 2, H / 2, -W / 2 - dimOffset),
  ];
  const lenGeo = reg(new THREE.BufferGeometry().setFromPoints(lenPoints));
  group.add(new THREE.Line(lenGeo, lineMat));

  // Width line (along Z, to the right of shelter)
  const widPoints = [
    new THREE.Vector3(L / 2 + dimOffset, H / 2, -W / 2),
    new THREE.Vector3(L / 2 + dimOffset, H / 2,  W / 2),
  ];
  const widGeo = reg(new THREE.BufferGeometry().setFromPoints(widPoints));
  group.add(new THREE.Line(widGeo, lineMat));

  // Height line (vertical, left side)
  const hPoints = [
    new THREE.Vector3(-L / 2 - dimOffset, 0,  0),
    new THREE.Vector3(-L / 2 - dimOffset, H,  0),
  ];
  const hGeo = reg(new THREE.BufferGeometry().setFromPoints(hPoints));
  group.add(new THREE.Line(hGeo, lineMat));

  // End-cap ticks
  const tick = 0.12;
  for (const [p1, p2, axis] of [
    [lenPoints[0], lenPoints[1], 'x'],
    [widPoints[0], widPoints[1], 'z'],
    [hPoints[0], hPoints[1], 'y'],
  ] as const) {
    for (const pt of [p1, p2]) {
      const dx = axis === 'x' ? 0 : tick;
      const dy = axis === 'y' ? 0 : tick;
      const dz = axis === 'z' ? 0 : tick;
      const tGeo = reg(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pt.x - dx, pt.y - dy, pt.z - dz),
        new THREE.Vector3(pt.x + dx, pt.y + dy, pt.z + dz),
      ]));
      group.add(new THREE.Line(tGeo, lineMat));
    }
  }
}
