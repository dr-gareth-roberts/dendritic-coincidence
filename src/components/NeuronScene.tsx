/**
 * 3D scene of the CA1 pyramidal neuron — the primary visualisation.
 *
 * Branches rendered as tapered cylinders, voltage-coloured with bloom.
 * Two synapse handles with mode labels. When a trial is playing, the
 * voltage trace drives the colours AND a propagation wave travels from
 * each active synapse along the dendrites.
 */

import { useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { KernelSize } from 'postprocessing'
import { Color } from 'three'
import { Soma } from './Soma'
import { BranchMesh } from './Branch'
import { SynapseHandle, type SynapseMode } from './SynapseHandle'
import {
  buildBranches,
  synapse1Position,
  synapse2Position,
  type Branch,
} from './morphology'
import { waveBonusAt } from './propagation'
import type { TrialResult } from '../sim/neuron'

export interface SynapseFire {
  position: [number, number, number]
  fireT: number
  amplitude: number
}

/** Set the WebGL clear color and scene background so the deep-purple radial
 * gradient is visible. The Canvas style gradient only shows where the renderer
 * leaves pixels transparent; with the EffectComposer we need a real color. */
function SceneBackground(): null {
  const { scene, gl } = useThree()
  // Deep purple core → near-black edges. Matches the CSS gradient.
  scene.background = new Color('#1a0a2f')
  gl.setClearColor(new Color('#1a0a2f'), 1)
  return null
}

interface NeuronSceneProps {
  /** Per-compartment voltages (mV) at the current playhead. */
  voltages: [number, number, number, number]
  syn1Mode: SynapseMode
  syn2Mode: SynapseMode
  syn1FireT: number | null
  syn2FireT: number | null
  /** Current playhead time (ms). */
  currentT: number
  /** Synapse weights for labels. */
  wAMPA1: number
  wNMDA1: number
  wAMPA2: number
  wNMDA2: number
  /** Optional trial ref (used to compute wave amplitudes). */
  trial: TrialResult | null
  onSyn1Click: () => void
  onSyn2Click: () => void
}

export function NeuronScene(props: NeuronSceneProps) {
  const branches: Branch[] = useMemo(() => buildBranches(), [])
  const syn1Pos = useMemo(() => synapse1Position(), [])
  const syn2Pos = useMemo(() => synapse2Position(), [])

  // Compute wave sources from the trial. The amplitude at each synapse
  // is the local dendritic V at fire time minus rest.
  const waveSources = useMemo<SynapseFire[]>(() => {
    const sources: SynapseFire[] = []
    if (!props.trial) return sources
    if (props.syn1FireT !== null && props.syn1Mode !== 'off') {
      const idx = Math.max(0, Math.min(props.trial.trace.length - 1, Math.round(props.syn1FireT / props.trial.dt)))
      const trunkV = props.trial.trace[idx].V[1]
      sources.push({
        position: syn1Pos,
        fireT: props.syn1FireT,
        amplitude: Math.max(0, trunkV - (-65)),
      })
    }
    if (props.syn2FireT !== null && props.syn2Mode !== 'off') {
      const idx = Math.max(0, Math.min(props.trial.trace.length - 1, Math.round(props.syn2FireT / props.trial.dt)))
      const trunkV = props.trial.trace[idx].V[1]
      sources.push({
        position: syn2Pos,
        fireT: props.syn2FireT,
        amplitude: Math.max(0, trunkV - (-65)),
      })
    }
    return sources
  }, [props.trial, props.syn1FireT, props.syn2FireT, props.syn1Mode, props.syn2Mode, syn1Pos, syn2Pos])

  // Soma gets the soma V (V[0]); branches get the V of their compartment
  // plus the wave bonus based on distance from active synapses.
  function branchVoltage(branch: Branch): number {
    let V = props.voltages[branch.compartment]
    if (waveSources.length > 0) {
      const point: [number, number, number] = [
        (branch.start[0] + branch.end[0]) / 2,
        (branch.start[1] + branch.end[1]) / 2,
        (branch.start[2] + branch.end[2]) / 2,
      ]
      V += waveBonusAt(point, props.currentT, waveSources)
    }
    return V
  }

  return (
    <Canvas
      camera={{ position: [380, 240, 620], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, toneMappingExposure: 1.0, preserveDrawingBuffer: true }}
      style={{ background: 'radial-gradient(ellipse at center, #2a1245 0%, #1a0a2f 70%, #0a0510 100%)' }}
    >
      {/* No background starfield: with the bloom luminanceThreshold at
          0.08, the Star points themselves crossed the threshold and
          contributed bright halos into the centre ROI, contaminating
          the "bloom is voltage-driven" measurement. The radial-gradient
          background is enough to give the scene depth without competing
          with the neuron's own light. */}
      <SceneBackground />

      <ambientLight intensity={0.25} color="#4466aa" />
      <pointLight position={[400, 400, 600]} intensity={0.6} color="#ffffff" />
      <pointLight position={[-400, -200, 400]} intensity={0.4} color="#8888ff" />
      <pointLight position={[0, 600, -400]} intensity={0.3} color="#ffaa44" />
      <hemisphereLight intensity={0.2} color="#ffeebb" groundColor="#1a0a2f" />

      {/* The neuron */}
      <Soma voltage={props.voltages[0]} />
      {branches.map((b, i) => (
        <BranchMesh key={i} branch={b} voltage={branchVoltage(b)} />
      ))}

      {/* Synapse handles */}
      <SynapseHandle
        position={syn1Pos}
        mode={props.syn1Mode}
        voltage={props.voltages[1]}
        fireT={props.syn1FireT}
        currentT={props.currentT}
        localV={props.voltages[1]}
        label="S1"
        wAMPA={props.wAMPA1}
        wNMDA={props.wNMDA1}
        onClick={props.onSyn1Click}
      />
      <SynapseHandle
        position={syn2Pos}
        mode={props.syn2Mode}
        voltage={props.voltages[1]}
        fireT={props.syn2FireT}
        currentT={props.currentT}
        localV={props.voltages[1]}
        label="S2"
        wAMPA={props.wAMPA2}
        wNMDA={props.wNMDA2}
        onClick={props.onSyn2Click}
      />

      <OrbitControls
        enablePan={false}
        minDistance={300}
        maxDistance={2200}
        target={[0, 260, 0]}
        autoRotate={false}
      />

      {/* Bloom + vignette — threshold tuned so resting neuron is below it
          and even mild depolarisation (V ≈ -55mV on the trunk) is above it,
          making the NMDA plateau visibly bloom. */}
      <EffectComposer multisampling={4}>
        <Bloom
          intensity={1.2}
          kernelSize={KernelSize.LARGE}
          luminanceThreshold={0.08}
          luminanceSmoothing={0.3}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.3} darkness={0.6} />
      </EffectComposer>
    </Canvas>
  )
}