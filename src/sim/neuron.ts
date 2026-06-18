/**
 * The 4-lumped CA1 pyramidal neuron.
 *
 *   soma (0)  ─── apicalTrunk (1)  ─── apicalTuft (2)
 *      │
 *      └─── basal (3)
 *
 * Each compartment runs Traub-Miles HH gating. Adjacent compartments are
 * coupled by lumped axial conductances. Synaptic currents are added per
 * compartment by the caller (see sim/synapse.ts).
 *
 *   step(dt, t, inputs)             — advance one Euler step
 *   runTrial(duration, dt, inputs)  — run a full trial, return trace
 *   voltageAt(compartment)          — read the current voltage
 *
 * State is mutated in place for speed. Call reset() between trials
 * (runTrial() does this automatically).
 */

import {
  SOMA_PARAMS,
  APICAL_TRUNK_PARAMS,
  APICAL_TUFT_PARAMS,
  BASAL_PARAMS,
  V_REST,
  initialHHState,
  stepHH,
  type HHParams,
  type HHState,
} from './hh'
import {
  DEFAULT_AXIAL,
  buildAdjacency,
  axialCurrentInto,
  type AxialCoupling,
} from './cable'
import {
  synapticCurrentWithV,
  DEFAULT_KINETICS,
  type SynapseEvent,
  type SynapseKinetics,
} from './synapse'

export const COMPARTMENT_NAMES = ['soma', 'apicalTrunk', 'apicalTuft', 'basal'] as const
export type CompartmentIndex = 0 | 1 | 2 | 3

export interface NeuronParams {
  hh: [HHParams, HHParams, HHParams, HHParams]
  axial: AxialCoupling
  /** Synapse kinetics (AMPA τ, NMDA τ1/τ2/A1, [Mg²⁺]). */
  kinetics: SynapseKinetics
}

export const DEFAULT_NEURON_PARAMS: NeuronParams = {
  hh: [SOMA_PARAMS, APICAL_TRUNK_PARAMS, APICAL_TUFT_PARAMS, BASAL_PARAMS],
  axial: DEFAULT_AXIAL,
  kinetics: DEFAULT_KINETICS,
}

/** A single time-step sample across all four compartments. */
export interface TraceSample {
  t: number
  V: [number, number, number, number]
}

/** Result of a runTrial() call. */
export interface TrialResult {
  /** Sample for each step, length = steps+1 (initial state included). */
  trace: TraceSample[]
  /** Total duration in ms. */
  duration: number
  /** Time step used, ms. */
  dt: number
  /** True if any compartment blew up. */
  blewUp: boolean
}

/**
 * Per-compartment input specification for one step. The `synapseEvents`
 * array lists all scheduled events on this compartment; the neuron sums
 * their V-dependent currents using the live voltage.
 */
export interface CompartmentInput {
  /** External current density (µA/cm^2), e.g. somatic injection. */
  I_ext: number
  /** Scheduled synapse events on this compartment. */
  synapseEvents: SynapseEvent[]
}

/** Returns per-compartment inputs at time t. */
export type ExternalInputsFn = (t: number) => [
  CompartmentInput,
  CompartmentInput,
  CompartmentInput,
  CompartmentInput,
]

export class Neuron {
  readonly params: NeuronParams
  readonly state: [HHState, HHState, HHState, HHState]
  private readonly adj: ReturnType<typeof buildAdjacency>
  private blewUp = false

  constructor(params: NeuronParams = DEFAULT_NEURON_PARAMS) {
    this.params = params
    this.state = [
      initialHHState(),
      initialHHState(),
      initialHHState(),
      initialHHState(),
    ]
    this.adj = buildAdjacency(params.axial)
  }

  reset(): void {
    for (const s of this.state) {
      const fresh = initialHHState()
      s.V = fresh.V
      s.m = fresh.m
      s.h = fresh.h
      s.n = fresh.n
    }
    this.blewUp = false
  }

  voltageAt(c: CompartmentIndex): number {
    return this.state[c].V
  }

  /** Run a trial. Returns the full voltage trace. */
  runTrial(durationMs: number, dt: number, inputs: ExternalInputsFn): TrialResult {
    this.reset()
    const steps = Math.round(durationMs / dt)
    const trace: TraceSample[] = []
    trace.push({
      t: 0,
      V: [this.state[0].V, this.state[1].V, this.state[2].V, this.state[3].V],
    })

    for (let i = 0; i < steps; i++) {
      const t = i * dt
      this.step(dt, t, inputs(t))
      trace.push({
        t: t + dt,
        V: [this.state[0].V, this.state[1].V, this.state[2].V, this.state[3].V],
      })
      if (this.blewUp) break
    }

    return {
      trace,
      duration: durationMs,
      dt,
      blewUp: this.blewUp,
    }
  }

  /** Advance one Euler step. */
  step(dt: number, t: number, inputs: [CompartmentInput, CompartmentInput, CompartmentInput, CompartmentInput]): void {
    // Snapshot voltages BEFORE stepping so axial currents use this step's V.
    const V: [number, number, number, number] = [
      this.state[0].V,
      this.state[1].V,
      this.state[2].V,
      this.state[3].V,
    ]

    for (let c = 0 as CompartmentIndex; c < 4; c = (c + 1) as CompartmentIndex) {
      const inp = inputs[c]
      // V-dependent synaptic current uses the pre-step V (semi-implicit in
      // the limit dt -> 0). Acceptable for dt = 0.01 ms.
      const syn = synapticCurrentWithV(t, V[c], inp.synapseEvents, this.params.kinetics)
      const I_axial = axialCurrentInto(c, V as unknown as number[], this.adj)
      const I_total = inp.I_ext + syn.I_AMPA + syn.I_NMDA + I_axial
      const ok = stepHH(this.state[c], this.params.hh[c], I_total, dt)
      if (!ok) {
        this.blewUp = true
        this.state[c].V = V_REST
      }
    }
  }

  /** Sanity check: are we approximately at rest across all compartments? */
  isAtRest(tol: number = 2): boolean {
    for (const s of this.state) {
      if (Math.abs(s.V - V_REST) > tol) return false
    }
    return true
  }
}