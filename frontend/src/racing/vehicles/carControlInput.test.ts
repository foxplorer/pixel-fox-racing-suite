import assert from 'node:assert/strict'
import test from 'node:test'
import {
  pressCarControl,
  registerCarControlHandlers,
  releaseCarControl
} from './carControlInput'

test('press and release route to registered handlers and report handled', () => {
  const pressed: string[] = []
  const released: string[] = []
  const unregister = registerCarControlHandlers({
    press: code => pressed.push(code),
    release: code => released.push(code)
  })

  assert.equal(pressCarControl('KeyW'), true)
  assert.equal(releaseCarControl('KeyW'), true)
  assert.deepEqual(pressed, ['KeyW'])
  assert.deepEqual(released, ['KeyW'])

  unregister()
  assert.equal(pressCarControl('KeyW'), false)
  assert.equal(releaseCarControl('KeyW'), false)
  assert.deepEqual(pressed, ['KeyW'])
})

test('a stale unregister does not clobber newer handlers', () => {
  const first: string[] = []
  const second: string[] = []
  const unregisterFirst = registerCarControlHandlers({
    press: code => first.push(code),
    release: () => {}
  })
  const unregisterSecond = registerCarControlHandlers({
    press: code => second.push(code),
    release: () => {}
  })

  unregisterFirst()
  assert.equal(pressCarControl('ArrowLeft'), true)
  assert.deepEqual(first, [])
  assert.deepEqual(second, ['ArrowLeft'])

  unregisterSecond()
  assert.equal(pressCarControl('ArrowLeft'), false)
})
