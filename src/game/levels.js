import { DEVICES } from './config'
import { buildScenario } from './scenarios'

export const UNLOCK_SCORE = 60 // score needed to unlock the next level

// Each level adds one device ('heating' = the heat pump, 'battery' = the home battery) to everything from the levels before it.
// `scenario` picks the day's weather and prices from SCENARIOS.
export const LEVELS = [
  {
    title: 'Laundry day', adds: 'washer', scenario: 'spring',
    intro: 'Start simple: one washing machine. Drag it to the cheapest hours — ideally while your solar panels produce the most.',
  },
  {
    title: 'Dry it too', adds: 'dryer', scenario: 'spring',
    intro: 'The dryer starts right after the washer finishes, so the two blocks move together. Find a 4-hour window that suits both.',
  },
  {
    title: 'Dishes', adds: 'dish', scenario: 'windy',
    intro: 'A volatile market today: strong wind pushes prices below zero at night. The dishwasher can run any time.',
  },
  {
    title: 'Hot water', adds: 'boiler', scenario: 'windy',
    intro: 'The water heater draws 3 kW and must finish by 18:00 for the evening showers.',
  },
  {
    title: 'Electric car', adds: 'ev', scenario: 'spring',
    intro: 'The car charges at 7.4 kW. Use the sun, but watch the 11 kW grid limit — overloads are expensive.',
  },
  {
    title: 'Home battery', adds: 'battery', scenario: 'spring',
    intro: 'Store surplus solar (or cheap grid power) and use it in the expensive evening. Each charging hour stores 2.7 kWh, up to 3 hours — you can only discharge what you charged before.',
  },
  {
    title: 'Winter heating', adds: 'heating', scenario: 'winter',
    intro: 'A cold, grey day. Paint the heat pump hours: the house stores heat, so preheat while power is cheap and keep it above the comfort minimum.',
  },
  {
    title: 'Stormy market', scenario: 'windy',
    intro: 'Everything at once on a volatile market. Negative prices at night, a spiky evening peak.',
  },
  {
    title: 'Free play', scenario: 'random',
    intro: 'A new random day every time. Everything is in play.',
  },
]

// What a level adds, for display: a device, or the heat pump.
export function levelAddition(level) {
  if (level.adds === 'heating') return { icon: '♨️', name: 'Heat pump' }
  if (level.adds === 'battery') return { icon: '🔋', name: 'Home battery' }
  return DEVICES.find((d) => d.id === level.adds) ?? null
}

// The scenario for a level, limited to the devices unlocked so far.
export function buildLevel(index) {
  const unlocked = LEVELS.slice(0, index + 1).map((l) => l.adds)
  const sc = buildScenario(LEVELS[index].scenario)
  return {
    ...sc,
    heating: unlocked.includes('heating'),
    battery: unlocked.includes('battery'),
    devices: sc.devices.filter((d) => unlocked.includes(d.id)),
  }
}
