/**
 * Forward-Euler integrator for Hodgkin-Huxley state.
 *
 * dt = 0.01 ms is the workhorse step. We use it for both V and the three
 * gating variables (m, h, n). Stability margin is comfortable at this dt
 * for the Traub-Miles rate functions used here; the fastest gating time
 * constant near spike threshold is ~0.1 ms (m), so dt / tau_min ~= 0.1,
 * well inside the explicit-Euler stability bound dt < 2 * tau_min.
 *
 * If you want substepping for performance: keep gating at 0.025 ms and
 * substep V at 0.005 ms. For our 4-compartment model this is unnecessary.
 */

/** Maximum allowed |V| before we consider the integrator blown up. */
export const V_BLOWUP_MV = 100

export function isBlowup(V: number): boolean {
  // Catch NaN and ±Infinity explicitly: `Math.abs(NaN) === NaN`, and any
  // comparison with NaN is `false`, so the bare |V| > 100 test would let
  // NaN propagate silently through the rest of the trial. The sweep then
  // would emit a `paired = NaN` row and the verifier would observe a peak
  // ratio of NaN, which fails its `> 1.2` test — but the failure mode is
  // "no data" not "blown up", making the bug invisible from the report.
  return !Number.isFinite(V) || Math.abs(V) > V_BLOWUP_MV
}
