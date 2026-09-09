'use client'

import React, { useState } from 'react'
import {
  Sparkles,
  Check,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Zap,
  Thermometer,
  CloudSun,
  ShieldCheck,
  ArrowRight,
  SlidersHorizontal,
  Bot,
  Flame,
} from 'lucide-react'
import type { ShelterDesign, ClimateProfile } from '@/lib/thermoshelter'
import type { DetailedOptimizationResult } from '@/lib/ai-optimizer'

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary ${className}`}
    >
      {children}
    </span>
  )
}

interface OptimizationPageProps {
  opt: DetailedOptimizationResult | any
  running: boolean
  optimized: boolean
  run: (parameters: string[], objective: string) => void
  currentDesign: ShelterDesign
  climate: ClimateProfile
  onApplyOptimal?: (design: ShelterDesign) => void
}

export default function OptimizationPage({
  opt,
  running,
  optimized,
  run,
  currentDesign,
  climate,
  onApplyOptimal,
}: OptimizationPageProps) {
  const [selected, setSelected] = useState<string[]>([
    'Orientation',
    'Wall Material',
    'Roof Material',
    'Window Area',
  ])
  const [objective, setObjective] = useState<string>('Minimize heating requirement')
  const [applied, setApplied] = useState(false)

  const handleRun = () => {
    setApplied(false)
    run(selected, objective)
  }

  const handleApply = () => {
    if (opt?.bestDesign && onApplyOptimal) {
      onApplyOptimal(opt.bestDesign)
      setApplied(true)
      setTimeout(() => setApplied(false), 5000)
    }
  }

  // Derive metrics if not present on legacy opt
  const metrics = opt?.metrics
  const comparisons = opt?.comparisons
  const aiAnalysis = opt?.aiAnalysis

  return (
    <div className="space-y-6">
      {/* Top Main Grid matching original layout */}
      <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
        {/* Left Column: Optimization Study Controls */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="font-semibold text-card-foreground">Optimization study</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Search the design space against a climate-specific objective.
            </p>
          </div>

          <div className="text-xs font-medium text-foreground">Parameters to optimize</div>
          <div className="mt-3 grid gap-2">
            {[
              'Orientation',
              'Wall Material',
              'Roof Material',
              'Window Area',
              'Shelter Dimensions',
              'Thermal Storage',
            ].map(param => (
              <label
                key={param}
                className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors ${
                  selected.includes(param)
                    ? 'border-primary/40 bg-primary/5 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(param)}
                  onChange={() =>
                    setSelected(s =>
                      s.includes(param) ? s.filter(y => y !== param) : [...s, param]
                    )
                  }
                  className="accent-primary"
                />
                {param}
              </label>
            ))}
          </div>

          <div className="mt-6 text-xs font-medium text-foreground">Objective</div>
          <select
            value={objective}
            onChange={e => setObjective(e.target.value)}
            className="mt-3 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option>Maintain thermal comfort</option>
            <option>Minimize heat loss</option>
            <option>Maximize useful solar gain</option>
            <option>Minimize heating requirement</option>
          </select>

          <button
            disabled={running || selected.length === 0}
            onClick={handleRun}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow transition hover:opacity-90 disabled:opacity-50"
          >
            {running ? 'Searching possible configurations…' : 'Optimize design'}
            <Sparkles className="size-4" />
          </button>

          {running && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Simulating permutations...</span>
                <span>Calculating thermodynamic performance</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
              </div>
            </div>
          )}

          {/* AI Model Badge */}
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-muted/60 p-3 text-xs text-muted-foreground">
            <Bot className="size-4 text-primary shrink-0" />
            <div>
              <div className="font-medium text-foreground">
                {aiAnalysis?.model || 'ThermoAI Reasoning Engine v2.4'}
              </div>
              <div className="text-[11px] opacity-75">
                Area-specific building thermodynamics & passive solar optimization
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Optimal Design Display */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {optimized ? (
            <>
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <Badge>OPTIMAL DESIGN FOUND</Badge>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-card-foreground">
                    A stronger starting point for this climate.
                  </h2>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-semibold text-primary">{opt.score}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Design score
                  </div>
                </div>
              </div>

              {/* 6 Key Parameter Cards - Exactly matching screenshot */}
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  ['ORIENTATION', opt.orientation],
                  ['WALL', opt.wall],
                  ['ROOF', opt.roof],
                  ['WINDOW AREA', `${opt.windowArea}%`],
                  ['THERMAL STORAGE', opt.thermalStorage || 'Stone Thermal Mass'],
                  ['CONFIGURATIONS EVALUATED', `${opt.configurationsEvaluated || 48}`],
                ].map(([label, val]) => (
                  <div key={label} className="rounded-lg bg-muted p-4">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {label}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-foreground">{val}</div>
                  </div>
                ))}
              </div>

              {/* Why This Design Section with Checkmarks */}
              <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="size-4 text-primary" />
                  Why this design?
                </div>

                <div className="mt-4 grid gap-3">
                  {Array.isArray(opt.explanation) &&
                    opt.explanation.map((reason: string, i: number) => (
                      <div key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{reason}</span>
                      </div>
                    ))}
                </div>

                {/* AI Executive Summary */}
                {aiAnalysis?.executiveSummary && (
                  <div className="mt-4 border-t border-primary/10 pt-3 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">AI Engineering Verdict: </span>
                    {aiAnalysis.executiveSummary}
                  </div>
                )}
              </div>

              {/* Apply Optimal Design CTA */}
              {onApplyOptimal && opt?.bestDesign && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Apply to Active Shelter Model
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Updates 3D model, simulation, and materials tab with this optimal configuration
                    </div>
                  </div>
                  <button
                    onClick={handleApply}
                    className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow transition hover:opacity-90"
                  >
                    {applied ? (
                      <>
                        <CheckCircle2 className="size-4 text-emerald-300" />
                        Applied to Shelter!
                      </>
                    ) : (
                      <>
                        <Zap className="size-4" />
                        Apply Optimal Design
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-96 flex-col items-center justify-center text-center">
              <div className="grid size-14 place-items-center rounded-full bg-muted text-primary">
                <Sparkles className="size-6" />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-foreground">
                Find a better-fit configuration
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                ThermoShelter will evaluate selected parameters relative to your climate and explain
                the recommendation.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Genuine Comparison Section: Current vs AI Recommended */}
      {optimized && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                <Sparkles className="size-3" />
                GENUINE DESIGN COMPARISON
              </div>
              <h3 className="mt-2 text-xl font-semibold text-card-foreground">
                Current Shelter vs. AI Recommended Design
              </h3>
              <p className="text-xs text-muted-foreground">
                Rigorous side-by-side thermodynamic simulation comparison for {climate.location} (
                {climate.climateType})
              </p>
            </div>

            {opt?.bestDesign && onApplyOptimal && (
              <button
                onClick={handleApply}
                className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20"
              >
                {applied ? '✓ Configuration Active' : 'Adopt AI Recommendations'}
                <ArrowRight className="size-3.5" />
              </button>
            )}
          </div>

          {/* Quantitative Performance Delta Cards */}
          {metrics && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Heat Loss Metric */}
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>24h Heat Loss</span>
                  <TrendingDown className="size-4 text-emerald-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-xl font-semibold text-foreground">
                    {metrics.heatLoss.optimal} {metrics.heatLoss.unit}
                  </span>
                  <span className="text-xs line-through text-muted-foreground">
                    {metrics.heatLoss.current} {metrics.heatLoss.unit}
                  </span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">
                  {metrics.heatLoss.percentDelta}% heat loss reduction
                </div>
              </div>

              {/* Passive Solar Gain Metric */}
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Useful Solar Gain</span>
                  <CloudSun className="size-4 text-amber-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-xl font-semibold text-foreground">
                    {metrics.solarGain.optimal} {metrics.solarGain.unit}
                  </span>
                  <span className="text-xs line-through text-muted-foreground">
                    {metrics.solarGain.current} {metrics.solarGain.unit}
                  </span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-500">
                  {metrics.solarGain.percentDelta > 0
                    ? `+${metrics.solarGain.percentDelta}% useful gain`
                    : `${metrics.solarGain.percentDelta}% gain`}
                </div>
              </div>

              {/* Heating / Auxiliary Energy Demand */}
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Auxiliary Heating Load</span>
                  <Flame className="size-4 text-rose-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-xl font-semibold text-foreground">
                    {metrics.heatingRequirement.optimal} {metrics.heatingRequirement.unit}
                  </span>
                  <span className="text-xs line-through text-muted-foreground">
                    {metrics.heatingRequirement.current} {metrics.heatingRequirement.unit}
                  </span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">
                  {metrics.heatingRequirement.percentDelta}% energy demand saved
                </div>
              </div>

              {/* Average Internal Temperature */}
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Avg Internal Temp</span>
                  <Thermometer className="size-4 text-primary" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-xl font-semibold text-foreground">
                    {metrics.avgTemp.optimal} {metrics.avgTemp.unit}
                  </span>
                  <span className="text-xs line-through text-muted-foreground">
                    {metrics.avgTemp.current} {metrics.avgTemp.unit}
                  </span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {metrics.avgTemp.delta > 0
                    ? `+${metrics.avgTemp.delta}°C towards comfort`
                    : `${metrics.avgTemp.delta}°C delta`}
                </div>
              </div>
            </div>
          )}

          {/* Component-by-Component Comparison Table */}
          {comparisons && comparisons.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-lg border border-border">
              <div className="border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Component Specification & Material Differences
              </div>
              <div className="divide-y divide-border">
                {comparisons.map((item: any) => (
                  <div
                    key={item.name}
                    className={`grid items-center gap-4 p-4 text-xs transition-colors sm:grid-cols-4 ${
                      item.changed ? 'bg-primary/[0.02]' : 'opacity-70'
                    }`}
                  >
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      {item.name}
                      {item.changed ? (
                        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                          OPTIMIZED
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                          RETAINED
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[10px] text-muted-foreground">Current:</span>
                      <span className="text-foreground">{item.current}</span>
                    </div>

                    <div>
                      <span className="block text-[10px] text-muted-foreground">
                        AI Recommendation:
                      </span>
                      <span className="font-semibold text-primary">{item.optimal}</span>
                    </div>

                    <div className="text-muted-foreground sm:text-right">
                      <span>{item.impact}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Climate Specific Passive Strategy Footer */}
          {aiAnalysis?.climateSpecificAdvice && (
            <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4 text-xs">
              <div className="font-semibold text-foreground">
                Passive Architectural Strategy for {climate.name}:
              </div>
              <p className="mt-1 text-muted-foreground leading-relaxed">
                {aiAnalysis.climateSpecificAdvice}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
