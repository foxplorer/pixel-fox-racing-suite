import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { buildScheduledRaceGridSlots, getScheduledRaceGridLayout, getScheduledRaceGridYaw } from './gridSlots'

const approx = (actual: number, expected: number, epsilon = 0.000001) => {
  assert.equal(Math.abs(actual - expected) <= epsilon, true, `${actual} should be close to ${expected}`)
}

test('getScheduledRaceGridYaw faces cars along the track start direction', () => {
  approx(getScheduledRaceGridYaw(new THREE.Vector3(0, 0, 1)), 0)
  approx(getScheduledRaceGridYaw(new THREE.Vector3(1, 0, 0)), Math.PI / 2)
  approx(getScheduledRaceGridYaw(new THREE.Vector3(0, 0, -1)), Math.PI)
})

test('buildScheduledRaceGridSlots creates two-wide rows on the approach side of the start line', () => {
  const slots = buildScheduledRaceGridSlots({
    startPosition: new THREE.Vector3(10, 0.1, 20),
    startDirection: new THREE.Vector3(0, 0, 1),
    slotCount: 6,
    laneOffset: 4,
    rowSpacing: 7,
    startOffset: 6,
  })

  assert.equal(slots.length, 6)
  assert.deepEqual(slots.map(slot => slot.slot), [1, 2, 3, 4, 5, 6])
  assert.deepEqual(slots[0].position.toArray(), [6, 0.1, 26])
  assert.deepEqual(slots[1].position.toArray(), [14, 0.1, 26])
  assert.deepEqual(slots[2].position.toArray(), [6, 0.1, 33])
  assert.deepEqual(slots[3].position.toArray(), [14, 0.1, 33])
  assert.deepEqual(slots[4].position.toArray(), [6, 0.1, 40])
  assert.deepEqual(slots[5].position.toArray(), [14, 0.1, 40])
  assert.equal(slots.every(slot => slot.rotationY === 0), true)
})

test('buildScheduledRaceGridSlots samples terrain height at each grid slot position', () => {
  const slots = buildScheduledRaceGridSlots({
    startPosition: new THREE.Vector3(10, 100, 20),
    startDirection: new THREE.Vector3(0, 0, 1),
    slotCount: 6,
    laneOffset: 4,
    rowSpacing: 7,
    startOffset: 6,
    yOffset: 0.1,
    getHeightAtPosition: (x, z) => z + (x > 10 ? 0.5 : 0),
  })

  assert.deepEqual(slots.map(slot => slot.position.y), [
    26.1,
    26.6,
    33.1,
    33.6,
    40.1,
    40.6,
  ])
})

test('buildScheduledRaceGridSlots rejects a vertical-only direction', () => {
  assert.throws(
    () => buildScheduledRaceGridSlots({
      startPosition: new THREE.Vector3(),
      startDirection: new THREE.Vector3(0, 1, 0),
    }),
    /horizontal component/
  )
})

test('getScheduledRaceGridLayout narrows San Luis staged rows', () => {
  assert.deepEqual(getScheduledRaceGridLayout('Australia'), {
    laneOffset: 4,
    rowSpacing: 7,
    startOffset: 6,
  })
  assert.deepEqual(getScheduledRaceGridLayout('San Luis'), {
    laneOffset: 2.2,
    rowSpacing: 5.5,
    startOffset: 6,
  })
  assert.deepEqual(getScheduledRaceGridLayout('Belgium'), {
    laneOffset: 2.8,
    rowSpacing: 6,
    startOffset: 6,
  })
})
