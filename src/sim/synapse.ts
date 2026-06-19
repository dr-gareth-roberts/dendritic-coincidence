/**
 * AMPA and NMDA synaptic conductances and currents.
 *
 * AMPA kinetics (Traynelis et al. 2010, Jonas & Spruston 1994):
 *   g_AMPA(t) = w_AMPA · exp(-t / τ_AMPA)        single exponential, τ = 2 ms
 *   I_AMPA    = g_AMPA(t) · (V - E_AMPA)          E_AMPA = 0 mV
 *
 * NMDA kinetics (Hestrin, Sah & Nicoll 1990; Jahr & Stevens 1990):
 *   g_NMDA(t) = w_NMDA · [A1·exp(-t/τ1) + A2·exp(-t/τ2)]
 *              τ1 = 50 ms (NR2A-fast), τ2 = 250 ms (NR2B-slow)
 *              A1/(A1+A2) = 0.4
 *   B(V)      = 1 / (1 + ([Mg²⁺]/3.57) · exp(-0.062 V))
 *              [Mg²⁺] = 1 mM, Jahr-Stevens fitted
 *   I_NMDA    = g_NMDA(t) · B(V) · (V - E_NMDA)   E_NMDA = 0 mV (modelling convention)
 *
 * The Mg²⁺ block is what makes NMDA voltage-dependent: at V_rest ≈ -65 mV
 * B(V) ≈ 0.04 (mostly blocked). At V ≈ -20 mV, B(V) ≈ 0.5. At V ≈ 0 mV,
 * B(V) ≈ 0.9. This nonlinear relief of Mg²⁺ block is the molecular basis
 * of dendritic coincidence detection.
 */

export const E_AMPA = 0
export const E_NMDA = 0

export const TAU_AMPA = 2.0 // ms
export const TAU_NMDA_1 = 50.0 // ms
export const TAU_NMDA_2 = 250.0 // ms
export const NMDA_A1_FRACTION = 0.4 // A1 / (A1 + A2)

export const MG_CONCENTRATION_MM = 1.0

/** Kinetic parameters that can be overridden by the leva Parameters panel. */
export interface SynapseKinetics {
  /** AMPA decay time constant (ms). */
  tauAMPA: number
  /** NMDA fast decay (ms). */
  tauNMDA1: number
  /** NMDA slow decay (ms). */
  tauNMDA2: number
  /** Fraction of NMDA in the fast component. */
  nmdaA1: number
  /** [Mg²⁺] (mM) for Jahr-Stevens block. */
  mgMM: number
}

export const DEFAULT_KINETICS: SynapseKinetics = {
  tauAMPA: TAU_AMPA,
  tauNMDA1: TAU_NMDA_1,
  tauNMDA2: TAU_NMDA_2,
  nmdaA1: NMDA_A1_FRACTION,
  mgMM: MG_CONCENTRATION_MM,
}

/** Jahr-Stevens 1990 Mg²⁺ block (V in mV). */
export function mgBlock(V: number, mgMM: number = MG_CONCENTRATION_MM): number {
  return 1 / (1 + (mgMM / 3.57) * Math.exp(-0.062 * V))
}

/** AMPA conductance at time t (ms) since spike (nS). */
export function ampaConductance(
  t: number,
  wAMPA: number = 1.0,
  tauAMPA: number = TAU_AMPA
): number {
  if (t < 0) return 0
  return wAMPA * Math.exp(-t / tauAMPA)
}

/** NMDA conductance at time t since spike (nS). */
export function nmdaConductance(
  t: number,
  wNMDA: number = 1.0,
  k: SynapseKinetics = DEFAULT_KINETICS
): number {
  if (t < 0) return 0
  const A1 = k.nmdaA1
  const A2 = 1 - k.nmdaA1
  return wNMDA * (A1 * Math.exp(-t / k.tauNMDA1) + A2 * Math.exp(-t / k.tauNMDA2))
}

/**
 * AMPA current (µA/cm^2) given voltage and conductance (nS).
 *
 * Convention used in this sim: positive current = inward = depolarising.
 * I = g * (E_rev - V). At V_rest = -65 with E_AMPA = 0: I = 65*g > 0 (inward). ✓
 *
 * Unit conversion: g (nS) × (E - V) (mV) = pA. 1 pA / (1e-4 cm²) = 1e-2 µA/cm².
 */
export function ampaCurrent(V: number, gNS: number): number {
  return (gNS * (E_AMPA - V)) * 1e-2
}

/** NMDA current (µA/cm^2) given voltage and conductance (nS). */
export function nmdaCurrent(V: number, gNS: number, mgMM: number = MG_CONCENTRATION_MM): number {
  return (gNS * mgBlock(V, mgMM) * (E_NMDA - V)) * 1e-2
}

/**
 * A scheduled synaptic event: at time `fireT` (ms), the synapse fires with
 * a given weight. The synapse keeps contributing current for many ms after
 * the spike (AMPA: ~10 ms, NMDA: ~300 ms).
 */
export interface SynapseEvent {
  fireT: number // ms, in trial time
  wAMPA: number // nS
  wNMDA: number // nS
}

export interface SynapseResult {
  /** AMPA current density at this compartment at time t (µA/cm^2). */
  I_AMPA: number
  /** NMDA current density at this compartment at time t (µA/cm^2). */
  I_NMDA: number
}

/**
 * Compute AMPA + NMDA current at time t given current voltage V. This is
 * the V-dependent version, used by the simulation step.
 *
 * Note: we recompute the conductance at this time from scratch from each
 * event's fireT. With a handful of events this is cheaper than maintaining
 * stateful ODEs.
 */
export function synapticCurrentWithV(
  t: number,
  V: number,
  events: SynapseEvent[],
  kinetics: SynapseKinetics = DEFAULT_KINETICS
): SynapseResult {
  let I_AMPA = 0
  let I_NMDA = 0
  for (const e of events) {
    const dt = t - e.fireT
    if (dt < 0) continue
    const gA = ampaConductance(dt, e.wAMPA, kinetics.tauAMPA)
    const gN = nmdaConductance(dt, e.wNMDA, kinetics)
    I_AMPA += ampaCurrent(V, gA)
    I_NMDA += nmdaCurrent(V, gN, kinetics.mgMM)
  }
  return { I_AMPA, I_NMDA }
}