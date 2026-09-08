import { NextResponse } from 'next/server'
import type { ClimateProfile } from '@/lib/thermoshelter'

interface GeocodeResult {
  id: number
  name: string
  latitude: number
  longitude: number
  elevation?: number
  country?: string
  admin1?: string
}

function classifyClimate(temp: number, humidity: number, elevation: number = 0): string {
  if (temp < 10 || elevation > 2000) {
    return humidity < 45 ? 'Cold & Arid (Alpine / High-Altitude)' : 'Cold & Humid'
  }
  if (temp > 26) {
    return humidity < 40 ? 'Hot & Dry' : 'Warm & Humid'
  }
  if (temp >= 10 && temp <= 26) {
    return humidity > 60 ? 'Temperate & Humid' : 'Composite'
  }
  return 'Composite'
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const city = searchParams.get('city')?.trim()
    let lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null
    let lon = searchParams.get('lon') ? parseFloat(searchParams.get('lon')!) : null
    let locationName = city || ''
    let region = ''

    // 1. If city name provided without coordinates, geocode via Open-Meteo
    if (city && (lat === null || lon === null || isNaN(lat) || isNaN(lon))) {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=en&format=json`
      const geoRes = await fetch(geoUrl, { next: { revalidate: 3600 } })
      if (!geoRes.ok) {
        return NextResponse.json({ success: false, error: 'Geocoding service unavailable' }, { status: 502 })
      }
      const geoData = await geoRes.json()
      const results: GeocodeResult[] = geoData.results || []

      if (results.length === 0) {
        return NextResponse.json({ success: false, error: `Could not find location "${city}". Try another city or coordinates.` }, { status: 404 })
      }

      // Prioritize exact name match first, then Indian / high altitude results
      const exactMatch = results.find(r => r.name.toLowerCase() === city.toLowerCase() && (r.country === 'India' || !results.some(x => x.country === 'India')))
        || results.find(r => r.name.toLowerCase() === city.toLowerCase())
        || results.find(r => r.country === 'India')
        || results[0]

      const best = exactMatch
      lat = best.latitude
      lon = best.longitude
      locationName = best.name
      region = [best.admin1, best.country].filter(Boolean).join(', ')
    }

    if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
      return NextResponse.json({ success: false, error: 'Please provide either ?city=<name> or ?lat=<num>&lon=<num>' }, { status: 400 })
    }

    // 2. Fetch live weather & solar radiation from Open-Meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,direct_normal_irradiance,shortwave_radiation&hourly=temperature_2m,shortwave_radiation&daily=sunshine_duration,temperature_2m_max,temperature_2m_min&wind_speed_unit=ms&timezone=auto`

    const weatherRes = await fetch(weatherUrl, { cache: 'no-store' })
    if (!weatherRes.ok) {
      const errText = await weatherRes.text()
      return NextResponse.json({ success: false, error: `Open-Meteo API (${weatherRes.status}): ${errText}` }, { status: 502 })
    }

    const weatherData = await weatherRes.json()
    const current = weatherData.current || {}
    const daily = weatherData.daily || {}
    const hourly = weatherData.hourly || {}
    const elevation = weatherData.elevation || 0

    // Compute representative daylight solar radiation (W/m²)
    // If night time (radiation == 0), take the peak daylight radiation from hourly forecast
    let representativeSolar = Number(current.shortwave_radiation || current.direct_normal_irradiance || 0)
    if (representativeSolar <= 10 && hourly.shortwave_radiation && Array.isArray(hourly.shortwave_radiation)) {
      const positiveRad = (hourly.shortwave_radiation as number[]).slice(0, 24).filter(v => v > 50)
      if (positiveRad.length > 0) {
        representativeSolar = Math.round(positiveRad.reduce((a, b) => a + b, 0) / positiveRad.length)
      } else {
        representativeSolar = 550 // Fallback nominal daylight solar irradiance
      }
    } else {
      representativeSolar = Math.round(representativeSolar)
    }

    const temp = Number(current.temperature_2m ?? 15)
    const humidity = Number(current.relative_humidity_2m ?? 50)
    const windSpeed = Number(current.wind_speed_10m ?? 2.5)

    // Sunshine duration: daily in seconds -> convert to hours
    const dailySunshine = daily.sunshine_duration && daily.sunshine_duration[0]
      ? Number((daily.sunshine_duration[0] / 3600).toFixed(1))
      : 8.0

    const cleanLocation = region ? `${locationName}, ${region}` : locationName || `Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`
    const climateType = classifyClimate(temp, humidity, elevation)
    const id = `live-${locationName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'loc'}-${Math.abs(Math.round(lat))}-${Math.abs(Math.round(lon))}`

    const profile: ClimateProfile = {
      id,
      name: locationName || cleanLocation,
      location: cleanLocation,
      climateType,
      ambientTemperature: Number(temp.toFixed(1)),
      solarRadiation: Math.max(100, representativeSolar),
      sunshineDuration: Math.max(1, dailySunshine),
      windSpeed: Number(windSpeed.toFixed(1)),
      relativeHumidity: Math.round(humidity),
    }

    return NextResponse.json({
      success: true,
      source: 'Open-Meteo Live API',
      coordinates: { latitude: lat, longitude: lon, elevation },
      profile,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to fetch weather data' }, { status: 500 })
  }
}
