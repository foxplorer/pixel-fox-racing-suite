import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRenderableRemotePlayer } from './useRemotePlayerLodRendering'
import type { RacingWorldPlayer } from './worldPlayers'

const basePlayer: RacingWorldPlayer = {
  id: 'remote-1',
  name: 'Remote',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  color: '#fff',
  carColor: '#f00',
  isWalking: true,
  originOutpoint: 'origin',
  chatMessage: 'hello',
  chatTimestamp: 123
}

test('buildRenderableRemotePlayer preserves near-tier fox and chat details', () => {
  const player = buildRenderableRemotePlayer({
    entry: {
      player: basePlayer,
      tier: 'near',
      distanceSq: 10,
      sourceIndex: 0
    },
    getContentUrl: outpoint => outpoint ? `url:${outpoint}` : undefined
  })

  assert.equal(player.remoteLodTier, 'near')
  assert.equal(player.foxTextureUrl, 'url:origin')
  assert.equal(player.chatMessage, 'hello')
  assert.equal(player.chatTimestamp, 123)
})

test('buildRenderableRemotePlayer strips mid-tier fox and chat details', () => {
  const player = buildRenderableRemotePlayer({
    entry: {
      player: basePlayer,
      tier: 'mid',
      distanceSq: 100,
      sourceIndex: 0
    },
    getContentUrl: outpoint => outpoint ? `url:${outpoint}` : undefined
  })

  assert.equal(player.remoteLodTier, 'mid')
  assert.equal(player.foxTextureUrl, undefined)
  assert.equal(player.chatMessage, undefined)
  assert.equal(player.chatTimestamp, undefined)
})

test('buildRenderableRemotePlayer uses fallback outpoint for near-tier fake remotes', () => {
  const player = buildRenderableRemotePlayer({
    entry: {
      player: {
        ...basePlayer,
        originOutpoint: undefined
      },
      tier: 'near',
      distanceSq: 10,
      sourceIndex: 0
    },
    getContentUrl: outpoint => outpoint ? `url:${outpoint}` : undefined,
    getFallbackOutpoint: () => 'fallback'
  })

  assert.equal(player.foxTextureUrl, 'url:fallback')
})
