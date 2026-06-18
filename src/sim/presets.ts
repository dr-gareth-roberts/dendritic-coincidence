/**
 * Named preset configurations. Each preset sets a meaningful starting
 * point for exploring the simulator.
 */

import type { SimParams } from '../state/store'

export interface Preset {
  id: string
  name: string
  description: string
  params: Partial<SimParams>
}

export const PRESETS: Preset[] = [
  {
    id: 'coincidence',
    name: 'Coincidence',
    description:
      'Two AMPA+NMDA synapses close in time. NMDA unblock → dendritic plateau → somatic AP.',
    params: { wAMPA: 6.0, wNMDA: 30, syn1Mode: 'both', syn2Mode: 'both', deltaT: 0 },
  },
  {
    id: 'sublinear',
    name: 'Sublinear',
    description:
      'Same two synapses, but 30 ms apart. NMDA unblock fails — response is roughly linear or sublinear.',
    params: { wAMPA: 6.0, wNMDA: 30, syn1Mode: 'both', syn2Mode: 'both', deltaT: 30 },
  },
  {
    id: 'single',
    name: 'Single input',
    description:
      'Only synapse 1 fires. A sublinear somatic EPSP with no spike.',
    params: { wAMPA: 6.0, wNMDA: 30, syn1Mode: 'both', syn2Mode: 'off', deltaT: 0 },
  },
  {
    id: 'apicalSpike',
    name: 'Strong NMDA burst',
    description:
      'One synapse with a much larger NMDA conductance. Local dendritic spike and somatic AP.',
    params: { wAMPA: 12, wNMDA: 100, syn1Mode: 'both', syn2Mode: 'off', deltaT: 0 },
  },
  {
    id: 'noNMDACoincidence',
    name: 'AMPA only — control',
    description:
      'Pure AMPA, no NMDA. Response is linear at all ΔT. Proves NMDA is doing the work.',
    params: { wAMPA: 6.0, wNMDA: 0, syn1Mode: 'ampa', syn2Mode: 'ampa', deltaT: 0 },
  },
]