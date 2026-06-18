/**
 * Voltage → light (color + emissive intensity) mapping.
 *
 * The whole point of the scene is that voltage changes should look like
 * LIGHT, not paint. At rest the neuron is dim navy. At AP peak it is
 * pure white-hot with enough emissive to push past the bloom threshold.
 *
 * Six stops: rest → mild → moderate → high → spike approaching → AP peak.
 *
 * IMPORTANT: the emissive numbers are tuned so that:
 *  - At rest (V=-65) emissiveIntensity is well below the bloom luminance
 *    threshold, so the resting neuron is dim.
 *  - At AP peak (V=+40) emissiveIntensity is large enough to push the
 *    rendered pixel luminance past the bloom threshold (0.85) so the bloom
 *    pass kicks in hard.
 *
 * To make this work, the material's `toneMapped` flag is FALSE — this lets
 * the emissive contribution blow past 1.0 in the framebuffer so the bloom
 * pass actually sees something above threshold. The tone-mapped post-pass
 * (ToneMapping in EffectComposer) is omitted entirely.
 */

const STOPS: Array<{ V: number; rgb: [number, number, number]; emissive: number }> = [
  { V: -65, rgb: [40, 70, 130], emissive: 0.1 },   // rest: deep navy, below bloom threshold
  { V: -55, rgb: [70, 130, 210], emissive: 0.5 },  // mild depolarisation, into bloom
  { V: -40, rgb: [120, 200, 240], emissive: 1.2 }, // moderate: cyan, well into bloom
  { V: -20, rgb: [255, 220, 100], emissive: 2.5 }, // high: yellow, heavy bloom
  { V: 0, rgb: [255, 150, 60], emissive: 4.0 },    // near spike: orange
  { V: 20, rgb: [255, 220, 200], emissive: 6.0 },  // hot: warm white
  { V: 40, rgb: [255, 255, 255], emissive: 10.0 }, // AP peak: pure white, full bloom
]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

export interface VoltageLight {
  rgb: [number, number, number]
  emissive: number
}

export function voltageToLight(V: number): VoltageLight {
  // Clamp into the stop range
  const Vc = Math.max(STOPS[0].V, Math.min(STOPS[STOPS.length - 1].V, V))
  // Find segment
  for (let i = 0; i < STOPS.length - 1; i++) {
    const lo = STOPS[i]
    const hi = STOPS[i + 1]
    if (Vc >= lo.V && Vc <= hi.V) {
      const t = (Vc - lo.V) / (hi.V - lo.V)
      return {
        rgb: [lerp(lo.rgb[0], hi.rgb[0], t), lerp(lo.rgb[1], hi.rgb[1], t), lerp(lo.rgb[2], hi.rgb[2], t)],
        emissive: lerp(lo.emissive, hi.emissive, t),
      }
    }
  }
  const last = STOPS[STOPS.length - 1]
  return { rgb: last.rgb, emissive: last.emissive }
}

/** Format voltage as a short string. */
export function formatV(V: number): string {
  return `${V >= 0 ? '+' : ''}${V.toFixed(1)} mV`
}
