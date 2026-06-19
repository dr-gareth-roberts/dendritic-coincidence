/**
 * App-wide zustand store.
 *
 * Holds:
 *   - sim parameters (synapse weights, ΔT, modes)
 *   - the last trial result (full voltage trace)
 *   - the last sweep result
 *   - playback state (playhead time, isPlaying, speed) for time-scrubbing
 *     the trial through the 3D scene
 *   - synapse fire times (syn1FireT, syn2FireT) for visualisation
 *   - leva-controlled overrides for HH params per compartment, axial params,
 *     and synapse kinetics. Applied when re-running a trial.
 */

import { create } from 'zustand'
import {
  Neuron,
  DEFAULT_NEURON_PARAMS,
  type TrialResult,
} from '../sim/neuron'
import type { SynapseEvent } from '../sim/synapse'
import type { SynapseMode } from '../components/SynapseHandle'
import { SOMA_PARAMS, APICAL_TRUNK_PARAMS, APICAL_TUFT_PARAMS, BASAL_PARAMS, type HHParams } from '../sim/hh'
import { DEFAULT_AXIAL, type AxialCoupling } from '../sim/cable'
import { DEFAULT_KINETICS, type SynapseKinetics } from '../sim/synapse'

export interface SweepPoint {
  deltaT: number
  ratio: number
  paired: number
}

export interface SimParams {
  wAMPA: number
  wNMDA: number
  fireT1: number
  deltaT: number // ms; relative timing of synapse 2
  trialDuration: number // ms
  syn1Mode: SynapseMode
  syn2Mode: SynapseMode
}

/**
 * Per-compartment HH overrides that the leva Parameters panel can change.
 * `null` means "use the sim default" — that's what makes a single `null`
 * safe to ship in the default state without overriding anything.
 */
export interface HHOverrides {
  soma: HHParams | null
  apicalTrunk: HHParams | null
  apicalTuft: HHParams | null
  basal: HHParams | null
}

export interface ParamOverrides {
  hh: HHOverrides
  axial: AxialCoupling
  kinetics: SynapseKinetics
}

// Tuned so that two coincident NMDA synapses on the apical trunk fire a
// somatic AP via the dendritic coincidence-detection mechanism (NMDA plateau
// → strong axial drive → soma fires). Off-coincidence: sublinear, no AP.
//
// Polsky 2004 Fig 2 reproduction: peak ratio is large at small |ΔT|
// (the AP is all-or-nothing, so the ratio looks bigger than 1.5×; the
// important qualitative claim is that coincidence → AP, non-coincidence
// → no AP). The NMDA τ₂ is set short enough (80ms) that 30ms offset
// already gives linear summation rather than sustained supralinearity.
export const DEFAULT_PARAMS: SimParams = {
  wAMPA: 6.0,
  wNMDA: 30,
  fireT1: 30,
  deltaT: 0,
  trialDuration: 300,
  syn1Mode: 'both',
  syn2Mode: 'both',
}

export const DEFAULT_OVERRIDES: ParamOverrides = {
  hh: {
    soma: null,
    apicalTrunk: null,
    apicalTuft: null,
    basal: null,
  },
  axial: { ...DEFAULT_AXIAL },
  kinetics: {
    ...DEFAULT_KINETICS,
    tauNMDA2: 100, // shortened from 250ms so the coincidence window is biologically realistic
  },
}

export interface AppState {
  params: SimParams
  overrides: ParamOverrides
  lastTrial: TrialResult | null
  sweep: SweepPoint[] | null
  sweepLoading: boolean
  /** Monotonic counter incremented on every runSweep call. Used to drop
   *  results from a superseded sweep (user double-clicked Sweep, or
   *  params changed mid-sweep). */
  sweepGeneration: number
  /** Count of sweep points where the integrator blew up. The verifier
   *  fails if this is > 0. */
  sweepBlowups: number
  /** Playhead time (ms) for the last trial — driven by the playback hook. */
  playhead: number
  /** Fire time of synapse 1 in the last trial (ms). Null if syn1Mode === 'off'. */
  syn1FireT: number | null
  /** Fire time of synapse 2 in the last trial (ms). Null if syn2Mode === 'off'. */
  syn2FireT: number | null

  setParam: <K extends keyof SimParams>(key: K, value: SimParams[K]) => void
  setOverrideHH: (compartment: keyof HHOverrides, params: HHParams | null) => void
  setOverrideAxial: (key: keyof AxialCoupling, value: number) => void
  setOverrideKinetics: (key: keyof SynapseKinetics, value: number) => void
  resetOverrides: () => void
  runTrial: () => void
  runSweep: () => void
  setPlayhead: (t: number) => void
  cycleSynapse1: () => void
  cycleSynapse2: () => void
}

function makeInputs(params: SimParams, currentFireT1: number, currentFireT2: number) {
  return (): [
    { I_ext: number; synapseEvents: SynapseEvent[] },
    { I_ext: number; synapseEvents: SynapseEvent[] },
    { I_ext: number; synapseEvents: SynapseEvent[] },
    { I_ext: number; synapseEvents: SynapseEvent[] },
  ] => {
    const ev1 =
      currentFireT1 >= 0 && params.syn1Mode !== 'off'
        ? [
            {
              fireT: currentFireT1,
              wAMPA: params.syn1Mode === 'ampa' || params.syn1Mode === 'both' ? params.wAMPA : 0,
              wNMDA: params.syn1Mode === 'nmda' || params.syn1Mode === 'both' ? params.wNMDA : 0,
            },
          ]
        : []
    const ev2 =
      currentFireT2 >= 0 && params.syn2Mode !== 'off'
        ? [
            {
              fireT: currentFireT2,
              wAMPA: params.syn2Mode === 'ampa' || params.syn2Mode === 'both' ? params.wAMPA : 0,
              wNMDA: params.syn2Mode === 'nmda' || params.syn2Mode === 'both' ? params.wNMDA : 0,
            },
          ]
        : []
    return [
      { I_ext: 0, synapseEvents: [] },
      { I_ext: 0, synapseEvents: [...ev1, ...ev2] },
      { I_ext: 0, synapseEvents: [] },
      { I_ext: 0, synapseEvents: [] },
    ]
  }
}

/** Build a NeuronParams from the sim defaults + any leva-driven overrides. */
function buildNeuronParams(overrides: ParamOverrides) {
  const hh: [HHParams, HHParams, HHParams, HHParams] = [
    overrides.hh.soma ?? SOMA_PARAMS,
    overrides.hh.apicalTrunk ?? APICAL_TRUNK_PARAMS,
    overrides.hh.apicalTuft ?? APICAL_TUFT_PARAMS,
    overrides.hh.basal ?? BASAL_PARAMS,
  ]
  return {
    ...DEFAULT_NEURON_PARAMS,
    hh,
    axial: { ...overrides.axial },
    kinetics: { ...overrides.kinetics },
  }
}

function peakEPSP(result: TrialResult, fireT: number): number {
  if (fireT < 0) return 0
  const dt = 0.01
  const fireIdx = Math.max(0, Math.round((fireT - 1) / dt))
  let peak = 0
  for (let i = fireIdx; i < result.trace.length; i++) {
    const dV = result.trace[i].V[0] - (-65)
    if (dV > peak) peak = dV
  }
  return peak
}

const NEXT_MODE: Record<SynapseMode, SynapseMode> = {
  off: 'ampa',
  ampa: 'nmda',
  nmda: 'both',
  both: 'off',
}

export const useAppStore = create<AppState>((set, get) => ({
  params: DEFAULT_PARAMS,
  overrides: DEFAULT_OVERRIDES,
  lastTrial: null,
  sweep: null,
  sweepLoading: false,
  sweepGeneration: 0,
  sweepBlowups: 0,
  playhead: 0,
  syn1FireT: null,
  syn2FireT: null,

  setParam: (key, value) =>
    set((s) => ({ params: { ...s.params, [key]: value } })),

  setOverrideHH: (compartment, params) =>
    set((s) => ({
      overrides: {
        ...s.overrides,
        hh: { ...s.overrides.hh, [compartment]: params },
      },
    })),

  setOverrideAxial: (key, value) =>
    set((s) => ({
      overrides: {
        ...s.overrides,
        axial: { ...s.overrides.axial, [key]: value },
      },
    })),

  setOverrideKinetics: (key, value) =>
    set((s) => ({
      overrides: {
        ...s.overrides,
        kinetics: { ...s.overrides.kinetics, [key]: value },
      },
    })),

  resetOverrides: () => set({ overrides: DEFAULT_OVERRIDES }),

  runTrial: () => {
    const { params, overrides } = get()
    const fireT2 = params.fireT1 + params.deltaT
    const neuron = new Neuron(buildNeuronParams(overrides))
    const inputs = makeInputs(params, params.fireT1, fireT2)
    const result = neuron.runTrial(params.trialDuration, 0.01, inputs)
    set({
      lastTrial: result,
      playhead: 0,
      syn1FireT: params.syn1Mode !== 'off' ? params.fireT1 : null,
      syn2FireT: params.syn2Mode !== 'off' ? fireT2 : null,
    })
  },

  runSweep: () => {
    // Generation counter: if the user fires a second sweep while the first
    // is in flight (or changes params mid-sweep), only the latest call's
    // result is allowed to update store state. Without this, a fast double
    // click on Sweep could overwrite a valid result with one based on
    // already-stale params.
    const myGen = (get().sweepGeneration ?? 0) + 1
    set({ sweepLoading: true, sweepGeneration: myGen })
    setTimeout(() => {
      if (get().sweepGeneration !== myGen) return // superseded
      const { params, overrides } = get()
      const dt = 0.01
      const deltaTs = [-50, -40, -30, -20, -15, -10, -7, -5, -3, -2, 0, 2, 3, 5, 7, 10, 15, 20, 30, 40, 50]
      const sweep: SweepPoint[] = []
      let blowupCount = 0

      // Baselines
      const syn1 = new Neuron(buildNeuronParams(overrides))
      const s1 = syn1.runTrial(params.trialDuration, dt, makeInputs({ ...params, syn2Mode: 'off' }, params.fireT1, -1))
      const syn2 = new Neuron(buildNeuronParams(overrides))
      const s2 = syn2.runTrial(params.trialDuration, dt, makeInputs({ ...params, syn1Mode: 'off' }, -1, params.fireT1))
      const sumBaseline = peakEPSP(s1, params.fireT1) + peakEPSP(s2, params.fireT1)
      for (const dT of deltaTs) {
        if (get().sweepGeneration !== myGen) return // superseded mid-loop
        const fireT2 = params.fireT1 + dT
        const n = new Neuron(buildNeuronParams(overrides))
        const r = n.runTrial(params.trialDuration, dt, makeInputs(params, params.fireT1, fireT2))
        if (r.blewUp) {
          // Track blowups explicitly (ratio = NaN) instead of silently
          // dropping the point. The verifier now fails if any point is
          // missing or has a non-finite ratio.
          blowupCount++
          sweep.push({ deltaT: dT, ratio: Number.NaN, paired: Number.NaN })
          continue
        }
        const peak = peakEPSP(r, Math.min(params.fireT1, fireT2))
        // Guard: only meaningful if the baseline is non-trivial. With
        // AMPA-only or with very small weights, sumBaseline may be ~0 and
        // the ratio is meaningless (or 0/0 = NaN). Mark such sweeps as
        // ratio = 0 so the verifier can flag it.
        const ratio =
          sumBaseline > 0.01 && Number.isFinite(peak) ? peak / sumBaseline : 0
        sweep.push({ deltaT: dT, ratio, paired: peak })
      }

      if (get().sweepGeneration !== myGen) return // superseded
      set({ sweep, sweepLoading: false, sweepBlowups: blowupCount })
    }, 50)
  },

  setPlayhead: (t) => {
    const { lastTrial } = get()
    const clamped = Math.max(0, Math.min(lastTrial?.duration ?? 0, t))
    set({ playhead: clamped })
  },

  cycleSynapse1: () => {
    set((s) => ({ params: { ...s.params, syn1Mode: NEXT_MODE[s.params.syn1Mode] } }))
  },

  cycleSynapse2: () => {
    set((s) => ({ params: { ...s.params, syn2Mode: NEXT_MODE[s.params.syn2Mode] } }))
  },
}))
