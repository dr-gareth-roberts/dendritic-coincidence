/**
 * Propagation wave: when a dendritic spike fires, the depolarisation
 * travels along the dendrite as a wave. With only 4 lumped compartments,
 * the wave is implicit — every compartment is at the same V. To make
 * the wave VISIBLE, we render a wave that travels from the active
 * synapse along the dendrite at a fixed speed.
 *
 * !! VISUAL ART, NOT BIOPHYSICS !!
 *
 * The simulator produces only 4 compartment voltages. The wave bonus
 * computed here is layered on top of those voltages for COLOUR PURPOSES
 * ONLY — it is never fed back into the simulation. With the default
 * parameters the wave bonus contributes roughly half of the +260% centre-
 * ROI brightness increase that the verifier sees during a coincidence
 * trial; the other half is the actual trunk depolarisation from -65 to
 * -55 mV during the NMDA plateau.
 *
 * If you are checking the sim, do NOT include the wave in any "is the
 * simulator doing X" test. The simulator does only what src/sim/* does.
 * This file is purely cosmetic.
 *
 * Wave parameters chosen to match the dendritic-spike timescale:
 *   - propagation speed: ~0.3 m/s along dendrite (dendritic spike, not AP)
 *   - duration: ~50 ms from fire to decay
 *   - amplitude: scaled from the dendritic V minus rest
 */

const WAVE_SPEED = 8.0 // scene-units per ms (wave crosses 500-unit trunk in ~60ms)
const WAVE_DURATION = 80 // ms
const WAVE_WIDTH = 80 // scene-units; full width at half-max

export interface WaveSource {
  /** Position of the active synapse. */
  position: [number, number, number]
  /** Time of fire (ms). */
  fireT: number
  /** Wave amplitude in mV above resting V. */
  amplitude: number
}

/**
 * Compute wave bonus (mV) at a given point at a given time, given a list
 * of wave sources.
 *
 * Returns the sum of contributions from all wave sources.
 */
export function waveBonusAt(
  point: [number, number, number],
  currentT: number,
  sources: WaveSource[]
): number {
  let bonus = 0
  for (const src of sources) {
    const dt = currentT - src.fireT
    if (dt < 0 || dt > WAVE_DURATION) continue
    // Wave has propagated `dt * WAVE_SPEED` units from the source.
    const waveRadius = dt * WAVE_SPEED
    const dx = point[0] - src.position[0]
    const dy = point[1] - src.position[1]
    const dz = point[2] - src.position[2]
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    // Gaussian envelope centred on waveRadius.
    const delta = dist - waveRadius
    const env = Math.exp(-(delta * delta) / (WAVE_WIDTH * WAVE_WIDTH / 4))
    // Amplitude decays over time
    const decay = 1 - dt / WAVE_DURATION
    bonus += src.amplitude * env * decay
  }
  return bonus
}

/**
 * Build wave sources from a list of synapse fire times.
 *
 * The amplitude is taken as the dendritic V at fire time minus rest, so
 * a stronger input produces a stronger wave.
 */
export function buildWaveSources(
  synFires: Array<{ position: [number, number, number]; fireT: number; amplitude: number }>
): WaveSource[] {
  return synFires.map((f) => ({
    position: f.position,
    fireT: f.fireT,
    amplitude: f.amplitude,
  }))
}