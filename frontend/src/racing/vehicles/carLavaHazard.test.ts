import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isCarOverLava,
  LAVA_PIT_VEHICLE_CLEARANCE_MARGIN,
  LAVA_SURFACE_CONTACT_MARGIN,
  LAVA_VEHICLE_CONTACT_MARGIN,
  type CarLavaHazard
} from './carLavaHazard'

// A pit centred at origin, travel axis = +Z, gap half 10 along, molten half 40 across.
const PIT_HAZARD: CarLavaHazard = {
  polygons: [],
  pits: [{ x: 0, z: 0, forwardX: 0, forwardZ: 1, halfLength: 10, halfWidth: 40 }]
}

// A square lava lake from (100,100) to (140,140).
const LAKE_HAZARD: CarLavaHazard = {
  polygons: [
    {
      boundary: [
        { x: 100, z: 100 },
        { x: 140, z: 100 },
        { x: 140, z: 140 },
        { x: 100, z: 140 }
      ]
    }
  ],
  pits: []
}

test('no hazard is never lava', () => {
  assert.equal(isCarOverLava(0, 0, undefined), false)
})

test('inside a pit gap is lava', () => {
  assert.equal(isCarOverLava(0, 0, PIT_HAZARD), true)
  assert.equal(isCarOverLava(30, 5, PIT_HAZARD), true) // wide across, inside gap
})

test('inside a pit footprint but elevated on a ramp is not touching lava', () => {
  assert.equal(
    isCarOverLava(0, 0, PIT_HAZARD, {
      groundY: 2,
      vehicleY: 2 + LAVA_PIT_VEHICLE_CLEARANCE_MARGIN + 0.1
    }),
    false
  )
})

test('inside a pit footprint near the lava surface still burns', () => {
  assert.equal(
    isCarOverLava(0, 0, PIT_HAZARD, {
      groundY: 2,
      vehicleY: 2 + LAVA_PIT_VEHICLE_CLEARANCE_MARGIN
    }),
    true
  )
})

test('past the lip (beyond halfLength) is solid ground, not lava', () => {
  assert.equal(isCarOverLava(0, 12, PIT_HAZARD), false)
})

test('outside the pit width is not lava', () => {
  assert.equal(isCarOverLava(45, 0, PIT_HAZARD), false)
})

test('inside the lava lake polygon is lava', () => {
  assert.equal(isCarOverLava(120, 120, LAKE_HAZARD), true)
})

test('outside the lava lake polygon is not lava', () => {
  assert.equal(isCarOverLava(0, 0, LAKE_HAZARD), false)
})

// A lake whose visible lava sheet sits at Y = 5.
const SUNKEN_LAKE_HAZARD: CarLavaHazard = {
  polygons: [
    {
      boundary: [
        { x: 100, z: 100 },
        { x: 140, z: 100 },
        { x: 140, z: 140 },
        { x: 100, z: 140 }
      ],
      surfaceY: 5
    }
  ],
  pits: []
}

test('inside the lake outline burns when ground sits at or below the lava sheet', () => {
  assert.equal(isCarOverLava(120, 120, SUNKEN_LAKE_HAZARD, 5), true)
  assert.equal(isCarOverLava(120, 120, SUNKEN_LAKE_HAZARD, 0), true)
  // Within the shoreline margin still counts as molten.
  assert.equal(
    isCarOverLava(120, 120, SUNKEN_LAKE_HAZARD, 5 + LAVA_SURFACE_CONTACT_MARGIN),
    true
  )
})

test('inside the lake outline but on rock above the buried sheet does not burn', () => {
  assert.equal(
    isCarOverLava(120, 120, SUNKEN_LAKE_HAZARD, 5 + LAVA_SURFACE_CONTACT_MARGIN + 0.1),
    false
  )
  assert.equal(isCarOverLava(120, 120, SUNKEN_LAKE_HAZARD, 40), false)
})

test('inside the lake outline but above the visible lava sheet does not burn', () => {
  assert.equal(
    isCarOverLava(120, 120, SUNKEN_LAKE_HAZARD, {
      groundY: 5,
      vehicleY: 5 + LAVA_VEHICLE_CONTACT_MARGIN + 0.1
    }),
    false
  )
})

test('inside the lake outline and vertically touching the lava sheet burns', () => {
  assert.equal(
    isCarOverLava(120, 120, SUNKEN_LAKE_HAZARD, {
      groundY: 5,
      vehicleY: 5 + LAVA_VEHICLE_CONTACT_MARGIN
    }),
    true
  )
})

test('a surfaceY polygon with no ground height falls back to the pure 2D test', () => {
  assert.equal(isCarOverLava(120, 120, SUNKEN_LAKE_HAZARD), true)
})
