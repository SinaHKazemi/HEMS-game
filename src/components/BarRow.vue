<script setup>
import { computed } from 'vue'
import { formatHour } from '../game/config'

// One timeline row showing an hourly value as a bar chart (supports negative values).
const props = defineProps({
  label: String,
  sub: String,
  values: Array,
  min: { type: Number, default: 0 },
  max: Number,
  color: Function, // (value, index) => css color
  describe: Function, // (value, index) => tooltip text
  valueLabel: Function, // optional (value, index) => small text above the bar
  limit: Number, // optional dashed line
})

const range = computed(() => props.max - props.min || 1)
const percentOf = (v) => ((v - props.min) / range.value) * 100

const bars = computed(() =>
  props.values.map((v, i) => {
    const zero = percentOf(0)
    const height = (Math.abs(v) / range.value) * 100
    return {
      style: { bottom: `${v >= 0 ? zero : zero - height}%`, height: `${height}%`, background: props.color(v, i) },
      title: `${formatHour(i)} — ${props.describe(v, i)}`,
      text: props.valueLabel?.(v, i) ?? '',
    }
  }),
)
</script>

<template>
  <div class="tl-row">
    <div class="tl-label">
      <strong>{{ label }}</strong>
      <p class="is-size-7 has-text-grey"><slot name="sub">{{ sub }}</slot></p>
    </div>
    <div class="tl-track tl-data">
      <div v-for="(b, i) in bars" :key="i" class="tl-cell" :title="b.title">
        <span class="tl-value has-text-grey">{{ b.text }}</span>
        <div class="tl-plot"><div class="tl-bar" :style="b.style"></div></div>
      </div>
      <div class="tl-plot">
        <div v-if="min < 0" class="tl-line" :style="{ bottom: `${percentOf(0)}%` }"></div>
        <div v-if="limit != null" class="tl-line is-limit" :style="{ bottom: `${percentOf(limit)}%` }">
          <span class="is-size-7 has-text-danger">limit {{ limit }} kW</span>
        </div>
      </div>
    </div>
  </div>
</template>
