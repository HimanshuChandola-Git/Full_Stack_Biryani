-- ThermoShelter Database Schema for Supabase
-- SIH26051: Design of Area Specific Shelter for Thermal Comfort Maintenance

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. CLIMATE PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.climate_profiles (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "climateType" TEXT NOT NULL,
    "ambientTemperature" NUMERIC NOT NULL,
    "solarRadiation" NUMERIC NOT NULL,
    "sunshineDuration" NUMERIC NOT NULL,
    "windSpeed" NUMERIC NOT NULL,
    "relativeHumidity" NUMERIC NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 2. MATERIALS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.materials (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL CHECK ("category" IN ('wall', 'roof', 'floor', 'window', 'door', 'thermal_storage')),
    "thermalConductivity" NUMERIC NOT NULL,
    "density" NUMERIC NOT NULL,
    "specificHeat" NUMERIC NOT NULL,
    "defaultThickness" NUMERIC NOT NULL,
    "thermalResistance" NUMERIC NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 3. SHELTER DESIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shelter_designs (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "length" NUMERIC NOT NULL,
    "width" NUMERIC NOT NULL,
    "height" NUMERIC NOT NULL,
    "shape" TEXT NOT NULL DEFAULT 'Rectangular',
    "orientation" TEXT NOT NULL DEFAULT 'South',
    "windowAreaPercentage" NUMERIC NOT NULL DEFAULT 12,
    "doorArea" NUMERIC NOT NULL DEFAULT 2.1,
    "numberOfWindows" INTEGER NOT NULL DEFAULT 3,
    "wallMaterialId" TEXT REFERENCES public.materials("id") ON DELETE SET NULL,
    "roofMaterialId" TEXT REFERENCES public.materials("id") ON DELETE SET NULL,
    "floorMaterialId" TEXT REFERENCES public.materials("id") ON DELETE SET NULL,
    "windowMaterialId" TEXT,
    "doorMaterialId" TEXT,
    "thermalStorageMaterialId" TEXT,
    "climateProfileId" TEXT REFERENCES public.climate_profiles("id") ON DELETE SET NULL,
    "created_at" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updated_at" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 4. SIMULATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.simulations (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "shelter_design_id" TEXT REFERENCES public.shelter_designs("id") ON DELETE CASCADE,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "simulation_duration" INTEGER DEFAULT 24,
    "time_step" INTEGER DEFAULT 1,
    "completed_at" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 5. OPTIMIZATION RUNS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.optimization_runs (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "climate_profile_id" TEXT REFERENCES public.climate_profiles("id") ON DELETE CASCADE,
    "objective" TEXT NOT NULL DEFAULT 'thermal comfort',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "configurations_evaluated" INTEGER DEFAULT 48,
    "completed_at" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE public.climate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shelter_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optimization_runs ENABLE ROW LEVEL SECURITY;

-- Allow public read access to climate profiles and materials
DROP POLICY IF EXISTS "Allow public read climate_profiles" ON public.climate_profiles;
CREATE POLICY "Allow public read climate_profiles" ON public.climate_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read materials" ON public.materials;
CREATE POLICY "Allow public read materials" ON public.materials FOR SELECT USING (true);

-- Allow public read and write to shelter designs
DROP POLICY IF EXISTS "Allow public read shelter_designs" ON public.shelter_designs;
CREATE POLICY "Allow public read shelter_designs" ON public.shelter_designs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert shelter_designs" ON public.shelter_designs;
CREATE POLICY "Allow public insert shelter_designs" ON public.shelter_designs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update shelter_designs" ON public.shelter_designs;
CREATE POLICY "Allow public update shelter_designs" ON public.shelter_designs FOR UPDATE USING (true);

-- Allow public read and insert to simulations
DROP POLICY IF EXISTS "Allow public read simulations" ON public.simulations;
CREATE POLICY "Allow public read simulations" ON public.simulations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert simulations" ON public.simulations;
CREATE POLICY "Allow public insert simulations" ON public.simulations FOR INSERT WITH CHECK (true);

-- Allow public read and insert to optimization runs
DROP POLICY IF EXISTS "Allow public read optimization_runs" ON public.optimization_runs;
CREATE POLICY "Allow public read optimization_runs" ON public.optimization_runs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert optimization_runs" ON public.optimization_runs;
CREATE POLICY "Allow public insert optimization_runs" ON public.optimization_runs FOR INSERT WITH CHECK (true);

-- ============================================================
-- INITIAL SEED DATA
-- ============================================================
INSERT INTO public.climate_profiles ("id", "name", "location", "climateType", "ambientTemperature", "solarRadiation", "sunshineDuration", "windSpeed", "relativeHumidity")
VALUES
    ('ladakh', 'Ladakh', 'Leh, Ladakh', 'Cold & Arid', 4.8, 612, 8.7, 3.2, 34),
    ('jaipur', 'Jaipur', 'Jaipur, Rajasthan', 'Hot & Dry', 29.4, 684, 9.3, 2.6, 38),
    ('kochi', 'Kochi', 'Kochi, Kerala', 'Warm & Humid', 28.1, 498, 6.1, 2.1, 77)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO public.materials ("id", "name", "category", "thermalConductivity", "density", "specificHeat", "defaultThickness", "thermalResistance", "description")
VALUES
    ('rammed-earth', 'Rammed Earth', 'wall', 0.72, 1900, 880, 300, 0.42, 'High-mass earthen wall system for thermal moderation.'),
    ('compressed-earth', 'Compressed Earth Block', 'wall', 0.58, 1750, 900, 250, 0.43, 'Modular earth block with balanced mass and resistance.'),
    ('lime-plaster', 'Lime Plaster', 'wall', 0.35, 1400, 840, 100, 0.29, 'Breathable finish layer shown for prototype comparison.'),
    ('concrete', 'Concrete', 'wall', 1.70, 2400, 880, 150, 0.088, 'Dense structural concrete with high thermal mass and conductivity.'),
    ('wood', 'Wood', 'wall', 0.15, 500, 1600, 100, 0.67, 'Natural timber construction with low thermal conductivity.'),
    ('eps-insulation', 'EPS Insulation', 'wall', 0.035, 25, 1400, 100, 2.86, 'Expanded polystyrene providing high thermal resistance.'),
    ('insulated-metal', 'Insulated Metal Panel', 'roof', 0.035, 120, 900, 120, 3.43, 'Lightweight roof assembly with a high insulation value.'),
    ('mud-roof', 'Mud + Lime Roof', 'roof', 0.48, 1500, 950, 180, 0.38, 'High-mass roof concept for passive thermal lag.'),
    ('stone-slab', 'Local Stone Slab', 'floor', 1.70, 2300, 790, 150, 0.09, 'Durable floor finish with high thermal mass.'),
    ('adobe-floor', 'Adobe Floor', 'floor', 0.55, 1600, 1000, 200, 0.36, 'Earthen floor concept with moderate resistance.'),
    ('double-glazed', 'Double Glazed Low-E', 'window', 0.80, 2500, 750, 24, 0.31, 'Window placeholder for lower conductive loss.'),
    ('timber-door', 'Insulated Timber Door', 'door', 0.14, 550, 1600, 45, 0.32, 'Door assembly placeholder for prototype calculations.'),
    ('stone-mass', 'Stone Thermal Mass', 'thermal_storage', 2.20, 2600, 880, 250, 0.11, 'Dense thermal storage material for temperature retention.')
ON CONFLICT ("id") DO NOTHING;
