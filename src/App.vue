<script setup>
import { LEVELS, UNLOCK_SCORE, levelAddition } from './game/levels'
import { starsFor } from './game/model'
import { useGame } from './composables/useGame'
import HouseScene from './components/HouseScene.vue'
import StatusPanel from './components/StatusPanel.vue'
import PlanTimeline from './components/PlanTimeline.vue'
import ResultModal from './components/ResultModal.vue'

const game = useGame()
const { levelIndex, level, progress, scenario, plan, optimum, time, speed, running, hasRun, showOptimal, result, bestScore, analysis, optimalAnalysis, current, costSoFar } = game

function showOptimalPlan() {
  result.value = null
  showOptimal.value = true
}
function nextLevel() {
  result.value = null
  game.nextLevel()
}
function levelLabel(l, i) {
  if (!game.isUnlocked(i)) return `🔒 Level ${i + 1} · ${l.title}`
  const score = progress.value[i]
  const stars = score == null ? '' : ` ${'★'.repeat(starsFor(score))}${'☆'.repeat(3 - starsFor(score))}`
  return `Level ${i + 1} · ${l.title}${stars}`
}
</script>

<template>
  <section class="section">
    <div class="container">
      <nav class="level">
        <div class="level-left">
          <h1 class="title">⚡ Power Planner</h1>
        </div>
        <div class="level-right">
          <div class="field is-grouped is-grouped-multiline">
            <div class="control">
              <div class="select">
                <select v-model="levelIndex" :disabled="running" aria-label="Level">
                  <option v-for="(l, i) in LEVELS" :key="i" :value="i" :disabled="!game.isUnlocked(i)">
                    {{ levelLabel(l, i) }}
                  </option>
                </select>
              </div>
            </div>
            <div class="control">
              <div class="select">
                <select v-model.number="speed" aria-label="Simulation speed">
                  <option :value="16">Slow</option>
                  <option :value="8">Normal</option>
                  <option :value="3">Fast</option>
                </select>
              </div>
            </div>
            <div class="control">
              <button class="button" :disabled="running || !hasRun" @click="showOptimal = !showOptimal">
                👁 {{ showOptimal ? 'Hide' : 'Show' }} optimal
              </button>
            </div>
            <div class="control">
              <button class="button" :disabled="running" @click="game.resetPlan">↺ Reset</button>
            </div>
            <div class="control">
              <button
                class="button is-warning has-text-weight-bold"
                :class="{ 'is-loading': !optimum }"
                :disabled="!optimum"
                @click="running ? game.finish() : game.run()"
              >
                {{ running ? '⏭ Skip' : '▶ Run the day' }}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <article class="message is-info">
        <div class="message-header">
          <p>Level {{ levelIndex + 1 }} of {{ LEVELS.length }} · {{ level.title }}</p>
          <span v-if="levelAddition(level)" class="tag is-white">
            New: {{ levelAddition(level).icon }} {{ levelAddition(level).name }}
          </span>
        </div>
        <div class="message-body">
          {{ level.intro }}
          <span v-if="levelIndex < LEVELS.length - 1">Score {{ UNLOCK_SCORE }}+ to unlock the next level.</span>
        </div>
      </article>

      <div class="columns">
        <div class="column is-7">
          <div class="box p-2">
            <HouseScene :scenario="scenario" :plan="plan" :time="time" :current="current" />
          </div>
        </div>
        <div class="column">
          <StatusPanel :scenario="scenario" :current="current" :cost-so-far="costSoFar" :best-score="bestScore" />
        </div>
      </div>

      <div class="box">
        <PlanTimeline
          :scenario="scenario"
          :plan="plan"
          :optimal-plan="optimum ? optimum.best.plan : plan"
          :show-optimal="showOptimal"
          :running="running"
          :time="time"
          :analysis="analysis"
          :optimal-analysis="optimalAnalysis"
          @move="game.moveDevice"
          @heat="game.setHeating"
          @battery="game.setBattery"
          @preview="game.preview"
        />
      </div>
    </div>

    <ResultModal
      v-if="result"
      :result="result"
      @close="result = null"
      @show-optimal="showOptimalPlan"
      @next="nextLevel"
    />
  </section>
</template>
