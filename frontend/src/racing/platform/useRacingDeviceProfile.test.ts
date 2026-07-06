import assert from 'node:assert/strict'
import test from 'node:test'
import { computeRacingDeviceProfile } from './useRacingDeviceProfile'

test('computeRacingDeviceProfile flags a phone in portrait as mobile racing UI', () => {
  const profile = computeRacingDeviceProfile({
    coarsePointer: true,
    hoverNone: true,
    maxTouchPoints: 5,
    viewportWidth: 390,
    viewportHeight: 844
  })

  assert.equal(profile.isTouchDevice, true)
  assert.equal(profile.isCoarsePointer, true)
  assert.equal(profile.isSmallViewport, true)
  assert.equal(profile.isLandscape, false)
  assert.equal(profile.prefersMobileRacingUi, true)
})

test('computeRacingDeviceProfile flags a phone in landscape as small viewport and landscape', () => {
  const profile = computeRacingDeviceProfile({
    coarsePointer: true,
    hoverNone: true,
    maxTouchPoints: 5,
    viewportWidth: 844,
    viewportHeight: 390
  })

  assert.equal(profile.isSmallViewport, true)
  assert.equal(profile.isLandscape, true)
  assert.equal(profile.prefersMobileRacingUi, true)
})

test('computeRacingDeviceProfile keeps a mouse-first desktop on the desktop UI', () => {
  const profile = computeRacingDeviceProfile({
    coarsePointer: false,
    hoverNone: false,
    maxTouchPoints: 0,
    viewportWidth: 1920,
    viewportHeight: 1080
  })

  assert.equal(profile.isTouchDevice, false)
  assert.equal(profile.isCoarsePointer, false)
  assert.equal(profile.isSmallViewport, false)
  assert.equal(profile.isLandscape, true)
  assert.equal(profile.prefersMobileRacingUi, false)
})

test('computeRacingDeviceProfile keeps a desktop touchscreen with a fine primary pointer on the desktop UI', () => {
  const profile = computeRacingDeviceProfile({
    coarsePointer: false,
    hoverNone: false,
    maxTouchPoints: 10,
    viewportWidth: 1920,
    viewportHeight: 1080
  })

  assert.equal(profile.isTouchDevice, true)
  assert.equal(profile.isCoarsePointer, false)
  assert.equal(profile.prefersMobileRacingUi, false)
})

test('computeRacingDeviceProfile flags an iPad-style tablet as mobile racing UI despite a large viewport', () => {
  const profile = computeRacingDeviceProfile({
    coarsePointer: true,
    hoverNone: true,
    maxTouchPoints: 5,
    viewportWidth: 1180,
    viewportHeight: 820
  })

  assert.equal(profile.isTouchDevice, true)
  assert.equal(profile.isCoarsePointer, true)
  assert.equal(profile.isSmallViewport, false)
  assert.equal(profile.prefersMobileRacingUi, true)
})

test('computeRacingDeviceProfile treats hover-none touch devices as coarse even without the coarse media flag', () => {
  const profile = computeRacingDeviceProfile({
    coarsePointer: false,
    hoverNone: true,
    maxTouchPoints: 2,
    viewportWidth: 412,
    viewportHeight: 915
  })

  assert.equal(profile.isCoarsePointer, true)
  assert.equal(profile.prefersMobileRacingUi, true)
})
