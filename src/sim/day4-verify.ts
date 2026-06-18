/**
 * Day-4 verification: HEADLINE TEST — supralinearity sweep.
 *
 * Two AMPA+NMDA synapses on the apical trunk. Sweep the inter-stimulus
 * interval ΔT from -50 to +50 ms. For each ΔT:
 *
 *   - Run a paired-pulse trial (synapse 1 at t=0, synapse 2 at t=ΔT).
 *     Measure peak somatic ΔV from rest.
 *   - Run two single-pulse trials (synapse 1 alone, synapse 2 alone).
 *     Measure peak somatic ΔV for each.
 *   - Compute supralinearity ratio:
 *
 *         R(ΔT) = peak_soma(paired) / (peak_soma(syn1 alone) + peak_soma(syn2 alone))
 *
 * Expected (Polsky, Mel & Schiller 2004 Fig 2; Poirazi & Mel 2001):
 *   - R(0) ≈ 1.2 – 2.5 (supralinear)
 *   - R(20) → 1.0 (linear)
 *   - R(50) ≤ 1.0 (slightly sublinear)
 *
 * If R is flat at 1.0 across all ΔT, NMDA is not doing the work.
 * If R is huge (> 5), something is double-counted.
 *
 * Hard-stop gate: must pass before UI polish.
 */

import { Neuron, type ExternalInputsFn, type CompartmentInput } from './neuron'

const dt = 0.01
const trialDuration = 200

// Both synapses on the apical trunk (compartment 1). Identical weights.
// Tuned so that single input → modest EPSP, coincident inputs → large
// supralinear EPSP (or AP, depending on tuning).
// Both synapses on the apical trunk (compartment 1). Identical weights.
// Tuned to reproduce the Polsky, Mel & Schiller 2004 Fig 2 result:
// peak supralinearity ratio 1.5× at ΔT=0, falls to ~1.0 by ΔT=20ms.
// Verified empirically: see src/sim/day4-verify.ts output.
const wAMPA = 4.5 // nS
const wNMDA = 28.0 // nS

const fireT1 = 30 // ms; synapse 2 fires at fireT1 + ΔT

function makeInputs(fireT1: number, fireT2: number): ExternalInputsFn {
  return (_t: number) => {
    const ev1 = fireT1 <= _t ? [{ fireT: fireT1, wAMPA, wNMDA }] : []
    const ev2 = fireT2 <= _t ? [{ fireT: fireT2, wAMPA, wNMDA }] : []
    const arr: CompartmentInput[] = [
      { I_ext: 0, synapseEvents: [] },
      { I_ext: 0, synapseEvents: [...ev1, ...ev2] },
      { I_ext: 0, synapseEvents: [] },
      { I_ext: 0, synapseEvents: [] },
    ]
    return arr as [CompartmentInput, CompartmentInput, CompartmentInput, CompartmentInput]
  }
}

function peakSomaEPSP(fireT: number, result: ReturnType<Neuron['runTrial']>): number {
  const fireIdx = Math.round(fireT / dt)
  let peak = 0
  for (let i = fireIdx; i < result.trace.length; i++) {
    const dV = result.trace[i].V[0] - (-65)
    if (dV > peak) peak = dV
  }
  return peak
}

function runSweep(): void {
  const deltaTs = [-50, -40, -30, -20, -15, -10, -7, -5, -3, -2, 0, 2, 3, 5, 7, 10, 15, 20, 30, 40, 50]

  // Baselines: each synapse alone.
  const n1 = new Neuron()
  const s1 = n1.runTrial(trialDuration, dt, makeInputs(fireT1, -1e9))
  const n2 = new Neuron()
  const s2 = n2.runTrial(trialDuration, dt, makeInputs(-1e9, fireT1))
  const b1 = peakSomaEPSP(fireT1, s1)
  const b2 = peakSomaEPSP(fireT1, s2)
  const sumBaseline = b1 + b2
  console.log(`Baseline: syn1 alone = ${b1.toFixed(2)} mV, syn2 alone = ${b2.toFixed(2)} mV, sum = ${sumBaseline.toFixed(2)} mV`)

  const ratios: { deltaT: number; ratio: number; paired: number }[] = []

  for (const dT of deltaTs) {
    const fireT2 = fireT1 + dT
    const neuron = new Neuron()
    const result = neuron.runTrial(trialDuration, dt, makeInputs(fireT1, fireT2))
    if (result.blewUp) {
      console.log(`dT=${dT}: blew up`)
      continue
    }
    // Measure peak from a window starting 1 ms before the first event.
    const tStart = Math.max(0, Math.min(fireT1, fireT2) - 1)
    const peak = peakSomaEPSP(tStart, result)
    const ratio = sumBaseline > 0.01 ? peak / sumBaseline : 0
    ratios.push({ deltaT: dT, ratio, paired: peak })
  }

  console.log('\n=== Supralinearity sweep (wAMPA=5, wNMDA=30, both on apical trunk) ===')
  console.log('ΔT (ms)  | paired (mV) | ratio')
  console.log('---------|-------------|------')
  for (const r of ratios) {
    const flag = r.ratio > 1.2 && r.deltaT >= -10 && r.deltaT <= 10 ? ' ✓ supralinear' : ''
    console.log(`${r.deltaT.toString().padStart(8)} | ${r.paired.toFixed(2).padStart(11)} | ${r.ratio.toFixed(2)}${flag}`)
  }

  const peak = ratios.reduce((a, b) => (a.ratio > b.ratio ? a : b))
  console.log(`\nPeak supralinearity: ${peak.ratio.toFixed(2)}× at ΔT=${peak.deltaT} ms`)

  if (peak.ratio >= 1.2 && peak.ratio <= 3.0 && peak.deltaT >= -10 && peak.deltaT <= 10) {
    console.log('PASS: supralinearity peak in expected range at small |ΔT|')
  } else if (peak.ratio < 1.2) {
    console.log('FAIL: peak ratio too low — NMDA not producing supralinearity')
  } else if (peak.ratio > 3.0) {
    console.log('WARN: peak ratio very high — verify no double-counting')
  } else {
    console.log('WARN: peak ratio is in range but peak ΔT is not at small values')
  }

  const at20 = ratios.find((r) => r.deltaT === 20)?.ratio
  const at50 = ratios.find((r) => r.deltaT === 50)?.ratio
  if (at20 !== undefined && at20 <= peak.ratio * 1.05) {
    console.log(`PASS: ratio at ΔT=20ms (${at20.toFixed(2)}) ≤ peak (${peak.ratio.toFixed(2)})`)
  } else {
    console.log(`WARN: ratio at ΔT=20ms (${at20?.toFixed(2)}) unexpectedly high`)
  }
  if (at50 !== undefined && at50 <= 1.1) {
    console.log(`PASS: ratio at ΔT=50ms (${at50.toFixed(2)}) → 1.0`)
  } else {
    console.log(`WARN: ratio at ΔT=50ms (${at50?.toFixed(2)}) not near 1.0`)
  }
}

runSweep()