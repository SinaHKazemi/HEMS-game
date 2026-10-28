import { ref, reactive, computed, shallowRef, watch } from 'vue'
import { HOURS, START_HOUR, BATTERY_OUTPUT, clamp } from '../game/config'
import { LEVELS, UNLOCK_SCORE, buildLevel } from '../game/levels'
import { placeDevice, defaultPlan, analysePlan, evaluate } from '../game/model'

// Best score per level, kept in the browser.
const PROGRESS_KEY = 'powerplanner-progress'
function readProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) ?? [] } catch { return [] }
}
function writeProgress(progress) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)) } catch { /* storage unavailable */ }
}

// All game state and actions. Components receive slices of this via props.
export function useGame() {
  const progress = ref(readProgress())
  const isUnlocked = (index) => index === 0 || (progress.value[index - 1] ?? 0) >= UNLOCK_SCORE
  const firstLocked = LEVELS.findIndex((_, i) => !isUnlocked(i))
  const levelIndex = ref(firstLocked === -1 ? LEVELS.length - 1 : firstLocked - 1) // highest unlocked level
  const level = computed(() => LEVELS[levelIndex.value])
  const bestScore = computed(() => progress.value[levelIndex.value] ?? null)
  const scenario = shallowRef(null)
  const plan = reactive({})
  const optimum = shallowRef(null) // null while the solver worker is still calculating
  const time = ref(0.5) // fractional slot index shown in the house and timeline
  const speed = ref(8) // seconds for a full simulated day
  const running = ref(false)
  const showCost = ref(false)
  const hasRun = ref(false)
  const showOptimal = ref(false)
  const result = ref(null)
  let frame = 0

  // The exact optimum can take a second, so it is calculated in a worker.
  const solver = new Worker(new URL('../game/solver.worker.js', import.meta.url), { type: 'module' })
  let solveRequest = 0
  solver.onmessage = ({ data }) => {
    if (data.id === solveRequest) optimum.value = data.optimum
  }

  const analysis = computed(() => analysePlan(scenario.value, plan))
  const optimalAnalysis = computed(() => (optimum.value ? analysePlan(scenario.value, optimum.value.best.plan) : analysis.value))

  const current = computed(() => {
    const i = clamp(Math.floor(time.value), 0, HOURS - 1)
    const h = (START_HOUR + time.value) % 24
    const minutes = Math.floor(((h % 1) * 60) / 15) * 15
    const { temps, load, net, heatOn, batteryLevel, batteryAction } = analysis.value
    const f = clamp(time.value - i, 0, 1)
    return {
      i,
      hour: h,
      clock: `${String(Math.floor(h)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      price: scenario.value.price[i],
      pv: scenario.value.pv[i],
      load: load[i],
      net: net[i],
      heating: heatOn[i],
      indoor: temps[i] + (temps[i + 1] - temps[i]) * f,
      outdoor: scenario.value.outdoor[i],
      comfort: scenario.value.comfort[i],
      batteryAction: batteryAction[i],
      batteryKwh: (batteryLevel[i] + (batteryLevel[i + 1] - batteryLevel[i]) * f) * BATTERY_OUTPUT,
    }
  })

  const costSoFar = computed(() => {
    if (!showCost.value) return null
    let cost = 0
    for (let t = 0; t < HOURS && t < time.value; t++) {
      cost += analysis.value.hourly[t] * Math.min(1, time.value - t)
    }
    return cost
  })

  function loadLevel(index) {
    const sc = buildLevel(index)
    scenario.value = sc
    for (const id of Object.keys(plan)) delete plan[id]
    Object.assign(plan, defaultPlan(sc))
    optimum.value = null
    solver.postMessage({ id: ++solveRequest, scenario: sc })
    time.value = 0.5
    hasRun.value = false
    showCost.value = false
    showOptimal.value = false
  }
  watch(levelIndex, loadLevel, { immediate: true })

  function moveDevice(id, start) {
    if (running.value) return
    placeDevice(scenario.value, plan, id, start)
    showCost.value = false
  }

  function setHeating(hour, on) {
    if (running.value) return
    plan.heating[hour] = on
    showCost.value = false
  }

  function setBattery(hour, action) {
    if (running.value) return
    plan.battery[hour] = action
    showCost.value = false
  }

  function resetPlan() {
    Object.assign(plan, defaultPlan(scenario.value))
    showCost.value = false
  }

  function preview(t) {
    if (running.value) return
    time.value = t
    showCost.value = false
  }

  function run() {
    running.value = true
    showCost.value = true
    showOptimal.value = false
    let start = null
    const step = (ts) => {
      start ??= ts
      time.value = Math.min(HOURS - 0.001, ((ts - start) / (speed.value * 1000)) * HOURS)
      if (time.value >= HOURS - 0.001) finish()
      else frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  }

  function finish() {
    cancelAnimationFrame(frame)
    time.value = HOURS - 0.001
    running.value = false
    hasRun.value = true
    const evaluation = evaluate(scenario.value, plan, optimum.value)
    const index = levelIndex.value
    const wasUnlocked = isUnlocked(index + 1)
    if (evaluation.score > (progress.value[index] ?? -1)) {
      progress.value = Object.assign([...progress.value], { [index]: evaluation.score })
      writeProgress(progress.value)
    }
    const isLast = index === LEVELS.length - 1
    result.value = {
      ...evaluation,
      isLast,
      canContinue: isLast || isUnlocked(index + 1),
      newlyUnlocked: !isLast && !wasUnlocked && isUnlocked(index + 1) ? LEVELS[index + 1] : null,
    }
  }

  // The last level (free play) just starts a fresh random day.
  function nextLevel() {
    const next = Math.min(levelIndex.value + 1, LEVELS.length - 1)
    if (next === levelIndex.value) loadLevel(next)
    else levelIndex.value = next
  }

  return {
    levelIndex, level, progress, isUnlocked, scenario, plan, optimum, time, speed, running, hasRun, showOptimal, result, bestScore,
    analysis, optimalAnalysis, current, costSoFar,
    moveDevice, setHeating, setBattery, resetPlan, preview, run, finish, nextLevel,
  }
}
