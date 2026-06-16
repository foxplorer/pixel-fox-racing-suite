import assert from 'node:assert/strict'
import test from 'node:test'
import { getWalletCollectibles } from './collectibleDisplay'

test('finds Pixel Racing collectibles by collection id and map name', () => {
  const collectibles = getWalletCollectibles([
    {
      outpoint: 'blueberry-current_0',
      origin: {
        outpoint: 'blueberry-origin_0',
        data: {
          map: {
            subTypeData: {
              collectionId:
                'd0322f59a802bd15c412e441adaab76c10bb3c9018e2a501117cba374616ea46_0',
            },
          },
        },
      },
    },
    {
      outpoint: 'rabbit-current_0',
      origin: {
        outpoint: 'rabbit-origin_0',
        data: { map: { name: 'rabbit' } },
      },
    },
    {
      outpoint: 'fox-current_0',
      origin: {
        outpoint: 'fox-origin_0',
        data: { map: { name: 'Pixel Foxes #1' } },
      },
    },
  ])

  assert.deepEqual(collectibles, [
    {
      kind: 'blueberries',
      name: 'Blueberries',
      outpoint: 'blueberry-current_0',
      originOutpoint: 'blueberry-origin_0',
      imageOutpoint:
        'd0322f59a802bd15c412e441adaab76c10bb3c9018e2a501117cba374616ea46_0',
    },
    {
      kind: 'rabbit',
      name: 'Rabbit',
      outpoint: 'rabbit-current_0',
      originOutpoint: 'rabbit-origin_0',
    },
  ])
})
