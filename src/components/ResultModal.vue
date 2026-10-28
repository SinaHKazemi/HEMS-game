<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { formatEuro } from '../game/config'
import { UNLOCK_SCORE } from '../game/levels'

const props = defineProps({ result: Object })
const emit = defineEmits(['close', 'show-optimal', 'next'])

const scoreClass = computed(() =>
  props.result.score >= 80 ? 'has-text-success' : props.result.score >= 60 ? 'has-text-warning' : 'has-text-danger',
)
const percent = (v) => `${Math.round(v * 100)}%`

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="modal is-active">
    <div class="modal-background" @click="emit('close')"></div>
    <div class="modal-content">
      <div class="box has-text-centered">
        <p class="title is-1 mb-2" :class="scoreClass">{{ result.score }}</p>
        <p class="is-size-3 has-text-warning">{{ '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars) }}</p>
        <p class="subtitle is-6 mt-2">{{ result.verdict }}</p>
        <div v-if="result.newlyUnlocked" class="notification is-success is-light py-3">
          🔓 Unlocked: <strong>{{ result.newlyUnlocked.title }}</strong>
        </div>

        <table class="table is-fullwidth">
          <tbody>
            <tr><td class="has-text-left">Your cost</td><th class="has-text-right">{{ formatEuro(result.cost) }}</th></tr>
            <tr><td class="has-text-left">Optimal cost</td><th class="has-text-right">{{ formatEuro(result.bestCost) }}</th></tr>
            <tr><td class="has-text-left">Starting plan cost</td><th class="has-text-right">{{ formatEuro(result.startCost) }}</th></tr>
            <tr v-if="result.heating"><td class="has-text-left">Too cold (included in your cost)</td><th class="has-text-right">{{ result.coldDegreeHours.toFixed(1) }} °C·h</th></tr>
            <tr>
              <td class="has-text-left">Solar used at home</td>
              <th class="has-text-right">{{ percent(result.selfUse) }} (optimal: {{ percent(result.selfUseOptimal) }})</th>
            </tr>
          </tbody>
        </table>

        <div v-if="result.tips.length" class="content has-text-left">
          <ul>
            <li v-for="tip in result.tips" :key="tip">{{ tip }}</li>
          </ul>
        </div>

        <div class="buttons is-centered">
          <button class="button" @click="emit('show-optimal')">👁 Show optimal plan</button>
          <button class="button" @click="emit('close')">✎ Improve plan</button>
          <button class="button is-warning has-text-weight-bold" :disabled="!result.canContinue" @click="emit('next')">
            {{ result.isLast ? '🎲 New random day' : 'Next level ➜' }}
          </button>
        </div>
        <p v-if="!result.canContinue" class="help">Score {{ UNLOCK_SCORE }}+ to unlock the next level.</p>
      </div>
    </div>
    <button class="modal-close is-large" aria-label="Close" @click="emit('close')"></button>
  </div>
</template>
