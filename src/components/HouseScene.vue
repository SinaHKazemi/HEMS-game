<script setup>
import { computed } from 'vue'
import { GRID_LIMIT, BATTERY_CAPACITY, clamp } from '../game/config'
import { CHARGE, DISCHARGE } from '../game/model'

const props = defineProps({
  scenario: Object,
  plan: Object,
  time: Number,
  current: Object,
})

function mix(a, b, f) {
  const rgb = (c) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16))
  const A = rgb(a), B = rgb(b)
  return '#' + A.map((v, k) => Math.round(v + (B[k] - v) * f).toString(16).padStart(2, '0')).join('')
}

// Sun elevation: 0 at sunrise/sunset, 1 at noon, -1 at night.
const elevation = computed(() => {
  const { rise, set } = props.scenario
  const h = props.current.hour
  return h > rise && h < set ? Math.sin((Math.PI * (h - rise)) / (set - rise)) : -1
})
const daylight = computed(() => clamp((elevation.value + 0.15) / 0.45, 0, 1))
const night = computed(() => clamp(1 - 2 * daylight.value, 0, 1))

const sky = computed(() => {
  const dusk = 1 - Math.abs(2 * daylight.value - 1)
  return {
    top: mix('#0b1533', '#5aa9e6', daylight.value),
    bottom: mix(mix('#1b2a55', '#bfe3f5', daylight.value), '#f4a261', dusk * 0.8),
  }
})
const sun = computed(() => {
  if (elevation.value < 0) return null
  const { rise, set } = props.scenario
  return { x: 30 + (340 * (props.current.hour - rise)) / (set - rise), y: 215 - 170 * elevation.value }
})

const panelFill = computed(() => mix('#1e3a5f', '#7fdbff', clamp(props.current.pv / props.scenario.pvPeak, 0, 1)))
const windowFill = computed(() => (daylight.value < 0.6 ? '#ffd166' : '#a8dadc'))
// Walls go from cold blue (16 °C) to warm beige (22 °C).
const wallFill = computed(() =>
  props.scenario.heating ? mix('#bcd4ec', '#f6dfb8', clamp((props.current.indoor - 16) / 6, 0, 1)) : '#f1e3c6',
)
const tooCold = computed(() => props.current.indoor < props.current.comfort)

// Devices not unlocked in the current level are not drawn.
const device = (id) => props.scenario.devices.find((d) => d.id === id)
const has = (id) => !!device(id)
const isOn = (id) => has(id) && props.plan[id] <= props.current.i && props.current.i < props.plan[id] + device(id).duration
const devStyle = (id) => ({ '--c': device(id).color })
const devClass = (id) => ({ dev: true, on: isOn(id) })

const carHome = computed(() => {
  const ev = device('ev')
  return !!ev && props.current.i >= ev.earliest && props.current.i < ev.latestEnd
})
const evProgress = computed(() => clamp((props.time - props.plan.ev) / device('ev').duration, 0, 1))

const batteryFill = computed(() => clamp(props.current.batteryKwh / BATTERY_CAPACITY, 0, 1))
const batteryColor = computed(() =>
  props.current.batteryAction === CHARGE ? '#06d6a0' : props.current.batteryAction === DISCHARGE ? '#ff9f1c' : '#8da9c4',
)

const gridLabel = computed(() => {
  const n = props.current.net
  return n >= 0 ? `Grid ↓ ${n.toFixed(1)} kW` : `Grid ↑ ${(-n).toFixed(1)} kW`
})
const gridFlow = computed(() => ({ in: props.current.net > 0.05, out: props.current.net < -0.05 }))
const overload = computed(() => props.current.net > GRID_LIMIT)
</script>

<template>
  <svg viewBox="0 0 400 300" class="house" role="img" aria-label="House">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" :stop-color="sky.top" />
        <stop offset="1" :stop-color="sky.bottom" />
      </linearGradient>
    </defs>
    <rect width="400" height="300" fill="url(#sky)" />

    <!-- sky -->
    <g fill="#fff" :opacity="night">
      <circle cx="60" cy="30" r="1" /><circle cx="140" cy="20" r="1.2" /><circle cx="250" cy="35" r="1" />
      <circle cx="370" cy="25" r="1.1" /><circle cx="300" cy="70" r=".9" /><circle cx="90" cy="70" r=".9" />
      <circle cx="200" cy="15" r="1" /><circle cx="20" cy="110" r=".8" /><circle cx="385" cy="110" r=".8" />
    </g>
    <circle cx="345" cy="45" r="13" fill="#f1f1d8" :opacity="night" />
    <circle v-if="sun" :cx="sun.x" :cy="sun.y" r="16" fill="#ffd166" />
    <g fill="#fff" :opacity="scenario.cloud * 1.4 * (0.3 + 0.7 * daylight)">
      <g transform="translate(120 40)"><ellipse rx="26" ry="10" /><ellipse cx="14" cy="-7" rx="16" ry="10" /></g>
      <g transform="translate(290 80)"><ellipse rx="22" ry="8" /><ellipse cx="-10" cy="-6" rx="13" ry="9" /></g>
    </g>

    <!-- ground and driveway -->
    <rect y="228" width="400" height="72" fill="#3f7d4e" />
    <rect x="305" y="232" width="95" height="40" fill="#5f6673" />

    <!-- grid connection -->
    <g stroke="#4a3a2a" stroke-width="5" stroke-linecap="round">
      <line x1="40" y1="88" x2="40" y2="236" />
      <line x1="26" y1="96" x2="54" y2="96" stroke-width="3" />
    </g>
    <path d="M40 96 Q78 135 112 150" fill="none" stroke="#222" stroke-width="2" />
    <path d="M40 96 Q78 135 112 150" class="flow" :class="gridFlow" />
    <text x="8" y="80" class="label">{{ gridLabel }}</text>

    <!-- heat pump outdoor unit -->
    <g v-if="scenario.heating" :class="{ dev: true, on: current.heating }" style="--c: #ef476f">
      <rect class="body" x="60" y="196" width="44" height="32" rx="3" />
      <circle class="spin" cx="76" cy="212" r="10" fill="none" stroke="#5b6475" stroke-width="2" stroke-dasharray="8 5" />
      <text x="96" y="217" font-size="10" text-anchor="middle">♨️</text>
    </g>

    <!-- house -->
    <rect x="110" y="130" width="190" height="100" :fill="wallFill" stroke="#8a7350" stroke-width="2" :class="{ overload }" />
    <polygon points="100,132 205,60 310,132" fill="#a4483b" stroke="#6e2c24" stroke-width="2" stroke-linejoin="round" />
    <g transform="translate(122 118) skewY(-33.7)" stroke="#9fb3c8" :fill="panelFill">
      <rect x="0" width="20" height="10" /><rect x="22" width="20" height="10" /><rect x="44" width="20" height="10" />
    </g>
    <text x="150" y="62" class="label" text-anchor="middle">☀ {{ current.pv.toFixed(1) }} kW</text>
    <circle cx="236" cy="108" r="9" :fill="windowFill" stroke="#6e2c24" stroke-width="2" />
    <line x1="205" y1="132" x2="205" y2="228" stroke="#c9b48c" stroke-width="2" />
    <rect x="215" y="146" width="38" height="28" :fill="windowFill" stroke="#8a7350" stroke-width="2" />
    <line x1="234" y1="146" x2="234" y2="174" stroke="#8a7350" stroke-width="1.5" />
    <rect x="222" y="200" width="22" height="28" fill="#8a7350" />
    <text v-if="scenario.heating" x="157" y="160" font-size="13" font-weight="700" text-anchor="middle" :fill="tooCold ? '#1d6fd1' : '#5b4630'">
      🌡 {{ current.indoor.toFixed(1) }} °C
    </text>

    <!-- devices (ids match DEVICES in game/config.js) -->
    <g v-if="has('washer')" :class="devClass('washer')" :style="devStyle('washer')">
      <rect class="body" x="116" y="192" width="26" height="34" rx="3" />
      <circle class="spin" cx="129" cy="211" r="8" fill="none" stroke="#5b6475" stroke-width="2" stroke-dasharray="10 4" />
      <text x="129" y="187" font-size="11" text-anchor="middle">🧺</text>
    </g>
    <g v-if="has('dryer')" :class="devClass('dryer')" :style="devStyle('dryer')">
      <rect class="body" x="146" y="192" width="26" height="34" rx="3" />
      <circle class="spin" cx="159" cy="211" r="8" fill="none" stroke="#5b6475" stroke-width="2" stroke-dasharray="6 6" />
      <text x="159" y="187" font-size="11" text-anchor="middle">🌀</text>
    </g>
    <g v-if="has('dish')" :class="devClass('dish')" :style="devStyle('dish')">
      <rect class="body" x="176" y="198" width="24" height="28" rx="2" />
      <line x1="179" y1="204" x2="197" y2="204" stroke="#5b6475" stroke-width="1.5" />
      <text x="188" y="193" font-size="11" text-anchor="middle">🍽️</text>
    </g>
    <g v-if="has('boiler')" :class="devClass('boiler')" :style="devStyle('boiler')">
      <rect class="body" x="268" y="160" width="24" height="66" rx="10" />
      <text x="280" y="155" font-size="11" text-anchor="middle">🔥</text>
    </g>

    <!-- home battery -->
    <g v-if="scenario.battery" :class="{ dev: true, on: !!current.batteryAction }" :style="{ '--c': batteryColor }">
      <rect class="body" x="248" y="194" width="16" height="32" rx="2" />
      <rect x="250" :y="224 - 28 * batteryFill" width="12" :height="28 * batteryFill" :fill="batteryColor" />
      <rect x="253" y="191" width="6" height="3" fill="#5b6475" />
    </g>

    <!-- EV and charger -->
    <template v-if="has('ev')">
      <rect x="300" y="196" width="8" height="14" rx="2" fill="#333" />
      <path d="M304 210 Q312 240 330 240" class="flow cable" :class="{ in: isOn('ev') }" />
    </template>
    <g v-if="carHome" transform="translate(322 230)">
      <path d="M4 22 L4 12 Q6 8 14 7 L22 0 L50 0 L60 7 Q72 8 72 14 L72 22 Z" fill="#e63946" stroke="#7a1b22" stroke-width="1.5" />
      <path d="M25 3 L48 3 L55 8 L19 8 Z" fill="#cde8f6" />
      <circle cx="18" cy="23" r="6" fill="#222" /><circle cx="58" cy="23" r="6" fill="#222" />
      <rect x="18" y="-14" width="40" height="8" rx="2" fill="#0008" stroke="#fff" stroke-width="1" />
      <rect x="19" y="-13" :width="38 * evProgress" height="6" rx="1" fill="#52d17c" />
    </g>

    <text v-if="overload" x="205" y="290" class="label warn" text-anchor="middle">⚠ GRID OVERLOAD</text>
  </svg>
</template>

<style scoped>
.house { display: block; width: 100%; height: auto; border-radius: 6px; }
.label { font-size: 11px; font-weight: 700; fill: #fff; stroke: #0008; stroke-width: 3px; paint-order: stroke; }
.label.warn { font-size: 13px; fill: #ff5d73; }

.dev .body { fill: #d9dee7; stroke: #5b6475; stroke-width: 1.2; }
.dev.on .body { fill: var(--c); filter: drop-shadow(0 0 6px var(--c)); }
.dev.on .spin { animation: spin 1s linear infinite; transform-box: fill-box; transform-origin: center; }

.flow { fill: none; stroke: #ffd166; stroke-width: 2.5; stroke-dasharray: 3 9; opacity: 0; }
.flow.in { opacity: 1; animation: dash 0.6s linear infinite; }
.flow.out { opacity: 1; stroke: #52d17c; animation: dash 0.6s linear infinite reverse; }
.flow.cable { stroke: #4cc9f0; }

.overload { stroke: #ff5d73; stroke-width: 4; animation: blink 0.5s steps(2) infinite; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes dash { to { stroke-dashoffset: -12; } }
@keyframes blink { 50% { stroke: transparent; } }
</style>
