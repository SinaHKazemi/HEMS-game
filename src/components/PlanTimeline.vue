<script setup>
import { ref, computed } from 'vue'
import { HOURS, GRID_LIMIT, BATTERY_OUTPUT, BATTERY_CAPACITY, hourOf } from '../game/config'
import BarRow from './BarRow.vue'
import DeviceRow from './DeviceRow.vue'
import HeatingRow from './HeatingRow.vue'
import TemperatureRow from './TemperatureRow.vue'
import BatteryRow from './BatteryRow.vue'

const props = defineProps({
  scenario: Object,
  plan: Object,
  optimalPlan: Object,
  showOptimal: Boolean,
  running: Boolean,
  time: Number,
  analysis: Object,
  optimalAnalysis: Object,
})
const emit = defineEmits(['move', 'heat', 'battery', 'preview'])

const cursorLayer = ref(null)
const hours = Array.from({ length: HOURS }, (_, i) => String(hourOf(i)).padStart(2, '0'))

const price = computed(() => {
  const values = props.scenario.price
  const lo = Math.min(...values), hi = Math.max(...values)
  return {
    values,
    min: Math.min(0, lo),
    max: hi,
    color: (v) => `hsl(${130 - 130 * ((v - lo) / (hi - lo || 1))} 70% 50%)`,
  }
})
const net = computed(() => props.analysis.net)
const netRange = computed(() => ({ min: Math.min(-2, ...net.value), max: Math.max(GRID_LIMIT + 2, ...net.value) }))
const peak = computed(() => Math.max(...net.value))
const overloadHours = computed(() => net.value.filter((v) => v > GRID_LIMIT).length)
const batteryKwh = computed(() => props.analysis.batteryLevel.slice(1).map((slots) => slots * BATTERY_OUTPUT))
const outdoorRange = computed(() => ({ min: Math.min(0, ...props.scenario.outdoor), max: Math.max(10, ...props.scenario.outdoor) }))

const netColor = (v) => (v > GRID_LIMIT ? 'var(--bulma-danger)' : v >= 0 ? '#f4a261' : 'var(--bulma-success)')
const describeNet = (v) =>
  (v >= 0 ? `importing ${v.toFixed(2)} kW` : `exporting ${(-v).toFixed(2)} kW`) + (v > GRID_LIMIT ? ' — OVER LIMIT!' : '')

function onHover(e) {
  if (props.running || e.buttons) return
  const rect = cursorLayer.value.getBoundingClientRect()
  const f = (e.clientX - rect.left) / rect.width
  if (f >= 0 && f < 1) emit('preview', Math.floor(f * HOURS) + 0.5)
}
</script>

<template>
  <div class="table-container">
    <div class="tl" @pointermove="onHover">
      <div class="tl-row">
        <div></div>
        <div class="tl-hours">
          <span v-for="h in hours" :key="h" class="is-size-7 has-text-grey">{{ h }}</span>
        </div>
      </div>

      <p class="tl-section has-text-warning">Forecast data</p>
      <BarRow
        label="Electricity price" sub="ct/kWh"
        :values="price.values" :min="price.min" :max="price.max" :color="price.color"
        :value-label="(v) => Math.round(v * 100)"
        :describe="(v) => `${(v * 100).toFixed(1)} ct/kWh`"
      />
      <BarRow
        label="Solar generation" sub="kW from your roof"
        :values="scenario.pv" :max="Math.max(4, ...scenario.pv)" :color="() => '#ffd166'"
        :value-label="(v) => (v >= 0.05 ? v.toFixed(1) : '')"
        :describe="(v) => `${v.toFixed(2)} kW solar`"
      />
      <BarRow
        label="Base load" sub="fridge, lights, cooking…"
        :values="scenario.base" :max="2.5" :color="() => '#8da9c4'"
        :value-label="(v) => v.toFixed(1)"
        :describe="(v) => `${v.toFixed(2)} kW base load`"
      />
      <BarRow
        v-if="scenario.heating"
        label="Outdoor temperature" sub="°C"
        :values="scenario.outdoor" :min="outdoorRange.min" :max="outdoorRange.max"
        :color="(v) => (v < 0 ? '#4cc9f0' : '#9bb7d4')"
        :value-label="(v) => Math.round(v)"
        :describe="(v) => `${v.toFixed(1)} °C outside`"
      />

      <p class="tl-section has-text-warning">Your plan — drag the blocks{{ scenario.heating || scenario.battery ? ', paint the hourly rows' : '' }}</p>
      <DeviceRow
        v-for="d in scenario.devices" :key="d.id"
        :device="d" :start="plan[d.id]" :optimal-start="optimalPlan[d.id]"
        :show-optimal="showOptimal" :locked="running"
        @move="(id, start) => emit('move', id, start)"
      />
      <HeatingRow
        v-if="scenario.heating"        :schedule="plan.heating" :heat-on="analysis.heatOn" :optimal="optimalPlan.heating"
        :show-optimal="showOptimal" :locked="running"
        @set="(hour, on) => emit('heat', hour, on)"
      />
      <BatteryRow
        v-if="scenario.battery"
        :schedule="plan.battery" :actions="analysis.batteryAction" :levels="analysis.batteryLevel"
        :optimal="optimalPlan.battery" :show-optimal="showOptimal" :locked="running"
        @set="(hour, action) => emit('battery', hour, action)"
      />

      <p class="tl-section has-text-warning">Result of your plan</p>
      <BarRow
        label="Grid exchange"
        :values="net" :min="netRange.min" :max="netRange.max" :limit="GRID_LIMIT"
        :color="netColor" :describe="describeNet"
      >
        <template #sub>
          peak {{ peak.toFixed(1) }} kW
          <span v-if="overloadHours" class="has-text-danger">· {{ overloadHours }} h over limit</span>
        </template>
      </BarRow>
      <BarRow
        v-if="scenario.battery"
        label="🔋 Battery level" :sub="`kWh stored at the end of each hour (max ${BATTERY_CAPACITY.toFixed(1)})`"
        :values="batteryKwh" :max="BATTERY_CAPACITY" :color="() => '#06d6a0'"
        :value-label="(v) => (v > 0 ? v.toFixed(1) : '')"
        :describe="(v) => `${v.toFixed(1)} kWh stored`"
      />
      <TemperatureRow
        v-if="scenario.heating"        :temps="analysis.temps" :comfort="scenario.comfort" :cold="analysis.cold"
        :optimal-temps="optimalAnalysis.temps" :show-optimal="showOptimal"
      />

      <div ref="cursorLayer" class="tl-cursor-layer">
        <div class="tl-cursor" :style="{ left: `${(time / HOURS) * 100}%` }"></div>
      </div>
    </div>
    <p class="is-size-7 has-text-grey mt-2">
      Tip: hover the timeline to preview any hour. Blocks can also be moved with ← → after clicking them.
    </p>
  </div>
</template>
