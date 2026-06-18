/**
 * Lumped axial coupling between adjacent compartments.
 *
 * For two adjacent compartments i and j, the axial current flowing from
 * j into i is
 *
 *     I_axial(i ← j) = g_ij (V_j - V_i)
 *
 * where g_ij is in mS/cm^2 and V in mV, giving I in µA/cm^2.
 *
 * We lump the cable equation: each compartment is a single isopotential
 * node, and the axial conductance g_ij is a free parameter tuned so that
 * the model reproduces two observed features:
 *
 *   1. A somatic AP backpropagates to the apical tuft at ~30–60% amplitude.
 *   2. A distal dendritic EPSP arrives at the soma at ~20–50% amplitude.
 *
 * In a full compartmental model these would be derived from morphology
 * (Rall 1969, Stuart & Spruston 1998). Here they're tunable.
 *
 * Adjacency graph (4-lumped CA1 pyramid):
 *
 *     apical tuft  ── g_at ──  apical trunk  ── g_st ──  soma  ── g_sb ──  basal
 *
 * 3 pairs: soma↔apicalTrunk, apicalTrunk↔apicalTuft, soma↔basal.
 */

export interface AxialCoupling {
  /** Soma ↔ apical trunk, mS/cm^2 */
  g_st: number
  /** Apical trunk ↔ apical tuft, mS/cm^2 */
  g_at: number
  /** Soma ↔ basal, mS/cm^2 */
  g_sb: number
}

/**
 * Starting values tuned to balance two competing goals:
 *   1. Allow bAP to propagate from soma to apical tuft (target: 30–60% amplitude).
 *   2. Allow dendritic inputs to produce local depolarisation without being
 *      voltage-clamped to the resting soma.
 *
 * Final values are empirical; see src/sim/day2-verify.ts and day3-verify.ts.
 */
export const DEFAULT_AXIAL: AxialCoupling = {
  g_st: 0.25, // soma ↔ apical trunk
  g_at: 0.2, // apical trunk ↔ apical tuft
  g_sb: 0.25, // soma ↔ basal
}

/** Voltage contribution to dV_i/dt from axial currents, in (µA/cm^2) / (µF/cm^2) = mV/ms. */
export interface AxialAdjacency {
  /** Compartment index, this compartment. */
  self: number
  /** Compartment index, the neighbour. */
  other: number
  /** Conductance g_ij, mS/cm^2. */
  g: number
}

/** Build adjacency list for the 4-compartment topology. */
export function buildAdjacency(c: AxialCoupling): AxialAdjacency[] {
  // Indices: 0=soma, 1=apicalTrunk, 2=apicalTuft, 3=basal
  return [
    { self: 0, other: 1, g: c.g_st },
    { self: 1, other: 0, g: c.g_st },
    { self: 1, other: 2, g: c.g_at },
    { self: 2, other: 1, g: c.g_at },
    { self: 0, other: 3, g: c.g_sb },
    { self: 3, other: 0, g: c.g_sb },
  ]
}

/**
 * Compute the axial current density flowing INTO compartment i from all
 * neighbours, given the voltage vector and an adjacency list.
 *
 * @param i     compartment index
 * @param V     voltage vector (length = number of compartments)
 * @param adj   adjacency list from buildAdjacency()
 * @returns     current density in µA/cm^2 (positive = inward)
 */
export function axialCurrentInto(i: number, V: number[], adj: AxialAdjacency[]): number {
  let I = 0
  for (const edge of adj) {
    if (edge.self === i) {
      I += edge.g * (V[edge.other] - V[i])
    }
  }
  return I
}