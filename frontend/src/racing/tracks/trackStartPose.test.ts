import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { findLongestStraightStartPose, resolveTrackStartPose } from './trackStartPose'

test('resolveTrackStartPose resolves explicit San Luis start pose from metadata', () => {
  const curve = new THREE.LineCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(10, 0, 0)
  )

  const pose = resolveTrackStartPose('san-luis', curve)

  assert.deepEqual(pose.position.toArray(), [0, 0.1, 0])
  assert.deepEqual(pose.direction.toArray(), [0, 0, 1])
})

test('resolveTrackStartPose resolves curve-t start poses and applies direction policy', () => {
  const curve = new THREE.LineCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 100)
  )

  const pose = resolveTrackStartPose('belgium', curve)

  assert.equal(pose.curveT, 0.9845)
  assert.ok(Math.abs(pose.position.z - 98.45) < 0.000001)
  assert.deepEqual(pose.direction.toArray(), [0, 0, -1])
})

test('findLongestStraightStartPose resolves midpoint on a straight curve', () => {
  const curve = new THREE.LineCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(10, 0, 0)
  )

  const pose = findLongestStraightStartPose(curve, { samples: 10 })

  assert.deepEqual(pose.position.toArray(), [5, 0, 0])
  assert.deepEqual(pose.direction.toArray(), [1, 0, 0])
  assert.equal(pose.curveT, 0.5)
  assert.equal(pose.straightLength, 10)
})

test('resolveTrackStartPose resolves Australia derived start pose from the runtime curve', () => {
  const curve = new THREE.LineCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(10, 0, 0)
  )

  const pose = resolveTrackStartPose('australia', curve)

  assert.deepEqual(pose.position.toArray(), [5, 0, 0])
  assert.deepEqual(pose.direction.toArray(), [-1, 0, 0])
  assert.equal(pose.curveT, 0.5)
})
