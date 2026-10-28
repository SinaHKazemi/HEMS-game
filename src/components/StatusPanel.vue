<script setup>
import { computed } from 'vue'
import { GRID_LIMIT, OVERLOAD_FEE, FEED_IN, COLD_FEE, T_MAX, BATTERY_CAPACITY, formatEuro } from '../game/config'
import { CHARGE, DISCHARGE } from '../game/model'

const props = defineProps({
  scenario: Object,
  current: Object,
  costSoFar: Number,
  bestScore: [Number, String],
})

const stats = computed(() => {
  const { price, pv, load, net, indoor, outdoor, comfort, heating, batteryKwh, batteryAction } = props.current
  const heatingStats = [
    {
      label: 'Indoor',
      value: `${indoor.toFixed(1)} °C${heating ? ' ♨️' : ''}`,
      class: indoor < comfort ? 'has-text-info' : '',
    },
    { label: 'Outdoor', value: `${outdoor.toFixed(1)} °C` },
  ]
  const batteryStat = {
    label: 'Battery',
    value: `${batteryKwh.toFixed(1)} kWh` + (batteryAction === CHARGE ? ' ＋' : batteryAction === DISCHARGE ? ' −' : ''),
  }
  return [
    ...(props.scenario.heating ? heatingStats : []),
    ...(props.scenario.battery ? [batteryStat] : []),
    { label: 'Price now', value: `${(price * 100).toFixed(1)} ct` },
    { label: 'Solar', value: `${pv.toFixed(1)} kW` },
    { label: 'Consumption', value: `${load.toFixed(1)} kW` },
    {
      label: 'Grid',
      value: net >= 0 ? `↓ ${net.toFixed(1)} kW` : `↑ ${(-net).toFixed(1)} kW`,
      class: net > GRID_LIMIT ? 'has-text-danger' : net < 0 ? 'has-text-success' : '',
    },
    { label: 'Cost so far', value: props.costSoFar == null ? 'run to see' : formatEuro(props.costSoFar) },
    { label: 'Your best score', value: props.bestScore ?? '–' },
  ]
})
</script>

<template>
  <div class="box">
    <p class="title is-1 mb-2">{{ current.clock }}</p>
    <p class="has-text-grey mb-4">{{ scenario.desc }}</p>

    <div class="columns is-mobile is-multiline is-variable is-2">
      <div v-for="s in stats" :key="s.label" class="column is-half">
        <p class="is-size-7 is-uppercase has-text-grey">{{ s.label }}</p>
        <p class="is-size-5 has-text-weight-bold" :class="s.class">{{ s.value }}</p>
      </div>
    </div>

    <div class="content is-small">
      <ul>
        <li>Drag the blocks in <strong>Your plan</strong> to schedule each device.</li>
        <li>Grid connection limit <strong>{{ GRID_LIMIT }} kW</strong> — every kWh above costs a <strong>{{ formatEuro(OVERLOAD_FEE) }}</strong> overload fee.</li>
        <li>Surplus solar is sold for <strong>{{ FEED_IN * 100 }} ct/kWh</strong> (or the market price, if lower).</li>
        <li v-if="scenario.battery">The battery stores up to {{ BATTERY_CAPACITY.toFixed(1) }} kWh. It starts empty, so charge it before you discharge it.</li>
        <li v-if="scenario.heating">Keep the house warm: 20 °C from 07:00 to 22:00, 17 °C at night, 19 °C around wake-up. Every °C·h below costs {{ formatEuro(COLD_FEE) }}.</li>
        <li v-if="scenario.heating">The house stores heat — preheat when power is cheap. The thermostat stops at {{ T_MAX }} °C.</li>
        <li>Score: 100 = optimal plan, 50 = the starting plan.</li>
      </ul>
    </div>
  </div>
</template>
