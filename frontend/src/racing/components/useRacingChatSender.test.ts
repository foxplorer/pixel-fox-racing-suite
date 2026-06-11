import assert from 'node:assert/strict'
import test from 'node:test'
import { buildOutgoingChatMessage } from './useRacingChatSender'

test('buildOutgoingChatMessage trims and caps chat text', () => {
  assert.equal(buildOutgoingChatMessage('  hello racers  ', 8), 'hello ra')
})

test('buildOutgoingChatMessage returns null for empty messages', () => {
  assert.equal(buildOutgoingChatMessage('     ', 30), null)
})
