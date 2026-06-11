import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { getRacingQualityPreset } from '../../performance/qualitySettings'
import {
  createImportedBasicAdvertisingBoards,
  createImportedBasicTreePlacements
} from './importedBasicSceneryData'

const createCurve = () => new THREE.CatmullRomCurve3([
  new THREE.Vector3(-100, 0, -100),
  new THREE.Vector3(100, 0, -100),
  new THREE.Vector3(100, 0, 100),
  new THREE.Vector3(-100, 0, 100)
], true)

test('imported basic scenery scales tree count by racing quality preset', () => {
  const curve = createCurve()
  const lowTrees = createImportedBasicTreePlacements(curve, getRacingQualityPreset('low'))
  const mediumTrees = createImportedBasicTreePlacements(curve, getRacingQualityPreset('medium'))
  const highTrees = createImportedBasicTreePlacements(curve, getRacingQualityPreset('high'))

  assert.equal(lowTrees.length < mediumTrees.length, true)
  assert.equal(mediumTrees.length < highTrees.length, true)
  assert.equal(lowTrees.length, 55)
  assert.equal(mediumTrees.length, 80)
  assert.equal(highTrees.length, 100)
})

test('imported basic scenery keeps trees outside the track corridor', () => {
  const curve = createCurve()
  const trees = createImportedBasicTreePlacements(curve, getRacingQualityPreset('medium'), {
    minCenterlineDistance: 65
  })

  assert.equal(trees.every(tree => {
    let nearestDistance = Infinity

    for (let i = 0; i <= 200; i++) {
      const point = curve.getPointAt(i / 200)
      nearestDistance = Math.min(nearestDistance, Math.hypot(tree.x - point.x, tree.z - point.z))
    }

    return nearestDistance >= 65
  }), true)
})

test('imported basic scenery creates boards on both sides around the full track', () => {
  const curve = createCurve()
  const boards = createImportedBasicAdvertisingBoards(curve)

  assert.equal(boards.length, 16)
  assert.equal(boards.filter(board => board.side === 'left').length, 8)
  assert.equal(boards.filter(board => board.side === 'right').length, 8)
  assert.equal(boards.every(board => board.curve === curve), true)
  assert.equal(boards.every(board => board.offset === 26 && board.height === 3.5), true)
})

test('imported basic scenery board options are configurable per track', () => {
  const boards = createImportedBasicAdvertisingBoards(createCurve(), {
    offset: 34,
    height: 4,
    segments: 5
  })

  assert.equal(boards.length, 10)
  assert.equal(boards.every(board => board.offset === 34 && board.height === 4), true)
})

test('imported basic scenery can skip board ranges around tight geometry', () => {
  const boards = createImportedBasicAdvertisingBoards(createCurve(), {
    segments: 8,
    excludedRanges: [[0.75, 1]]
  })

  assert.equal(boards.length, 12)
  assert.equal(boards.some(board => board.startT >= 0.75), false)
})
