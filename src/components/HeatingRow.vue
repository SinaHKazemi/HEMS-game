<script setup>
import { ref } from 'vue'
import { HOURS, HEAT_PUMP_POWER, T_MAX, formatHour } from '../game/config'

// Timeline row with one on/off cell per hour for the heat pump. Click or drag to paint.
const props = defineProps({
  schedule: Array, // what the player switched on
  heatOn: Array, // what actually ran (the thermostat skips hours when the house is at T_MAX)
  optimal: Array,
  showOptimal: Boolean,
  locked: Boolean,
})
const emit = defineEmits(['set'])

const track = ref(null)
let paintValue = null

function hourAt(e) {
  const rect = track.value.getBoundingClientRect()
  return Math.floor(((e.clientX - rect.left) / rect.width) * HOURS)
}
function onDown(e) {
  if (props.locked) return
  e.currentTarget.setPointerCapture(e.pointerId)
  const hour = hourAt(e)
  paintValue = !props.schedule[hour]
  emit('set', hour, paintValue)
}
function onMove(e) {
  const hour = hourAt(e)
  if (paintValue !== null && hour >= 0 && hour < HOURS && props.schedule[hour] !== paintValue) emit('set', hour, paintValue)
}
function onUp() {
  paintValue = null
}

function title(i) {
  const state = !props.schedule[i] ? 'off' : props.heatOn[i] ? 'heating' : `skipped — house already at ${T_MAX} °C`
  return `${formatHour(i)} — ${state}` + (props.showOptimal ? ` (optimal: ${props.optimal[i] ? 'on' : 'off'})` : '')
}
</script>

<template>
  <div class="tl-row">
    <div class="tl-label">
      <strong>♨️ Heat pump</strong>
      <p class="is-size-7 has-text-grey">{{ HEAT_PUMP_POWER }} kW · click or drag to switch hours on/off</p>
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
        v-for="(on, i) in schedule"
        :key="i"
        class="tl-heat"
        :class="{ 'is-on': on, 'is-skipped': on && !heatOn[i], 'is-optimal': showOptimal && optimal[i] }"
        :title="title(i)"
      ></div>
    </div>
  </div>
</template>
