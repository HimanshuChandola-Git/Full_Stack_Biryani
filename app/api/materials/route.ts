import { NextResponse } from 'next/server'
import { materials as defaultMaterials, type Material } from '@/lib/thermoshelter'
import { repository } from '@/lib/supabase-repository'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function sanitizeMaterial(item: any): Material | null {
  if (!item || typeof item !== 'object') return null
  const name = String(item.name || '').trim()
  if (!name) return null

  const validCategories: Material['category'][] = ['wall', 'roof', 'floor', 'window', 'door', 'thermal_storage']
  const rawCategory = String(item.category || '').toLowerCase().trim() as Material['category']
  const category = validCategories.includes(rawCategory) ? rawCategory : 'wall'

  const thermalConductivity = Number(item.thermalConductivity ?? item.k ?? item.conductivity)
  const density = Number(item.density ?? 1000)
  const specificHeat = Number(item.specificHeat ?? item.cp ?? item.heatCapacity ?? 900)
  const defaultThickness = Number(item.defaultThickness ?? item.thickness ?? 100)

  if (isNaN(thermalConductivity) || thermalConductivity <= 0) return null

  const id = String(item.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
  const thermalResistance = Number(item.thermalResistance ?? Number(((defaultThickness / 1000) / thermalConductivity).toFixed(3)))
  const description = String(item.description || `${name} (${category}) with k=${thermalConductivity} W/m·K`)

  return {
    id,
    name,
    category,
    thermalConductivity,
    density: isNaN(density) || density <= 0 ? 1000 : density,
    specificHeat: isNaN(specificHeat) || specificHeat <= 0 ? 900 : specificHeat,
    defaultThickness: isNaN(defaultThickness) || defaultThickness <= 0 ? 100 : defaultThickness,
    thermalResistance: isNaN(thermalResistance) || thermalResistance <= 0 ? 0.1 : thermalResistance,
    description,
  }
}

// GET /api/materials — Retrieve all active materials
export async function GET() {
  try {
    const list = await repository.fetchMaterials(defaultMaterials)
    return NextResponse.json({
      success: true,
      count: list.length,
      materials: list,
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch materials' },
      { status: 500 }
    )
  }
}

// POST /api/materials — Upload single or batch materials via JSON or external API URL
export async function POST(req: Request) {
  try {
    const body = await req.json()
    let rawItems: any[] = []

    if (body && typeof body === 'object' && typeof body.url === 'string') {
      // Fetch from external API URL
      const extRes = await fetch(body.url)
      if (!extRes.ok) {
        return NextResponse.json({ success: false, error: `External API responded with status ${extRes.status}` }, { status: 502 })
      }
      const extJson = await extRes.json()
      rawItems = Array.isArray(extJson) ? extJson : Array.isArray(extJson.materials) ? extJson.materials : Array.isArray(extJson.data) ? extJson.data : [extJson]
    } else {
      rawItems = Array.isArray(body) ? body : Array.isArray(body.materials) ? body.materials : [body]
    }

    const validated: Material[] = []
    const errors: string[] = []

    for (let i = 0; i < rawItems.length; i++) {
      const parsed = sanitizeMaterial(rawItems[i])
      if (parsed) {
        validated.push(parsed)
      } else {
        errors.push(`Item at index ${i} ('${rawItems[i]?.name || 'unnamed'}') has invalid properties. Required: positive thermalConductivity and name.`)
      }
    }

    if (validated.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid materials found in payload',
          details: errors,
        },
        { status: 400 }
      )
    }

    // Persist to Supabase if configured
    const supabase = getSupabase()
    let savedToDatabase = false

    if (supabase) {
      const { error: upsertError } = await supabase.from('materials').upsert(validated)
      if (upsertError) {
        return NextResponse.json(
          {
            success: false,
            error: `Database save failed: ${upsertError.message}`,
            validatedMaterials: validated,
          },
          { status: 500 }
        )
      }
      savedToDatabase = true
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${validated.length} material(s)`,
      savedToDatabase,
      count: validated.length,
      materials: validated,
      warnings: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Invalid request body' },
      { status: 400 }
    )
  }
}
