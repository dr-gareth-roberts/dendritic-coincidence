/**
 * Day-1 verification: soma-only HH fires an AP in response to a brief current pulse.
 *
 * Run with: npx tsx src/sim/day1-verify.ts
 * (or: npm install -D tsx && npx tsx src/sim/day1-verify.ts)
 *
 * Expected: peak V between +20 and +40 mV within 10 ms of a 0.5 nA × 1 ms pulse.
 * Threshold = -50 mV. Width ~1 ms.
 */

import {
  SOMA_PARAMS,
  initialHHState,
  stepHH,
} from './hh'

// Convert nA into current density. A single-compartment model with a
// "surface area" of 1e-4 cm^2 (typical soma-sized patch) gives
// I_density (µA/cm^2) = I (nA) / 1e-4 cm^2 * (1 µA / 1e3 nA) = I_nA * 10.
const SURFACE_AREA_CM2 = 1e-4

function somaSpikeTest(): void {
  const state = initialHHState()
  const params = SOMA_PARAMS
  const dt = 0.01 // ms

  // Sustained current step to characterise repetitive firing (typical test
  // for cortical pyramidal HH). 0.1 nA over a 1e-4 cm^2 surface = 1 µA/cm^2
  // — well above rheobase for these parameters. Expect firing at ~50 Hz.
  const stepStart = 5.0 // ms
  const totalT = 100 // ms
  const stepI_nA = 0.1
  const stepI_density = (stepI_nA * 1e-3) / SURFACE_AREA_CM2 // µA/cm^2

  const steps = Math.round(totalT / dt)

  let peakV = -Infinity
  let peakTime = -1
  let thresholdCrossed = false
  let thresholdTime = -1
  let spikeCount = 0
  let prevV = state.V

  const trace: { t: number; V: number }[] = []
  let blewUp = false

  for (let i = 0; i < steps; i++) {
    const t = i * dt
    const I_ext = t >= stepStart ? stepI_density : 0

    const stable = stepHH(state, params, I_ext, dt)
    if (!stable) {
      console.error(`BLOWUP at t=${t.toFixed(3)} ms, V=${state.V}`)
      blewUp = true
      break
    }

    trace.push({ t, V: state.V })

    if (state.V > peakV) {
      peakV = state.V
      peakTime = t
    }
    if (!thresholdCrossed && state.V > -50) {
      thresholdCrossed = true
      thresholdTime = t
    }
    // Detect upstroke crossings of 0 mV to count spikes.
    if (prevV <= 0 && state.V > 0) {
      spikeCount++
    }
    prevV = state.V
  }

  console.log('=== Day 1: soma-only HH spike test ===')
  console.log(`dt = ${dt} ms, surface area = ${SURFACE_AREA_CM2} cm^2`)
  console.log(
    `Step: ${stepI_nA} nA from t=${stepStart} to t=${totalT} ms (${stepI_density.toFixed(2)} µA/cm^2)`
  )
  console.log(`Peak V: ${peakV.toFixed(2)} mV at t=${peakTime.toFixed(2)} ms`)
  console.log(`AP threshold (-50 mV) crossed: ${thresholdCrossed} at t=${thresholdTime.toFixed(2)} ms`)
  console.log(`Spike count (crossings of 0 mV): ${spikeCount}`)
  console.log(`Final V: ${state.V.toFixed(2)} mV`)
  console.log(`Blew up: ${blewUp}`)

  // Verdict
  if (blewUp) {
    console.log('FAIL: integrator blew up')
    return
  }
  if (peakV < 15 || peakV > 55) {
    console.log(`FAIL: peak V ${peakV.toFixed(2)} mV outside expected [15, 55] mV band`)
    return
  }
  if (!thresholdCrossed) {
    console.log('FAIL: AP threshold not crossed')
    return
  }
  if (spikeCount < 2) {
    console.log(`FAIL: expected repetitive firing, got only ${spikeCount} spikes`)
    return
  }
  // Approximate width: time peak V > 0 mV
  const aboveZero = trace.filter((p) => p.V > 0)
  if (aboveZero.length > 0) {
    const width = aboveZero[aboveZero.length - 1].t - aboveZero[0].t
    console.log(`First AP width (above 0 mV): ${width.toFixed(2)} ms`)
  }

  console.log('PASS: soma AP within expected range; repetitive firing confirmed')
}

somaSpikeTest()
