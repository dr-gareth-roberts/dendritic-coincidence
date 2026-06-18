/**
 * A single tapered branch rendered as a CylinderGeometry.
 *
 * Taper is achieved by scaling the top vs bottom of the cylinder.
 * Voltage → colour + emissive intensity drives the light look.
 */

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { voltageToLight } from './voltageColor'
import type { Branch } from './morphology'

interface BranchProps {
  branch: Branch
  /** Voltage at this branch's compartment (mV). */
  voltage: number
  /** Optional additional depolarisation from a propagating wave (mV). */
  waveBonus?: number
}

const _v = new THREE.Vector3()
const _q = new THREE.Quaternion()

function makeTaperedCylinder(
  start: [number, number, number],
  end: [number, number, number],
  radiusStart: number,
  radiusEnd: number
): { geom: THREE.CylinderGeometry; position: [number, number, number]; rotation: [number, number, number] } {
  // Cylinder geometry default axis is +Y. Length along Y, centred at origin.
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const dz = end[2] - start[2]
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz)
  // Position = midpoint
  const position: [number, number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ]
  // Rotation: align +Y to (dx,dy,dz)/length
  _v.set(dx / length, dy / length, dz / length)
  _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v)
  const euler = new THREE.Euler().setFromQuaternion(_q)
  const rotation: [number, number, number] = [euler.x, euler.y, euler.z]

  // CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
  // Default: top=+Y end. We want bigger radius at start, smaller at end.
  const geom = new THREE.CylinderGeometry(radiusEnd, radiusStart, length, 12, 1)

  return { geom, position, rotation }
}

export function BranchMesh({ branch, voltage, waveBonus = 0 }: BranchProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)

  const built = useMemo(
    () =>
      makeTaperedCylinder(
        branch.start,
        branch.end,
        branch.diameterStart / 2,
        branch.diameterEnd / 2
      ),
    [branch]
  )

  useFrame(() => {
    if (!matRef.current) return
    const V = voltage + waveBonus
    const light = voltageToLight(V)
    matRef.current.color.setRGB(light.rgb[0] / 255, light.rgb[1] / 255, light.rgb[2] / 255)
    matRef.current.emissive.setRGB(light.rgb[0] / 255, light.rgb[1] / 255, light.rgb[2] / 255)
    matRef.current.emissiveIntensity = light.emissive
  })

  return (
    <mesh position={built.position} rotation={built.rotation} geometry={built.geom}>
      {/* toneMapped=false so high emissive at AP peak actually pushes past
          the bloom threshold; resting emissive is below it. */}
      <meshStandardMaterial ref={matRef} roughness={0.55} metalness={0.0} />
    </mesh>
  )
}
