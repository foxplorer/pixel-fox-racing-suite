import assert from 'node:assert/strict'
import test from 'node:test'
import { getCarRacingGameViewportStyle } from './racingGameViewport'

test('getCarRacingGameViewportStyle preserves idle sizing', () => {
  const style = getCarRacingGameViewportStyle('idle')

  assert.equal(style.height, '80vh')
  assert.equal(style.maxHeight, 'none')
})

test('getCarRacingGameViewportStyle preserves showroom sizing', () => {
  const style = getCarRacingGameViewportStyle('showroom')

  assert.equal(style.height, '100vh')
  assert.equal(style.maxHeight, 'none')
})

test('getCarRacingGameViewportStyle preserves active race sizing', () => {
  const style = getCarRacingGameViewportStyle('racing')

  assert.equal(style.height, '90vh')
  assert.equal(style.maxHeight, '900px')
  assert.equal(style.position, 'relative')
  assert.equal(style.backgroundColor, '#000')
  assert.equal(style.margin, '0 auto')
})
