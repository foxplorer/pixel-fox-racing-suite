import assert from 'node:assert/strict'
import test from 'node:test'
import { formatCameraModeLabel, RACING_CAMERA_MODES } from './RacingCameraModeSelector'

test('RACING_CAMERA_MODES preserves the existing selector order', () => {
  assert.deepEqual(RACING_CAMERA_MODES, ['simple', 'smooth', 'damped', 'targetsmooth', 'velocity'])
})

test('formatCameraModeLabel preserves the custom target smooth label', () => {
  assert.equal(formatCameraModeLabel('simple'), 'simple')
  assert.equal(formatCameraModeLabel('targetsmooth'), 'Target Smooth')
})
