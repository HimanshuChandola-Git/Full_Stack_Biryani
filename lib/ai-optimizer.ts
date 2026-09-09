import {
  simulateShelter,
  materialById,
  materials,
  type ShelterDesign,
  type ClimateProfile,
  type SimulationOutput,
  type OptimizationResult,
} from './thermoshelter'

export interface DesignComparisonItem {
  name: string
  current: string
  optimal: string
  changed: boolean
  impact: string
}

export interface MetricComparison {
  label: string
  current: number
  optimal: number
  unit: string
  delta: number
  percentDelta: number
  isImprovement: boolean
}

export interface DetailedOptimizationResult extends OptimizationResult {
  currentScore: number
  configurationsEvaluated: number
  objective: string
  parametersOptimized: string[]
  bestDesign: ShelterDesign
  comparisons: DesignComparisonItem[]
  metrics: {
    heatLoss: MetricComparison
    solarGain: MetricComparison
    heatingRequirement: MetricComparison
    avgTemp: MetricComparison
  }
  aiAnalysis: {
    model: string
    headline: string
    executiveSummary: string
    reasons: string[]
    climateSpecificAdvice: string
    passiveSolarStrategy: string
  }
}

interface OptimizationOptions {
  currentDesign: ShelterDesign
  climate: ClimateProfile
  parameters?: string[]
  objective?: string
  availableMaterials?: typeof materials
}

export async function runAiOptimization({
  currentDesign,
  climate,
  parameters = ['Orientation', 'Wall Material', 'Roof Material', 'Window Area'],
  objective = 'Minimize heating requirement',
  availableMaterials = materials,
}: OptimizationOptions): Promise<DetailedOptimizationResult> {
  const isCold = climate.ambientTemperature < 18.0
  const isHot = climate.ambientTemperature > 26.0

  // 1. Evaluate baseline current design
  const currentSim = simulateShelter(currentDesign, climate)
  const currentWallMat = materialById(currentDesign.wallMaterialId)
  const currentRoofMat = materialById(currentDesign.roofMaterialId)
  const currentFloorMat = materialById(currentDesign.floorMaterialId)
  const currentStorageMat = materialById(currentDesign.thermalStorageMaterialId)

  // 2. Determine search space based on user-selected parameters
  const optOrientation = parameters.includes('Orientation')
  const optWall = parameters.includes('Wall Material')
  const optRoof = parameters.includes('Roof Material')
  const optWindow = parameters.includes('Window Area')
  const optDimensions = parameters.includes('Shelter Dimensions')
  const optStorage = parameters.includes('Thermal Storage')

  // Candidates
  const candidateOrientations: ShelterDesign['orientation'][] = optOrientation
    ? isCold
      ? ['South', 'East', 'West', 'North']
      : ['North', 'East', 'South', 'West']
    : [currentDesign.orientation]

  const wallMaterials = availableMaterials.filter(m => m.category === 'wall')
  const candidateWallIds: string[] = optWall
    ? wallMaterials.map(m => m.id)
    : [currentDesign.wallMaterialId]

  const roofMaterials = availableMaterials.filter(m => m.category === 'roof')
  const candidateRoofIds: string[] = optRoof
    ? roofMaterials.map(m => m.id)
    : [currentDesign.roofMaterialId]

  const candidateWindowPercentages: number[] = optWindow
    ? isCold
      ? [14, 12, 10, 8]
      : [8, 10, 12]
    : [currentDesign.windowAreaPercentage]

  const candidateDimensions: { length: number; width: number; height: number }[] = optDimensions
    ? [
        { length: 6, width: 4.5, height: 3 },
        { length: 7, width: 4, height: 2.8 },
        { length: 5, width: 5, height: 3 },
      ]
    : [{ length: currentDesign.length, width: currentDesign.width, height: currentDesign.height }]

  const storageMaterials = availableMaterials.filter(m => m.category === 'thermal_storage')
  const candidateStorageIds: string[] = optStorage
    ? storageMaterials.length > 0
      ? storageMaterials.map(m => m.id)
      : ['stone-mass']
    : [currentDesign.thermalStorageMaterialId]

  // 3. Evaluate candidate configurations
  type EvaluatedConfig = {
    design: ShelterDesign
    sim: SimulationOutput
    score: number
  }

  const evaluations: EvaluatedConfig[] = []

  for (const orientation of candidateOrientations) {
    for (const wallId of candidateWallIds) {
      for (const roofId of candidateRoofIds) {
        for (const windowArea of candidateWindowPercentages) {
          for (const dim of candidateDimensions) {
            for (const storageId of candidateStorageIds) {
              const testDesign: ShelterDesign = {
                ...currentDesign,
                length: dim.length,
                width: dim.width,
                height: dim.height,
                orientation,
                wallMaterialId: wallId,
                roofMaterialId: roofId,
                windowAreaPercentage: windowArea,
                thermalStorageMaterialId: storageId,
              }

              const sim = simulateShelter(testDesign, climate)
              const score = calculateDesignScore(sim, climate, objective)
              evaluations.push({ design: testDesign, sim, score })
            }
          }
        }
      }
    }
  }

  // Rank configurations
  evaluations.sort((a, b) => b.score - a.score)

  const best = evaluations[0] ?? {
    design: currentDesign,
    sim: currentSim,
    score: 85,
  }

  const currentScore = calculateDesignScore(currentSim, climate, objective)
  const bestWallMat = materialById(best.design.wallMaterialId)
  const bestRoofMat = materialById(best.design.roofMaterialId)
  const bestStorageMat = materialById(best.design.thermalStorageMaterialId)

  // 4. Detailed Component Comparisons
  const comparisons: DesignComparisonItem[] = [
    {
      name: 'Orientation',
      current: currentDesign.orientation,
      optimal: best.design.orientation,
      changed: currentDesign.orientation !== best.design.orientation,
      impact:
        best.design.orientation === 'South'
          ? 'Maximizes winter solar gain through south glazing'
          : 'Minimizes harsh direct afternoon solar exposure',
    },
    {
      name: 'Wall Material',
      current: `${currentWallMat.name} (R=${currentWallMat.thermalResistance})`,
      optimal: `${bestWallMat.name} (R=${bestWallMat.thermalResistance})`,
      changed: currentDesign.wallMaterialId !== best.design.wallMaterialId,
      impact:
        bestWallMat.thermalResistance > currentWallMat.thermalResistance
          ? `+${Math.round(((bestWallMat.thermalResistance - currentWallMat.thermalResistance) / currentWallMat.thermalResistance) * 100)}% higher thermal resistance`
          : 'Optimized balance of thermal storage mass and damping',
    },
    {
      name: 'Roof Assembly',
      current: `${currentRoofMat.name} (R=${currentRoofMat.thermalResistance})`,
      optimal: `${bestRoofMat.name} (R=${bestRoofMat.thermalResistance})`,
      changed: currentDesign.roofMaterialId !== best.design.roofMaterialId,
      impact:
        bestRoofMat.thermalResistance > currentRoofMat.thermalResistance
          ? 'Blocks upward convective buoyancy heat loss through roof'
          : 'Prevents overhead solar radiant heat penetration',
    },
    {
      name: 'Window Area Ratio',
      current: `${currentDesign.windowAreaPercentage}%`,
      optimal: `${best.design.windowAreaPercentage}%`,
      changed: currentDesign.windowAreaPercentage !== best.design.windowAreaPercentage,
      impact:
        best.design.windowAreaPercentage > currentDesign.windowAreaPercentage
          ? 'Increased aperture captures more passive solar radiation'
          : 'Reduced glazed area lowers envelope conduction loss',
    },
    {
      name: 'Thermal Storage Mass',
      current: currentStorageMat.name,
      optimal: bestStorageMat.name,
      changed: currentDesign.thermalStorageMaterialId !== best.design.thermalStorageMaterialId,
      impact: 'Dampens internal diurnal swings by buffering solar heat in mass',
    },
  ]

  // 5. Quantitative Metric Comparisons
  const curHeatLossKwh = Number((currentSim.totalHeatLoss / 1000).toFixed(1))
  const optHeatLossKwh = Number((best.sim.totalHeatLoss / 1000).toFixed(1))
  const heatLossDelta = Number((optHeatLossKwh - curHeatLossKwh).toFixed(1))
  const heatLossPct = Math.round(((optHeatLossKwh - curHeatLossKwh) / Math.max(0.1, curHeatLossKwh)) * 100)

  const curSolarKwh = Number((currentSim.totalSolarGain / 1000).toFixed(1))
  const optSolarKwh = Number((best.sim.totalSolarGain / 1000).toFixed(1))
  const solarDelta = Number((optSolarKwh - curSolarKwh).toFixed(1))
  const solarPct = Math.round(((optSolarKwh - curSolarKwh) / Math.max(0.1, curSolarKwh)) * 100)

  const curHeatingKwh = Number((currentSim.totalHeatingRequirement / 1000).toFixed(1))
  const optHeatingKwh = Number((best.sim.totalHeatingRequirement / 1000).toFixed(1))
  const heatingDelta = Number((optHeatingKwh - curHeatingKwh).toFixed(1))
  const heatingPct = Math.round(((optHeatingKwh - curHeatingKwh) / Math.max(0.1, curHeatingKwh)) * 100)

  const curAvgTemp = currentSim.averageInternalTemperature
  const optAvgTemp = best.sim.averageInternalTemperature
  const tempDelta = Number((optAvgTemp - curAvgTemp).toFixed(1))

  const metrics = {
    heatLoss: {
      label: '24h Total Heat Loss',
      current: curHeatLossKwh,
      optimal: optHeatLossKwh,
      unit: 'kWh',
      delta: heatLossDelta,
      percentDelta: heatLossPct,
      isImprovement: heatLossDelta < 0,
    },
    solarGain: {
      label: 'Passive Solar Heat Captured',
      current: curSolarKwh,
      optimal: optSolarKwh,
      unit: 'kWh',
      delta: solarDelta,
      percentDelta: solarPct,
      isImprovement: isCold ? solarDelta > 0 : solarDelta < 0,
    },
    heatingRequirement: {
      label: isCold ? 'Supplementary Heating Demand' : 'Cooling / Heat Discomfort Load',
      current: curHeatingKwh,
      optimal: optHeatingKwh,
      unit: 'kWh',
      delta: heatingDelta,
      percentDelta: heatingPct,
      isImprovement: heatingDelta < 0,
    },
    avgTemp: {
      label: 'Average Internal Temperature',
      current: curAvgTemp,
      optimal: optAvgTemp,
      unit: '°C',
      delta: tempDelta,
      percentDelta: Math.round(tempDelta * 10) / 10,
      isImprovement: isCold ? tempDelta > 0 : Math.abs(optAvgTemp - 23) < Math.abs(curAvgTemp - 23),
    },
  }

  // 6. Generate AI Reasoning Explanations
  const explanations: string[] = []

  if (isCold) {
    explanations.push(
      `Optimal ${best.design.orientation} orientation maximizes passive solar irradiance, capturing ${(best.sim.totalSolarGain / 1000).toFixed(1)} kWh/day of useful solar heat.`
    )
    explanations.push(
      `${bestWallMat.name} provides superior thermal resistance (R=${bestWallMat.thermalResistance} m²K/W), reducing conductive envelope losses.`
    )
    explanations.push(
      `${bestRoofMat.name} limits upward thermal buoyancy loss, keeping total 24h heat loss down to ${(best.sim.totalHeatLoss / 1000).toFixed(1)} kWh.`
    )
    explanations.push(
      `High-density ${bestStorageMat.name} buffers diurnal cold swings, reducing supplementary heating requirement to ${(best.sim.totalHeatingRequirement / 1000).toFixed(1)} kWh.`
    )
  } else if (isHot) {
    explanations.push(
      `${best.design.orientation} orientation prevents direct harsh solar overheating during peak solar radiation periods.`
    )
    explanations.push(
      `${bestWallMat.name} delivers optimal thermal lag (high specific heat and density), shifting daytime heat pulse toward night hours.`
    )
    explanations.push(
      `${bestRoofMat.name} insulates the ceiling plane against intense downward radiant heat from the sun.`
    )
    explanations.push(
      `Calibrated ${best.design.windowAreaPercentage}% glazing limits solar greenhouse gain while preserving adequate natural ventilation daylighting.`
    )
  } else {
    explanations.push(
      `Orientation aligned ${best.design.orientation} to take balanced advantage of local prevailing winds (${climate.windSpeed} m/s) and ambient conditions.`
    )
    explanations.push(
      `${bestWallMat.name} provides moderate thermal resistance and breathability suited for humid conditions.`
    )
    explanations.push(
      `${bestRoofMat.name} stabilizes envelope temperatures near the 22-26°C comfort target.`
    )
    explanations.push(
      `Average internal temperature held steady at ${best.sim.averageInternalTemperature}°C with minimal artificial intervention.`
    )
  }

  // Try calling external LLM if GEMINI_API_KEY is configured
  let aiSummary = `For ${climate.name} (${climate.climateType}), switching to ${bestWallMat.name} walls with ${bestRoofMat.name} roof oriented ${best.design.orientation} achieves a ${best.score}/100 design score, cutting heating requirement by ${Math.abs(heatingPct)}% while stabilizing indoor comfort.`
  let modelIdentifier = 'ThermoAI Physics-Guided Reasoning Model v2.4'

  if (process.env.GEMINI_API_KEY) {
    try {
      const apiKey = process.env.GEMINI_API_KEY
      const prompt = `You are an expert thermodynamic building engineer for the ThermoShelter passive shelter project.
Evaluate this design optimization for ${climate.name} (${climate.climateType}, ambient temp: ${climate.ambientTemperature}°C, solar: ${climate.solarRadiation} W/m²).
Current design: Orientation ${currentDesign.orientation}, Wall ${currentWallMat.name}, Roof ${currentRoofMat.name}, Window ${currentDesign.windowAreaPercentage}%.
Optimized design: Orientation ${best.design.orientation}, Wall ${bestWallMat.name}, Roof ${bestRoofMat.name}, Window ${best.design.windowAreaPercentage}%.
Metrics: Heat loss changed from ${curHeatLossKwh} to ${optHeatLossKwh} kWh (${heatLossPct}%), Heating demand from ${curHeatingKwh} to ${optHeatingKwh} kWh (${heatingPct}%), Avg Temp from ${curAvgTemp}°C to ${optAvgTemp}°C.
Objective: ${objective}.
Provide a 2-sentence executive summary explaining the thermodynamic rationale and key advantage of this optimization.`

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      )
      if (response.ok) {
        const json = await response.json()
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
        if (text && text.trim().length > 20) {
          aiSummary = text.trim()
          modelIdentifier = 'Gemini 1.5 Flash + ThermoAI Hybrid'
        }
      }
    } catch {
      // Fallback cleanly to internal ThermoAI
    }
  }

  return {
    score: best.score,
    currentScore,
    orientation: best.design.orientation,
    wall: bestWallMat.name,
    roof: bestRoofMat.name,
    windowArea: best.design.windowAreaPercentage,
    thermalStorage: bestStorageMat.name,
    solarGain: Math.round(best.sim.totalSolarGain),
    heatLoss: Math.round(best.sim.totalHeatLoss),
    heatingRequirement: Math.round(best.sim.totalHeatingRequirement),
    explanation: explanations,
    configurationsEvaluated: evaluations.length,
    objective,
    parametersOptimized: parameters,
    bestDesign: best.design,
    comparisons,
    metrics,
    aiAnalysis: {
      model: modelIdentifier,
      headline: 'A stronger starting point for this climate.',
      executiveSummary: aiSummary,
      reasons: explanations,
      climateSpecificAdvice: isCold
        ? `In ${climate.name}'s cold & arid climate, conduction loss through walls and roof dominates 24h energy demand. Pair south glazing with night insulating shutters for maximum passive retention.`
        : `In ${climate.name}'s hot climate, prioritize external shading overhangs and night cross-ventilation to discharge stored heat from thermal mass.`,
      passiveSolarStrategy: isCold
        ? 'Direct Gain Passive Solar with Thermal Mass Trombe-Lag Effect'
        : 'Cool Envelope with Induced Solar Chimney / Convective Purge',
    },
  }
}

function calculateDesignScore(
  sim: SimulationOutput,
  climate: ClimateProfile,
  objective: string
): number {
  const isCold = climate.ambientTemperature < 18.0
  const isHot = climate.ambientTemperature > 26.0

  if (objective === 'Minimize heat loss') {
    // Score heavily weights low envelope heat loss
    const lossKwh = sim.totalHeatLoss / 1000
    const score = Math.max(60, Math.min(98, Math.round(100 - lossKwh * 0.8)))
    return score
  }

  const maxTemp = sim.maxTemperature ?? sim.averageInternalTemperature
  const minTemp = sim.minTemperature ?? sim.averageInternalTemperature

  if (objective === 'Maximize useful solar gain') {
    // Score rewards high solar gain without extreme overheating
    const solarKwh = sim.totalSolarGain / 1000
    const penalty = maxTemp > 28 ? (maxTemp - 28) * 4 : 0
    const score = Math.max(60, Math.min(97, Math.round(70 + solarKwh * 1.1 - penalty)))
    return score
  }

  if (objective === 'Minimize heating requirement' || isCold) {
    // Cold climate / heating minimization
    const heatingKwh = sim.totalHeatingRequirement / 1000
    const heatLossKwh = sim.totalHeatLoss / 1000
    const score = Math.max(
      65,
      Math.min(96, Math.round(98 - heatingKwh * 0.12 - heatLossKwh * 0.15))
    )
    return score
  }

  // Thermal comfort: keep within 21°C - 25°C
  const tempDeviation = Math.abs(sim.averageInternalTemperature - 23.0)
  const diurnalSwing = maxTemp - minTemp
  const score = Math.max(
    65,
    Math.min(98, Math.round(96 - tempDeviation * 3.5 - diurnalSwing * 1.2))
  )
  return score
}
