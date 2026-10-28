import {
  HOURS, BASE_LOAD, DEVICES, hourOf, comfortMin,
  T_START, HEAT_LOSS, HEAT_CAPACITY, SOLAR_GAIN,
} from './config'

const HOME_OFFICE = { ev: { earliest: 0, note: 'Home office — car home all day' } }

// Parameters that shape the generated price / solar / load curves.
export const SCENARIOS = {
  spring: {
    name: '☀️ Sunny spring day (home office)',
    desc: 'Lots of sun and mild temperatures. You work from home today.',
    seed: 11, pBase: 0.30, morning: 0.06, evening: 0.12, dip: 0.14, night: 0.04, noise: 0.03,
    rise: 5.5, set: 21, pvPeak: 6.5, cloud: 0.15, baseMult: 1, tMin: 9, tMax: 19, deviceOverrides: HOME_OFFICE,
  },
  winter: {
    name: '❄️ Grey winter day',
    desc: 'Short, cloudy day. Solar barely helps — watch the price curve.',
    seed: 22, pBase: 0.32, morning: 0.10, evening: 0.16, dip: 0.03, night: 0.10, noise: 0.03,
    rise: 8, set: 16.5, pvPeak: 1.8, cloud: 0.5, baseMult: 1.35, tMin: -4, tMax: 2,
  },
  windy: {
    name: '🌬️ Windy night, volatile market',
    desc: 'Strong night wind pushes prices below zero. Spiky evening peak.',
    seed: 33, pBase: 0.26, morning: 0.08, evening: 0.22, dip: 0.06, night: 0.33, noise: 0.06,
    rise: 7, set: 19, pvPeak: 4, cloud: 0.4, baseMult: 1.1, tMin: 3, tMax: 8,
  },
  random: { name: '🎲 Random day' },
}

// Deterministic PRNG (mulberry32) so a seed always produces the same day.
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const gauss = (h, mu, sigma) => Math.exp(-0.5 * ((h - mu) / sigma) ** 2)
const round = (v, digits) => Math.round(v * 10 ** digits) / 10 ** digits

function randomParams() {
  const r = rng(Date.now() & 0xffffff)
  const summer = r()
  const rise = Math.round((8 - 2.5 * summer) * 2) / 2
  const p = {
    name: SCENARIOS.random.name,
    seed: Math.floor(r() * 1e6),
    pBase: 0.24 + r() * 0.1, morning: r() * 0.12, evening: 0.08 + r() * 0.16,
    dip: r() * 0.14 * summer, night: r() * 0.32, noise: 0.02 + r() * 0.05,
    rise, set: 16.5 + 4.5 * summer, pvPeak: 1.5 + 5.5 * summer * (0.5 + r() / 2),
    cloud: r() * 0.6, baseMult: 1.35 - 0.35 * summer,
    tMin: -4 + 13 * summer, tMax: 1 + 18 * summer,
    deviceOverrides: r() < 0.4 ? HOME_OFFICE : {},
  }
  const sunrise = `${String(Math.floor(rise)).padStart(2, '0')}:${rise % 1 ? '30' : '00'}`
  p.desc = `Sunrise ${sunrise}, solar peak ~${p.pvPeak.toFixed(1)} kW` +
    (p.night > 0.25 ? ', negative prices possible at night.' : '.')
  return p
}

export function buildScenario(key) {
  const p = key === 'random' ? randomParams() : SCENARIOS[key]
  const r = rng(p.seed)
  const price = [], pv = [], base = [], outdoor = []
  for (let i = 0; i < HOURS; i++) {
    const h = hourOf(i) + 0.5
    price.push(round(
      p.pBase + p.morning * gauss(h, 8, 1.3) + p.evening * gauss(h, 19, 1.8) - p.dip * gauss(h, 13, 2.5)
        - p.night * (gauss(h, 3, 1.8) + gauss(h, 27, 1.8)) + (r() - 0.5) * p.noise,
      3,
    ))
    const sun = h > p.rise && h < p.set ? Math.sin((Math.PI * (h - p.rise)) / (p.set - p.rise)) : 0
    pv.push(round(p.pvPeak * sun ** 1.3 * (1 - p.cloud * r()), 2))
    base.push(round(BASE_LOAD[hourOf(i)] * p.baseMult * (0.9 + 0.2 * r()), 2))
    const amp = (p.tMax - p.tMin) / 2
    outdoor.push(round(p.tMin + amp + amp * Math.cos((2 * Math.PI * (h - 15)) / 24) + (r() - 0.5) * 0.6, 1))
  }
  // Indoor temperature if the heating stayed off all day (index t = start of slot t, 25 values).
  const freeTemp = [T_START]
  for (let i = 0; i < HOURS; i++) {
    const heatFlow = -HEAT_LOSS * (20 - outdoor[i]) + base[i] + SOLAR_GAIN * pv[i]
    freeTemp.push(freeTemp[i] + heatFlow / HEAT_CAPACITY)
  }
  const comfort = Array.from({ length: HOURS }, (_, i) => comfortMin(hourOf(i)))
  const devices = DEVICES.map((d) => ({ ...d, ...p.deviceOverrides?.[d.id] }))
  return { key, ...p, price, pv, base, outdoor, freeTemp, comfort, devices }
}
