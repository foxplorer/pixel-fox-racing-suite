import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { getRacingQualityPreset } from '../../../performance/qualitySettings'
import {
  createUnitedKingdomAdvertisingBoards,
  createUnitedKingdomAdvertisingLogoDecals,
  createUnitedKingdomTreePlacements,
  isUnitedKingdomAdvertisingLogoDecalAllowed
} from './unitedKingdomSceneryData'

const createCurve = () => new THREE.CatmullRomCurve3([
  new THREE.Vector3(-100, 0, -100),
  new THREE.Vector3(100, 0, -100),
  new THREE.Vector3(100, 0, 100),
  new THREE.Vector3(-100, 0, 100)
], true)

test('unitedKingdom scenery scales tree count by racing quality preset', () => {
  const curve = createCurve()
  const lowTrees = createUnitedKingdomTreePlacements(curve, getRacingQualityPreset('low'))
  const mediumTrees = createUnitedKingdomTreePlacements(curve, getRacingQualityPreset('medium'))
  const highTrees = createUnitedKingdomTreePlacements(curve, getRacingQualityPreset('high'))

  assert.equal(lowTrees.length < mediumTrees.length, true)
  assert.equal(mediumTrees.length < highTrees.length, true)
  assert.equal(lowTrees.length, 66)
  assert.equal(mediumTrees.length, 96)
  assert.equal(highTrees.length, 120)
})

test('unitedKingdom scenery placements include collision radii', () => {
  const trees = createUnitedKingdomTreePlacements(createCurve(), getRacingQualityPreset('medium'))

  assert.equal(trees.length > 0, true)
  assert.equal(trees.every(tree => Number.isFinite(tree.x) && Number.isFinite(tree.z)), true)
  assert.equal(trees.every(tree => tree.scale > 0 && tree.radius > 0), true)
})

test('unitedKingdom trees are placed outside the advertising board corridor', () => {
  const curve = createCurve()
  const trees = createUnitedKingdomTreePlacements(curve, getRacingQualityPreset('medium'))

  assert.equal(trees.every(tree => {
    let nearestDistance = Infinity

    for (let i = 0; i <= 200; i++) {
      const point = curve.getPointAt(i / 200)
      nearestDistance = Math.min(nearestDistance, Math.hypot(tree.x - point.x, tree.z - point.z))
    }

    return nearestDistance >= 60
  }), true)
})

test('unitedKingdom advertising boards run both sides around the full track', () => {
  const curve = createCurve()
  const boards = createUnitedKingdomAdvertisingBoards(curve)

  assert.equal(boards.length, 16)
  assert.equal(boards.filter(board => board.side === 'left').length, 8)
  assert.equal(boards.filter(board => board.side === 'right').length, 8)
  assert.equal(boards.every(board => board.curve === curve), true)
  assert.equal(boards.every(board => board.offset === 26 && board.height === 3.5), true)
})

test('unitedKingdom advertising logos are fixed-size decals over board geometry', () => {
  const curve = createCurve()
  const boards = createUnitedKingdomAdvertisingBoards(curve)
  const decals = createUnitedKingdomAdvertisingLogoDecals(boards)

  assert.equal(decals.length > boards.length, true)
  assert.equal(decals.every(decal => decal.curve === curve), true)
  assert.equal(decals.every(decal => decal.offset === 26), true)
  assert.equal(decals.every(decal => decal.width === 6.5 && decal.height === 1.5), true)
  assert.equal(decals.every(decal => decal.boardHeight === 3.5), true)
  assert.equal(decals.every(decal => decal.t >= 0 && decal.t <= 1), true)
  assert.equal(decals.some(decal => decal.face === 'track'), true)
  assert.equal(decals.some(decal => decal.face === 'outer'), false)
  assert.equal(decals.some(decal => decal.logo === 'your-ad-here'), true)
  assert.equal(decals.some(decal => decal.logo === 'pixel-racing'), true)
})

test('unitedKingdom advertising logos skip sharp curve sections', () => {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-150, 0, 0),
    new THREE.Vector3(-50, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 50),
    new THREE.Vector3(0, 0, 150),
    new THREE.Vector3(100, 0, 150)
  ], false)

  let accepted = false
  let rejected = false

  for (let i = 0; i <= 100; i++) {
    const allowed = isUnitedKingdomAdvertisingLogoDecalAllowed(curve, i / 100, 0.02, 0.985)
    accepted ||= allowed
    rejected ||= !allowed
  }

  assert.equal(accepted, true)
  assert.equal(rejected, true)
})
