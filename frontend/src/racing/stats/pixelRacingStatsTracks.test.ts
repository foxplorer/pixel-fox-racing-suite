import assert from 'node:assert/strict'
import test from 'node:test'
import type { PixelRacingGameResult } from '../transactions/lapResult'
import {
  getPixelRacingStatsTrackName,
  getPixelRacingStatsTrackNames,
  getPixelRacingStatsTrackTabId,
  groupPixelRacingResultsByStatsTrack
} from './pixelRacingStatsTracks'

const result = (trackname: string | undefined, laptime: string): PixelRacingGameResult => ({
  owneraddress: `owner-${trackname || 'legacy'}-${laptime}`,
  outpoint: '',
  originoutpoint: '',
  foxname: 'Fox',
  laptime,
  time: '1',
  txid: `${trackname || 'legacy'}-${laptime}`,
  foxinfolink: '',
  foximagelink: '',
  trackname
})

test('pixel racing stats maps blank legacy track names to San Luis', () => {
  assert.equal(getPixelRacingStatsTrackName(result(undefined, '80')), 'San Luis')
  assert.equal(getPixelRacingStatsTrackName(result('', '80')), 'San Luis')
  assert.equal(getPixelRacingStatsTrackName(result('  ', '80')), 'San Luis')
})

test('pixel racing stats keeps official tracks ordered and appends discovered tracks', () => {
  assert.deepEqual(getPixelRacingStatsTrackNames([
    result('Example Park', '75'),
    result('Belgium', '70'),
    result(undefined, '80'),
    result('Australia', '72')
  ]), ['Australia', 'San Luis', 'Belgium', 'Example Park'])
})

test('pixel racing stats normalizes legacy real-world track names to country names', () => {
  assert.equal(getPixelRacingStatsTrackName(result('Melbourne', '72')), 'Australia')
  assert.equal(getPixelRacingStatsTrackName(result('Spa', '70')), 'Belgium')
  assert.equal(getPixelRacingStatsTrackName(result('Silverstone', '75')), 'United Kingdom')
  assert.equal(getPixelRacingStatsTrackName(result('Nürburgring', '75')), 'Germany')
})

test('pixel racing stats groups and sorts dynamic track leaderboards', () => {
  const grouped = groupPixelRacingResultsByStatsTrack([
    result('Example Park', '90'),
    result('Example Park', '70'),
    result(undefined, '80')
  ])

  assert.deepEqual(Object.keys(grouped).sort(), ['Example Park', 'San Luis'])
  assert.deepEqual(grouped['Example Park'].map(entry => entry.laptime), ['70', '90'])
})

test('pixel racing stats creates stable tab ids for arbitrary track names', () => {
  assert.equal(getPixelRacingStatsTrackTabId('Example Park'), 'example-park')
  assert.equal(getPixelRacingStatsTrackTabId('  New Track!!!  '), 'new-track')
})
