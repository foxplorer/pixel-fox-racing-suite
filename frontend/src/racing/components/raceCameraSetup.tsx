import { useEffect, type FC } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

export const getInitialRaceCameraPosition = (
  startFinishPosition: THREE.Vector3,
  startFinishDirection: THREE.Vector3,
  offset = new THREE.Vector3(0, 8, 25)
): THREE.Vector3 => {
  const initialRotation = Math.atan2(startFinishDirection.x, startFinishDirection.z)
  const rotatedOffset = offset.clone()
  rotatedOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), initialRotation)
  return startFinishPosition.clone().add(rotatedOffset)
}

interface RaceCameraLookAtInitializerProps {
  target: THREE.Vector3
  yOffset?: number
}

export const RaceCameraLookAtInitializer: FC<RaceCameraLookAtInitializerProps> = ({
  target,
  yOffset = 0.5
}) => {
  const { camera } = useThree()

  useEffect(() => {
    camera.lookAt(target.x, target.y + yOffset, target.z)
  }, [camera, target, yOffset])

  return null
}
