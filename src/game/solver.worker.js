// Runs the exact optimiser off the main thread so the page stays responsive.
import { solve } from './model'

self.onmessage = ({ data }) => {
  self.postMessage({ id: data.id, optimum: solve(data.scenario) })
}
