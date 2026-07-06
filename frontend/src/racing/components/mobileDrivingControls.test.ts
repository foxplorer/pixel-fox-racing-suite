import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createMobileControlPressTracker,
  MOBILE_CONTROL_KEY_CODES
} from './mobileDrivingControls'

interface EmittedKey {
  type: 'keydown' | 'keyup'
  code: string
}

const createRecordingTracker = () => {
  const emitted: EmittedKey[] = []
  const tracker = createMobileControlPressTracker((type, code) => emitted.push({ type, code }))
  return { tracker, emitted }
}

test('press and release emit matching key events for the mapped code', () => {
  const { tracker, emitted } = createRecordingTracker()

  tracker.press(1, 'gas')
  tracker.release(1)

  assert.deepEqual(emitted, [
    { type: 'keydown', code: MOBILE_CONTROL_KEY_CODES.gas },
    { type: 'keyup', code: MOBILE_CONTROL_KEY_CODES.gas }
  ])
})

test('steering and gas can be held simultaneously from separate pointers', () => {
  const { tracker, emitted } = createRecordingTracker()

  tracker.press(1, 'gas')
  tracker.press(2, 'left')
  assert.deepEqual(tracker.getPressedControls().sort(), ['gas', 'left'])

  tracker.release(2)
  assert.deepEqual(tracker.getPressedControls(), ['gas'])
  assert.deepEqual(emitted.at(-1), { type: 'keyup', code: MOBILE_CONTROL_KEY_CODES.left })
})

test('two pointers on the same control emit a single keydown and keyup', () => {
  const { tracker, emitted } = createRecordingTracker()

  tracker.press(1, 'gas')
  tracker.press(2, 'gas')
  tracker.release(1)
  assert.equal(emitted.length, 1)

  tracker.release(2)
  assert.deepEqual(emitted, [
    { type: 'keydown', code: MOBILE_CONTROL_KEY_CODES.gas },
    { type: 'keyup', code: MOBILE_CONTROL_KEY_CODES.gas }
  ])
})

test('duplicate press and unknown release are ignored', () => {
  const { tracker, emitted } = createRecordingTracker()

  tracker.press(1, 'brake')
  tracker.press(1, 'brake')
  tracker.release(99)

  assert.equal(emitted.length, 1)
  assert.deepEqual(tracker.getPressedControls(), ['brake'])
})

test('releaseAll lifts every held control exactly once', () => {
  const { tracker, emitted } = createRecordingTracker()

  tracker.press(1, 'gas')
  tracker.press(2, 'gas')
  tracker.press(3, 'right')
  tracker.releaseAll()

  const keyups = emitted.filter(event => event.type === 'keyup')
  assert.deepEqual(keyups.map(event => event.code).sort(), [
    MOBILE_CONTROL_KEY_CODES.gas,
    MOBILE_CONTROL_KEY_CODES.right
  ].sort())
  assert.deepEqual(tracker.getPressedControls(), [])

  tracker.releaseAll()
  assert.equal(emitted.filter(event => event.type === 'keyup').length, 2)
})
