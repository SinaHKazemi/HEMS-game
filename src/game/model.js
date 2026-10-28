import {
  HOURS, GRID_LIMIT, OVERLOAD_FEE, FEED_IN, DEFAULT_START, clamp, formatEuro,
  HEAT_PUMP_POWER, HEAT_PER_HOUR, T_MAX, COLD_FEE, BATTERY_POWER, BATTERY_OUTPUT, BATTERY_SLOTS,
} from './config'

const deviceById = (sc, id) => sc.devices.find((d) => d.id === id)

const followersOf = (sc, id) => sc.devices.filter((d) => d.after === id)

// Allowed start range of a device, leaving room for the devices chained after it.
function startRange(sc, d) {
  let lo = d.earliest, hi = d.latestEnd - d.duration
  for (const next of followersOf(sc, d.id)) {
    const r = startRange(sc, next)
    lo = Math.max(lo, r.lo - d.duration)
    hi = Math.min(hi, r.hi - d.duration)
  }
  return { lo, hi }
}

function placeChain(sc, plan, d, start) {
  const { lo, hi } = startRange(sc, d)
  plan[d.id] = clamp(start, lo, hi)
  for (const next of followersOf(sc, d.id)) placeChain(sc, plan, next, plan[d.id] + d.duration)
}

// Moves a device in `plan` (mutating it), respecting its time window.
// Chained devices (`after`) move together: moving the dryer moves the washer too.
export function placeDevice(sc, plan, id, start) {
  const d = deviceById(sc, id)
  if (d.after) placeDevice(sc, plan, d.after, start - deviceById(sc, d.after).duration)
  else placeChain(sc, plan, d, start)
}

// Indoor temperature at the start of slot t, after `heatedHours` hours of heating.
const indoorTemp = (sc, t, heatedHours) => sc.freeTemp[t] + HEAT_PER_HOUR * heatedHours
// Comfort only counts once the heat pump is part of the game (sc.heating).
const coldFee = (sc, t, temp) => (sc.heating ? Math.max(0, sc.comfort[t] - temp) * COLD_FEE : 0)

// Battery actions per hour. The battery level is counted in "slots": one charging hour stores one slot.
export const CHARGE = 'charge'
export const DISCHARGE = 'discharge'
const IDLE = ''
const BATTERY_ACTIONS = [IDLE, CHARGE, DISCHARGE]
const ACTION_STEP = [0, 1, -1] // change in stored slots, by index in BATTERY_ACTIONS
const batteryPower = (action) => (action === CHARGE ? BATTERY_POWER : action === DISCHARGE ? -BATTERY_OUTPUT : 0)
const batteryStep = (action) => (action === CHARGE ? 1 : action === DISCHARGE ? -1 : 0)

// Whether an action is possible with `level` slots stored: no discharging before charging,
// no charging beyond the capacity.
export const batteryAllows = (action, level) =>
  action === CHARGE ? level < BATTERY_SLOTS : action === DISCHARGE ? level > 0 : true

// A simple thermostat: heat whenever the house would otherwise end the hour too cold.
function thermostatSchedule(sc) {
  const schedule = []
  let n = 0
  for (let t = 0; t < HOURS; t++) {
    const on = sc.heating && indoorTemp(sc, t + 1, n) < sc.comfort[t] && indoorTemp(sc, t, n) < T_MAX
    schedule.push(on)
    if (on) n++
  }
  return schedule
}

export function defaultPlan(sc) {
  const plan = { heating: thermostatSchedule(sc), battery: new Array(HOURS).fill(IDLE) }
  for (const d of sc.devices) placeDevice(sc, plan, d.id, DEFAULT_START[d.id])
  return plan
}

// Base load plus scheduled devices (without the heat pump and battery).
function deviceLoad(sc, plan) {
  const load = sc.base.slice()
  for (const d of sc.devices) {
    for (let k = 0; k < d.duration; k++) load[plan[d.id] + k] += d.power
  }
  return load
}

// Cost of one hour given net grid power (positive = import, negative = export).
export function hourCost(sc, t, net) {
  const price = sc.price[t]
  let cost = net >= 0 ? net * price : net * Math.min(FEED_IN, price)
  if (net > GRID_LIMIT) cost += (net - GRID_LIMIT) * OVERLOAD_FEE
  return cost
}

// Everything the UI needs to know about a plan, hour by hour.
// Scheduled heating/battery hours that are not possible are skipped (heatOn / batteryAction).
export function analysePlan(sc, plan) {
  const temps = [sc.freeTemp[0]], heatOn = []
  const batteryLevel = [0], batteryAction = [] // batteryLevel: slots stored at the start of each hour
  let n = 0
  for (let t = 0; t < HOURS; t++) {
    const on = sc.heating && !!plan.heating[t] && indoorTemp(sc, t, n) < T_MAX // thermostat cut-off
    heatOn.push(on)
    if (on) n++
    temps.push(indoorTemp(sc, t + 1, n))

    const wanted = sc.battery ? plan.battery[t] : IDLE
    const action = batteryAllows(wanted, batteryLevel[t]) ? wanted : IDLE
    batteryAction.push(action)
    batteryLevel.push(batteryLevel[t] + batteryStep(action))
  }
  const load = deviceLoad(sc, plan).map((l, t) => l + (heatOn[t] ? HEAT_PUMP_POWER : 0))
  const net = load.map((l, t) => l + batteryPower(batteryAction[t]) - sc.pv[t])
  const cold = temps.slice(1).map((temp, t) => (sc.heating ? Math.max(0, sc.comfort[t] - temp) : 0)) // °C·h per hour
  const hourly = net.map((v, t) => hourCost(sc, t, v) + cold[t] * COLD_FEE)
  return {
    load, net, temps, heatOn, cold, hourly, batteryLevel, batteryAction,
    cost: hourly.reduce((a, b) => a + b, 0),
    coldDegreeHours: cold.reduce((a, b) => a + b, 0),
  }
}

// Share of the solar production used at home (incl. charging the battery) instead of exported.
export function selfConsumption(sc, net) {
  const produced = sc.pv.reduce((a, b) => a + b, 0)
  const exported = net.reduce((a, v) => a + Math.max(0, -v), 0)
  return produced > 0 ? clamp(1 - exported / produced, 0, 1) : 1
}

// Returns a function that finds the cheapest heat pump + battery schedule for a given device load,
// by dynamic programming. State = (hours heated so far, battery slots stored): the indoor
// temperature follows from the first (see indoorTemp). Buffers and cold fees are prepared once
// because solve() calls it for every device placement.
function scheduleOptimiser(sc) {
  const N = sc.heating ? HOURS + 1 : 1 // heated-hours states
  const B = sc.battery ? BATTERY_SLOTS + 1 : 1 // battery states
  const S = N * B // state index = n * B + b
  const coldFees = new Float64Array(HOURS * N) // coldFees[t*N + n]: fee for hour t, n hours heated by its end
  const canHeat = new Uint8Array(HOURS * N) // below the thermostat cut-off at the start of hour t
  for (let t = 0; t < HOURS; t++) {
    for (let n = 0; n < N; n++) {
      coldFees[t * N + n] = coldFee(sc, t, indoorTemp(sc, t + 1, n))
      canHeat[t * N + n] = sc.heating && indoorTemp(sc, t, n) < T_MAX ? 1 : 0
    }
  }
  const actions = sc.battery ? 3 : 1 // only IDLE without a battery
  const choice = new Uint8Array(HOURS * S) // best way into a state: heat (0/1) * 3 + battery action index
  const hourCosts = new Float64Array(6) // [heat * 3 + action]
  let cost = new Float64Array(S), next = new Float64Array(S)

  return (load) => {
    cost.fill(Infinity)
    cost[0] = 0
    for (let t = 0; t < HOURS; t++) {
      next.fill(Infinity)
      const net = load[t] - sc.pv[t]
      for (let h = 0; h < 2; h++) {
        for (let a = 0; a < actions; a++) {
          hourCosts[h * 3 + a] = hourCost(sc, t, net + h * HEAT_PUMP_POWER + batteryPower(BATTERY_ACTIONS[a]))
        }
      }
      for (let n = 0; n < N && n <= t; n++) {
        for (let b = 0; b < B; b++) {
          const here = cost[n * B + b]
          if (here === Infinity) continue
          for (let h = 0; h <= canHeat[t * N + n]; h++) {
            const cold = coldFees[t * N + n + h]
            for (let a = 0; a < actions; a++) {
              const nb = b + ACTION_STEP[a]
              if (nb < 0 || nb >= B) continue // battery empty or full
              const to = (n + h) * B + nb
              const c = here + hourCosts[h * 3 + a] + cold
              if (c < next[to]) { next[to] = c; choice[t * S + to] = h * 3 + a }
            }
          }
        }
      }
      ;[cost, next] = [next, cost]
    }
    let end = 0
    for (let s = 1; s < S; s++) if (cost[s] < cost[end]) end = s
    return {
      cost: cost[end],
      // Walks the choices back from the final state; only called when the schedule is needed.
      schedule: () => {
        const heating = new Array(HOURS), battery = new Array(HOURS)
        for (let t = HOURS - 1, s = end; t >= 0; t--) {
          const c = choice[t * S + s], h = Math.floor(c / 3), action = BATTERY_ACTIONS[c % 3]
          heating[t] = h === 1
          battery[t] = action
          s = (Math.floor(s / B) - h) * B + (s % B) - batteryStep(action)
        }
        return { heating, battery }
      },
    }
  }
}

// Exact optimum: every device placement, each with its best heating and battery schedule.
export function solve(sc) {
  const load = sc.base.slice()
  const plan = {}
  const optimiseSchedule = scheduleOptimiser(sc)
  let best = { cost: Infinity }
  const visit = (k) => {
    if (k === sc.devices.length) {
      const result = optimiseSchedule(load)
      if (result.cost < best.cost) best = { cost: result.cost, plan: { ...plan, ...result.schedule() } }
      return
    }
    const d = sc.devices[k]
    // A chained device has exactly one option: right after its predecessor (listed earlier).
    const chainedStart = d.after && plan[d.after] + deviceById(sc, d.after).duration
    const { lo, hi } = d.after ? { lo: chainedStart, hi: chainedStart } : startRange(sc, d)
    for (let s = lo; s <= hi; s++) {
      for (let j = 0; j < d.duration; j++) load[s + j] += d.power
      plan[d.id] = s
      visit(k + 1)
      for (let j = 0; j < d.duration; j++) load[s + j] -= d.power
    }
  }
  visit(0)
  return { best }
}

export const starsFor = (score) => (score >= 95 ? 3 : score >= 80 ? 2 : score >= 60 ? 1 : 0)

// Score: 100 = optimal plan, 50 = the starting plan, 0 = twice as far from optimal as the start.
export function evaluate(sc, plan, { best }) {
  const you = analysePlan(sc, plan)
  const start = analysePlan(sc, defaultPlan(sc))
  const optimal = analysePlan(sc, best.plan)
  const span = Math.max(start.cost - best.cost, 0.5)
  const score = clamp(Math.round(100 - (50 * (you.cost - best.cost)) / span), 0, 100)

  const tips = []
  const overloadHours = you.net.filter((v) => v > GRID_LIMIT).length
  if (overloadHours) {
    tips.push(`You exceeded the ${GRID_LIMIT} kW grid limit in ${overloadHours} hour(s) — spread out the big loads.`)
  }
  if (you.coldDegreeHours > 0.5) {
    tips.push(`The house was too cold for ${you.coldDegreeHours.toFixed(1)} °C·h — that cost ${formatEuro(you.coldDegreeHours * COLD_FEE)} in comfort penalties.`)
  }
  const flexible = [sc.heating && 'heat pump', sc.battery && 'battery'].filter(Boolean)
  if (flexible.length) {
    const saving = you.cost - scheduleOptimiser(sc)(deviceLoad(sc, plan)).cost
    if (saving > 0.05) tips.push(`Better ${flexible.join(' and ')} hours alone could save you about ${formatEuro(saving)}.`)
  }
  for (const d of sc.devices) {
    if (tips.length >= 4 || d.after || plan[d.id] === best.plan[d.id]) continue
    const moved = { ...plan }
    placeDevice(sc, moved, d.id, best.plan[d.id])
    const saving = you.cost - analysePlan(sc, moved).cost
    if (saving > 0.05) tips.push(`Moving ${d.icon} ${d.name} alone could save you about ${formatEuro(saving)}.`)
  }
  if (!tips.length && score < 99) tips.push('Small tweaks remain — compare your plan with the optimal one.')

  return {
    score,
    stars: starsFor(score),
    verdict:
      score >= 99 ? 'Perfect — you found the optimal plan!'
      : score >= 95 ? 'Excellent! Almost optimal.'
      : score >= 80 ? 'Great planning!'
      : score >= 60 ? 'Better than the starting plan — but there is money left on the table.'
      : 'Ouch. Look at the prices, the grid limit and the indoor temperature again.',
    cost: you.cost,
    bestCost: best.cost,
    startCost: start.cost,
    heating: sc.heating,
    coldDegreeHours: you.coldDegreeHours,
    selfUse: selfConsumption(sc, you.net),
    selfUseOptimal: selfConsumption(sc, optimal.net),
    tips,
  }
}
