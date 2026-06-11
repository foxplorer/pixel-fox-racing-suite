import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import {
  createStartGate,
  getStartGateTransition,
  projectOntoStartGate,
  updateStartGateState,
  type StartGate
} from './startGate'

const gate: StartGate = {
  position: new THREE.Vector3(0, 0, 0),
  direction: new THREE.Vector3(0, 0, 1),
  halfWidth: 6,
  halfLength: 2
}

test('projectOntoStartGate reports inside points', () => {
  const projection = projectOntoStartGate(new THREE.Vector3(3, 0, 1), gate)

  assert.equal(projection.isInside, true)
  assert.equal(projection.alongTrack, 1)
  assert.equal(projection.acrossTrack, -3)
})

test('createStartGate derives half dimensions from authored width and depth', () => {
  const created = createStartGate(gate.position, gate.direction, {
    width: 12,
    depth: 4
  })

  assert.equal(created.halfWidth, 6)
  assert.equal(created.halfLength, 2)
})

test('projectOntoStartGate rejects points outside width or length', () => {
  assert.equal(projectOntoStartGate(new THREE.Vector3(7, 0, 1), gate).isInside, false)
  assert.equal(projectOntoStartGate(new THREE.Vector3(3, 0, 3), gate).isInside, false)
})

test('getStartGateTransition detects enter and leave edges', () => {
  assert.deepEqual(getStartGateTransition(false, true), { justEntered: true, justLeft: false })
  assert.deepEqual(getStartGateTransition(true, false), { justEntered: false, justLeft: true })
  assert.deepEqual(getStartGateTransition(true, true), { justEntered: false, justLeft: false })
})

test('updateStartGateState projects, reports transition, and stores inside state', () => {
  const isInside = { current: false }
  const entered = updateStartGateState(new THREE.Vector3(0, 0, 0), gate, isInside)

  assert.equal(entered.isInside, true)
  assert.equal(entered.justEntered, true)
  assert.equal(entered.justLeft, false)
  assert.equal(isInside.current, true)

  const left = updateStartGateState(new THREE.Vector3(0, 0, 5), gate, isInside)

  assert.equal(left.isInside, false)
  assert.equal(left.justEntered, false)
  assert.equal(left.justLeft, true)
  assert.equal(isInside.current, false)
})
