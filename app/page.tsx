'use client'

import { useMemo, useState, useEffect } from 'react'
import dynamic_ from 'next/dynamic'
import { AreaChart, Area, BarChart, Bar, CartesianGrid, Cell, LineChart, Line, PieChart, Pie, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, ArrowRight, BarChart3, BookOpen, Box, Calculator, Check, ChevronRight, CircleHelp, ClipboardList, CloudSun, Compass, Download, FlaskConical, Globe2, Layers3, MapPin, Menu, Navigation, PanelLeftClose, Play, Plus, RefreshCw, Search, Settings2, SlidersHorizontal, Sparkles, Thermometer, TrendingDown, UploadCloud, Wind, X } from 'lucide-react'
import { climates, defaultDesign, materialById, materials, climateById, optimizeShelter, simulateShelter, registerMaterials, registerClimateProfile, type ShelterDesign, type Material, type ClimateProfile } from '@/lib/thermoshelter'
import { repository } from '@/lib/supabase-repository'
import MaterialUploadModal from '@/components/materials/MaterialUploadModal'
import OptimizationPage from '@/components/optimization/OptimizationPage'

// Three.js component — loaded client-side only (never SSR)
const ThreeBuilding = dynamic_(() => import('@/components/three/ThreeBuilding'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center rounded-xl border border-border bg-muted text-xs text-muted-foreground">
      <div className="flex flex-col items-center gap-2">
        <div className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading 3D engine…
      </div>
    </div>
  ),
})

type Section='Dashboard'|'Climate'|'Shelter Design'|'Materials'|'Simulation'|'Results'|'Compare Designs'|'Optimization'|'Reports'
const nav: {label:Section; icon: typeof Activity}[]=[{label:'Dashboard',icon:Activity},{label:'Climate',icon:CloudSun},{label:'Shelter Design',icon:Box},{label:'Materials',icon:Layers3},{label:'Simulation',icon:FlaskConical},{label:'Results',icon:BarChart3},{label:'Compare Designs',icon:Compass},{label:'Optimization',icon:Sparkles},{label:'Reports',icon:ClipboardList}]
const stages=['Climate','Shelter Design','Materials','Simulation','Results','Optimization','Reports']

export default function Page(){
 const [section,setSection]=useState<Section>('Dashboard'); const [mobileNav,setMobileNav]=useState(false); const [climateId,setClimateId]=useState('ladakh'); const [design,setDesign]=useState<ShelterDesign>(defaultDesign); const [materialsSearch,setMaterialsSearch]=useState(''); const [materialCategory,setMaterialCategory]=useState('all'); const [simulationRunning,setSimulationRunning]=useState(false); const [simulationDone,setSimulationDone]=useState(false); const [optimizationRunning,setOptimizationRunning]=useState(false); const [optimized,setOptimized]=useState(false); const [saved,setSaved]=useState(false)
 const [materialsList, setMaterialsList] = useState<Material[]>(materials)
 const [uploadModalOpen, setUploadModalOpen] = useState(false)
 const [syncingMaterials, setSyncingMaterials] = useState(false)
 const [simResult, setSimResult] = useState<ReturnType<typeof simulateShelter> | null>(null)
 const [optResult, setOptResult] = useState<ReturnType<typeof optimizeShelter> | null>(null)

 const syncMaterials = async () => {
   setSyncingMaterials(true)
   try {
     const res = await fetch('/api/materials')
     const data = await res.json()
     if (data.success && Array.isArray(data.materials) && data.materials.length > 0) {
       registerMaterials(data.materials)
       setMaterialsList([...materials])
     }
   } catch {
     // fallback silently
   } finally {
     setSyncingMaterials(false)
   }
 }

 useEffect(() => {
   syncMaterials()
 }, [])

 const handleMaterialsAdded = (newItems: Material[]) => {
   registerMaterials(newItems)
   setMaterialsList([...materials])
 }

 const climate=climateById(climateId)
 const sim=useMemo(()=>simResult ?? simulateShelter(design,climate),[simResult,design,climate])
 const opt=useMemo(()=>optResult ?? optimizeShelter({},climate),[optResult,climate])
 const currentStage=stages.indexOf(section)
 const update=(key:keyof ShelterDesign,value:string|number)=>setDesign(prev=>({...prev,[key]:value}))
 const go=(s:Section)=>{setSection(s);setMobileNav(false)}

 const runSimulation=async ()=>{
   setSimulationRunning(true)
   setSimulationDone(false)
   try {
     const res = await fetch('/api/simulate', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ design, climate }),
     })
     const data = await res.json()
     if (data.success && data.sim) {
       setSimResult(data.sim)
     } else {
       setSimResult(simulateShelter(design, climate))
     }
   } catch {
     setSimResult(simulateShelter(design, climate))
   } finally {
     setSimulationRunning(false)
     setSimulationDone(true)
     go('Results')
     repository.saveSimulation(design.id, sim)
   }
 }

 const runOptimization = async (parameters?: string[], objective?: string) => {
    setOptimizationRunning(true)
    const activeParams = parameters ?? ['Orientation', 'Wall Material', 'Roof Material', 'Window Area']
    const activeObj = objective ?? 'Minimize heating requirement'
    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          climate,
          currentDesign: design,
          parameters: activeParams,
          objective: activeObj,
        }),
      })
      const data = await res.json()
      if (data.success && data.opt) {
        setOptResult(data.opt)
      } else {
        setOptResult(optimizeShelter({}, climate))
      }
    } catch {
      setOptResult(optimizeShelter({}, climate))
    } finally {
      setOptimizationRunning(false)
      setOptimized(true)
      repository.saveOptimization(climate.id, opt)
    }
  }

  const filtered = materialsList.filter(
    m =>
      (materialCategory === 'all' || m.category === materialCategory) &&
      m.name.toLowerCase().includes(materialsSearch.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-sidebar transition-transform lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Thermometer className="size-5" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">ThermoShelter</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">SIH26051 / PROTOTYPE</div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 px-3 py-5">
          <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</div>
          <nav className="flex flex-col gap-1">
            {nav.map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  onClick={() => go(item.label)}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${section === item.label ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                  {item.label === 'Results' && simulationDone ? <span className="ml-auto size-1.5 rounded-full bg-primary" /> : null}
                </button>
              )
            })}
          </nav>
        </div>
        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-lg bg-sidebar-accent p-3">
            <div className="flex items-center gap-2 text-xs font-medium">
              <CircleHelp className="size-3.5 text-primary" />
              Prototype mode
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Outputs are clearly labeled demo data and are not validated physics results.
            </p>
          </div>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation">
              <Menu className="size-5" />
            </button>
            <div className="hidden items-center gap-2 text-sm sm:flex">
              <span className="text-muted-foreground">Project</span>
              <ChevronRight className="size-3 text-muted-foreground" />
              <span className="font-medium">Ladakh Passive Study</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs sm:flex">
              <span className="size-2 rounded-full bg-emerald-500" />
              Simulation ready
            </div>
            <button className="grid size-8 place-items-center rounded-full bg-muted text-xs font-semibold">AK</button>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-4 py-6 lg:px-8">
          <div className="mb-7 flex items-center justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span>Workspace</span>
                <ChevronRight className="size-3" />
                <span className="text-foreground">{section}</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">{section === 'Dashboard' ? 'Design shelters that work with the climate, not against it.' : section}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{section === 'Dashboard' ? 'Area-specific thermal simulation and optimization for energy-efficient passive shelters.' : 'Configure, evaluate, and explain a climate-aware shelter design.'}</p>
            </div>
            {section === 'Dashboard' && (
              <button onClick={() => go('Climate')} className="hidden items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm sm:flex">
                Start designing <ArrowRight className="size-4" />
              </button>
            )}
          </div>
          <div className="mb-7 flex items-center gap-1 overflow-x-auto pb-1">
            {stages.map((stage, i) => (
              <div key={stage} className="flex shrink-0 items-center gap-1">
                <button onClick={() => go(stage as Section)} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${section === stage ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  <span className="grid size-4 place-items-center rounded-full bg-background/20 text-[10px]">{i + 1}</span>
                  {stage}
                </button>
                {i < stages.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
          {section === 'Dashboard' ? (
            <Dashboard go={go} climate={climate} design={design} sim={sim} />
          ) : section === 'Climate' ? (
            <ClimatePage climateId={climateId} setClimateId={setClimateId} go={go} />
          ) : section === 'Shelter Design' ? (
            <DesignPage design={design} update={update} onSave={() => { setSaved(true); repository.saveShelterDesign(design) }} go={go} saved={saved} materialsList={materialsList} />
          ) : section === 'Materials' ? (
            <MaterialsPage filtered={filtered} search={materialsSearch} setSearch={setMaterialsSearch} category={materialCategory} setCategory={setMaterialCategory} design={design} update={update} go={go} onOpenUpload={() => setUploadModalOpen(true)} materialsList={materialsList} onSyncApi={syncMaterials} syncing={syncingMaterials} />
          ) : section === 'Simulation' ? (
            <SimulationPage design={design} climate={climate} run={runSimulation} running={simulationRunning} done={simulationDone} />
          ) : section === 'Results' ? (
            <ResultsPage sim={sim} design={design} go={go} />
          ) : section === 'Compare Designs' ? (
            <ComparePage sim={sim} climate={climate} materialsList={materialsList} />
          ) : section === 'Optimization' ? (
            <OptimizationPage
              opt={opt}
              running={optimizationRunning}
              optimized={optimized}
              run={runOptimization}
              currentDesign={design}
              climate={climate}
              onApplyOptimal={(bestDesign) => {
                setDesign(bestDesign)
                setSaved(false)
              }}
            />
          ) : (
            <ReportsPage design={design} climate={climate} sim={sim} />
          )}
        </main>
      </div>
      <MaterialUploadModal isOpen={uploadModalOpen} onClose={() => setUploadModalOpen(false)} onMaterialsAdded={handleMaterialsAdded} />
    </div>
  )
}
function Dashboard({go,climate,design,sim}:{go:(s:Section)=>void;climate:ReturnType<typeof climateById>;design:ShelterDesign;sim:ReturnType<typeof simulateShelter>}){return <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]"><section className="rounded-xl border border-border bg-card p-6 lg:p-8"><div className="mb-8 flex items-start justify-between"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground"><span className="size-1.5 rounded-full bg-primary"/>Area-specific design workspace</div><h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight lg:text-4xl">Passive shelter design, grounded in local climate.</h2><p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">Translate climate conditions into design decisions, compare material assemblies, and understand why an option performs better.</p></div><div className="hidden rounded-lg border border-border bg-muted p-3 md:block"><Compass className="size-5 text-primary"/></div></div><div className="flex flex-wrap gap-3"><button onClick={()=>go('Climate')} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">Start designing <ArrowRight className="size-4"/></button><button onClick={()=>go('Simulation')} className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium">Explore workflow <Play className="size-4"/></button></div></section><section className="rounded-xl border border-border bg-primary p-6 text-primary-foreground"><div className="flex items-center justify-between"><div className="text-xs font-medium uppercase tracking-[0.14em] opacity-70">Current project</div><Settings2 className="size-4 opacity-70"/></div><div className="mt-8 text-lg font-semibold">{design.name}</div><div className="mt-4 grid grid-cols-2 gap-4 text-sm"><div><div className="text-xs opacity-60">Location</div><div className="mt-1">{climate.location}</div></div><div><div className="text-xs opacity-60">Geometry</div><div className="mt-1">{design.length} × {design.width} × {design.height} m</div></div><div><div className="text-xs opacity-60">Climate</div><div className="mt-1">{climate.climateType}</div></div><div><div className="text-xs opacity-60">Status</div><div className="mt-1 flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-300"/>Ready to simulate</div></div></div></section><div className="grid gap-4 sm:grid-cols-3 lg:col-span-2"><Feature icon={SunIcon} title="Solar optimization" text="Maximize useful solar gain."/><Feature icon={Thermometer} title="Thermal simulation" text="Predict temperature and heat flow."/><Feature icon={Sparkles} title="Design optimization" text="Find an efficient configuration."/></div><section className="rounded-xl border border-border bg-card lg:col-span-2"><div className="flex items-center justify-between border-b border-border p-5"><div><h3 className="font-semibold">Thermal outlook</h3><p className="text-xs text-muted-foreground">Predicted demo output for the current design</p></div><button onClick={()=>go('Results')} className="text-xs font-medium text-primary">View results <ArrowRight className="ml-1 inline size-3"/></button></div><div className="grid gap-4 p-5 sm:grid-cols-3"><Metric label="Avg. internal temp" value={`${sim.averageInternalTemperature} °C`} icon={<Thermometer/>}/><Metric label="Useful solar gain" value={`${(sim.totalSolarGain/1000).toFixed(1)} kWh`} icon={<TrendingDown/>}/><Metric label="Heat loss" value={`${(sim.totalHeatLoss/1000).toFixed(1)} kWh`} icon={<Wind/>}/></div></section></div>}
function Feature({icon:Icon,title,text}:{icon:React.ComponentType<{className?:string}>;title:string;text:string}){return <div className="rounded-xl border border-border bg-card p-5"><div className="mb-5 grid size-9 place-items-center rounded-md bg-muted text-primary"><Icon className="size-4"/></div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>}
function Metric({label,value,icon}:{label:string;value:string;icon:React.ReactNode}){return <div className="rounded-lg bg-muted p-4"><div className="flex items-center justify-between text-muted-foreground"><span className="text-xs">{label}</span><span className="[&>svg]:size-4">{icon}</span></div><div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div><div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Predicted · Demo data</div></div>}
function SunIcon(){return <CloudSun className="size-4"/>}
function ClimatePage({climateId,setClimateId,go}:{climateId:string;setClimateId:(id:string)=>void;go:(s:Section)=>void}){
  const c = climateById(climateId)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [elevation, setElevation] = useState<number | null>(null)

  const fetchWeather = async (param: string) => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/weather?${param}`)
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch live weather data.')
      }
      registerClimateProfile(data.profile)
      setClimateId(data.profile.id)
      if (data.coordinates?.elevation) setElevation(data.coordinates.elevation)
    } catch (err: any) {
      setErrorMsg(err.message || 'Error fetching live weather.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!query.trim()) return
    fetchWeather(`city=${encodeURIComponent(query.trim())}`)
  }

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.')
      return
    }
    setLoading(true)
    setErrorMsg(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchWeather(`lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`)
      },
      () => {
        setLoading(false)
        setErrorMsg('Unable to retrieve your location. Please type a city name above.')
      }
    )
  }

  const quickCities = [
    { label: 'Leh (Ladakh)', query: 'city=Leh' },
    { label: 'Drās (Kargil)', query: 'city=Dras' },
    { label: 'Kaza (Spiti)', query: 'city=Kaza' },
    { label: 'Shimla (HP)', query: 'city=Shimla' },
    { label: 'Srinagar (J&K)', query: 'city=Srinagar' },
    { label: 'Manali (HP)', query: 'city=Manali' },
  ]

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.65fr]">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Live Climate & Solar Profile</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-500">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500"/>
                OPEN-METEO LIVE API
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Search any location or detect GPS to fetch real-time ambient temperature, solar irradiance (W/m²), and boundary conditions.
            </p>
          </div>
          <button
            onClick={handleDetectLocation}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            title="Use current GPS location"
          >
            <Navigation className="size-3.5 text-primary" />
            Detect My GPS
          </button>
        </div>

        {/* Live Search Form */}
        <form onSubmit={handleSearch} className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search location (e.g. Leh, Dras, Spiti, Kargil, Shimla, Manali)..."
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? <div className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <Search className="size-3.5"/>}
            Fetch Weather
          </button>
        </form>

        {/* Quick High-Altitude Station Chips */}
        <div className="mb-6">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Quick Cold-Climate Stations
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickCities.map(qc => (
              <button
                key={qc.label}
                onClick={() => fetchWeather(qc.query)}
                disabled={loading}
                className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
              >
                {qc.label}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {errorMsg}
          </div>
        )}

        {/* Meteorological Values Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['Location', c.location],
            ['Climate type', c.climateType],
            ['Ambient temperature', `${c.ambientTemperature} °C`],
            ['Solar radiation', `${c.solarRadiation} W/m²`],
            ['Sunshine duration', `${c.sunshineDuration} hours/day`],
            ['Wind speed', `${c.windSpeed} m/s`],
            ['Relative humidity', `${c.relativeHumidity} %`],
            ['Simulation duration', '24 hours'],
          ].map(([label, value]) => (
            <label key={label} className="grid gap-2 text-xs font-medium">
              {label}
              <input
                value={value}
                readOnly
                className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground outline-none"
              />
            </label>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="text-[11px] text-muted-foreground">
            {elevation ? `Station elevation: ${elevation.toLocaleString()} m above sea level` : 'Live meteorological inputs ready for thermal simulation.'}
          </div>
          <button
            onClick={() => go('Shelter Design')}
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Apply & Continue to Shelter Design <ArrowRight className="ml-1 inline size-4" />
          </button>
        </div>
      </section>

      <InfoPanel title="Why live climate data matters" icon={<CloudSun />}>
        <p>
          Local climate sets the physical boundary conditions for thermal comfort. Real solar radiation, wind speed, humidity, and ambient temperature drive heat loss and passive solar gain.
        </p>
        <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
          Using live Open-Meteo meteorological and solar models ensures your design accurately accounts for winter solar gains and extreme nighttime radiative heat losses.
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Metric label="Live Solar Resource" value={`${c.solarRadiation} W/m²`} icon={<SunIcon />} />
          <Metric label="Live Ambient Baseline" value={`${c.ambientTemperature} °C`} icon={<Thermometer />} />
        </div>
      </InfoPanel>
    </div>
  )
}
function InfoPanel({title,icon,children}:{title:string;icon:React.ReactNode;children:React.ReactNode}){return <section className="rounded-xl border border-border bg-card p-6"><div className="flex items-center gap-2 font-semibold"><span className="text-primary [&>svg]:size-4">{icon}</span>{title}</div><div className="mt-4 text-sm leading-6 text-muted-foreground">{children}</div></section>}
function DesignPage({design,update,onSave,go,saved,materialsList}:{design:ShelterDesign;update:(key:keyof ShelterDesign,value:string|number)=>void;onSave:()=>void;go:(s:Section)=>void;saved:boolean;materialsList?:Material[]}){
  const activeMats = materialsList ?? materials;
  const getCat = (cat: Material['category']) => activeMats.filter(m => m.category === cat);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="mb-6">
          <h2 className="font-semibold">Shelter geometry</h2>
          <p className="mt-1 text-xs text-muted-foreground">Set dimensions and openings — the 3D model updates live.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {([['length','Length','m'],['width','Width','m'],['height','Height','m'],['windowAreaPercentage','Window area','%'],['doorArea','Door area','m²'],['numberOfWindows','Windows','count']] as const).map(([key,label,unit]) => (
            <label key={key} className="grid gap-2 text-xs font-medium">
              {label}
              <div className="relative">
                <input type="number" min="0" value={design[key]} onChange={e => update(key, Number(e.target.value))} className="h-10 w-full rounded-md border border-input bg-background px-3 pr-12 text-sm outline-none"/>
                <span className="absolute right-3 top-3 text-[10px] text-muted-foreground">{unit}</span>
              </div>
            </label>
          ))}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-xs font-medium">Shape
            <select value={design.shape} onChange={e => update('shape', e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option>Rectangular</option>
              <option>Square</option>
            </select>
          </label>
          <label className="grid gap-2 text-xs font-medium">Orientation
            <select value={design.orientation} onChange={e => update('orientation', e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option>North</option>
              <option>South</option>
              <option>East</option>
              <option>West</option>
            </select>
          </label>
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Envelope Material Selection (API Driven)</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-xs font-medium">Wall Material
              <select value={design.wallMaterialId} onChange={e => update('wallMaterialId', e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                {getCat('wall').map(m => <option key={m.id} value={m.id}>{m.name} (k={m.thermalConductivity})</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-medium">Roof Material
              <select value={design.roofMaterialId} onChange={e => update('roofMaterialId', e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                {getCat('roof').map(m => <option key={m.id} value={m.id}>{m.name} (k={m.thermalConductivity})</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-medium">Floor Material
              <select value={design.floorMaterialId} onChange={e => update('floorMaterialId', e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                {getCat('floor').map(m => <option key={m.id} value={m.id}>{m.name} (k={m.thermalConductivity})</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-medium">Window Glazing
              <select value={design.windowMaterialId} onChange={e => update('windowMaterialId', e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                {getCat('window').map(m => <option key={m.id} value={m.id}>{m.name} (k={m.thermalConductivity})</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-medium">Entrance Door
              <select value={design.doorMaterialId} onChange={e => update('doorMaterialId', e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                {getCat('door').map(m => <option key={m.id} value={m.id}>{m.name} (k={m.thermalConductivity})</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-medium">Thermal Storage Mass
              <select value={design.thermalStorageMaterialId} onChange={e => update('thermalStorageMaterialId', e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                {getCat('thermal_storage').map(m => <option key={m.id} value={m.id}>{m.name} (cp={m.specificHeat})</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={onSave} className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
            {saved ? 'Design saved' : 'Save design'}
          </button>
          <button onClick={() => go('Materials')} className="rounded-md border border-border px-4 py-2.5 text-sm font-medium">
            Continue to materials <ArrowRight className="ml-1 inline size-4" />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center rounded-lg bg-muted p-4">
          <div>
            <div className="text-lg font-semibold">{(design.length * design.width).toFixed(1)}</div>
            <div className="text-[10px] uppercase text-muted-foreground">Floor m²</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{design.windowAreaPercentage}%</div>
            <div className="text-[10px] uppercase text-muted-foreground">Openings</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{design.orientation[0]}</div>
            <div className="text-[10px] uppercase text-muted-foreground">Orientation</div>
          </div>
        </div>
      </section>
      <DesignPreview design={design} />
    </div>
  )
}
function DesignPreview({design}:{design:ShelterDesign}){return <div className="flex flex-col gap-3"><ThreeBuilding design={design} className="h-full"/></div>}
function Badge({children}:{children:React.ReactNode}){return <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold tracking-wider text-primary">{children}</span>}

function MaterialsPage({
  filtered,
  search,
  setSearch,
  category,
  setCategory,
  design,
  update,
  go,
  onOpenUpload,
  materialsList,
  onSyncApi,
  syncing,
}: {
  filtered: Material[]
  search: string
  setSearch: (s: string) => void
  category: string
  setCategory: (s: string) => void
  design: ShelterDesign
  update: (key: keyof ShelterDesign, value: string | number) => void
  go: (s: Section) => void
  onOpenUpload: () => void
  materialsList: Material[]
  onSyncApi: () => void
  syncing: boolean
}) {
  const assemblySlots: { key: keyof ShelterDesign; label: string; cat: Material['category'] }[] = [
    { key: 'wallMaterialId', label: 'Wall Component', cat: 'wall' },
    { key: 'roofMaterialId', label: 'Roof Component', cat: 'roof' },
    { key: 'floorMaterialId', label: 'Floor Component', cat: 'floor' },
    { key: 'windowMaterialId', label: 'Window Glazing', cat: 'window' },
    { key: 'doorMaterialId', label: 'Entrance Door', cat: 'door' },
    { key: 'thermalStorageMaterialId', label: 'Thermal Storage Mass', cat: 'thermal_storage' },
  ]

  return (
    <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
      {/* LEFT: Selected Assembly with fully interactive Material Selectors */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground">Selected assembly</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose or change material for each building envelope component.
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-primary">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            ACTIVE
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {assemblySlots.map(({ key, label, cat }) => {
            const currentId = String(design[key])
            const currentMat = materialsList.find(x => x.id === currentId) || materialById(currentId)
            const slotOptions = materialsList.filter(x => x.category === cat)
            const selectable = slotOptions.length > 0 ? slotOptions : materialsList

            return (
              <div
                key={key}
                className="rounded-lg border border-border/80 bg-muted/20 p-3.5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">{label}</span>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="rounded bg-background/80 px-1.5 py-0.5 font-medium border border-border/60">
                      R {currentMat.thermalResistance} m²K/W
                    </span>
                    <span className="rounded bg-background/80 px-1.5 py-0.5 font-medium border border-border/60">
                      k {currentMat.thermalConductivity} W/mK
                    </span>
                  </div>
                </div>

                <div className="mt-2">
                  <select
                    value={currentId}
                    onChange={e => update(key, e.target.value)}
                    aria-label={`Select material for ${label}`}
                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {selectable.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} — k: {item.thermalConductivity} W/mK | R: {item.thermalResistance} m²K/W
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="truncate max-w-[210px]">{currentMat.description}</span>
                  <span className="font-mono text-[10px] shrink-0">{currentMat.defaultThickness}mm · {currentMat.density}kg/m³</span>
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={() => go('Simulation')}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Continue to simulation <ArrowRight className="size-4" />
        </button>
      </section>

      {/* RIGHT: Material Library with Live API status and Direct Selection */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-foreground">Material library</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                API: /api/materials
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Dynamic materials loaded via REST API. Click any material to assign it to your assembly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onSyncApi}
              disabled={syncing}
              title="Sync latest materials from REST API"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${syncing ? 'animate-spin text-primary' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync API'}
            </button>

            <button
              onClick={onOpenUpload}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <UploadCloud className="size-3.5" />
              Upload / Ingest API
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter materials by name..."
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
            />
          </div>

          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="all">All categories ({materialsList.length})</option>
            <option value="wall">Wall</option>
            <option value="roof">Roof</option>
            <option value="floor">Floor</option>
            <option value="window">Window</option>
            <option value="door">Door</option>
            <option value="thermal_storage">Storage</option>
          </select>
        </div>

        {/* Cards Grid */}
        <div className="grid gap-3 sm:grid-cols-2 max-h-[640px] overflow-y-auto pr-1">
          {filtered.map(m => {
            const isWall = design.wallMaterialId === m.id
            const isRoof = design.roofMaterialId === m.id
            const isFloor = design.floorMaterialId === m.id
            const isWindow = design.windowMaterialId === m.id
            const isDoor = design.doorMaterialId === m.id
            const isStorage = design.thermalStorageMaterialId === m.id

            const isCurrentInSlot =
              (m.category === 'wall' && isWall) ||
              (m.category === 'roof' && isRoof) ||
              (m.category === 'floor' && isFloor) ||
              (m.category === 'window' && isWindow) ||
              (m.category === 'door' && isDoor) ||
              (m.category === 'thermal_storage' && isStorage)

            const isAssignedSomewhere = isWall || isRoof || isFloor || isWindow || isDoor || isStorage

            return (
              <article
                key={m.id}
                className={`flex flex-col justify-between rounded-lg border p-4 transition-all ${
                  isAssignedSomewhere
                    ? 'border-primary/50 bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:border-border/80 hover:shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="inline-block rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {m.category.replace('_', ' ')}
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-foreground">{m.name}</h3>
                    </div>

                    {isAssignedSomewhere && (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        <Check className="size-3" />
                        In assembly
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs leading-5 text-muted-foreground line-clamp-2">
                    {m.description}
                  </p>
                </div>

                <div className="mt-4">
                  <div className="grid grid-cols-3 gap-2 border-t border-border pt-2 text-[10px] text-muted-foreground">
                    <div>
                      <b className="block text-xs font-semibold text-foreground">{m.thermalConductivity}</b>
                      W/mK
                    </div>
                    <div>
                      <b className="block text-xs font-semibold text-foreground">{m.density}</b>
                      kg/m³
                    </div>
                    <div>
                      <b className="block text-xs font-semibold text-foreground">{m.defaultThickness}</b>
                      mm
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      R: {m.thermalResistance} m²K/W
                    </span>

                    {isCurrentInSlot ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <Check className="size-3.5" />
                        Active for {m.category.replace('_', ' ')}
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          if (m.category === 'wall') update('wallMaterialId', m.id)
                          else if (m.category === 'roof') update('roofMaterialId', m.id)
                          else if (m.category === 'floor') update('floorMaterialId', m.id)
                          else if (m.category === 'window') update('windowMaterialId', m.id)
                          else if (m.category === 'door') update('doorMaterialId', m.id)
                          else update('thermalStorageMaterialId', m.id)
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                      >
                        Select as {m.category.replace('_', ' ')}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function SimulationPage({design,climate,run,running,done}:{design:ShelterDesign;climate:ReturnType<typeof climateById>;run:()=>void;running:boolean;done:boolean}){
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.7fr]">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="font-semibold">Simulation configuration</h2>
            <p className="mt-1 text-xs text-muted-foreground">Review inputs before running the physics solver.</p>
          </div>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            REST API: /api/simulate
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['Climate', `${climate.location} · ${climate.climateType}`],
            ['Geometry', `${design.shape} · ${design.length} × ${design.width} × ${design.height} m`],
            ['Orientation', design.orientation],
            ['Openings', `${design.windowAreaPercentage}% windows · ${design.numberOfWindows} openings`],
            ['Wall material', materialById(design.wallMaterialId).name],
            ['Roof material', materialById(design.roofMaterialId).name],
            ['Floor material', materialById(design.floorMaterialId).name],
            ['Window glazing', materialById(design.windowMaterialId).name],
          ].map(([a,b]) => (
            <div key={a} className="rounded-lg bg-muted p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{a}</div>
              <div className="mt-2 text-sm font-medium">{b}</div>
            </div>
          ))}
        </div>
        <button disabled={running} onClick={run} className="mt-6 flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60 transition-colors hover:bg-primary/90">
          <Play className="size-4"/>
          {running ? 'Executing physics simulation via /api/simulate…' : 'Run simulation'}
        </button>
        {done && (
          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <Check className="size-4"/>
            Simulation completed via REST API solver.
          </div>
        )}
      </section>
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Engine pipeline</h2>
          <Badge>24H TRANSIENT EULER</Badge>
        </div>
        <div className="mt-6 flex flex-col gap-4">
          {[
            'Fetching dynamic climate baseline from /api/weather',
            'Computing angle-dependent solar irradiation (W/m²)',
            'Calculating envelope heat transfer (U-values)',
            'Evaluating infiltration & ventilation losses',
            'Implicit Euler thermal network matrix solving'
          ].map((x,i) => (
            <div key={x} className="flex items-center gap-3">
              <span className={`grid size-7 place-items-center rounded-full text-xs ${running && i < 4 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {running && i < 4 ? <Activity className="size-3.5"/> : i + 1}
              </span>
              <span className="text-sm text-muted-foreground">{x}</span>
            </div>
          ))}
        </div>
        <p className="mt-8 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
          Calculations are executed on the server using deterministic energy conservation equations: C · dTin/dt = Qsolar + Qinternal - Qconduction - Qinfiltration.
        </p>
      </section>
    </div>
  )
}
function ResultsPage({sim,design,go}:{sim:ReturnType<typeof simulateShelter>;design:ShelterDesign;go:(s:Section)=>void}){return <div className="flex flex-col gap-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Internal temperature" value={`${sim.averageInternalTemperature} °C`} icon={<Thermometer/>}/><Metric label="Solar energy gain" value={`${(sim.totalSolarGain/1000).toFixed(1)} kWh`} icon={<SunIcon/>}/><Metric label="Total heat loss" value={`${(sim.totalHeatLoss/1000).toFixed(1)} kWh`} icon={<Wind/>}/><Metric label="Heating requirement" value={`${(sim.totalHeatingRequirement/1000).toFixed(1)} kWh`} icon={<Activity/>}/></div><div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]"><ChartCard title="Internal temperature vs ambient" subtitle="Predicted · 24 hour demo output"><ResponsiveContainer width="100%" height={260}><LineChart data={sim.points}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)"/><XAxis dataKey="timestamp" tick={{fontSize:10}} interval={3}/><YAxis tick={{fontSize:10}}/><Tooltip/><Line type="monotone" dataKey="internalTemperature" stroke="var(--primary)" strokeWidth={2} dot={false} name="Internal °C"/><Line type="monotone" dataKey="ambientTemperature" stroke="var(--muted-foreground)" strokeWidth={1.5} dot={false} name="Ambient °C"/></LineChart></ResponsiveContainer></ChartCard><ChartCard title="Heat loss breakdown" subtitle="Relative distribution · demo"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={sim.breakdown} dataKey="value" nameKey="name" innerRadius={65} outerRadius={92} paddingAngle={3}>{sim.breakdown.map(x=><Cell key={x.name} fill={x.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="grid grid-cols-2 gap-2">{sim.breakdown.map(x=><div key={x.name} className="flex items-center gap-2 text-xs"><span className="size-2 rounded-full" style={{background:x.color}}/>{x.name}<span className="ml-auto text-muted-foreground">{x.value}%</span></div>)}</div></ChartCard></div><div className="grid gap-5 lg:grid-cols-2"><ChartCard title="Solar radiation and gain" subtitle="W/m² and relative useful gain"><ResponsiveContainer width="100%" height={220}><AreaChart data={sim.points}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)"/><XAxis dataKey="timestamp" tick={{fontSize:10}} interval={3}/><YAxis tick={{fontSize:10}}/><Tooltip/><Area type="monotone" dataKey="solarRadiation" fill="var(--chart-2)" fillOpacity={0.18} stroke="var(--chart-2)" name="Solar W/m²"/><Area type="monotone" dataKey="solarGain" fill="var(--chart-1)" fillOpacity={0.2} stroke="var(--chart-1)" name="Gain W"/></AreaChart></ResponsiveContainer></ChartCard><ChartCard title="Heat loss and heating requirement" subtitle="Hourly predicted values"><ResponsiveContainer width="100%" height={220}><BarChart data={sim.points}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)"/><XAxis dataKey="timestamp" tick={{fontSize:10}} interval={3}/><YAxis tick={{fontSize:10}}/><Tooltip/><Bar dataKey="heatLoss" fill="var(--chart-2)" name="Heat loss W" radius={[3,3,0,0]}/><Bar dataKey="heatingRequirement" fill="var(--chart-1)" name="Heating W" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></ChartCard></div><div className="flex flex-wrap items-center justify-between rounded-xl border border-border bg-card p-5"><div><div className="text-xs uppercase tracking-wider text-muted-foreground">Design summary</div><div className="mt-2 text-sm font-medium">{design.name} · {design.orientation} orientation · {design.length*design.width} m² floor area</div></div><button onClick={()=>go('Compare Designs')} className="mt-3 rounded-md border border-border px-4 py-2 text-sm font-medium sm:mt-0">Compare designs <ArrowRight className="ml-1 inline size-4"/></button></div></div>}
function ChartCard({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}){return <section className="rounded-xl border border-border bg-card p-5"><div className="mb-4"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></div>{children}</section>}
function ComparePage({sim,climate,materialsList}:{sim:ReturnType<typeof simulateShelter>;climate:ReturnType<typeof climateById>;materialsList:Material[]}){
  type CompRow={id:string;name:string;wall:string;roof:string;orientation:string;windowArea:number;avgTemp:number;solar:number;loss:number;heating:number;active:boolean}
  const [rows,setRows]=useState<CompRow[]>([
    {id:'active',name:'Ladakh Passive Study',wall:'Rammed Earth',roof:'Insulated Panel',orientation:'South',windowArea:12,avgTemp:sim.averageInternalTemperature,solar:sim.totalSolarGain/1000,loss:sim.totalHeatLoss/1000,heating:sim.totalHeatingRequirement/1000,active:true},
    {id:'hm',name:'High Mass Variant',wall:'Compressed Earth',roof:'Mud + Lime',orientation:'East',windowArea:8,avgTemp:15.2,solar:4.2,loss:2.9,heating:1.8,active:false},
  ])
  const [open,setOpen]=useState(false)
  const [adding,setAdding]=useState(false)
  const [form,setForm]=useState({name:'',orientation:'South',wallMaterialId:'rammed_earth',roofMaterialId:'insulated_panel',floorMaterialId:'concrete_slab',windowMaterialId:'double_glazing',doorMaterialId:'timber_door',thermalStorageMaterialId:'concrete_block',windowArea:12,length:6,width:4,height:3})

  const wallOptions=materialsList.filter(m=>m.category==='wall')
  const roofOptions=materialsList.filter(m=>m.category==='roof')

  const handleAdd=async(e:React.FormEvent)=>{
    e.preventDefault()
    if(!form.name.trim())return
    setAdding(true)
    try{
      const designPayload:ShelterDesign={...defaultDesign,name:form.name,orientation:form.orientation as ShelterDesign['orientation'],wallMaterialId:form.wallMaterialId,roofMaterialId:form.roofMaterialId,floorMaterialId:form.floorMaterialId,windowMaterialId:form.windowMaterialId,doorMaterialId:form.doorMaterialId,thermalStorageMaterialId:form.thermalStorageMaterialId,windowAreaPercentage:form.windowArea,length:form.length,width:form.width,height:form.height}
      let result:ReturnType<typeof simulateShelter>
      try{
        const res=await fetch('/api/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({design:designPayload,climate})})
        const data=await res.json()
        result=data.success&&data.sim?data.sim:simulateShelter(designPayload,climate)
      }catch{result=simulateShelter(designPayload,climate)}
      const wallName=materialsList.find(m=>m.id===form.wallMaterialId)?.name??form.wallMaterialId
      const roofName=materialsList.find(m=>m.id===form.roofMaterialId)?.name??form.roofMaterialId
      setRows(prev=>[...prev,{id:Date.now().toString(),name:form.name,wall:wallName,roof:roofName,orientation:form.orientation,windowArea:form.windowArea,avgTemp:result.averageInternalTemperature,solar:result.totalSolarGain/1000,loss:result.totalHeatLoss/1000,heating:result.totalHeatingRequirement/1000,active:false}])
      setOpen(false)
      setForm(f=>({...f,name:''}))
    }finally{setAdding(false)}
  }

  const chartData=rows.map(r=>({name:r.name.length>14?r.name.slice(0,14)+'…':r.name,solar:parseFloat(r.solar.toFixed(2)),loss:parseFloat(r.loss.toFixed(2)),heat:parseFloat(r.heating.toFixed(2))}))

  return(
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Compare saved configurations</h2>
            <p className="mt-1 text-xs text-muted-foreground">Relative comparison for the selected climate · {climate.location}</p>
          </div>
          <button
            id="add-design-btn"
            onClick={()=>setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Plus className="size-3.5"/>Add design
          </button>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-border text-muted-foreground">
              <tr>{['Design','Wall','Roof','Orientation','Window area','Avg. internal','Solar gain','Heat loss','Heating'].map(x=><th key={x} className="pb-3 pr-4 font-medium">{x}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id} className={`border-b border-border ${r.active?'bg-primary/5':''}`}>
                  <td className="py-4 pr-4 font-semibold">{r.name}{r.active&&<Badge>ACTIVE</Badge>}</td>
                  <td className="pr-4">{r.wall}</td>
                  <td className="pr-4">{r.roof}</td>
                  <td className="pr-4">{r.orientation}</td>
                  <td className="pr-4">{r.windowArea}%</td>
                  <td className={`pr-4 font-semibold ${r.active?'':'text-foreground'}`}>{r.avgTemp} °C</td>
                  <td className="pr-4">{r.solar.toFixed(1)} kWh</td>
                  <td className="pr-4">{r.loss.toFixed(1)} kWh</td>
                  <td>{r.heating.toFixed(1)} kWh</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ChartCard title="Relative performance" subtitle="Selected configurations · live comparison">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)"/>
            <XAxis dataKey="name" tick={{fontSize:10}}/>
            <YAxis tick={{fontSize:10}}/>
            <Tooltip/>
            <Bar dataKey="solar" fill="var(--chart-1)" name="Solar gain kWh" radius={[3,3,0,0]}/>
            <Bar dataKey="loss" fill="var(--chart-2)" name="Heat loss kWh" radius={[3,3,0,0]}/>
            <Bar dataKey="heat" fill="var(--chart-3)" name="Heating kWh" radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Add Design Slide-over Modal */}
      {open&&(
        <div className="fixed inset-0 z-50 flex items-end justify-end" role="dialog" aria-modal="true" aria-label="Add design">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>setOpen(false)}/>
          {/* Panel */}
          <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <div className="font-semibold">Add design variant</div>
                <p className="mt-0.5 text-xs text-muted-foreground">Configure a new design and run a live simulation to compare.</p>
              </div>
              <button onClick={()=>setOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-md hover:bg-muted"><X className="size-4"/></button>
            </div>

            {/* Form */}
            <form onSubmit={handleAdd} className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
              <label className="grid gap-1.5 text-xs font-medium">
                Design name <span className="text-destructive">*</span>
                <input
                  id="design-name-input"
                  required
                  value={form.name}
                  onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                  placeholder="e.g. Lightweight Timber Variant"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </label>

              <div className="grid grid-cols-3 gap-3">
                {([['length','Length (m)',1,20],['width','Width (m)',1,20],['height','Height (m)',1.5,6]] as const).map(([k,lbl,mn,mx])=>(
                  <label key={k} className="grid gap-1.5 text-xs font-medium">
                    {lbl}
                    <input type="number" min={mn} max={mx} step="0.5" value={form[k]} onChange={e=>setForm(f=>({...f,[k]:Number(e.target.value)}))} className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"/>
                  </label>
                ))}
              </div>

              <label className="grid gap-1.5 text-xs font-medium">
                Orientation
                <select value={form.orientation} onChange={e=>setForm(f=>({...f,orientation:e.target.value}))} className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                  {['North','South','East','West'].map(o=><option key={o}>{o}</option>)}
                </select>
              </label>

              <label className="grid gap-1.5 text-xs font-medium">
                Window area (%)
                <div className="flex items-center gap-3">
                  <input type="range" min={2} max={40} value={form.windowArea} onChange={e=>setForm(f=>({...f,windowArea:Number(e.target.value)}))} className="flex-1 accent-primary"/>
                  <span className="w-10 text-right text-sm font-semibold">{form.windowArea}%</span>
                </div>
              </label>

              <label className="grid gap-1.5 text-xs font-medium">
                Wall material
                <select value={form.wallMaterialId} onChange={e=>setForm(f=>({...f,wallMaterialId:e.target.value}))} className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                  {(wallOptions.length>0?wallOptions:materialsList).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>

              <label className="grid gap-1.5 text-xs font-medium">
                Roof material
                <select value={form.roofMaterialId} onChange={e=>setForm(f=>({...f,roofMaterialId:e.target.value}))} className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                  {(roofOptions.length>0?roofOptions:materialsList).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>

              <div className="mt-auto flex gap-3 border-t border-border pt-4">
                <button type="button" onClick={()=>setOpen(false)} className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted">Cancel</button>
                <button
                  id="add-design-submit"
                  type="submit"
                  disabled={adding||!form.name.trim()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {adding?<><div className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"/>Simulating…</>:<><Play className="size-3.5"/>Run & Add</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function ReportsPage({design,climate,sim}:{design:ShelterDesign;climate:ReturnType<typeof climateById>;sim:ReturnType<typeof simulateShelter>}){return <div className="mx-auto max-w-4xl"><section className="rounded-xl border border-border bg-card p-8"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6"><div><div className="flex items-center gap-2"><div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground"><Thermometer className="size-4"/></div><span className="font-semibold">ThermoShelter</span></div><h2 className="mt-7 text-2xl font-semibold">Thermal design study</h2><p className="mt-1 text-sm text-muted-foreground">{design.name} · Generated prototype report</p></div><button onClick={()=>window.print()} className="rounded-md border border-border px-4 py-2 text-sm font-medium"><Download className="mr-2 inline size-4"/>Export report</button></div><div className="grid gap-6 py-7 sm:grid-cols-2"><ReportBlock title="Project information"><Row a="Project" b={design.name}/><Row a="Status" b="Prototype / demo output"/><Row a="Generated" b="08 Sep 2026"/></ReportBlock><ReportBlock title="Climate parameters"><Row a="Location" b={climate.location}/><Row a="Climate type" b={climate.climateType}/><Row a="Ambient temperature" b={`${climate.ambientTemperature} °C`}/><Row a="Solar radiation" b={`${climate.solarRadiation} W/m²`}/></ReportBlock><ReportBlock title="Shelter parameters"><Row a="Geometry" b={`${design.length} × ${design.width} × ${design.height} m`}/><Row a="Orientation" b={design.orientation}/><Row a="Window area" b={`${design.windowAreaPercentage}%`}/></ReportBlock><ReportBlock title="Simulation results"><Row a="Avg. internal temperature" b={`${sim.averageInternalTemperature} °C`}/><Row a="Solar gain" b={`${(sim.totalSolarGain/1000).toFixed(1)} kWh`}/><Row a="Heat loss" b={`${(sim.totalHeatLoss/1000).toFixed(1)} kWh`}/></ReportBlock></div><div className="rounded-lg bg-muted p-5"><div className="text-xs font-semibold uppercase tracking-wider">Interpretation note</div><p className="mt-2 text-sm leading-6 text-muted-foreground">This report is a structured preview for the SIH prototype. Values are mock simulation output and should not be treated as experimental, ANSYS, or real-world validated results.</p></div></section></div>}
function ReportBlock({title,children}:{title:string;children:React.ReactNode}){return <div><h3 className="mb-3 text-sm font-semibold">{title}</h3><div className="flex flex-col gap-2">{children}</div></div>}
function Row({a,b}:{a:string;b:string}){return <div className="flex justify-between gap-4 border-b border-border/70 pb-2 text-xs"><span className="text-muted-foreground">{a}</span><span className="text-right font-medium">{b}</span></div>}
