import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyRaceLoadingStartState,
  applyRaceShowroomResetState,
  applyRaceStartState,
  shouldAutoEnterRaceShowroom,
  startImmediateRaceIfNeeded,
  startRaceForSelectedTrack
} from './raceLifecycle'

test('applyRaceStartState resets shared race start state', () => {
  const state = {
    hasJoined: false,
    gameStatus: 'showroom',
    score: 12,
    distanceTraveled: 34,
    lapTime: 56,
    lapTimes: [56],
    lapTxids: { 0: 'txid' } as Record<number, string>,
    countdown: 0
  }

  applyRaceStartState({
    setHasJoined: value => {
      state.hasJoined = value
    },
    setGameStatus: value => {
      state.gameStatus = value
    },
    setScore: value => {
      state.score = value
    },
    setDistanceTraveled: value => {
      state.distanceTraveled = value
    },
    setLapTime: value => {
      state.lapTime = value
    },
    setLapTimes: value => {
      state.lapTimes = value
    },
    setLapTxids: value => {
      state.lapTxids = value
    },
    setCountdown: value => {
      state.countdown = value
    }
  })

  assert.deepEqual(state, {
    hasJoined: true,
    gameStatus: 'loading',
    score: 0,
    distanceTraveled: 0,
    lapTime: 0,
    lapTimes: [],
    lapTxids: {},
    countdown: 3
  })
})

test('applyRaceLoadingStartState resets loading state without changing joined state', () => {
  const state = {
    hasJoined: false,
    gameStatus: 'idle',
    score: 12,
    distanceTraveled: 34,
    lapTime: 56,
    lapTimes: [56],
    lapTxids: { 0: 'txid' } as Record<number, string>,
    countdown: 0
  }

  applyRaceLoadingStartState({
    setGameStatus: value => {
      state.gameStatus = value
    },
    setScore: value => {
      state.score = value
    },
    setDistanceTraveled: value => {
      state.distanceTraveled = value
    },
    setLapTime: value => {
      state.lapTime = value
    },
    setLapTimes: value => {
      state.lapTimes = value
    },
    setLapTxids: value => {
      state.lapTxids = value
    },
    setCountdown: value => {
      state.countdown = value
    }
  })

  assert.deepEqual(state, {
    hasJoined: false,
    gameStatus: 'loading',
    score: 0,
    distanceTraveled: 0,
    lapTime: 0,
    lapTimes: [],
    lapTxids: {},
    countdown: 3
  })
})

test('applyRaceShowroomResetState resets shared restart state', () => {
  const state = {
    hasJoined: true,
    gameStatus: 'crashed',
    score: 12,
    distanceTraveled: 34,
    lapTime: 56,
    lapTimes: [56],
    lapTxids: { 0: 'txid' } as Record<number, string>
  }

  applyRaceShowroomResetState({
    setGameStatus: value => {
      state.gameStatus = value
    },
    setHasJoined: value => {
      state.hasJoined = value
    },
    setScore: value => {
      state.score = value
    },
    setDistanceTraveled: value => {
      state.distanceTraveled = value
    },
    setLapTime: value => {
      state.lapTime = value
    },
    setLapTimes: value => {
      state.lapTimes = value
    },
    setLapTxids: value => {
      state.lapTxids = value
    }
  })

  assert.deepEqual(state, {
    hasJoined: false,
    gameStatus: 'showroom',
    score: 0,
    distanceTraveled: 0,
    lapTime: 0,
    lapTimes: [],
    lapTxids: {}
  })
})

test('shouldAutoEnterRaceShowroom enters only idle non-immediate races with a selected fox', () => {
  assert.equal(shouldAutoEnterRaceShowroom({
    hasFoxOriginOutpoint: true,
    gameStatus: 'idle'
  }), true)

  assert.equal(shouldAutoEnterRaceShowroom({
    hasFoxOriginOutpoint: true,
    gameStatus: 'idle',
    startRaceImmediately: true
  }), false)

  assert.equal(shouldAutoEnterRaceShowroom({
    hasFoxOriginOutpoint: false,
    gameStatus: 'idle'
  }), false)

  assert.equal(shouldAutoEnterRaceShowroom({
    hasFoxOriginOutpoint: true,
    gameStatus: 'loading'
  }), false)
})

test('startImmediateRaceIfNeeded starts loading race and preserves spawn minimap position', () => {
  const state = {
    hasStartedRace: false,
    gameStatus: 'idle',
    score: 12,
    distanceTraveled: 34,
    lapTime: 56,
    lapTimes: [56],
    lapTxids: { 0: 'txid' } as Record<number, string>,
    countdown: 0,
    carPosition: null as { x: number; y: number; z: number } | null
  }

  const result = startImmediateRaceIfNeeded({
    startRaceImmediately: true,
    hasFoxOriginOutpoint: true,
    gameStatus: state.gameStatus,
    hasStartedRace: state.hasStartedRace,
    spawnPosition: { x: 4, y: 5, z: 6 },
    carPosition: state.carPosition,
    setCarPosition: value => {
      state.carPosition = value
    },
    setHasStartedRace: value => {
      state.hasStartedRace = value
    },
    setGameStatus: value => {
      state.gameStatus = value
    },
    setScore: value => {
      state.score = value
    },
    setDistanceTraveled: value => {
      state.distanceTraveled = value
    },
    setLapTime: value => {
      state.lapTime = value
    },
    setLapTimes: value => {
      state.lapTimes = value
    },
    setLapTxids: value => {
      state.lapTxids = value
    },
    setCountdown: value => {
      state.countdown = value
    }
  })

  assert.equal(result, 'started')
  assert.deepEqual(state, {
    hasStartedRace: true,
    gameStatus: 'loading',
    score: 0,
    distanceTraveled: 0,
    lapTime: 0,
    lapTimes: [],
    lapTxids: {},
    countdown: 3,
    carPosition: { x: 4, y: 5, z: 6 }
  })
})

test('startImmediateRaceIfNeeded can use an explicit fallback position', () => {
  let carPosition: { x: number; y: number; z: number } | null = null
  let hasStartedRace = false

  const result = startImmediateRaceIfNeeded({
    startRaceImmediately: true,
    hasFoxOriginOutpoint: true,
    gameStatus: 'idle',
    hasStartedRace,
    spawnPosition: null,
    fallbackPosition: { x: 0, y: 0.1, z: 0 },
    setCarPosition: value => {
      carPosition = value
    },
    setHasStartedRace: value => {
      hasStartedRace = value
    },
    setGameStatus: () => {},
    setScore: () => {},
    setDistanceTraveled: () => {},
    setLapTime: () => {},
    setLapTimes: () => {},
    setLapTxids: () => {},
    setCountdown: () => {}
  })

  assert.equal(result, 'started')
  assert.equal(hasStartedRace, true)
  assert.deepEqual(carPosition, { x: 0, y: 0.1, z: 0 })
})

test('startImmediateRaceIfNeeded resets its guard when immediate mode turns off', () => {
  let hasStartedRace = true

  const result = startImmediateRaceIfNeeded({
    startRaceImmediately: false,
    hasFoxOriginOutpoint: true,
    gameStatus: 'loading',
    hasStartedRace,
    setHasStartedRace: value => {
      hasStartedRace = value
    },
    setGameStatus: () => assert.fail('should not reset race state'),
    setScore: () => assert.fail('should not reset race state'),
    setDistanceTraveled: () => assert.fail('should not reset race state'),
    setLapTime: () => assert.fail('should not reset race state'),
    setLapTimes: () => assert.fail('should not reset race state'),
    setLapTxids: () => assert.fail('should not reset race state'),
    setCountdown: () => assert.fail('should not reset race state')
  })

  assert.equal(result, 'reset')
  assert.equal(hasStartedRace, false)
})

test('startRaceForSelectedTrack hands off when another track is selected', () => {
  const handoffs: Array<{ trackName: string; color?: string }> = []
  const result = startRaceForSelectedTrack({
    selectedTrackName: 'Belgium',
    localTrackName: 'Australia',
    selectedColor: '#ff0000',
    onTrackChange: (trackName, color) => {
      handoffs.push({ trackName, color })
    },
    setHasJoined: () => assert.fail('should not start local race'),
    setGameStatus: () => assert.fail('should not start local race'),
    setScore: () => assert.fail('should not start local race'),
    setDistanceTraveled: () => assert.fail('should not start local race'),
    setLapTime: () => assert.fail('should not start local race'),
    setLapTimes: () => assert.fail('should not start local race'),
    setLapTxids: () => assert.fail('should not start local race'),
    setCountdown: () => assert.fail('should not start local race')
  })

  assert.equal(result, 'handoff')
  assert.deepEqual(handoffs, [{ trackName: 'Belgium', color: '#ff0000' }])
})

test('startRaceForSelectedTrack starts local race and preserves spawn minimap position', () => {
  const state = {
    hasJoined: false,
    gameStatus: 'showroom',
    score: 12,
    distanceTraveled: 34,
    lapTime: 56,
    lapTimes: [56],
    lapTxids: { 0: 'txid' } as Record<number, string>,
    countdown: 0,
    carPosition: null as { x: number; y: number; z: number } | null
  }

  const result = startRaceForSelectedTrack({
    selectedTrackName: 'San Luis',
    localTrackName: 'San Luis',
    selectedColor: '#00ff00',
    spawnPosition: { x: 1, y: 2, z: 3 },
    carPosition: state.carPosition,
    setCarPosition: value => {
      state.carPosition = value
    },
    setHasJoined: value => {
      state.hasJoined = value
    },
    setGameStatus: value => {
      state.gameStatus = value
    },
    setScore: value => {
      state.score = value
    },
    setDistanceTraveled: value => {
      state.distanceTraveled = value
    },
    setLapTime: value => {
      state.lapTime = value
    },
    setLapTimes: value => {
      state.lapTimes = value
    },
    setLapTxids: value => {
      state.lapTxids = value
    },
    setCountdown: value => {
      state.countdown = value
    }
  })

  assert.equal(result, 'started')
  assert.deepEqual(state, {
    hasJoined: true,
    gameStatus: 'loading',
    score: 0,
    distanceTraveled: 0,
    lapTime: 0,
    lapTimes: [],
    lapTxids: {},
    countdown: 3,
    carPosition: { x: 1, y: 2, z: 3 }
  })
})
