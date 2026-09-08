/**
 * ThermoShelter — Three.js Visual Material Definitions
 * =====================================================
 * NOTE: These are purely VISUAL rendering properties.
 * Thermal conductivity, U-values, heat transfer — all remain in
 * lib/thermoshelter.ts (the Python engine equivalent).
 * This file only controls how materials LOOK in the 3D viewport.
 */

import * as THREE from 'three';

export interface VisualMaterialConfig {
  id: string;
  displayName: string;
  /** Wall face color */
  color: number;
  /** Roughness for MeshStandardMaterial (0=mirror, 1=fully diffuse) */
  roughness: number;
  /** Metalness */
  metalness: number;
  /** Optional emissive tint for thermal view */
  emissive?: number;
}

export const VISUAL_MATERIALS: Record<string, VisualMaterialConfig> = {
  'Concrete': {
    id: 'Concrete',
    displayName: 'Concrete',
    color: 0x9ca3af,   // cool grey
    roughness: 0.85,
    metalness: 0.0,
  },
  'Wood': {
    id: 'Wood',
    displayName: 'Wood',
    color: 0xc8a472,   // warm oak
    roughness: 0.78,
    metalness: 0.0,
  },
  'EPS Insulation': {
    id: 'EPS Insulation',
    displayName: 'EPS Insulation',
    color: 0xfef3c7,   // pale yellow-white foam
    roughness: 0.9,
    metalness: 0.0,
  },
  'Rammed Earth': {
    id: 'Rammed Earth',
    displayName: 'Rammed Earth',
    color: 0xb5845a,   // earthy terracotta
    roughness: 0.95,
    metalness: 0.0,
  },
  'Compressed Earth Block': {
    id: 'Compressed Earth Block',
    displayName: 'Compressed Earth Block',
    color: 0xc4916a,
    roughness: 0.92,
    metalness: 0.0,
  },
  'Lime Plaster': {
    id: 'Lime Plaster',
    displayName: 'Lime Plaster',
    color: 0xe8e4d9,   // off-white lime
    roughness: 0.70,
    metalness: 0.0,
  },
  'Insulated Metal Panel': {
    id: 'Insulated Metal Panel',
    displayName: 'Insulated Metal Panel',
    color: 0x8fa3b1,
    roughness: 0.45,
    metalness: 0.55,
  },
  'Mud + Lime Roof': {
    id: 'Mud + Lime Roof',
    displayName: 'Mud + Lime Roof',
    color: 0xa07850,
    roughness: 0.88,
    metalness: 0.0,
  },
  'Local Stone Slab': {
    id: 'Local Stone Slab',
    displayName: 'Local Stone Slab',
    color: 0x78818c,
    roughness: 0.80,
    metalness: 0.05,
  },
  'Adobe Floor': {
    id: 'Adobe Floor',
    displayName: 'Adobe Floor',
    color: 0xc4a07a,
    roughness: 0.85,
    metalness: 0.0,
  },
  'Double Glazed Low-E': {
    id: 'Double Glazed Low-E',
    displayName: 'Double Glazed Low-E',
    color: 0x93c5fd,
    roughness: 0.05,
    metalness: 0.0,
  },
  'Insulated Timber Door': {
    id: 'Insulated Timber Door',
    displayName: 'Insulated Timber Door',
    color: 0x92614a,
    roughness: 0.75,
    metalness: 0.0,
  },
  'Stone Thermal Mass': {
    id: 'Stone Thermal Mass',
    displayName: 'Stone Thermal Mass',
    color: 0x64748b,
    roughness: 0.82,
    metalness: 0.08,
  },
};

// ── Material-ID (from thermoshelter.ts) ↔ VISUAL_MATERIALS key mapping ─────
const ID_TO_VISUAL_KEY: Record<string, string> = {
  'rammed-earth':    'Rammed Earth',
  'compressed-earth':'Compressed Earth Block',
  'lime-plaster':    'Lime Plaster',
  'concrete':        'Concrete',
  'wood':            'Wood',
  'eps-insulation':  'EPS Insulation',
  'insulated-metal': 'Insulated Metal Panel',
  'mud-roof':        'Mud + Lime Roof',
  'stone-slab':      'Local Stone Slab',
  'adobe-floor':     'Adobe Floor',
  'double-glazed':   'Double Glazed Low-E',
  'timber-door':     'Insulated Timber Door',
  'stone-mass':      'Stone Thermal Mass',
};

export function getVisualConfig(materialId: string): VisualMaterialConfig {
  const key = ID_TO_VISUAL_KEY[materialId] ?? materialId;
  return VISUAL_MATERIALS[key] ?? VISUAL_MATERIALS['Rammed Earth'];
}

/** Build a Three.js MeshStandardMaterial from a visual config. */
export function buildThreeMaterial(
  config: VisualMaterialConfig,
  opacity = 1.0,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: config.color,
    roughness: config.roughness,
    metalness: config.metalness,
    transparent: opacity < 1.0,
    opacity,
    side: THREE.FrontSide,
  });
}

/** Glass-like material for windows. */
export function buildWindowMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0xbfdbfe,
    roughness: 0.02,
    metalness: 0.0,
    transmission: 0.82,
    thickness: 0.02,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  });
}

/** Door material — warm timber tone. */
export function buildDoorMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x7c4f32,
    roughness: 0.72,
    metalness: 0.0,
  });
}

/** Ground plane material. */
export function buildGroundMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x8d9e7a,
    roughness: 0.95,
    metalness: 0.0,
  });
}

/** Thermal-overlay material (warm/cool gradient applied via colour). */
export function buildThermalMaterial(
  normalizedHeat: number, // 0 = cool, 1 = hot
  opacity = 0.55,
): THREE.MeshStandardMaterial {
  // Blue → Cyan → Yellow → Red
  const cool = new THREE.Color(0x3b82f6);
  const hot  = new THREE.Color(0xef4444);
  const blended = cool.clone().lerp(hot, normalizedHeat);
  return new THREE.MeshStandardMaterial({
    color: blended,
    roughness: 0.6,
    metalness: 0.0,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
  });
}
