<script setup>
import { ref } from 'vue'
import { HOURS, BATTERY_POWER, formatHour } from '../game/config'
import { CHARGE, DISCHARGE, batteryAllows } from '../game/model'

// Timeline row with one cell per hour for the home battery: idle, charge or discharge.
// Click cycles through the actions that are possible at that hour; drag paints the same action.
const props = defineProps({
  schedule: Array, // what the player chose
  actions: Array, // what actually happened (impossible actions are skipped)
  levels: Array, // slots stored at the start of each hour
  optimal: Array,
  showOptimal: Boolean,
  locked: Boolean,
})
const emit = defineEmits(['set'])

const ORDER = ['', CHARGE, DISCHARGE]
const LABEL = { '': 'idle', [CHARGE]: 'charge', [DISCHARGE]: 'discharge' }
const track = ref(null)
let paintValue = null

function hourAt(e) {
  const rect = track.value.getBoundingClientRect()
  return Math.floor(((e.clientX - rect.left) / rect.width) * HOURS)
}
// Next action in the cycle that the battery level allows (no discharging before charging).
function nextAction(hour) {
  const k = ORDER.indexOf(props.schedule[hour])
  for (let step = 1; step <= ORDER.length; step++) {
    const action = ORDER[(k + step) % ORDER.length]
    if (batteryAllows(action, props.levels[hour])) return action
  }
  return ''
}
function onDown(e) {
  if (props.locked) return
  e.currentTarget.setPointerCapture(e.pointerId)
  const hour = hourAt(e)
  paintValue = nextAction(hour)
  emit('set', hour, paintValue)
}
function onMove(e) {
  const hour = hourAt(e)
  if (paintValue === null || hour < 0 || hour >= HOURS || props.schedule[hour] === paintValue) return
  if (batteryAllows(paintValue, props.levels[hour])) emit('set', hour, paintValue)
}
function onUp() {
  paintValue = null
}

function title(i) {
  const wanted = props.schedule[i]
  const skipped = wanted && !props.actions[i] ? ` — skipped, battery ${wanted === CHARGE ? 'full' : 'empty'}` : ''
  return `${formatHour(i)} — ${LABEL[wanted]}${skipped}` + (props.showOptimal ? ` (optimal: ${LABEL[props.optimal[i]]})` : '')
}
</script>

<template>
  <div class="tl-row">
    <div class="tl-label">
      <strong>🔋 Home battery</strong>
      <p class="is-size-7 has-text-grey">{{ BATTERY_POWER }} kW · click: charge ＋ → discharge − → idle · charge first</p>
    </div>
    <div
      ref="track"
      class="tl-track tl-plan tl-grid"
      @pointerdown.prevent="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <div
        v-for="(action, i) in schedule"
        :key="i"
        class="tl-heat tl-battery"
        :class="{
          'is-charge': action === CHARGE,
          'is-discharge': action === DISCHARGE,
          'is-skipped': action && !actions[i],
          'is-optimal': showOptimal && optimal[i],
        }"
        :style="showOptimal && optimal[i] ? { outlineColor: optimal[i] === CHARGE ? '#06d6a0' : '#ff9f1c' } : null"
        :title="title(i)"
      >
        {{ action === CHARGE ? '＋' : action === DISCHARGE ? '−' : '' }}
      </div>
    </div>
  </div>
</template>
