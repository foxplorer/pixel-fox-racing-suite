import assert from 'node:assert/strict'
import test from 'node:test'
import { RACING_SOUND_TOGGLE_ICON_SIZE } from './RacingSoundToggle'

test('RACING_SOUND_TOGGLE_ICON_SIZE preserves the existing icon size', () => {
  assert.equal(RACING_SOUND_TOGGLE_ICON_SIZE, 24)
})
