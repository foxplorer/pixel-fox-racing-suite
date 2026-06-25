import assert from 'node:assert/strict'
import test from 'node:test'
import { getCameraSnapLabel, getGasControlLabel, getHeadlightsControlLabel } from './RacingControlsHelper'

test('getGasControlLabel preserves car and snowmobile gas bindings', () => {
  assert.equal(getGasControlLabel('car'), 'G / W / ↑ — Gas')
  assert.equal(getGasControlLabel('snowmobile'), 'W / ↑ — Gas')
})

test('getCameraSnapLabel preserves vehicle-specific helper copy', () => {
  assert.equal(getCameraSnapLabel('car'), 'Drive to snap camera back.')
  assert.equal(getCameraSnapLabel('snowmobile'), 'Ride to snap camera back.')
})

test('getHeadlightsControlLabel only advertises headlights for cars', () => {
  assert.equal(getHeadlightsControlLabel('car'), 'L — Toggle headlights')
  assert.equal(getHeadlightsControlLabel('snowmobile'), null)
})
