/**
 * Synapse handle: glowing ring at the synapse site.
 *
 * The ring pulses with mode (off/ampa/nmda/both). When the synapse fires
 * (fireT within ~30ms of current playhead), the ring expands and brightens
 * — a firing event made visible.
 */

import { useRef, useMemo } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { voltageToLight, formatV } from './voltageColor'

export type SynapseMode = 'off' | 'ampa' | 'nmda' | 'both'

interface SynapseHandleProps {
  position: [number, number, number]
  mode: SynapseMode
  /** Voltage at this synapse (mV). */
  voltage: number
  /** Time of last fire (ms), or null if not yet fired. */
  fireT: number | null
  /** Current playhead time (ms). */
  currentT: number
  /** Local voltage at this synapse site (mV). */
  localV?: number
  /** Label (e.g. "S1"). */
  label: string
  /** Display weights for the label. */
  wAMPA: number
  wNMDA: number
  onClick: () => void
}

const MODE_LABEL: Record<SynapseMode, string> = {
  off: 'OFF',
  ampa: 'AMPA',
  nmda: 'NMDA',
  both: 'AMPA+NMDA',
}

const MODE_COLOR: Record<SynapseMode, number> = {
  off: 0x666688,
  ampa: 0x44aaff,
  nmda: 0xff8844,
  both: 0xffdd44,
}

const FIRE_EVENT_DURATION = 35 // ms; ring expands for this long

export function SynapseHandle({
  position,
  mode,
  voltage,
  fireT,
  currentT,
  localV,
  label,
  wAMPA,
  wNMDA,
  onClick,
}: SynapseHandleProps) {
  const ringRef = useRef<THREE.Mesh>(null)
  const ringMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const innerMatRef = useRef<THREE.MeshStandardMaterial>(null)

  const baseColor = useMemo(() => new THREE.Color(MODE_COLOR[mode]), [mode])

  useFrame(() => {
    if (!ringMatRef.current || !innerMatRef.current) return

    // Firing event: ring expands and brightens for FIRE_EVENT_DURATION ms
    let fireProgress = 0
    if (fireT !== null) {
      const dt = currentT - fireT
      if (dt >= 0 && dt < FIRE_EVENT_DURATION) {
        fireProgress = 1 - dt / FIRE_EVENT_DURATION
      }
    }

    // Ring scales with fireProgress: 1.0 at idle, up to 4.0 at fire onset
    const ringScale = 1 + fireProgress * 3
    if (ringRef.current) ringRef.current.scale.set(ringScale, ringScale, ringScale)

    // Ring colour: blend base with voltage colour
    const vLight = voltageToLight(voltage)
    const vColor = new THREE.Color(vLight.rgb[0] / 255, vLight.rgb[1] / 255, vLight.rgb[2] / 255)

    if (mode === 'off') {
      ringMatRef.current.color.copy(baseColor)
      ringMatRef.current.emissive.copy(baseColor)
      ringMatRef.current.emissiveIntensity = 0.15
    } else {
      ringMatRef.current.color.lerpColors(baseColor, vColor, 0.5)
      ringMatRef.current.emissive.copy(baseColor)
      ringMatRef.current.emissiveIntensity = 0.4 + fireProgress * 3.5
    }

    // Inner sphere pulses with voltage
    innerMatRef.current.color.copy(vColor)
    innerMatRef.current.emissive.copy(vColor)
    innerMatRef.current.emissiveIntensity = vLight.emissive
  })

  function handleClick(e: ThreeEvent<MouseEvent>): void {
    e.stopPropagation()
    onClick()
  }

  const displayV = localV !== undefined ? localV : voltage

  return (
    <group position={position} onClick={handleClick}>
      {/* Outer firing-event ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[14, 2.5, 10, 40]} />
        <meshStandardMaterial
          ref={ringMatRef}
          roughness={0.3}
          metalness={0.0}
          transparent
          opacity={0.85}
          toneMapped
        />
      </mesh>
      {/* Inner glowing sphere */}
      <mesh>
        <sphereGeometry args={[9, 24, 18]} />
        <meshStandardMaterial
          ref={innerMatRef}
          roughness={0.4}
          metalness={0.0}
          emissiveIntensity={0.5}
          toneMapped
        />
      </mesh>

      {/* 3D-anchored label */}
      <Html
        position={[0, 28, 0]}
        center
        distanceFactor={400}
        style={{
          color: '#ffdd66',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '11px',
          fontWeight: 600,
          background: 'rgba(10, 10, 30, 0.75)',
          padding: '4px 8px',
          borderRadius: '4px',
          border: '1px solid rgba(255, 170, 68, 0.4)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div>
          <div>{label}</div>
          <div style={{ fontSize: '10px', color: '#aaaacc' }}>{MODE_LABEL[mode]}</div>
          <div style={{ fontSize: '10px', color: '#88ff88' }}>{formatV(displayV)}</div>
          {mode !== 'off' && (
            <div style={{ fontSize: '9px', color: '#8888aa' }}>
              A:{wAMPA.toFixed(1)} N:{wNMDA.toFixed(1)}
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}