import { NextResponse } from 'next/server'
import { defaultDesign, climateById, type ClimateProfile, type ShelterDesign } from '@/lib/thermoshelter'
import { runAiOptimization } from '@/lib/ai-optimizer'
import { repository } from '@/lib/supabase-repository'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const climate: ClimateProfile = body?.climate ?? climateById('ladakh')
    const currentDesign: ShelterDesign = body?.currentDesign ?? defaultDesign
    const parameters: string[] = Array.isArray(body?.parameters)
      ? body.parameters
      : ['Orientation', 'Wall Material', 'Roof Material', 'Window Area']
    const objective: string = body?.objective || 'Minimize heating requirement'

    // Run deep thermodynamic & AI optimization study
    const opt = await runAiOptimization({
      currentDesign,
      climate,
      parameters,
      objective,
    })

    try {
      if (climate.id) {
        await repository.saveOptimization(climate.id, opt)
      }
    } catch {
      // Non-blocking persistence
    }

    return NextResponse.json({
      success: true,
      opt,
      objective,
      evaluatedConfigurations: opt.configurationsEvaluated,
      algorithm: opt.aiAnalysis.model,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Optimization execution failed' },
      { status: 500 }
    )
  }
}

