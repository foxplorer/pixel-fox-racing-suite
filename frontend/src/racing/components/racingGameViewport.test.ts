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

test('getCarRacingGameViewportStyle uses dvh and no clamp for mobile racing', () => {
  const style = getCarRacingGameViewportStyle('racing', { useMobileViewportUnits: true })

  assert.equal(style.height, '100dvh')
  assert.equal(style.maxHeight, 'none')
  assert.equal(style.overscrollBehavior, 'none')
})

test('getCarRacingGameViewportStyle keeps mobile idle view shorter than fullscreen', () => {
  const idleStyle = getCarRacingGameViewportStyle('idle', { useMobileViewportUnits: true })
  const showroomStyle = getCarRacingGameViewportStyle('showroom', { useMobileViewportUnits: true })

  assert.equal(idleStyle.height, '80dvh')
  assert.equal(showroomStyle.height, '100dvh')
  assert.equal(showroomStyle.maxHeight, 'none')
})
