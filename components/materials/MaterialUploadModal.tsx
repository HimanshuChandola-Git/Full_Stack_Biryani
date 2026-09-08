'use client'

import { useState, useRef } from 'react'
import { UploadCloud, FileText, Download, CheckCircle2, AlertCircle, X, Code2, Globe, Database, Sparkles } from 'lucide-react'
import type { Material } from '@/lib/thermoshelter'

interface Props {
  isOpen: boolean
  onClose: () => void
  onMaterialsAdded: (newMaterials: Material[]) => void
}

const SAMPLE_CSV = `name,category,thermalConductivity,density,specificHeat,defaultThickness,description
Aerated Autoclaved Concrete,wall,0.16,650,1050,200,Lightweight precast concrete with micro air cells
Hempcrete Block,wall,0.07,350,1500,300,Bio-composite wall system made of hemp shiv and lime
Sheep Wool Batt,roof,0.038,20,1800,150,Natural hygroscopic insulation with excellent vapor buffering
Vacuum Insulated Panel,wall,0.007,200,800,30,Ultra-low conductivity core wrapped in airtight membrane
Triple Glazed Argon,window,0.60,2500,750,36,High-performance low-emissivity argon-filled glazing
Basalt Rock Slab,floor,1.90,2900,920,150,Heavy igneous rock for subfloor thermal flywheel`

const SAMPLE_JSON = `[
  {
    "name": "Cellulose Insulation",
    "category": "roof",
    "thermalConductivity": 0.040,
    "density": 45,
    "specificHeat": 1600,
    "defaultThickness": 200,
    "description": "Recycled paper fiber treated with borates for fire and pest resistance"
  },
  {
    "name": "Phase Change PCM Plaster",
    "category": "wall",
    "thermalConductivity": 0.21,
    "density": 1100,
    "specificHeat": 2800,
    "defaultThickness": 40,
    "description": "Micro-encapsulated organic paraffin wax in gypsum plaster that absorbs daytime latent heat"
  },
  {
    "name": "Aerogel Glazing",
    "category": "window",
    "thermalConductivity": 0.018,
    "density": 100,
    "specificHeat": 1000,
    "defaultThickness": 20,
    "description": "Translucent silica aerogel insulated glazing unit with ultra-high thermal resistance"
  }
]`

const API_PRESETS = [
  {
    title: 'SIH Cold-Climate Material Database',
    badge: 'SIH Recommended',
    description: 'Specialized thermal materials for Ladakh, Spiti, and high-altitude Himalayan shelters.',
    payload: [
      {
        name: 'Vacuum Insulated Panel (VIP)',
        category: 'wall',
        thermalConductivity: 0.007,
        density: 190,
        specificHeat: 800,
        defaultThickness: 30,
        description: 'Next-gen nanoporous core in vacuum foil barrier with extreme thermal resistance (R > 4.2).',
      },
      {
        name: 'Phase Change PCM Plaster',
        category: 'thermal_storage',
        thermalConductivity: 0.21,
        density: 1150,
        specificHeat: 2850,
        defaultThickness: 35,
        description: 'Passive latent heat storage material melting at 21°C to stabilize indoor nighttime temperatures.',
      },
      {
        name: 'Aerogel Insulated Glazing',
        category: 'window',
        thermalConductivity: 0.018,
        density: 120,
        specificHeat: 1000,
        defaultThickness: 25,
        description: 'Silica aerogel filling between low-E glass panes for high solar transmittance and low heat loss.',
      },
      {
        name: 'Expanded Aerated Autoclaved Concrete',
        category: 'wall',
        thermalConductivity: 0.12,
        density: 500,
        specificHeat: 1050,
        defaultThickness: 250,
        description: 'Thermal masonry blocks engineered with micro air cavities for sub-zero climates.',
      },
    ],
  },
  {
    title: 'Himalayan Vernacular & Bio-Composite',
    badge: 'Eco & Low Carbon',
    description: 'Locally available renewable materials suited for low-embodied carbon construction.',
    payload: [
      {
        name: 'Hempcrete Monolithic Wall',
        category: 'wall',
        thermalConductivity: 0.068,
        density: 340,
        specificHeat: 1560,
        defaultThickness: 300,
        description: 'Carbon-negative composite of industrial hemp shiv and natural hydraulic lime binder.',
      },
      {
        name: 'Sheep Wool Thermal Batt',
        category: 'roof',
        thermalConductivity: 0.038,
        density: 22,
        specificHeat: 1800,
        defaultThickness: 160,
        description: 'Indigenous Ladakhi sheep wool with natural moisture absorption and zero condensation risk.',
      },
      {
        name: 'Compressed Straw Bale Wall',
        category: 'wall',
        thermalConductivity: 0.065,
        density: 120,
        specificHeat: 2000,
        defaultThickness: 350,
        description: 'Agricultural byproduct tightly bound and plastered with earthen mud for high insulation.',
      },
      {
        name: 'Dense Basalt Thermal Floor',
        category: 'floor',
        thermalConductivity: 1.85,
        density: 2850,
        specificHeat: 900,
        defaultThickness: 120,
        description: 'Polished local basalt slab absorbing daytime solar radiation through south windows.',
      },
    ],
  },
  {
    title: 'Super-Insulated Envelope & Glazing',
    badge: 'Passivhaus Standard',
    description: 'Ultra-low U-value components engineered for near-zero heat dissipation.',
    payload: [
      {
        name: 'Quadruple Glazed Krypton Window',
        category: 'window',
        thermalConductivity: 0.35,
        density: 2600,
        specificHeat: 750,
        defaultThickness: 48,
        description: 'Passivhaus certified 4-pane unit with 3 low-E coatings and 90% krypton cavity gas.',
      },
      {
        name: 'Phenolic Foam Roof Board',
        category: 'roof',
        thermalConductivity: 0.020,
        density: 35,
        specificHeat: 1400,
        defaultThickness: 140,
        description: 'Rigid closed-cell thermoset foam providing high R-value at low profile thickness.',
      },
      {
        name: 'Polyurethane Airtight Door',
        category: 'door',
        thermalConductivity: 0.024,
        density: 80,
        specificHeat: 1500,
        defaultThickness: 75,
        description: 'Heavy duty insulated perimeter compression door with dual neoprene draft gaskets.',
      },
    ],
  },
]

export default function MaterialUploadModal({ isOpen, onClose, onMaterialsAdded }: Props) {
  const [tab, setTab] = useState<'api' | 'file' | 'json'>('api')
  const [file, setFile] = useState<File | null>(null)
  const [jsonText, setJsonText] = useState(SAMPLE_JSON)
  const [apiUrl, setApiUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; count?: number; warnings?: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'thermoshelter_materials_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleFileUpload = async () => {
    if (!file) return
    setUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/materials/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload materials.')
      }

      setResult({
        success: true,
        message: data.message || `Successfully imported ${data.count} materials!`,
        count: data.count,
        warnings: data.warnings,
      })

      if (data.materials && Array.isArray(data.materials)) {
        onMaterialsAdded(data.materials)
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Error occurred while uploading.',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleJsonUpload = async (customPayload?: any) => {
    setUploading(true)
    setResult(null)

    try {
      let payload = customPayload
      if (!payload) {
        try {
          payload = JSON.parse(jsonText)
        } catch {
          throw new Error('Invalid JSON syntax. Please check for missing quotes or commas.')
        }
      }

      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to process materials via API.')
      }

      setResult({
        success: true,
        message: data.message || `Successfully ingested ${data.count} materials into engine!`,
        count: data.count,
        warnings: data.warnings,
      })

      if (data.materials && Array.isArray(data.materials)) {
        onMaterialsAdded(data.materials)
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Error occurred during API ingestion.',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleFetchExternalApi = async () => {
    if (!apiUrl.trim()) return
    setUploading(true)
    setResult(null)

    try {
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: apiUrl.trim() }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch from external API endpoint.')
      }

      setResult({
        success: true,
        message: data.message || `Successfully synced ${data.count} materials from external API!`,
        count: data.count,
      })

      if (data.materials && Array.isArray(data.materials)) {
        onMaterialsAdded(data.materials)
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Failed to connect to external material API endpoint.',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold tracking-tight">Material Data API & Ingestion</h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">REST API</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Connect external databases or upload custom material specifications to dynamically update the 3D model and thermal solver.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="mt-4 flex flex-wrap gap-2 border-b border-border pb-3">
          <button
            onClick={() => { setTab('api'); setResult(null) }}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'api' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <Globe className="size-3.5" />
            Connect External API / Presets
          </button>
          <button
            onClick={() => { setTab('file'); setResult(null) }}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'file' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="size-3.5" />
            Upload CSV / File
          </button>
          <button
            onClick={() => { setTab('json'); setResult(null) }}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'json' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <Code2 className="size-3.5" />
            Raw JSON API Payload
          </button>

          <button
            onClick={handleDownloadTemplate}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Download className="size-3" />
            CSV Template
          </button>
        </div>

        {/* Tab 1: External API */}
        {tab === 'api' && (
          <div className="mt-4 space-y-5">
            <div>
              <label className="text-xs font-medium text-foreground">
                Fetch from External REST API Endpoint URL
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/api/v1/materials.json"
                  value={apiUrl}
                  onChange={e => setApiUrl(e.target.value)}
                  className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleFetchExternalApi}
                  disabled={uploading || !apiUrl.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Globe className="size-3.5" />
                  Fetch API
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Enter any public or authenticated REST URL returning a JSON array of materials.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="size-3.5 text-primary" />
                Or ingest verified specialized material database presets via API:
              </div>

              <div className="grid gap-2.5">
                {API_PRESETS.map((preset, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3.5 transition-colors hover:border-primary/40 hover:bg-muted/70"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{preset.title}</span>
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                          {preset.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{preset.description}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                        {preset.payload.map(p => (
                          <span key={p.name} className="rounded border border-border bg-background px-1.5 py-0.5">
                            {p.name} ({p.category})
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleJsonUpload(preset.payload)}
                      disabled={uploading}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-all disabled:opacity-50"
                    >
                      <Database className="size-3.5" />
                      Ingest via API ({preset.payload.length})
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: File Upload */}
        {tab === 'file' && (
          <div className="mt-4 space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0])
              }}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/70"
            >
              <UploadCloud className="size-10 text-primary mb-2" />
              <p className="text-sm font-medium">
                {file ? file.name : 'Click to browse or drag and drop your file'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Supports .csv and .json files with properties: thermalConductivity, density, specificHeat, defaultThickness
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,text/csv,application/json"
                className="hidden"
                onChange={e => {
                  if (e.target.files?.[0]) setFile(e.target.files[0])
                }}
              />
            </div>

            {file && (
              <div className="flex items-center justify-between rounded-lg bg-muted p-2.5 px-3 text-xs">
                <span className="font-mono text-muted-foreground truncate max-w-[350px]">{file.name}</span>
                <span className="text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Raw JSON Editor */}
        {tab === 'json' && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Send directly to endpoint: <code className="font-mono text-primary">POST /api/materials</code></span>
              <button
                onClick={() => setJsonText(SAMPLE_JSON)}
                className="text-[11px] underline hover:text-foreground"
              >
                Reset to sample
              </button>
            </div>
            <textarea
              rows={8}
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              className="w-full rounded-xl border border-input bg-background p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Paste JSON array of materials..."
            />
          </div>
        )}

        {/* Status Alerts */}
        {result && (
          <div
            className={`mt-4 flex items-start gap-2.5 rounded-xl border p-3.5 text-xs ${
              result.success
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-destructive/30 bg-destructive/10 text-destructive'
            }`}
          >
            {result.success ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
            <div className="flex-1">
              <p className="font-medium">{result.message}</p>
              {result.warnings && result.warnings.length > 0 && (
                <ul className="mt-1 list-disc pl-4 opacity-80">
                  {result.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-xs font-medium hover:bg-muted"
          >
            {result?.success ? 'Done' : 'Cancel'}
          </button>

          {tab !== 'api' && (
            <button
              onClick={tab === 'file' ? handleFileUpload : () => handleJsonUpload()}
              disabled={uploading || (tab === 'file' && !file)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <div className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Sending to API…
                </>
              ) : (
                <>
                  <UploadCloud className="size-3.5" />
                  Upload via API
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
