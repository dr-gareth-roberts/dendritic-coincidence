/**
 * Soma mesh — a sphere with a hint of structure (slight equatorial bulge,
 * deep navy at rest, white-hot at AP peak).
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { voltageToLight } from './voltageColor'
import { SOMA_CENTRE, SOMA_RADIUS } from './morphology'

interface SomaProps {
  voltage: number
}

export function Soma({ voltage }: SomaProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!matRef.current) return
    const light = voltageToLight(voltage)
    matRef.current.color.setRGB(light.rgb[0] / 255, light.rgb[1] / 255, light.rgb[2] / 255)
    matRef.current.emissive.setRGB(light.rgb[0] / 255, light.rgb[1] / 255, light.rgb[2] / 255)
    matRef.current.emissiveIntensity = light.emissive

    // Slight breathing pulse — visual liveliness at rest
    if (meshRef.current) {
      const t = clock.elapsedTime
      const breathe = 1 + 0.02 * Math.sin(t * 0.7)
      meshRef.current.scale.set(breathe, breathe, breathe)
    }
  })

  return (
    <group position={SOMA_CENTRE}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[SOMA_RADIUS, 32, 24]} />
        {/* toneMapped=false so the high-emissive AP peak actually pushes
            past the bloom luminance threshold in the framebuffer. */}
        <meshStandardMaterial ref={matRef} roughness={0.45} metalness={0.05} />
      </mesh>
      {/* Equatorial halo to make the soma feel grounded */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[SOMA_RADIUS * 1.15, SOMA_RADIUS * 0.06, 8, 32]} />
        <meshStandardMaterial color="#3344aa" emissive="#3344aa" emissiveIntensity={0.4} roughness={0.6} toneMapped />
      </mesh>
    </group>
  )
}