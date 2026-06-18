/**
 * Procedural morphology of the CA1 pyramidal neuron.
 *
 * A real CA1 pyramidal has:
 *   - Soma (~20 µm diameter)
 *   - Single apical trunk (~500 µm, 2-3 µm diameter) ascending to a tuft
 *   - Apical tuft: 3-5 oblique branches at the top, each ~100-150 µm long
 *   - Basal dendrites: 2-4 branches descending from the soma, ~150-200 µm
 *
 * We lump to 4 compartments (soma, apical trunk, apical tuft, basal) but
 * RENDER each compartment as a branching silhouette. The simulation runs
 * on the lumped compartments; the rendering interpolates V along the
 * branches based on distance from the active synapse (see PropagationField).
 */

export interface Branch {
  /** Start point, in scene units. */
  start: [number, number, number]
  /** End point, in scene units. */
  end: [number, number, number]
  /** Diameter at start, in scene units. */
  diameterStart: number
  /** Diameter at end, in scene units. */
  diameterEnd: number
  /** Compartment this branch belongs to (0=soma, 1=apicalTrunk, 2=apicalTuft, 3=basal). */
  compartment: 0 | 1 | 2 | 3
  /** Distance from soma, normalised 0..1 along its compartment's main axis. */
  tAlong: number
}

/** µm → scene units. 1 µm = 1 unit (so a 500 µm trunk is 500 units).
 *  The wave geometry in propagation.ts is in the same scene units, so
 *  WAVE_SPEED and WAVE_WIDTH are automatically consistent.
 */
export const UM_TO_UNITS = 1.0

const SOMA_DIAM = 20 * UM_TO_UNITS // 20 units (soma visible from far)
const TRUNK_LENGTH = 500 * UM_TO_UNITS // 500 units
const TRUNK_DIAM = 8 * UM_TO_UNITS // 8 units — readable from camera distance
const TUFT_BRANCH_LENGTH = 130 * UM_TO_UNITS // 130 units
const TUFT_BRANCH_DIAM = 4 * UM_TO_UNITS // 4 units
const BASAL_BRANCH_LENGTH = 180 * UM_TO_UNITS // 180 units
const BASAL_BRANCH_DIAM = 4.5 * UM_TO_UNITS // 4.5 units

const SOMA_Y = 0
const TRUNK_BASE_Y = SOMA_Y + SOMA_DIAM / 2
const TRUNK_TOP_Y = TRUNK_BASE_Y + TRUNK_LENGTH

/** Build the full list of branches. */
export function buildBranches(): Branch[] {
  const branches: Branch[] = []

  // Apical trunk — single tapered cylinder
  branches.push({
    start: [0, TRUNK_BASE_Y, 0],
    end: [0, TRUNK_TOP_Y, 0],
    diameterStart: TRUNK_DIAM * 1.4,
    diameterEnd: TRUNK_DIAM * 0.6,
    compartment: 1,
    tAlong: 1.0,
  })

  // Apical tuft — 5 oblique branches at the top
  const tuftBaseY = TRUNK_TOP_Y
  const tuftAngles = [-0.7, -0.35, 0, 0.35, 0.7]
  for (let i = 0; i < tuftAngles.length; i++) {
    const angle = tuftAngles[i]
    const xEnd = Math.sin(angle) * TUFT_BRANCH_LENGTH
    const yEnd = tuftBaseY + Math.cos(angle) * TUFT_BRANCH_LENGTH * 0.7
    const zEnd = Math.sin(i * 1.7) * TUFT_BRANCH_LENGTH * 0.25 // slight depth variation
    branches.push({
      start: [0, tuftBaseY, 0],
      end: [xEnd, yEnd, zEnd],
      diameterStart: TUFT_BRANCH_DIAM * 1.6,
      diameterEnd: TUFT_BRANCH_DIAM * 0.5,
      compartment: 2,
      tAlong: i / (tuftAngles.length - 1),
    })
  }

  // Basal dendrites — 3 branches descending from soma
  const basalAngles = [-0.6, 0, 0.6]
  for (let i = 0; i < basalAngles.length; i++) {
    const angle = basalAngles[i]
    const xEnd = Math.sin(angle) * BASAL_BRANCH_LENGTH
    const yEnd = SOMA_Y - Math.cos(angle) * BASAL_BRANCH_LENGTH * 0.6
    const zEnd = Math.sin(i * 2.1 + 0.5) * BASAL_BRANCH_LENGTH * 0.2
    branches.push({
      start: [0, SOMA_Y - SOMA_DIAM / 2 + 2, 0],
      end: [xEnd, yEnd, zEnd],
      diameterStart: BASAL_BRANCH_DIAM * 1.4,
      diameterEnd: BASAL_BRANCH_DIAM * 0.4,
      compartment: 3,
      tAlong: i / (basalAngles.length - 1),
    })
  }

  return branches
}

/** Soma centre. */
export const SOMA_CENTRE: [number, number, number] = [0, SOMA_Y, 0]
export const SOMA_RADIUS = SOMA_DIAM / 2

/** Synapse 1: proximal apical trunk (40% up from soma). */
export function synapse1Position(): [number, number, number] {
  return [0, TRUNK_BASE_Y + TRUNK_LENGTH * 0.4, 0]
}

/** Synapse 2: distal apical trunk (75% up from soma). */
export function synapse2Position(): [number, number, number] {
  return [0, TRUNK_BASE_Y + TRUNK_LENGTH * 0.75, 0]
}

/**
 * Distance from a point (e.g. a synapse) to a branch midpoint, in scene units.
 */
export function distanceToBranch(
  point: [number, number, number],
  branch: Branch
): number {
  const mx = (branch.start[0] + branch.end[0]) / 2
  const my = (branch.start[1] + branch.end[1]) / 2
  const mz = (branch.start[2] + branch.end[2]) / 2
  const dx = point[0] - mx
  const dy = point[1] - my
  const dz = point[2] - mz
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/** Distance from soma centre to a point. */
export function distanceFromSoma(point: [number, number, number]): number {
  const dx = point[0] - SOMA_CENTRE[0]
  const dy = point[1] - SOMA_CENTRE[1]
  const dz = point[2] - SOMA_CENTRE[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}
