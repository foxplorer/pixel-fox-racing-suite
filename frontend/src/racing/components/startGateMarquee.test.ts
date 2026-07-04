import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildStartGateMarqueeModel,
  formatMarqueeClock,
  formatMarqueeLapTime,
  sortMarqueeStandings,
  type StartGateMarqueeEntrant
} from './startGateMarquee'

const makeEntrant = (overrides: Partial<StartGateMarqueeEntrant> & { entrantId: string }): StartGateMarqueeEntrant => ({
  name: 'Fox',
  gridSlot: 0,
  lapTimesMs: [],
  ...overrides
})

test('formatMarqueeClock renders minutes and padded seconds', () => {
  assert.equal(formatMarqueeClock(125), '2:05')
  assert.equal(formatMarqueeClock(0), '0:00')
  assert.equal(formatMarqueeClock(-4), '0:00')
})

test('formatMarqueeLapTime renders millisecond lap times', () => {
  assert.equal(formatMarqueeLapTime(83456), '1:23.456')
  assert.equal(formatMarqueeLapTime(5000), '0:05.000')
})

test('multiplayer countdown shows race start clock and player-facing staging summary', () => {
  const model = buildStartGateMarqueeModel({
    mode: 'multiplayer',
    gameStatus: 'countdown',
    countdown: 95,
    lapsRequired: 3,
    entrants: [
      makeEntrant({ entrantId: 'b', name: 'Bandit', gridSlot: 1 }),
      makeEntrant({ entrantId: 'a', name: 'Aurora', gridSlot: 0 })
    ]
  })

  assert.equal(model.statusLine, 'RACE STARTS IN 1:35')
  assert.deepEqual(model.infoLines, [
    '2 FOXES STAGED',
    '3 LAPS',
    'GROUP START'
  ])
})

test('single-player multiplayer countdown avoids implementation grid labels', () => {
  const model = buildStartGateMarqueeModel({
    mode: 'multiplayer',
    gameStatus: 'countdown',
    countdown: 95,
    lapsRequired: 3,
    entrants: [
      makeEntrant({ entrantId: 'a', name: 'Pixel Foxe', gridSlot: 1 })
    ]
  })

  assert.equal(model.statusLine, 'RACE STARTS IN 1:35')
  assert.deepEqual(model.infoLines, [
    '1 FOX STAGED',
    '3 LAPS',
    'WAITING'
  ])
})

test('multiplayer final countdown shows the beep number', () => {
  const model = buildStartGateMarqueeModel({
    mode: 'multiplayer',
    gameStatus: 'countdown',
    countdown: 2,
    lapsRequired: 3,
    entrants: []
  })

  assert.equal(model.statusLine, '0:02')
})

test('multiplayer racing ranks finishers first with total time', () => {
  const model = buildStartGateMarqueeModel({
    mode: 'multiplayer',
    gameStatus: 'racing',
    countdown: 0,
    lapsRequired: 2,
    entrants: [
      makeEntrant({ entrantId: 'slow', name: 'Slowpoke', gridSlot: 0, lapTimesMs: [61000] }),
      makeEntrant({ entrantId: 'done', name: 'Blazer', gridSlot: 1, lapTimesMs: [60000, 60000], finishOrder: 1 }),
      makeEntrant({ entrantId: 'out', name: 'Ghost', gridSlot: 2, lapTimesMs: [], disconnected: true })
    ]
  })

  assert.equal(model.statusLine, '1 FINISHED')
  assert.deepEqual(model.infoLines, [
    'P1 BLAZER  2:00.000',
    'P2 SLOWPOKE  LAP 2/2',
    'P3 GHOST  OUT'
  ])
})

test('multiplayer standings order falls back to laps then split then grid', () => {
  const rows = sortMarqueeStandings([
    makeEntrant({ entrantId: 'a', gridSlot: 3, lapTimesMs: [50000] }),
    makeEntrant({ entrantId: 'b', gridSlot: 1, lapTimesMs: [48000] }),
    makeEntrant({ entrantId: 'c', gridSlot: 0, lapTimesMs: [] })
  ], 3)

  assert.deepEqual(rows.map(row => row.entrant.entrantId), ['b', 'a', 'c'])
  assert.deepEqual(rows.map(row => row.place), [1, 2, 3])
})

test('solo racing shows current lap, history, best lap and player count', () => {
  const model = buildStartGateMarqueeModel({
    mode: 'solo',
    gameStatus: 'racing',
    countdown: 0,
    lapTimesSeconds: [45.2, 43.9],
    currentLapTimeSeconds: 12.4,
    playersOnTrack: 4
  })

  assert.equal(model.statusLine, 'LAP 3  0:12')
  assert.deepEqual(model.infoLines, [
    'LAP 1  0:45.200',
    'LAP 2  0:43.900',
    'BEST  0:43.900',
    '4 FOXES ON TRACK'
  ])
})

test('solo countdown with no laps yet welcomes racers to the track', () => {
  const model = buildStartGateMarqueeModel({
    mode: 'solo',
    gameStatus: 'countdown',
    countdown: 3,
    lapTimesSeconds: [],
    trackName: 'Australia'
  })

  assert.equal(model.statusLine, '0:03')
  assert.deepEqual(model.infoLines, ['WELCOME TO AUSTRALIA'])
})
