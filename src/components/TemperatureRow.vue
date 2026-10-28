<script setup>
import { computed } from 'vue'
import { HOURS, T_MAX, formatHour } from '../game/config'

// Indoor temperature over the day against the comfort zone.
// The SVG uses 10 units per hour horizontally and stretches to the track width.
const props = defineProps({
  temps: Array, // 25 values: start of every hour plus the end of the day
  comfort: Array, // minimum per hour
  cold: Array, // °C·h below the comfort minimum per hour
  optimalTemps: Array,
  showOptimal: Boolean,
})

const range = computed(() => {
  const all = [...props.temps, ...props.comfort, T_MAX, ...(props.showOptimal ? props.optimalTemps : [])]
  return { lo: Math.floor(Math.min(...all) - 1), hi: Math.ceil(Math.max(...all) + 1) }
})
const y = (temp) => (100 * (range.value.hi - temp)) / (range.value.hi - range.value.lo)
const line = (temps) => temps.map((temp, t) => `${t * 10},${y(temp)}`).join(' ')

// Comfort zone: from the hourly minimum up to the thermostat cut-off.
const comfortZone = computed(() => {
  const bottom = props.comfort.flatMap((c, t) => [`${t * 10},${y(c)}`, `${(t + 1) * 10},${y(c)}`])
  return [`0,${y(T_MAX)}`, `${HOURS * 10},${y(T_MAX)}`, ...bottom.reverse()].join(' ')
})
const totalCold = computed(() => props.cold.reduce((a, b) => a + b, 0))
const hourTitle = (t) =>
  `${formatHour(t)} — ${props.temps[t].toFixed(1)} → ${props.temps[t + 1].toFixed(1)} °C (min ${props.comfort[t]} °C)`
</script>

<template>
  <div class="tl-row">
    <div class="tl-label">
      <strong>🌡️ Indoor temperature</strong>
      <p class="is-size-7 has-text-grey">
        green = comfort zone ({{ T_MAX }} °C cut-off)
        <span v-if="totalCold > 0.05" class="has-text-danger">· too cold {{ totalCold.toFixed(1) }} °C·h</span>
      </p>
    </div>
    <div class="tl-track tl-temp">
      <svg :viewBox="`0 0 ${HOURS * 10} 100`" preserveAspectRatio="none">
        <polygon :points="comfortZone" fill="var(--bulma-success)" opacity="0.18" />
        <template v-for="(c, t) in cold" :key="t">
          <rect
            v-if="c > 0"
            :x="t * 10" :width="10" :y="y(comfort[t])" :height="y(temps[t + 1]) - y(comfort[t])"
            fill="var(--bulma-danger)" opacity="0.35"
          />
        </template>
        <polyline
          v-if="showOptimal" :points="line(optimalTemps)"
          fill="none" stroke="var(--bulma-text-strong)" stroke-width="2" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"
        />
        <polyline :points="line(temps)" fill="none" stroke="#ef476f" stroke-width="3" vector-effect="non-scaling-stroke" />
      </svg>
      <span class="tl-axis is-size-7 has-text-grey" style="top: 0">{{ range.hi }} °C</span>
      <span class="tl-axis is-size-7 has-text-grey" style="bottom: 0">{{ range.lo }} °C</span>
      <div class="tl-grid tl-hover">
        <div v-for="t in HOURS" :key="t" :title="hourTitle(t - 1)"></div>
      </div>
    </div>
  </div>
</template>
