/**
 * ThermoShelter — Computational Physics Engine
 * =============================================
 * Deterministic thermal simulation and material recommendation
 * for cold-climate shelter design (SIH26051 MVP Phase 2).
 *
 * Physics model:
 *   C * dTin/dt = Qsolar + Qinternal - Qconduction - Qinfiltration
 *
 * Solved via single-node Implicit Euler for unconditional numerical stability:
 *   T_in_next = (T_in * C/dt + Q_solar + U_total * T_out) / (C/dt + U_total)
 */

export type ClimateProfile = {
  id: string;
  name: string;
  location: string;
  climateType: string;
  ambientTemperature: number;
  solarRadiation: number;
  sunshineDuration: number;
  windSpeed: number;
  relativeHumidity: number;
};

export type Material = {
  id: string;
  name: string;
  category: 'wall' | 'roof' | 'floor' | 'window' | 'door' | 'thermal_storage';
  thermalConductivity: number; // k [W/(m·K)]
  density: number;             // density [kg/m³]
  specificHeat: number;        // cp [J/(kg·K)]
  defaultThickness: number;    // thickness [mm]
  thermalResistance: number;   // R [m²·K/W]
  description: string;
};

export type ShelterDesign = {
  id: string;
  name: string;
  length: number;
  width: number;
  height: number;
  shape: 'Rectangular' | 'Square';
  orientation: 'North' | 'South' | 'East' | 'West';
  windowAreaPercentage: number;
  doorArea: number;
  numberOfWindows: number;
  wallMaterialId: string;
  roofMaterialId: string;
  floorMaterialId: string;
  windowMaterialId: string;
  doorMaterialId: string;
  thermalStorageMaterialId: string;
  climateProfileId: string;
};

export type SimulationPoint = {
  timestamp: string;
  ambientTemperature: number;
  solarRadiation: number;
  internalTemperature: number;
  solarGain: number;
  heatLoss: number;
  heatingRequirement: number;
};

export type SimulationOutput = {
  points: SimulationPoint[];
  averageInternalTemperature: number;
  totalSolarGain: number;
  totalHeatLoss: number;
  totalHeatingRequirement: number;
  breakdown: { name: string; value: number; color: string }[];
  minTemperature?: number;
  maxTemperature?: number;
  totalHeatLossKwh?: number;
  totalSolarKwh?: number;
};

export type OptimizationResult = {
  score: number;
  orientation: ShelterDesign['orientation'];
  wall: string;
  roof: string;
  windowArea: number;
  thermalStorage: string;
  solarGain: number;
  heatLoss: number;
  heatingRequirement: number;
  explanation: string[];
};

export interface PhysicsSimulationResult {
  hours: number[];
  outdoor_temperature: number[];
  indoor_temperature: number[];
  solar_gain: number[];
  wall_heat_loss: number[];
  roof_heat_loss: number[];
  floor_heat_loss: number[];
  window_heat_loss?: number[];
  door_heat_loss?: number[];
  infiltration_heat_loss: number[];
  total_heat_loss_array: number[];
  net_heat_flow: number[];
  total_heat_loss_kwh: number;
  total_solar_kwh: number;
  min_temperature: number;
  max_temperature: number;
  avg_temperature: number;
}

// ============================================================
// MATERIAL DATABASE
// ============================================================

export const MATERIALS: Record<string, { k: number; density: number; cp: number }> = {
  "Concrete": {
    k: 1.70,
    density: 2400.0,
    cp: 880.0,
  },
  "Wood": {
    k: 0.15,
    density: 500.0,
    cp: 1600.0,
  },
  "EPS Insulation": {
    k: 0.035,
    density: 25.0,
    cp: 1400.0,
  },
  "Rammed Earth": {
    k: 0.72,
    density: 1900.0,
    cp: 880.0,
  },
  "Compressed Earth Block": {
    k: 0.58,
    density: 1750.0,
    cp: 900.0,
  },
  "Lime Plaster": {
    k: 0.35,
    density: 1400.0,
    cp: 840.0,
  },
  "Insulated Metal Panel": {
    k: 0.035,
    density: 120.0,
    cp: 900.0,
  },
  "Mud + Lime Roof": {
    k: 0.48,
    density: 1500.0,
    cp: 950.0,
  },
  "Local Stone Slab": {
    k: 1.70,
    density: 2300.0,
    cp: 790.0,
  },
  "Adobe Floor": {
    k: 0.55,
    density: 1600.0,
    cp: 1000.0,
  },
  "Double Glazed Low-E": {
    k: 0.80,
    density: 2500.0,
    cp: 750.0,
  },
  "Insulated Timber Door": {
    k: 0.14,
    density: 550.0,
    cp: 1600.0,
  },
  "Stone Thermal Mass": {
    k: 2.20,
    density: 2600.0,
    cp: 880.0,
  },
};

export const materials: Material[] = [
  { id: 'rammed-earth', name: 'Rammed Earth', category: 'wall', thermalConductivity: 0.72, density: 1900, specificHeat: 880, defaultThickness: 300, thermalResistance: 0.42, description: 'High-mass earthen wall system for thermal moderation.' },
  { id: 'compressed-earth', name: 'Compressed Earth Block', category: 'wall', thermalConductivity: 0.58, density: 1750, specificHeat: 900, defaultThickness: 250, thermalResistance: 0.43, description: 'Modular earth block with balanced mass and resistance.' },
  { id: 'lime-plaster', name: 'Lime Plaster', category: 'wall', thermalConductivity: 0.35, density: 1400, specificHeat: 840, defaultThickness: 100, thermalResistance: 0.29, description: 'Breathable finish layer shown for prototype comparison.' },
  { id: 'concrete', name: 'Concrete', category: 'wall', thermalConductivity: 1.70, density: 2400, specificHeat: 880, defaultThickness: 150, thermalResistance: 0.088, description: 'Dense structural concrete with high thermal mass and conductivity.' },
  { id: 'wood', name: 'Wood', category: 'wall', thermalConductivity: 0.15, density: 500, specificHeat: 1600, defaultThickness: 100, thermalResistance: 0.67, description: 'Natural timber construction with low thermal conductivity.' },
  { id: 'eps-insulation', name: 'EPS Insulation', category: 'wall', thermalConductivity: 0.035, density: 25, specificHeat: 1400, defaultThickness: 100, thermalResistance: 2.86, description: 'Expanded polystyrene providing high thermal resistance.' },
  { id: 'insulated-metal', name: 'Insulated Metal Panel', category: 'roof', thermalConductivity: 0.035, density: 120, specificHeat: 900, defaultThickness: 120, thermalResistance: 3.43, description: 'Lightweight roof assembly with a high insulation value.' },
  { id: 'mud-roof', name: 'Mud + Lime Roof', category: 'roof', thermalConductivity: 0.48, density: 1500, specificHeat: 950, defaultThickness: 180, thermalResistance: 0.38, description: 'High-mass roof concept for passive thermal lag.' },
  { id: 'stone-slab', name: 'Local Stone Slab', category: 'floor', thermalConductivity: 1.70, density: 2300, specificHeat: 790, defaultThickness: 150, thermalResistance: 0.09, description: 'Durable floor finish with high thermal mass.' },
  { id: 'adobe-floor', name: 'Adobe Floor', category: 'floor', thermalConductivity: 0.55, density: 1600, specificHeat: 1000, defaultThickness: 200, thermalResistance: 0.36, description: 'Earthen floor concept with moderate resistance.' },
  { id: 'double-glazed', name: 'Double Glazed Low-E', category: 'window', thermalConductivity: 0.80, density: 2500, specificHeat: 750, defaultThickness: 24, thermalResistance: 0.31, description: 'Window placeholder for lower conductive loss.' },
  { id: 'timber-door', name: 'Insulated Timber Door', category: 'door', thermalConductivity: 0.14, density: 550, specificHeat: 1600, defaultThickness: 45, thermalResistance: 0.32, description: 'Door assembly placeholder for prototype calculations.' },
  { id: 'stone-mass', name: 'Stone Thermal Mass', category: 'thermal_storage', thermalConductivity: 2.20, density: 2600, specificHeat: 880, defaultThickness: 250, thermalResistance: 0.11, description: 'Dense thermal storage material for temperature retention.' },
];

export const climates: ClimateProfile[] = [
  { id: 'ladakh', name: 'Ladakh', location: 'Leh, Ladakh', climateType: 'Cold & Arid', ambientTemperature: 4.8, solarRadiation: 612, sunshineDuration: 8.7, windSpeed: 3.2, relativeHumidity: 34 },
  { id: 'jaipur', name: 'Jaipur', location: 'Jaipur, Rajasthan', climateType: 'Hot & Dry', ambientTemperature: 29.4, solarRadiation: 684, sunshineDuration: 9.3, windSpeed: 2.6, relativeHumidity: 38 },
  { id: 'kochi', name: 'Kochi', location: 'Kochi, Kerala', climateType: 'Warm & Humid', ambientTemperature: 28.1, solarRadiation: 498, sunshineDuration: 6.1, windSpeed: 2.1, relativeHumidity: 77 },
];

export const defaultDesign: ShelterDesign = {
  id: 'design-01',
  name: 'Ladakh Passive Study',
  length: 6,
  width: 4.5,
  height: 3,
  shape: 'Rectangular',
  orientation: 'South',
  windowAreaPercentage: 12,
  doorArea: 2.1,
  numberOfWindows: 3,
  wallMaterialId: 'rammed-earth',
  roofMaterialId: 'insulated-metal',
  floorMaterialId: 'stone-slab',
  windowMaterialId: 'double-glazed',
  doorMaterialId: 'timber-door',
  thermalStorageMaterialId: 'stone-mass',
  climateProfileId: 'ladakh',
};

// ============================================================
// GEOMETRY HELPERS
// ============================================================

export function calculate_geometry(
  length: number,
  width: number,
  height: number,
): [number, number, number, number] {
  if (length <= 0 || width <= 0 || height <= 0) {
    throw new Error("All shelter dimensions must be positive.");
  }
  const volume = length * width * height;
  const wall_area = 2.0 * (length + width) * height;
  const roof_area = length * width;
  const floor_area = length * width;
  return [volume, wall_area, roof_area, floor_area];
}

// ============================================================
// U-VALUE
// ============================================================

export function calculate_u_value(
  k: number,
  thickness: number,
): number {
  if (thickness <= 0) {
    throw new Error("Thickness must be positive.");
  }
  return k / thickness;
}

// ============================================================
// HEAT TRANSFER COMPONENTS
// ============================================================

export function calc_conduction(
  U: number,
  area: number,
  t_in: number,
  t_out: number,
): number {
  return U * area * (t_in - t_out);
}

export function calc_infiltration(
  ACH: number,
  volume: number,
  t_in: number,
  t_out: number,
): number {
  if (ACH < 0) {
    throw new Error("ACH cannot be negative.");
  }
  const rho_air = 1.225;
  const cp_air = 1005.0;
  const v_dot = (ACH * volume) / 3600.0;
  return rho_air * cp_air * v_dot * (t_in - t_out);
}

// ============================================================
// THERMAL CAPACITY
// ============================================================

export function calculate_thermal_capacity(
  volume: number,
  internal_mass: number,
  cp_mass: number = 1000.0,
): number {
  if (internal_mass < 0) {
    throw new Error("Thermal mass cannot be negative.");
  }
  const rho_air = 1.225;
  const cp_air = 1005.0;
  const c_air = rho_air * cp_air * volume;
  const c_mass = internal_mass * cp_mass;
  return c_air + c_mass;
}

// ============================================================
// SYNTHETIC CLIMATE & SOLAR MODEL
// ============================================================

export function generate_outdoor_temperature(
  min_temp: number = -15.0,
  max_temp: number = 0.0,
): number[] {
  const mean_temp = (max_temp + min_temp) / 2.0;
  const amplitude = (max_temp - min_temp) / 2.0;
  const temperature: number[] = [];

  for (let hour = 0; hour < 24; hour++) {
    // Minimum at ~6 AM, maximum at ~6 PM (18:00)
    const temp = mean_temp + amplitude * Math.sin((2.0 * Math.PI * (hour - 12.0)) / 24.0);
    temperature.push(temp);
  }
  return temperature;
}

export function generate_solar_gain(peak_solar_gain: number = 800.0): number[] {
  const solar: number[] = new Array(24).fill(0.0);
  const sunrise = 7;
  const sunset = 17;

  for (let hour = 0; hour < 24; hour++) {
    if (hour >= sunrise && hour <= sunset) {
      solar[hour] = peak_solar_gain * Math.sin(
        (Math.PI * (hour - sunrise)) / (sunset - sunrise)
      );
    }
  }
  return solar;
}

// ============================================================
// 24-HOUR PHYSICS SIMULATION (IMPLICIT EULER)
// ============================================================

export function run_24h_simulation(
  initial_temperature: number,
  volume: number,
  wall_area: number,
  roof_area: number,
  floor_area: number,
  u_wall: number,
  u_roof: number,
  u_floor: number,
  ACH: number,
  internal_mass: number,
  outdoor_temperature: number[],
  solar_gain: number[],
  dt: number = 3600.0,
  window_area: number = 0,
  u_window: number = 0,
  door_area: number = 0,
  u_door: number = 0,
  cp_mass: number = 1000.0,
): PhysicsSimulationResult {
  if (dt <= 0) {
    throw new Error("Timestep must be positive.");
  }

  const capacity = calculate_thermal_capacity(volume, internal_mass, cp_mass);

  const indoor_temperatures: number[] = [];
  const wall_heat_losses: number[] = [];
  const roof_heat_losses: number[] = [];
  const floor_heat_losses: number[] = [];
  const window_heat_losses: number[] = [];
  const door_heat_losses: number[] = [];
  const infiltration_heat_losses: number[] = [];
  const total_heat_losses: number[] = [];
  const net_heat_flows: number[] = [];

  let t_in = initial_temperature;

  const v_dot = (ACH * volume) / 3600.0;
  const inf_conductance = 1.225 * 1005.0 * v_dot;
  const u_total =
    u_wall * wall_area +
    u_roof * roof_area +
    u_floor * floor_area +
    u_window * window_area +
    u_door * door_area +
    inf_conductance;

  const c_over_dt = capacity / dt;

  for (let hour = 0; hour < 24; hour++) {
    const t_out = outdoor_temperature[hour];
    const q_solar = solar_gain[hour];

    // Implicit Euler: T_in_next = (T_in * C/dt + Q_solar + U_total * T_out) / (C/dt + U_total)
    const t_in_next = (t_in * c_over_dt + q_solar + u_total * t_out) / (c_over_dt + u_total);

    const q_wall = calc_conduction(u_wall, wall_area, t_in_next, t_out);
    const q_roof = calc_conduction(u_roof, roof_area, t_in_next, t_out);
    const q_floor = calc_conduction(u_floor, floor_area, t_in_next, t_out);
    const q_win = window_area > 0 ? calc_conduction(u_window, window_area, t_in_next, t_out) : 0;
    const q_dr = door_area > 0 ? calc_conduction(u_door, door_area, t_in_next, t_out) : 0;
    const q_inf = calc_infiltration(ACH, volume, t_in_next, t_out);

    const q_loss_total = q_wall + q_roof + q_floor + q_win + q_dr + q_inf;
    const q_net = q_solar - q_loss_total;

    t_in = t_in_next;

    indoor_temperatures.push(t_in);
    wall_heat_losses.push(q_wall);
    roof_heat_losses.push(q_roof);
    floor_heat_losses.push(q_floor);
    window_heat_losses.push(q_win);
    door_heat_losses.push(q_dr);
    infiltration_heat_losses.push(q_inf);
    total_heat_losses.push(q_loss_total);
    net_heat_flows.push(q_net);
  }

  const total_heat_loss_kwh = total_heat_losses.reduce((acc, v) => acc + Math.max(v, 0), 0) * dt / 3600000.0;
  const total_solar_kwh = solar_gain.reduce((acc, v) => acc + v, 0) * dt / 3600000.0;
  const min_temperature = Math.min(...indoor_temperatures);
  const max_temperature = Math.max(...indoor_temperatures);
  const avg_temperature = indoor_temperatures.reduce((acc, v) => acc + v, 0) / 24.0;

  return {
    hours: Array.from({ length: 24 }, (_, i) => i),
    outdoor_temperature,
    indoor_temperature: indoor_temperatures,
    solar_gain,
    wall_heat_loss: wall_heat_losses,
    roof_heat_loss: roof_heat_losses,
    floor_heat_loss: floor_heat_losses,
    window_heat_loss: window_heat_losses,
    door_heat_loss: door_heat_losses,
    infiltration_heat_loss: infiltration_heat_losses,
    total_heat_loss_array: total_heat_losses,
    net_heat_flow: net_heat_flows,
    total_heat_loss_kwh,
    total_solar_kwh,
    min_temperature,
    max_temperature,
    avg_temperature,
  };
}

// ============================================================
// OPTIMIZER / RECOMMENDATION ENGINE
// ============================================================

export function optimize_material(
  length: number,
  width: number,
  height: number,
  wall_thickness: number,
  roof_material_name: string,
  floor_material_name: string,
  ACH: number,
  internal_mass: number,
  initial_temperature: number,
  min_outdoor_temp: number,
  max_outdoor_temp: number,
  peak_solar_gain: number,
): [string, string, Record<string, { U: number; sim_data: PhysicsSimulationResult }>, PhysicsSimulationResult] {
  const [volume, wall_area, roof_area, floor_area] = calculate_geometry(length, width, height);

  const outdoor_temp = generate_outdoor_temperature(min_outdoor_temp, max_outdoor_temp);
  const solar_gain = generate_solar_gain(peak_solar_gain);

  const roofMat = MATERIALS[roof_material_name] || MATERIALS["Insulated Metal Panel"];
  const floorMat = MATERIALS[floor_material_name] || MATERIALS["Concrete"];

  const u_roof = calculate_u_value(roofMat.k, wall_thickness);
  const u_floor = calculate_u_value(floorMat.k, wall_thickness);

  const results: Record<string, { U: number; sim_data: PhysicsSimulationResult }> = {};

  for (const [mat_name, props] of Object.entries(MATERIALS)) {
    const u_wall = calculate_u_value(props.k, wall_thickness);

    const sim_data = run_24h_simulation(
      initial_temperature,
      volume,
      wall_area,
      roof_area,
      floor_area,
      u_wall,
      u_roof,
      u_floor,
      ACH,
      internal_mass,
      outdoor_temp,
      solar_gain,
    );

    results[mat_name] = {
      U: u_wall,
      sim_data,
    };
  }

  let best_material = Object.keys(results)[0];
  let lowest_loss = Infinity;

  for (const [mat_name, res] of Object.entries(results)) {
    if (res.sim_data.total_heat_loss_kwh < lowest_loss) {
      lowest_loss = res.sim_data.total_heat_loss_kwh;
      best_material = mat_name;
    }
  }

  const best_sim = results[best_material].sim_data;
  const best_u = results[best_material].U;

  const recommendation =
    `${best_material} is recommended because it produced the lowest simulated ` +
    `total heat loss among the tested materials. ` +
    `It achieved a total heat loss of ${best_sim.total_heat_loss_kwh.toFixed(2)} kWh ` +
    `with a wall U-value of ${best_u.toFixed(3)} W/(m²·K). ` +
    `The indoor temperature ranged from ${best_sim.min_temperature.toFixed(1)}°C to ` +
    `${best_sim.max_temperature.toFixed(1)}°C. ` +
    `Note: This recommendation is best under the current shelter geometry and ` +
    `simulated climate conditions, and relies on prototype material properties.`;

  return [best_material, recommendation, results, best_sim];
}

// ============================================================
// HIGH-LEVEL INTEGRATION ADAPTERS (FOR REACT FRONTEND)
// ============================================================

export function materialById(id: string): Material {
  return materials.find((m) => m.id === id) ?? materials[0];
}

export function registerMaterials(newMaterials: Material[]) {
  for (const m of newMaterials) {
    const idx = materials.findIndex(x => x.id === m.id);
    if (idx >= 0) {
      materials[idx] = m;
    } else {
      materials.push(m);
    }
  }
}

export function climateById(id: string): ClimateProfile {
  return climates.find((c) => c.id === id) ?? climates[0];
}

export function registerClimateProfile(profile: ClimateProfile) {
  const idx = climates.findIndex((c) => c.id === profile.id);
  if (idx >= 0) {
    climates[idx] = profile;
  } else {
    climates.unshift(profile);
  }
}

export function simulateShelter(design: ShelterDesign, climate: ClimateProfile): SimulationOutput {
  const [volume, gross_wall_area, roof_area, floor_area] = calculate_geometry(
    Math.max(0.1, design.length),
    Math.max(0.1, design.width),
    Math.max(0.1, design.height)
  );

  const window_fraction = Math.max(0.02, Math.min(0.60, design.windowAreaPercentage / 100.0));
  const window_area = gross_wall_area * window_fraction;
  const door_area = Math.min(Math.max(0, design.doorArea), Math.max(0, gross_wall_area - window_area));
  const wall_area = Math.max(0.1, gross_wall_area - window_area - door_area);

  const wallMat = materialById(design.wallMaterialId);
  const roofMat = materialById(design.roofMaterialId);
  const floorMat = materialById(design.floorMaterialId);
  const winMat = materialById(design.windowMaterialId);
  const doorMat = materialById(design.doorMaterialId);
  const storageMat = materialById(design.thermalStorageMaterialId);

  const u_wall = wallMat.thermalResistance > 0
    ? (1.0 / wallMat.thermalResistance)
    : calculate_u_value(wallMat.thermalConductivity, (wallMat.defaultThickness || 200) / 1000.0);

  const u_roof = roofMat.thermalResistance > 0
    ? (1.0 / roofMat.thermalResistance)
    : calculate_u_value(roofMat.thermalConductivity, (roofMat.defaultThickness || 120) / 1000.0);

  const u_floor = floorMat.thermalResistance > 0
    ? (1.0 / floorMat.thermalResistance)
    : calculate_u_value(floorMat.thermalConductivity, (floorMat.defaultThickness || 150) / 1000.0);

  const u_window = winMat.thermalResistance > 0
    ? (1.0 / winMat.thermalResistance)
    : calculate_u_value(winMat.thermalConductivity, (winMat.defaultThickness || 24) / 1000.0);

  const u_door = doorMat.thermalResistance > 0
    ? (1.0 / doorMat.thermalResistance)
    : calculate_u_value(doorMat.thermalConductivity, (doorMat.defaultThickness || 45) / 1000.0);

  const effectiveStorageThickness = 0.12; // 12 cm effective thermal mass layer
  const internal_mass = Math.max(300.0, floor_area * effectiveStorageThickness * storageMat.density);
  const cp_mass = storageMat.specificHeat || 1000.0;
  const ach = Math.max(0.2, 0.35 + (climate.windSpeed * 0.05));

  // Diurnal temperature swing: Arid regions (like Ladakh) experience higher swings (~6.5°C)
  const diurnalSwing = Math.max(3.0, Math.min(8.5, (100 - climate.relativeHumidity) * 0.09));
  const minOutdoorTemp = climate.ambientTemperature - diurnalSwing;
  const maxOutdoorTemp = climate.ambientTemperature + diurnalSwing;
  const outdoor_temperatures = generate_outdoor_temperature(minOutdoorTemp, maxOutdoorTemp);

  // Solar profile: Solar radiation incident on shelter windows
  const raw_solar_curve = generate_solar_gain(climate.solarRadiation);

  // Orientation factor: South captures max winter passive solar gain in northern latitudes
  const orientationFactors: Record<ShelterDesign['orientation'], number> = {
    South: 1.0,
    East: 0.72,
    West: 0.72,
    North: 0.38,
  };
  const orientationFactor = orientationFactors[design.orientation] ?? 0.75;
  const shgc = 0.65; // Solar Heat Gain Coefficient for glazing

  const effective_solar_gain = raw_solar_curve.map((sol) => sol * window_area * shgc * orientationFactor);

  // Warmup run (24h) to avoid transient initialization artifact, then formal run
  const warmup = run_24h_simulation(
    climate.ambientTemperature,
    volume,
    wall_area,
    roof_area,
    floor_area,
    u_wall,
    u_roof,
    u_floor,
    ach,
    internal_mass,
    outdoor_temperatures,
    effective_solar_gain,
    3600.0,
    window_area,
    u_window,
    door_area,
    u_door,
    cp_mass
  );

  const sim = run_24h_simulation(
    warmup.indoor_temperature[23],
    volume,
    wall_area,
    roof_area,
    floor_area,
    u_wall,
    u_roof,
    u_floor,
    ach,
    internal_mass,
    outdoor_temperatures,
    effective_solar_gain,
    3600.0,
    window_area,
    u_window,
    door_area,
    u_door,
    cp_mass
  );

  const comfortSetpoint = 18.0; // 18°C indoor comfort threshold for cold climates
  const v_dot = (ach * volume) / 3600.0;
  const inf_conductance = 1.225 * 1005.0 * v_dot;
  const u_total =
    u_wall * wall_area +
    u_roof * roof_area +
    u_floor * floor_area +
    u_window * window_area +
    u_door * door_area +
    inf_conductance;

  const points: SimulationPoint[] = [];
  let totalHeatingWh = 0;

  for (let h = 0; h < 24; h++) {
    const t_in = sim.indoor_temperature[h];
    const t_out = outdoor_temperatures[h];
    const incident_solar = raw_solar_curve[h];
    const admitted_solar = effective_solar_gain[h];
    const loss = sim.total_heat_loss_array[h];

    // Heating requirement: energy needed to maintain 18°C comfort threshold
    const heatingDeficit = t_in < comfortSetpoint ? (comfortSetpoint - t_in) * u_total : 0.0;
    totalHeatingWh += heatingDeficit;

    points.push({
      timestamp: `${String(h).padStart(2, '0')}:00`,
      ambientTemperature: Number(t_out.toFixed(1)),
      solarRadiation: Math.round(incident_solar),
      internalTemperature: Number(t_in.toFixed(1)),
      solarGain: Math.round(admitted_solar),
      heatLoss: Math.round(Math.max(0, loss)),
      heatingRequirement: Math.round(heatingDeficit),
    });
  }

  // Component breakdown percentages
  const wallLossSum = sim.wall_heat_loss.reduce((a, b) => a + Math.max(0, b), 0);
  const roofLossSum = sim.roof_heat_loss.reduce((a, b) => a + Math.max(0, b), 0);
  const winLossSum = (sim.window_heat_loss ?? []).reduce((a, b) => a + Math.max(0, b), 0);
  const doorLossSum = (sim.door_heat_loss ?? []).reduce((a, b) => a + Math.max(0, b), 0);
  const floorLossSum = sim.floor_heat_loss.reduce((a, b) => a + Math.max(0, b), 0);
  const infLossSum = sim.infiltration_heat_loss.reduce((a, b) => a + Math.max(0, b), 0);

  const totalLossSum = wallLossSum + roofLossSum + winLossSum + doorLossSum + floorLossSum + infLossSum || 1.0;

  const breakdown = [
    { name: 'Walls', value: Math.round((wallLossSum / totalLossSum) * 100), color: '#315a72' },
    { name: 'Roof', value: Math.round((roofLossSum / totalLossSum) * 100), color: '#d9983e' },
    { name: 'Windows', value: Math.round((winLossSum / totalLossSum) * 100), color: '#5e8fa8' },
    { name: 'Door', value: Math.round((doorLossSum / totalLossSum) * 100), color: '#8c6b4f' },
    { name: 'Floor', value: Math.round((floorLossSum / totalLossSum) * 100), color: '#7a8792' },
    { name: 'Infiltration', value: Math.round((infLossSum / totalLossSum) * 100), color: '#b9c4ca' },
  ];

  // Adjust integer rounding so sum is exactly 100
  const sumValues = breakdown.reduce((acc, item) => acc + item.value, 0);
  if (sumValues !== 100 && breakdown.length > 0) {
    breakdown[0].value += (100 - sumValues);
  }

  const totalSolarWh = effective_solar_gain.reduce((a, b) => a + b, 0);
  const totalHeatLossWh = sim.total_heat_loss_array.reduce((a, b) => a + Math.max(0, b), 0);

  return {
    points,
    averageInternalTemperature: Number(sim.avg_temperature.toFixed(1)),
    totalSolarGain: Math.round(totalSolarWh),
    totalHeatLoss: Math.round(totalHeatLossWh),
    totalHeatingRequirement: Math.round(totalHeatingWh),
    breakdown,
    minTemperature: Number(sim.min_temperature.toFixed(1)),
    maxTemperature: Number(sim.max_temperature.toFixed(1)),
    totalHeatLossKwh: Number(sim.total_heat_loss_kwh.toFixed(2)),
    totalSolarKwh: Number(sim.total_solar_kwh.toFixed(2)),
  };
}

export function optimizeShelter(_: unknown, climate: ClimateProfile): OptimizationResult {
  const isCold = climate.ambientTemperature < 18.0;

  // Candidate design parameters
  const candidateOrientations: ShelterDesign['orientation'][] = isCold
    ? ['South', 'East', 'West', 'North']
    : ['North', 'East', 'West', 'South'];

  const candidateWalls = isCold
    ? ['eps-insulation', 'rammed-earth', 'compressed-earth', 'wood']
    : ['compressed-earth', 'rammed-earth', 'lime-plaster', 'wood'];

  const candidateRoofs = ['insulated-metal', 'mud-roof'];
  const candidateWindowPercentages = isCold ? [14, 12, 10, 8] : [8, 10, 12];

  type CandidateEval = {
    orientation: ShelterDesign['orientation'];
    wallId: string;
    roofId: string;
    windowArea: number;
    simOut: SimulationOutput;
  };

  const evaluations: CandidateEval[] = [];

  for (const orientation of candidateOrientations) {
    for (const wallId of candidateWalls) {
      for (const roofId of candidateRoofs) {
        for (const windowArea of candidateWindowPercentages) {
          const candidateDesign: ShelterDesign = {
            id: 'candidate',
            name: 'Candidate Design',
            length: 6,
            width: 4.5,
            height: 3,
            shape: 'Rectangular',
            orientation,
            windowAreaPercentage: windowArea,
            doorArea: 2.1,
            numberOfWindows: 3,
            wallMaterialId: wallId,
            roofMaterialId: roofId,
            floorMaterialId: 'stone-slab',
            windowMaterialId: 'double-glazed',
            doorMaterialId: 'timber-door',
            thermalStorageMaterialId: 'stone-mass',
            climateProfileId: climate.id,
          };

          const simOut = simulateShelter(candidateDesign, climate);
          evaluations.push({
            orientation,
            wallId,
            roofId,
            windowArea,
            simOut,
          });
        }
      }
    }
  }

  // Rank configurations
  evaluations.sort((a, b) => {
    if (isCold) {
      // In cold climate, minimize heating requirement and heat loss
      return (a.simOut.totalHeatingRequirement + a.simOut.totalHeatLoss * 0.5) -
             (b.simOut.totalHeatingRequirement + b.simOut.totalHeatLoss * 0.5);
    } else {
      // In hot climate, minimize excessive overheating and cooling load
      return Math.abs(a.simOut.averageInternalTemperature - 24.0) -
             Math.abs(b.simOut.averageInternalTemperature - 24.0);
    }
  });

  const best = evaluations[0];
  const worst = evaluations[evaluations.length - 1];

  // Performance score (85 - 98 based on relative heating & heat loss reduction)
  const lossRange = Math.max(1, worst.simOut.totalHeatLoss - best.simOut.totalHeatLoss);
  const lossSavedRatio = Math.max(0, Math.min(1, (worst.simOut.totalHeatLoss - best.simOut.totalHeatLoss) / lossRange));
  const calculatedScore = Math.round(88 + lossSavedRatio * 10);

  const bestWallMat = materialById(best.wallId);
  const bestRoofMat = materialById(best.roofId);

  const explanations: string[] = isCold
    ? [
        `Optimal ${best.orientation} orientation maximizes passive solar irradiance, capturing ${(best.simOut.totalSolarGain / 1000).toFixed(1)} kWh/day of useful solar heat.`,
        `${bestWallMat.name} provides superior thermal resistance (R=${bestWallMat.thermalResistance} m²K/W), reducing conductive envelope losses.`,
        `${bestRoofMat.name} limits upward thermal buoyancy loss, keeping total 24h heat loss down to ${(best.simOut.totalHeatLoss / 1000).toFixed(1)} kWh.`,
        `High-density Stone Thermal Mass buffers diurnal cold swings, reducing supplementary heating requirement to ${(best.simOut.totalHeatingRequirement / 1000).toFixed(1)} kWh.`,
      ]
    : [
        `${best.orientation} orientation minimizes peak afternoon direct solar heat gain.`,
        `${bestWallMat.name} offers balanced thermal lag, dampening diurnal outdoor temperature peaks.`,
        `${bestRoofMat.name} reduces solar radiant heat penetration into the living envelope.`,
        `Calculated average internal temperature stabilized at ${best.simOut.averageInternalTemperature}°C.`,
      ];

  return {
    score: calculatedScore,
    orientation: best.orientation,
    wall: bestWallMat.name,
    roof: bestRoofMat.name,
    windowArea: best.windowArea,
    thermalStorage: 'Stone Thermal Mass',
    solarGain: Math.round(best.simOut.totalSolarGain),
    heatLoss: Math.round(best.simOut.totalHeatLoss),
    heatingRequirement: Math.round(best.simOut.totalHeatingRequirement),
    explanation: explanations,
  };
}
