import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getPixelRacingRecordVersion,
  getPixelRacingStandingKey,
} from './pixelRacingStatsPrivacy'
import type { PixelRacingGameResult } from '../transactions/lapResult'

const result = (
  recordVersion: number | undefined,
  owneraddress: string,
  originoutpoint: string
): PixelRacingGameResult => ({
  recordVersion,
  owneraddress,
  outpoint: 'current.0',
  originoutpoint,
  foxname: 'Test Fox',
  laptime: '70',
  time: '123',
  txid: 'txid',
  foxinfolink: '',
  foximagelink: '',
})

test('record versions default legacy records to version 1', () => {
  assert.equal(getPixelRacingRecordVersion({}), 1)
  assert.equal(getPixelRacingRecordVersion({ recordVersion: '2' }), 2)
})

test('standings use owner addresses for legacy records and fox origins for v2', () => {
  assert.equal(getPixelRacingStandingKey(result(undefined, 'owner', 'origin.0')), 'owner')
  assert.equal(getPixelRacingStandingKey(result(2, '', 'origin.0')), 'origin.0')
})
