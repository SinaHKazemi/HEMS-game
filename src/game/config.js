// Game rules and static data. Slot index 0 = 06:00, the day ends at 06:00 the next morning.

export const HOURS = 24
export const START_HOUR = 6
export const GRID_LIMIT = 11 // kW
export const OVERLOAD_FEE = 1.0 // € per kWh above GRID_LIMIT
export const FEED_IN = 0.08 // € per kWh of exported solar

export const hourOf = (i) => (START_HOUR + i) % HOURS
export const formatHour = (i) => `${String(hourOf(i)).padStart(2, '0')}:00`
export const formatEuro = (v) => `${v < 0 ? '−' : ''}€${Math.abs(v).toFixed(2)}`
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// earliest / latestEnd are slot indices. `after` = starts the moment that device finishes
// (the two move together; the predecessor must be listed first).
// Each id is also drawn in HouseScene.vue.
export const DEVICES = [
  { id: 'washer', name: 'Washer', icon: '🧺', duration: 2, power: 2.0, earliest: 2, latestEnd: 16, color: '#4cc9f0', note: '08:00–22:00 (quiet hours)' },
  { id: 'dryer', name: 'Dryer', icon: '🌀', duration: 2, power: 2.5, earliest: 2, latestEnd: 18, color: '#b388ff', note: 'Starts right after the washer, done by 24:00', after: 'washer' },
  { id: 'dish', name: 'Dishwasher', icon: '🍽️', duration: 2, power: 1.5, earliest: 0, latestEnd: 24, color: '#80ed99', note: 'Any time' },
  { id: 'boiler', name: 'Water heater', icon: '🔥', duration: 3, power: 3.0, earliest: 0, latestEnd: 12, color: '#ff9f1c', note: 'Hot water ready by 18:00' },
  { id: 'ev', name: 'EV charging', icon: '🚗', duration: 4, power: 7.4, earliest: 12, latestEnd: 24, color: '#f72585', note: 'Car home 18:00–06:00' },
]

// The "everything in the evening" plan the player starts from.
export const DEFAULT_START = { washer: 12, dryer: 14, dish: 14, boiler: 10, ev: 12 }

// Heating. Simplified thermal model: heat loss is computed against a fixed 20 °C reference, so the
// indoor temperature only depends on *how many* hours were heated so far. That keeps the optimum
// exactly solvable (see bestHeating in model.js) while still showing the buffering behaviour.
export const HEAT_PUMP_POWER = 2.5 // kW electric
export const HEAT_PUMP_COP = 3 // kW of heat per kW of electricity
export const HEAT_CAPACITY = 5 // kWh of heat per °C stored in walls, floors and furniture
export const HEAT_LOSS = 0.15 // kW per °C difference between 20 °C and outside
export const SOLAR_GAIN = 0.3 // sunshine through windows, as a share of the PV output
export const HEAT_PER_HOUR = (HEAT_PUMP_POWER * HEAT_PUMP_COP) / HEAT_CAPACITY // °C per heated hour
export const T_START = 19 // °C at 06:00
export const T_MAX = 24 // thermostat cut-off: the heat pump stays off at or above this
export const COLD_FEE = 1.0 // € per °C·h below the comfort minimum

// Minimum comfortable indoor temperature by clock hour.
export const comfortMin = (clockHour) =>
  clockHour >= 7 && clockHour < 22 ? 20 : clockHour === 5 || clockHour === 6 ? 19 : 17

// Home battery. Charging draws BATTERY_POWER for one hour and stores one "slot" of energy;
// discharging releases one slot as BATTERY_OUTPUT for one hour (the difference is conversion loss).
export const BATTERY_POWER = 3 // kW drawn while charging
export const BATTERY_EFFICIENCY = 0.9 // round trip
export const BATTERY_OUTPUT = BATTERY_POWER * BATTERY_EFFICIENCY // kW delivered while discharging
export const BATTERY_SLOTS = 3 // capacity, in charging hours
export const BATTERY_CAPACITY = BATTERY_OUTPUT * BATTERY_SLOTS // usable kWh

// Household base load by clock hour (kW).
export const BASE_LOAD = [0.3, 0.3, 0.3, 0.3, 0.3, 0.35, 0.6, 0.9, 0.7, 0.5, 0.45, 0.5, 0.7, 0.6, 0.5, 0.5, 0.6, 0.9, 1.3, 1.5, 1.4, 1.1, 0.8, 0.5]
