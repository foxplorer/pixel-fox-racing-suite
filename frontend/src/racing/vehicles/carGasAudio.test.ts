import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CAR_GAS_AUDIO_LOOP_START_SECONDS,
  getCarGasAudioLoopEndSeconds,
  seekCarGasAudioIntoLoopWindow,
  startCarGasAudio,
  stopCarGasAudio,
  updateCarGasAudio,
  type CarGasAudioElement
} from './carGasAudio'

const assertNear = (actual: number, expected: number, epsilon = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `Expected ${actual} to be within ${epsilon} of ${expected}`
  )
}

const createAudio = (): CarGasAudioElement & {
  playCalls: number
  pauseCalls: number
} => ({
  volume: 0,
  currentTime: 12,
  duration: 8,
  loop: true,
  playCalls: 0,
  pauseCalls: 0,
  play() {
    this.playCalls++
    return Promise.resolve()
  },
  pause() {
    this.pauseCalls++
  }
})

test('startCarGasAudio sets volume, starts playback, and marks playing', async () => {
  const audio = createAudio()
  const isPlaying = { current: false }
  let pressed = 0

  startCarGasAudio({
    audio,
    speed: 0,
    isPlaying,
    onGasPressed: () => {
      pressed++
    }
  })

  await Promise.resolve()
  assertNear(audio.volume, 0.07)
  assert.equal(audio.loop, false)
  assert.equal(audio.currentTime, CAR_GAS_AUDIO_LOOP_START_SECONDS)
  assert.equal(audio.playCalls, 1)
  assert.equal(isPlaying.current, true)
  assert.equal(pressed, 1)
})

test('car gas audio loop helpers skip the intro and tail of the gas clip', () => {
  const audio = createAudio()

  assert.equal(getCarGasAudioLoopEndSeconds(audio), 6.8)

  audio.currentTime = 0
  seekCarGasAudioIntoLoopWindow(audio)
  assert.equal(audio.currentTime, CAR_GAS_AUDIO_LOOP_START_SECONDS)

  audio.currentTime = 6.9
  seekCarGasAudioIntoLoopWindow(audio)
  assert.equal(audio.currentTime, CAR_GAS_AUDIO_LOOP_START_SECONDS)
})

test('stopCarGasAudio pauses, rewinds, and optionally notifies release', () => {
  const audio = createAudio()
  const isPlaying = { current: true }
  let released = 0

  stopCarGasAudio({
    audio,
    isPlaying,
    onGasReleased: () => {
      released++
    }
  })

  assert.equal(audio.pauseCalls, 1)
  assert.equal(audio.currentTime, 0)
  assert.equal(isPlaying.current, false)
  assert.equal(released, 1)
})

test('updateCarGasAudio updates volume while enabled and stops silently while muted', () => {
  const audio = createAudio()
  const isPlaying = { current: true }
  audio.currentTime = 6.9

  updateCarGasAudio({
    audio,
    speed: 75,
    isSoundEnabled: true,
    isPlaying
  })

  assertNear(audio.volume, 0.35)
  assert.equal(audio.currentTime, CAR_GAS_AUDIO_LOOP_START_SECONDS)
  assert.equal(audio.pauseCalls, 0)

  updateCarGasAudio({
    audio,
    speed: 75,
    isSoundEnabled: false,
    isPlaying
  })

  assert.equal(audio.pauseCalls, 1)
  assert.equal(audio.currentTime, 0)
  assert.equal(isPlaying.current, false)
})
