<script setup>
import { ref, computed } from 'vue'
import { HOURS, formatHour } from '../game/config'

// One timeline row with a draggable block for a device's start time.
const props = defineProps({
  device: Object,
  start: Number,
  optimalStart: Number,
  showOptimal: Boolean,
  locked: Boolean,
})
const emit = defineEmits(['move'])

const track = ref(null)
const percent = (slots) => `${(slots / HOURS) * 100}%`
const span = computed(() => `${props.device.name}: ${formatHour(props.start)} – ${formatHour(props.start + props.device.duration)}`)

let drag = null
function onDown(e) {
  if (props.locked) return
  e.currentTarget.focus()
  e.currentTarget.setPointerCapture(e.pointerId)
  drag = { x0: e.clientX, start: props.start, slotWidth: track.value.clientWidth / HOURS }
}
function onMove(e) {
  if (drag) emit('move', props.device.id, drag.start + Math.round((e.clientX - drag.x0) / drag.slotWidth))
}
function onUp() {
  drag = null
}
function nudge(delta) {
  if (!props.locked) emit('move', props.device.id, props.start + delta)
}
</script>

<template>
  <div class="tl-row">
    <div class="tl-label">
      <strong>{{ device.icon }} {{ device.name }}</strong>
      <p class="is-size-7 has-text-grey">{{ device.duration }} h · {{ device.power }} kW · {{ device.note }}</p>
    </div>
    <div ref="track" class="tl-track tl-plan">
      <div
        class="tl-zone"
        :style="{ left: percent(device.earliest), width: percent(device.latestEnd - device.earliest) }"
      ></div>
      <div
        v-if="showOptimal"
        class="tl-ghost"
        :style="{ left: percent(optimalStart), width: percent(device.duration) }"
        :title="`Optimal: ${formatHour(optimalStart)}`"
      ></div>
      <span
        class="tag tl-block"
        :class="{ 'is-locked': locked }"
        :style="{ left: percent(start), width: percent(device.duration), background: device.color }"
        :title="span"
        tabindex="0"
        role="slider"
        :aria-label="`${device.name} start time`"
        :aria-valuetext="span"
        @pointerdown.prevent="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @keydown.left.prevent="nudge(-1)"
        @keydown.right.prevent="nudge(1)"
      >
        {{ device.icon }} {{ device.duration }}h
      </span>
    </div>
  </div>
</template>
