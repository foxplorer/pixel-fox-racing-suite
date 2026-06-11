import assert from 'node:assert/strict'
import test from 'node:test'
import { clearPlayerChatMessages } from './useRaceRestartHandler'

test('clearPlayerChatMessages clears transient chat fields', () => {
  const players = clearPlayerChatMessages([
    { id: 'a', chatMessage: 'hello', chatTimestamp: 123, score: 4 },
    { id: 'b', score: 2 }
  ])

  assert.deepEqual(players, [
    { id: 'a', chatMessage: undefined, chatTimestamp: undefined, score: 4 },
    { id: 'b', chatMessage: undefined, chatTimestamp: undefined, score: 2 }
  ])
})
