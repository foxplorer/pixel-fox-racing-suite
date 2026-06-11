import assert from 'node:assert/strict'
import test from 'node:test'
import {
  handleSocketTransactionActivity,
  registerRacingTransactionSocketListeners
} from './socketActivity'

test('handleSocketTransactionActivity builds and emits activity rows', () => {
  let activity: any = null

  const handled = handleSocketTransactionActivity({
    data: {
      txid: 'abc',
      itemType: 'salad',
      itemImage: '/salad.svg',
      trackName: '',
      foxOutpoint: 'fox-out',
      foxName: 'Fast Fox',
      originOutpoint: 'origin-out',
      ownerAddress: 'addr',
      dummy: true
    },
    fallbackTrackName: 'Belgium',
    timestampMs: 123,
    onLatestActivityChange: nextActivity => {
      activity = nextActivity
    }
  })

  assert.equal(handled, true)
  assert.equal(activity.txid, 'abc')
  assert.equal(activity.trackname, 'Belgium')
  assert.equal(activity.time, '123')
  assert.equal(activity.itemType, 'salad')
})

test('handleSocketTransactionActivity ignores invalid transaction payloads', () => {
  let called = false

  const handled = handleSocketTransactionActivity({
    data: {},
    fallbackTrackName: 'Australia',
    onLatestActivityChange: () => {
      called = true
    }
  })

  assert.equal(handled, false)
  assert.equal(called, false)
})

test('registerRacingTransactionSocketListeners registers item and game transaction handlers', () => {
  const listeners = new Map<string, (data: any) => void>()
  const activities: any[] = []

  registerRacingTransactionSocketListeners({
    socket: {
      on(event, listener) {
        listeners.set(event, listener)
      }
    },
    fallbackTrackName: 'Aspen',
    onLatestActivityChange: activity => {
      activities.push(activity)
    }
  })

  assert.equal(listeners.has('newItemTransaction'), true)
  assert.equal(listeners.has('newGameTransaction'), true)

  listeners.get('newItemTransaction')?.({ txid: 'item-tx', trackName: '' })
  listeners.get('newGameTransaction')?.({ txid: 'game-tx', trackName: '' })

  assert.deepEqual(activities.map(activity => activity.txid), ['item-tx', 'game-tx'])
  assert.deepEqual(activities.map(activity => activity.trackname), ['Aspen', 'Aspen'])
})
