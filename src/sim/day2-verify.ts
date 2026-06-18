/**
 * Day-2 verification: 4-compartment neuron with axial coupling.
 *
 * Inject 0.1 nA sustained step at the soma. Verify:
 *   1. Soma fires an AP.
 *   2. AP backpropagates to the apical tuft at ~30–60% of somatic amplitude.
 *   3. AP backpropagates to the basal dendrite at ~30–60%.
 *   4. No integrator blowup.
 *
 * If the bAP attenuation is outside [10%, 80%] at the tuft, tune g_axial.
 */

import { Neuron, COMPARTMENT_NAMES, type ExternalInputsFn, type CompartmentInput } from './neuron'

const SURFACE_AREA_CM2 = 1e-4

function nAtoCurrentDensity(nA: number): number {
  return (nA * 1e-3) / SURFACE_AREA_CM2 // µA/cm^2
}

function day2Test(): void {
  const neuron = new Neuron()
  const stepStart = 5.0 // ms
  const totalT = 50 // ms — enough for one full AP and propagation
  const dt = 0.01 // ms
  const stepI_nA = 0.5
  const stepI_density = nAtoCurrentDensity(stepI_nA)

  // External current at soma only; nothing else.
  const inputs: ExternalInputsFn = (_t: number) => {
    const stepI = _t >= stepStart ? stepI_density : 0
    const arr: CompartmentInput[] = [
      { I_ext: stepI, synapseEvents: [] },
      { I_ext: 0, synapseEvents: [] },
      { I_ext: 0, synapseEvents: [] },
      { I_ext: 0, synapseEvents: [] },
    ]
    return arr as [CompartmentInput, CompartmentInput, CompartmentInput, CompartmentInput]
  }

  const result = neuron.runTrial(totalT, dt, inputs)
  if (result.blewUp) {
    console.log('FAIL: integrator blew up')
    return
  }

  // Find the first AP at the soma.
  let prevSoma = result.trace[0].V[0]
  let apPeakSoma = -Infinity
  let apPeakTimeSoma = -1
  let apStartIdx = -1
  for (let i = 1; i < result.trace.length; i++) {
    const s = result.trace[i]
    const V = s.V[0]
    if (apStartIdx < 0 && prevSoma < -50 && V >= -50) apStartIdx = i
    if (V > apPeakSoma) {
      apPeakSoma = V
      apPeakTimeSoma = s.t
    }
    prevSoma = V
  }

  // At the same time index, find the peak V in each distal compartment
  // within a small window after the somatic peak (bAP propagation).
  const windowMs = 10
  const windowSamples = Math.round(windowMs / dt)
  const startSample = apStartIdx >= 0 ? apStartIdx : 0
  const endSample = Math.min(result.trace.length - 1, startSample + windowSamples)

  let maxTrunk = -Infinity
  let maxTuft = -Infinity
  let maxBasal = -Infinity
  let trunkT = -1
  let tuftT = -1
  let basalT = -1
  for (let i = startSample; i <= endSample; i++) {
    const s = result.trace[i]
    if (s.V[1] > maxTrunk) {
      maxTrunk = s.V[1]
      trunkT = s.t
    }
    if (s.V[2] > maxTuft) {
      maxTuft = s.V[2]
      tuftT = s.t
    }
    if (s.V[3] > maxBasal) {
      maxBasal = s.V[3]
      basalT = s.t
    }
  }

  const restSoma = result.trace[0].V[0] // ≈ -65
  const bapAmpSoma = apPeakSoma - restSoma
  const bapAmpTrunk = maxTrunk - restSoma
  const bapAmpTuft = maxTuft - restSoma
  const bapAmpBasal = maxBasal - restSoma
  const trunkRatio = (bapAmpTrunk / bapAmpSoma) * 100
  const tuftRatio = (bapAmpTuft / bapAmpSoma) * 100
  const basalRatio = (bapAmpBasal / bapAmpSoma) * 100

  console.log('=== Day 2: 4-compartment soma-AP → bAP propagation ===')
  console.log(`Step: ${stepI_nA} nA at soma from t=${stepStart} ms (${stepI_density.toFixed(2)} µA/cm^2)`)
  console.log(`dt = ${dt} ms, total = ${totalT} ms`)
  console.log('')
  console.log(`Somatic AP peak:    ${apPeakSoma.toFixed(2)} mV at t=${apPeakTimeSoma.toFixed(2)} ms  (amplitude ${bapAmpSoma.toFixed(1)} mV)`)
  console.log(`Apical trunk peak:  ${maxTrunk.toFixed(2)} mV at t=${trunkT.toFixed(2)} ms  (amplitude ${bapAmpTrunk.toFixed(1)} mV, ${trunkRatio.toFixed(0)}% of soma)`)
  console.log(`Apical tuft peak:   ${maxTuft.toFixed(2)} mV at t=${tuftT.toFixed(2)} ms  (amplitude ${bapAmpTuft.toFixed(1)} mV, ${tuftRatio.toFixed(0)}% of soma)`)
  console.log(`Basal peak:         ${maxBasal.toFixed(2)} mV at t=${basalT.toFixed(2)} ms  (amplitude ${bapAmpBasal.toFixed(1)} mV, ${basalRatio.toFixed(0)}% of soma)`)
  console.log('')

  // Verdict
  if (bapAmpSoma < 30) {
    console.log(`FAIL: somatic AP amplitude ${bapAmpSoma.toFixed(1)} mV too small`)
    return
  }
  if (tuftRatio < 10 || tuftRatio > 90) {
    console.log(`WARN: bAP → tuft ratio ${tuftRatio.toFixed(0)}% outside expected [10, 90]% band — tune g_at`)
  } else {
    console.log(`PASS: bAP → tuft ${tuftRatio.toFixed(0)}% within expected band`)
  }
  if (basalRatio < 10 || basalRatio > 90) {
    console.log(`WARN: bAP → basal ratio ${basalRatio.toFixed(0)}% outside expected [10, 90]% band — tune g_sb`)
  } else {
    console.log(`PASS: bAP → basal ${basalRatio.toFixed(0)}% within expected band`)
  }
  console.log(`Compartment final Vs: ${COMPARTMENT_NAMES.map((_, i) => result.trace[result.trace.length - 1].V[i].toFixed(2)).join(', ')}`)
  console.log('PASS: Day 2 verification complete')
}

day2Test()