import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { getStadiumStandPlacement } from './stadiumPlacement'
import { getStadiumFoxPlacements, shuffleStadiumFoxes } from './stadiumFoxPlacement'

test('shuffleStadiumFoxes is deterministic and does not mutate input', () => {
  const foxes = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]

  assert.deepEqual(shuffleStadiumFoxes(foxes), shuffleStadiumFoxes(foxes))
  assert.deepEqual(foxes, [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }])
})

test('getStadiumFoxPlacements fills every requested seat on both stands', () => {
  const stadiumData = getStadiumStandPlacement({
    basePosition: new THREE.Vector3(0, 0, 0),
    baseDirection: new THREE.Vector3(0, 0, 1),
    distanceFromTrack: 10,
    groundY: 0
  })

  const placements = getStadiumFoxPlacements({
    shuffledFoxes: [{ voxels: [[1, 2, 3, '#fff']] }],
    stadiumData,
    rows: 2,
    seatsPerRow: 3,
    seatWidth: 1,
    rowDepth: 2,
    rowHeightStep: 1,
    side: 'both'
  })

  assert.equal(placements.length, 12)
})

test('getStadiumFoxPlacements can render only one side', () => {
  const stadiumData = getStadiumStandPlacement({
    basePosition: new THREE.Vector3(0, 0, 0),
    baseDirection: new THREE.Vector3(0, 0, 1),
    distanceFromTrack: 10,
    groundY: 0
  })

  const placements = getStadiumFoxPlacements({
    shuffledFoxes: [{ voxels: [[1, 2, 3, '#fff']] }],
    stadiumData,
    rows: 2,
    seatsPerRow: 3,
    seatWidth: 1,
    rowDepth: 2,
    rowHeightStep: 1,
    side: 'left'
  })

  assert.equal(placements.length, 6)
})

test('getStadiumFoxPlacements applies deterministic crowd density', () => {
  const stadiumData = getStadiumStandPlacement({
    basePosition: new THREE.Vector3(0, 0, 0),
    baseDirection: new THREE.Vector3(0, 0, 1),
    distanceFromTrack: 10,
    groundY: 0
  })
  const input = {
    shuffledFoxes: [{ voxels: [[1, 2, 3, '#fff']] }],
    stadiumData,
    rows: 4,
    seatsPerRow: 10,
    seatWidth: 1,
    rowDepth: 2,
    rowHeightStep: 1,
    side: 'both' as const,
    densityScale: 0.5
  }

  const placements = getStadiumFoxPlacements(input)
  const repeatedPlacements = getStadiumFoxPlacements(input)

  assert.deepEqual(placements, repeatedPlacements)
  assert.equal(placements.length > 0, true)
  assert.equal(placements.length < 80, true)
})

test('getStadiumFoxPlacements can hide all spectator foxes with zero density', () => {
  const stadiumData = getStadiumStandPlacement({
    basePosition: new THREE.Vector3(0, 0, 0),
    baseDirection: new THREE.Vector3(0, 0, 1),
    distanceFromTrack: 10,
    groundY: 0
  })

  const placements = getStadiumFoxPlacements({
    shuffledFoxes: [{ voxels: [[1, 2, 3, '#fff']] }],
    stadiumData,
    rows: 2,
    seatsPerRow: 3,
    seatWidth: 1,
    rowDepth: 2,
    rowHeightStep: 1,
    side: 'both',
    densityScale: 0
  })

  assert.equal(placements.length, 0)
})
