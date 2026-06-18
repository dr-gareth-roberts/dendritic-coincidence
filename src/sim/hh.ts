/**
 * Hodgkin-Huxley step (Traub-Miles variant) for a single compartment.
 *
 *   C dV/dt = -g_Na m^3 h (V - E_Na) - g_K n^4 (V - E_K) - g_L (V - E_L) + I_ext
 *   dm/dt = α_m(V)(1 - m) - β_m(V) m
 *   dh/dt = α_h(V)(1 - h) - β_h(V) h
 *   dn/dt = α_n(V)(1 - n) - β_n(V) n
 *
 * Units: V in mV, conductances in mS/cm^2, currents in µA/cm^2,
 * capacitance in µF/cm^2, time in ms. With these units the equation
 * is dimensionally consistent: (µA/cm^2) = (mS/cm^2) * mV.
 */

import {
  alphaM,
  alphaH,
  alphaN,
  betaM,
  betaH,
  betaN,
  steadyStateAndTau,
} from './gating'
import { isBlowup } from './integrator'

export interface HHParams {
  /** Max Na conductance, mS/cm^2 */
  g_Na: number
  /** Max K (delayed-rectifier) conductance, mS/cm^2 */
  g_K: number
  /** Leak conductance, mS/cm^2 */
  g_L: number
  /** Na reversal, mV */
  E_Na: number
  /** K reversal, mV */
  E_K: number
  /** Leak reversal, mV */
  E_L: number
  /** Membrane capacitance, µF/cm^2 */
  C_m: number
}

export const SOMA_PARAMS: HHParams = {
  g_Na: 40,
  g_K: 18,
  g_L: 0.2,
  E_Na: 55,
  E_K: -90,
  E_L: -65,
  C_m: 1.0,
}

export const APICAL_TRUNK_PARAMS: HHParams = {
  g_Na: 8,
  g_K: 6,
  g_L: 0.2,
  E_Na: 55,
  E_K: -90,
  E_L: -65,
  C_m: 1.0,
}

export const APICAL_TUFT_PARAMS: HHParams = {
  g_Na: 6,
  g_K: 6,
  g_L: 0.2,
  E_Na: 55,
  E_K: -90,
  E_L: -65,
  C_m: 1.0,
}

export const BASAL_PARAMS: HHParams = {
  g_Na: 8,
  g_K: 6,
  g_L: 0.2,
  E_Na: 55,
  E_K: -90,
  E_L: -65,
  C_m: 1.0,
}

/** Resting potential used as initial condition. */
export const V_REST = -65

export interface HHState {
  V: number
  m: number
  h: number
  n: number
}

export function initialHHState(V0: number = V_REST): HHState {
  const ss = steadyStateAndTau(V0)
  return {
    V: V0,
    m: ss.m.x,
    h: ss.h.x,
    n: ss.n.x,
  }
}

/**
 * One Forward-Euler step of the HH equations.
 * @param state  current state (mutated in place and returned for convenience)
 * @param params channel parameters
 * @param I_ext  externally-applied current density (µA/cm^2). Positive = inward.
 * @param dt     time step (ms)
 * @returns true if stable; false if V blew up (caller should reset).
 */
export function stepHH(
  state: HHState,
  params: HHParams,
  I_ext: number,
  dt: number
): boolean {
  const { V, m, h, n } = state

  const aM = alphaM(V)
  const bM = betaM(V)
  const aH = alphaH(V)
  const bH = betaH(V)
  const aN = alphaN(V)
  const bN = betaN(V)

  const I_Na = params.g_Na * m * m * m * h * (V - params.E_Na)
  const I_K = params.g_K * n * n * n * n * (V - params.E_K)
  const I_L = params.g_L * (V - params.E_L)

  const dV = (-I_Na - I_K - I_L + I_ext) / params.C_m
  const dm = aM * (1 - m) - bM * m
  const dh = aH * (1 - h) - bH * h
  const dn = aN * (1 - n) - bN * n

  state.V = V + dV * dt
  state.m = m + dm * dt
  state.h = h + dh * dt
  state.n = n + dn * dt

  if (isBlowup(state.V)) return false
  return true
}
