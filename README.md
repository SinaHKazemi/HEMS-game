# Power Planner

A small browser game about home energy management. You see tomorrow's electricity prices, solar,
base load and outdoor temperature forecast, then drag each appliance to a time slot and choose the
hours the heat pump runs and the battery charges or discharges. The house stores heat, so preheating
while power is cheap pays off — as long as it stays inside the comfort zone. Running the day scores
your plan: 100 = the exact optimum, 50 = the starting plan.

The game has 9 levels. Each one adds a device (washer → dryer → dishwasher → water heater → electric
car → home battery → heat pump), followed by a level with everything on a volatile market and a
free-play level with a random day. A score of 60+ unlocks the next level; progress is saved in the
browser.

Built with [Vue 3](https://vuejs.org/) + [Vite](https://vite.dev/) and styled with [Bulma](https://bulma.io/).

## Commands

```sh
npm install
npm run dev      # local dev server
npm run build    # static build in dist/
```

## Structure

```text
src/
  game/                 plain JS, no Vue: easy to test and change
    config.js           rules (grid limit, fees), devices, base load, heating and battery parameters
    levels.js           level list: which device each level adds, which day it plays on
    scenarios.js        scenario parameters and the generator for price/solar/load/temperature curves
    model.js            cost, thermal and battery model, exact optimal solver, scoring
    solver.worker.js    runs solve() in a Web Worker so the page stays responsive
  composables/
    useGame.js          all reactive game state and actions
  components/
    HouseScene.vue      SVG house driven by the current hour
    StatusPanel.vue     clock and live numbers
    PlanTimeline.vue    data rows, device rows, result rows, time cursor
    BarRow.vue          one hourly bar-chart row
    DeviceRow.vue       one draggable device row
    HeatingRow.vue      hourly on/off cells for the heat pump
    BatteryRow.vue      hourly charge/discharge cells for the battery
    TemperatureRow.vue  indoor temperature chart with the comfort zone
    ResultModal.vue     score after a run
  style.css             timeline layout (the only global custom CSS)
```

### Common changes

- **Tune rules or devices:** edit `src/game/config.js`. A new device also needs a drawing in
  `HouseScene.vue` (devices are drawn by `id`).
- **Add or reorder levels:** edit `LEVELS` in `src/game/levels.js`.
- **Add a scenario:** add an entry to `SCENARIOS` in `src/game/scenarios.js`.
- **Tune the house's heat buffer:** `HEAT_CAPACITY`, `HEAT_LOSS`, `T_MAX` and `comfortMin` in
  `src/game/config.js`.
- **Tune the battery:** `BATTERY_POWER`, `BATTERY_EFFICIENCY` and `BATTERY_SLOTS` in
  `src/game/config.js`. More slots make the optimiser slower (one more DP state each).

### Battery rules

The battery starts the day empty. Each charging hour draws `BATTERY_POWER` and stores one "slot";
each discharging hour releases one slot at `BATTERY_POWER × BATTERY_EFFICIENCY`. A discharge is only
possible after a charge (and charging stops when the battery is full). The battery row refuses such
clicks; if an earlier change makes a planned action impossible, it is shown greyed out and skipped.

### How the optimum is found

`solve()` in `model.js` tries every device placement. For each one, `scheduleOptimiser()` finds the
best heat pump and battery schedule exactly with dynamic programming over the state
(hours heated so far, battery slots stored). This works because of one simplification in the
thermal model: heat loss is measured against a fixed 20 °C, so the indoor temperature depends only
on how many hours have been heated so far, not on which ones.
