import { NextResponse } from 'next/server'
import type { Material } from '@/lib/thermoshelter'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))
  const results: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    // Regex matches comma-separated values accounting for quoted values
    const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g
    const row: string[] = []
    let match: RegExpExecArray | null

    while ((match = regex.exec(lines[i])) !== null) {
      let val = match[1] ?? ''
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"')
      }
      row.push(val.trim())
      if (match.index === regex.lastIndex) regex.lastIndex++
      if (row.length === headers.length) break
    }

    if (row.length > 0) {
      const entry: Record<string, string> = {}
      headers.forEach((h, idx) => {
        entry[h] = row[idx] ?? ''
      })
      results.push(entry)
    }
  }

  return results
}

function normalizeAndValidateMaterial(raw: Record<string, any>): Material | null {
  const name = String(raw.name || raw.Name || raw.material || '').trim()
  if (!name) return null

  const validCategories: Material['category'][] = ['wall', 'roof', 'floor', 'window', 'door', 'thermal_storage']
  const cat = String(raw.category || raw.Category || 'wall').toLowerCase().trim() as Material['category']
  const category = validCategories.includes(cat) ? cat : 'wall'

  const k = Number(raw.thermalConductivity ?? raw.k ?? raw.conductivity ?? raw.ThermalConductivity)
  if (isNaN(k) || k <= 0) return null

  const density = Number(raw.density ?? raw.Density ?? 1000)
  const specificHeat = Number(raw.specificHeat ?? raw.cp ?? raw.SpecificHeat ?? 900)
  const defaultThickness = Number(raw.defaultThickness ?? raw.thickness ?? raw.Thickness ?? 100)
  const thermalResistance = Number(
    raw.thermalResistance ??
    raw.rValue ??
    raw.ThermalResistance ??
    Number(((defaultThickness / 1000) / k).toFixed(3))
  )

  const id = String(raw.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
  const description = String(raw.description || raw.Description || `${name} (${category}) with k=${k} W/m·K`)

  return {
    id,
    name,
    category,
    thermalConductivity: k,
    density: isNaN(density) || density <= 0 ? 1000 : density,
    specificHeat: isNaN(specificHeat) || specificHeat <= 0 ? 900 : specificHeat,
    defaultThickness: isNaN(defaultThickness) || defaultThickness <= 0 ? 100 : defaultThickness,
    thermalResistance: isNaN(thermalResistance) || thermalResistance <= 0 ? 0.1 : thermalResistance,
    description,
  }
}

// POST /api/materials/upload — Accepts CSV text, JSON text, or multipart form data
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let rawItems: Record<string, any>[] = []

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null

      if (!file) {
        return NextResponse.json({ success: false, error: 'No file provided in form data' }, { status: 400 })
      }

      const text = await file.text()
      if (file.name.endsWith('.json') || text.trim().startsWith('[') || text.trim().startsWith('{')) {
        const json = JSON.parse(text)
        rawItems = Array.isArray(json) ? json : Array.isArray(json.materials) ? json.materials : [json]
      } else {
        rawItems = parseCSV(text)
      }
    } else if (contentType.includes('text/csv')) {
      const text = await req.text()
      rawItems = parseCSV(text)
    } else {
      // JSON payload
      const json = await req.json()
      rawItems = Array.isArray(json) ? json : Array.isArray(json.materials) ? json.materials : [json]
    }

    if (!rawItems || rawItems.length === 0) {
      return NextResponse.json({ success: false, error: 'Could not parse any rows or records from the uploaded data.' }, { status: 400 })
    }

    const validated: Material[] = []
    const skipped: string[] = []

    for (let i = 0; i < rawItems.length; i++) {
      const mat = normalizeAndValidateMaterial(rawItems[i])
      if (mat) {
        validated.push(mat)
      } else {
        skipped.push(`Row ${i + 1} (${rawItems[i]?.name || 'unnamed'}): Missing valid name or positive thermal conductivity.`)
      }
    }

    if (validated.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid materials could be imported from the file.',
        details: skipped,
      }, { status: 400 })
    }

    // Save to Supabase if credentials exist
    const supabase = getSupabase()
    let savedToDatabase = false

    if (supabase) {
      const { error } = await supabase.from('materials').upsert(validated)
      if (error) {
        return NextResponse.json({
          success: false,
          error: `Database save failed: ${error.message}`,
          validatedCount: validated.length,
        }, { status: 500 })
      }
      savedToDatabase = true
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${validated.length} materials.`,
      savedToDatabase,
      count: validated.length,
      materials: validated,
      warnings: skipped.length > 0 ? skipped : undefined,
    })
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || 'Failed to process file upload',
    }, { status: 500 })
  }
}
