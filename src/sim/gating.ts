/**
 * Traub-Miles rate functions for the Hodgkin-Huxley family.
 *
 * Reference: Traub & Miles 1991, "Neuronal Networks of the Hippocampus"
 * (Cambridge UP), used by Poirazi & Mel 2001 (ModelDB #50897).
 *
 * V is in mV. Rates are in 1/ms.
 *
 * Gates (m, h, n) are first-order kinetic variables evolving as
 *   dx/dt = α_x(V) (1 - x) - β_x(V) x
 */

const exp = Math.exp

export function alphaM(V: number): number {
  return (0.32 * (V + 54)) / (1 - exp(-(V + 54) / 4))
}

export function betaM(V: number): number {
  return (0.28 * (V + 27)) / (exp((V + 27) / 5) - 1)
}

export function alphaH(V: number): number {
  return 0.128 * exp(-(V + 50) / 18)
}

export function betaH(V: number): number {
  return 4 / (1 + exp(-(V + 27) / 5))
}

export function alphaN(V: number): number {
  return (0.032 * (V + 52)) / (1 - exp(-(V + 52) / 5))
}

export function betaN(V: number): number {
  return 0.5 * exp(-(V + 57) / 40)
}

/**
 * Steady-state x_inf(V) and time constant tau_x(V) for each gate.
 * Useful for initial conditions and debugging.
 */
export function steadyStateAndTau(
  V: number
): { m: { x: number; tau: number }; h: { x: number; tau: number }; n: { x: number; tau: number } } {
  const aM = alphaM(V)
  const bM = betaM(V)
  const aH = alphaH(V)
  const bH = betaH(V)
  const aN = alphaN(V)
  const bN = betaN(V)
  return {
    m: { x: aM / (aM + bM), tau: 1 / (aM + bM) },
    h: { x: aH / (aH + bH), tau: 1 / (aH + bH) },
    n: { x: aN / (aN + bN), tau: 1 / (aN + bN) },
  }
}
