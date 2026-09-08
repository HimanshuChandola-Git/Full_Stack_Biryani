'use client'

/**
 * ThermoShelter — Three.js 3D Building Visualisation Component
 * ============================================================
 * Renders a parameter-driven, interactive 3-D shelter using Three.js.
 *
 * IMPORTANT: No thermal calculations are performed here.
 * All physics (U-values, heat transfer, infiltration, solar gain) remain in
 * lib/thermoshelter.ts (the TypeScript port of the Python engine).
 *
 * Data flow:
 *   Shelter Design UI → ShelterConfig props → ThreeBuilding → 3-D scene
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import type { ShelterDesign } from '@/lib/thermoshelter'

// ── Lazily import Three.js so Next.js SSR is never affected ─────────────────
// All import() calls happen inside useEffect (browser-only).

interface Props {
  design: ShelterDesign
  /** Optional heat-loss value from the thermal engine to drive thermal view.
   *  Supply a value between 0–1 (normalised). Leave undefined for normal view. */
  thermalHeat?: number
  className?: string
}

interface UIControls {
  showRoof: boolean
  showMeasurements: boolean
  thermalView: boolean
  showGrid: boolean
  interiorView: boolean
}

// ── Dimension label overlay ──────────────────────────────────────────────────
function DimLabel({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-black/30 px-2 py-1 text-[10px] text-white backdrop-blur-sm">
      <span className="font-medium text-white/60">{label}</span>
      <span className="font-semibold">{value}{unit}</span>
    </div>
  )
}

// ── Orientation badge ────────────────────────────────────────────────────────
function OrientationBadge({ orientation }: { orientation: string }) {
  const map: Record<string, string> = { North: '↑ N', South: '↓ S', East: '→ E', West: '← W' }
  return (
    <div className="flex items-center gap-1 rounded-md bg-indigo-600/80 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
      {map[orientation] ?? orientation}
    </div>
  )
}

// ── Control button ───────────────────────────────────────────────────────────
function Ctrl({ active, label, onClick }: { active?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
        active ? 'bg-indigo-600 text-white' : 'bg-black/30 text-white/80 hover:bg-black/50'
      } backdrop-blur-sm`}
    >
      {label}
    </button>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function ThreeBuilding({ design, thermalHeat, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)

  // Refs to Three.js objects — never stored in state (avoids re-renders)
  const rendererRef  = useRef<import('three').WebGLRenderer | null>(null)
  const sceneRef     = useRef<import('three').Scene | null>(null)
  const cameraRef    = useRef<import('three').PerspectiveCamera | null>(null)
  const controlsRef  = useRef<import('three/addons/controls/OrbitControls.js').OrbitControls | null>(null)
  const shelterRef   = useRef<import('three').Group | null>(null)
  const animIdRef    = useRef<number>(0)
  const disposablesRef = useRef<Array<import('three').BufferGeometry | import('three').Material>>([])

  const [ui, setUi] = useState<UIControls>({
    showRoof: true,
    showMeasurements: true,
    thermalView: false,
    showGrid: true,
    interiorView: false,
  })
  const [ready, setReady] = useState(false)

  // ── Scene initialisation (runs once on mount) ────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      const THREE   = await import('three')
      const { OrbitControls } = await import('three/addons/controls/OrbitControls.js')

      if (cancelled || !canvasRef.current || !containerRef.current) return

      const canvas = canvasRef.current
      const { clientWidth: W, clientHeight: H } = containerRef.current

      // Renderer
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(W, H)
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.setClearColor(0x000000, 0)
      rendererRef.current = renderer

      // Scene
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0xf1f5f9)
      scene.fog = new THREE.FogExp2(0xf1f5f9, 0.018)
      sceneRef.current = scene

      // Lights
      const hemi = new THREE.HemisphereLight(0xdbeafe, 0x9ca3af, 0.9)
      scene.add(hemi)

      const sun = new THREE.DirectionalLight(0xfff8e7, 1.6)
      sun.position.set(8, 12, 6)
      sun.castShadow = true
      sun.shadow.mapSize.set(1024, 1024)
      sun.shadow.camera.near = 0.5
      sun.shadow.camera.far  = 80
      sun.shadow.camera.left = sun.shadow.camera.bottom = -20
      sun.shadow.camera.right = sun.shadow.camera.top = 20
      sun.shadow.bias = -0.001
      scene.add(sun)

      const fill = new THREE.DirectionalLight(0xbfdbfe, 0.4)
      fill.position.set(-5, 4, -4)
      scene.add(fill)

      // Camera
      const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 500)
      camera.position.set(14, 10, 14)
      cameraRef.current = camera

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.06
      controls.minDistance = 2
      controls.maxDistance = 60
      controls.maxPolarAngle = Math.PI / 2.05
      controls.target.set(0, 2, 0)
      controls.update()
      controlsRef.current = controls

      // Render loop
      function animate() {
        animIdRef.current = requestAnimationFrame(animate)
        controls.update()
        renderer.render(scene, camera)
      }
      animate()

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (!containerRef.current) return
        const w = containerRef.current.clientWidth
        const h = containerRef.current.clientHeight
        renderer.setSize(w, h)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      })
      ro.observe(containerRef.current)

      if (!cancelled) setReady(true)

      return () => {
        cancelled = true
        ro.disconnect()
        cancelAnimationFrame(animIdRef.current)
        renderer.dispose()
      }
    }

    const cleanup = init()
    return () => { cancelled = true; cleanup.then(fn => fn?.()) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Rebuild shelter whenever design / thermal / UI changes ───────────────
  useEffect(() => {
    if (!ready || !sceneRef.current) return

    async function rebuildShelter() {
      const THREE  = await import('three')
      const { buildShelterGeometry } = await import('./buildingGeometry')

      const scene = sceneRef.current!

      // Dispose previous shelter
      if (shelterRef.current) {
        scene.remove(shelterRef.current)
      }
      disposablesRef.current.forEach(d => d.dispose())
      disposablesRef.current = []

      const { group, boundingBox, disposables } = buildShelterGeometry(
        {
          length: Math.max(1, design.length),
          width:  Math.max(1, design.width),
          height: Math.max(1, design.height),
          shape:  design.shape,
          orientation: design.orientation,
          windowAreaPercentage: design.windowAreaPercentage,
          doorArea: design.doorArea,
          numberOfWindows: design.numberOfWindows,
          wallMaterialId:  design.wallMaterialId,
          roofMaterialId:  design.roofMaterialId,
          floorMaterialId: design.floorMaterialId,
        },
        ui.thermalView,
        thermalHeat ?? 0,
      )

      disposablesRef.current = disposables

      // Apply visibility overrides
      group.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return
        const name = child.userData.role as string | undefined
        if (name === 'roof' && !ui.showRoof) child.visible = false
        if (name === 'measurement' && !ui.showMeasurements) child.visible = false
        if (name === 'grid' && !ui.showGrid) child.visible = false
      })

      scene.add(group)
      shelterRef.current = group

      // Auto-frame camera so the shelter always fills the view
      if (cameraRef.current && controlsRef.current) {
        const centre = new THREE.Vector3()
        boundingBox.getCenter(centre)
        const size   = boundingBox.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const dist   = maxDim * 1.8

        const cam = cameraRef.current
        cam.position.set(dist, dist * 0.65, dist)
        controlsRef.current.target.copy(new THREE.Vector3(0, size.y / 2, 0))
        controlsRef.current.update()
      }
    }

    rebuildShelter()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    design.length, design.width, design.height,
    design.shape, design.orientation,
    design.windowAreaPercentage, design.doorArea, design.numberOfWindows,
    design.wallMaterialId, design.roofMaterialId, design.floorMaterialId,
    ui.thermalView, ui.showRoof, ui.showGrid,
    thermalHeat,
  ])

  // ── Reset camera ─────────────────────────────────────────────────────────
  const resetCamera = useCallback(async () => {
    if (!cameraRef.current || !controlsRef.current || !shelterRef.current) return
    const THREE = await import('three')
    const bb = new THREE.Box3().setFromObject(shelterRef.current)
    const size = bb.getSize(new THREE.Vector3())
    const d = Math.max(size.x, size.y, size.z) * 1.8
    cameraRef.current.position.set(d, d * 0.65, d)
    controlsRef.current.target.set(0, size.y / 2, 0)
    controlsRef.current.update()
  }, [])

  // ── Interior view: lower camera into the shelter ─────────────────────────
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return
    if (ui.interiorView) {
      const h = Math.max(1, design.height)
      cameraRef.current.position.set(0, h * 0.55, 0)
      controlsRef.current.target.set(0, h * 0.55, -design.width * 0.3)
      controlsRef.current.maxPolarAngle = Math.PI * 0.98
      controlsRef.current.minDistance = 0.5
      controlsRef.current.update()
    } else {
      controlsRef.current.maxPolarAngle = Math.PI / 2.05
      controlsRef.current.minDistance = 2
      resetCamera()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.interiorView])

  const toggle = (key: keyof UIControls) =>
    setUi(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className={`relative flex flex-col rounded-xl overflow-hidden border border-border bg-card ${className}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">3D Shelter Preview</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">Interactive · Procedural geometry · Visualisation only</p>
        </div>
        <div className="flex items-center gap-1.5">
          <OrientationBadge orientation={design.orientation} />
          {ui.thermalView && (
            <span className="rounded-md bg-rose-500/80 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
              THERMAL
            </span>
          )}
        </div>
      </div>

      {/* Three.js canvas viewport */}
      <div ref={containerRef} className="relative h-[420px] w-full flex-1 bg-slate-100">
        <canvas ref={canvasRef} className="h-full w-full" />

        {/* Dimension overlay */}
        {ui.showMeasurements && (
          <div className="absolute bottom-3 left-3 flex flex-col gap-1">
            <DimLabel label="L" value={design.length} unit="m" />
            <DimLabel label="W" value={design.width}  unit="m" />
            <DimLabel label="H" value={design.height} unit="m" />
          </div>
        )}

        {/* Loading state */}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-xs">Initialising 3D engine…</span>
            </div>
          </div>
        )}

        {/* Thermal notice */}
        {ui.thermalView && thermalHeat === undefined && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-lg bg-amber-500/90 px-3 py-1.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            Run simulation to see thermal data
          </div>
        )}
      </div>

      {/* Control strip */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-muted/40 px-4 py-2.5">
        <Ctrl label="⟳ Reset camera" onClick={resetCamera} />
        <Ctrl label="Roof"         active={ui.showRoof}         onClick={() => toggle('showRoof')} />
        <Ctrl label="Interior"     active={ui.interiorView}     onClick={() => toggle('interiorView')} />
        <Ctrl label="Measurements" active={ui.showMeasurements} onClick={() => toggle('showMeasurements')} />
        <Ctrl label="Grid"         active={ui.showGrid}         onClick={() => toggle('showGrid')} />
        <Ctrl
          label="🌡 Thermal view"
          active={ui.thermalView}
          onClick={() => toggle('thermalView')}
        />
        <span className="ml-auto text-[9px] text-muted-foreground">
          Drag to rotate · Scroll to zoom · Right-drag to pan
        </span>
      </div>
    </div>
  )
}
