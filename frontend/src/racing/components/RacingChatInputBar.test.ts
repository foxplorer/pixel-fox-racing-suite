import assert from 'node:assert/strict'
import test from 'node:test'
import {
  RACING_CHAT_MESSAGE_MAX_LENGTH,
  SNOWMOBILE_CHAT_MESSAGE_MAX_LENGTH
} from './RacingChatInputBar'

test('RACING_CHAT_MESSAGE_MAX_LENGTH preserves the existing chat limit', () => {
  assert.equal(RACING_CHAT_MESSAGE_MAX_LENGTH, 30)
})

test('SNOWMOBILE_CHAT_MESSAGE_MAX_LENGTH preserves the existing snowmobile chat limit', () => {
  assert.equal(SNOWMOBILE_CHAT_MESSAGE_MAX_LENGTH, 50)
})
