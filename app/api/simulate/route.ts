import { NextResponse } from 'next/server'
import { simulateShelter, defaultDesign, climateById, type ShelterDesign, type ClimateProfile } from '@/lib/thermoshelter'
import { repository } from '@/lib/supabase-repository'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const design: ShelterDesign = body?.design ?? defaultDesign
    const climate: ClimateProfile = body?.climate ?? climateById('ladakh')

    // Run deterministic physics simulation
    const sim = simulateShelter(design, climate)

    // Optionally persist simulation record
    try {
      if (design.id) {
        await repository.saveSimulation(design.id, sim)
      }
    } catch {
      // Non-blocking persistence
    }

    return NextResponse.json({
      success: true,
      sim,
      solver: 'Implicit Euler 24h Transient Energy Balance (dt=3600s)',
      timestamp: new Date().toISOString(),
      metadata: {
        shelter: design.name,
        climate: climate.location,
        orientation: design.orientation,
        floorArea: design.length * design.width,
        wallMaterial: design.wallMaterialId,
        roofMaterial: design.roofMaterialId,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Simulation execution failed' },
      { status: 500 }
    )
  }
}
