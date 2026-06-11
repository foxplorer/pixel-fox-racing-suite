import { RefObject, useCallback, useEffect, useRef } from 'react'
import type { PixelRacingGameResult } from '../transactions/lapResult'
import {
  buildCollectibleActivityResult,
  buildSharedCollectibleTransactionPayload,
  getCollectibleImageUrl,
  submitCollectibleTransaction
} from '../transactions/collectibleItem'
import type {
  RacingCollectibleImageUrls,
  RacingCollectibleType
} from '../collectibles/collectibleTypes'

interface CollectibleSocket {
  emit(event: 'collectItem', payload: { itemId: string }): unknown
  emit(event: 'shareTransaction', payload: ReturnType<typeof buildSharedCollectibleTransactionPayload>): unknown
}

interface UseCollectibleItemActionsOptions {
  transactionServerUrl: string
  collectibleImageUrls: RacingCollectibleImageUrls
  socketRef: RefObject<CollectibleSocket | null>
  hasJoined: boolean
  playDingSound: () => void
  ordinalAddress?: string | null
  foxOutpoint?: string | null
  foxOriginOutpoint?: string | null
  foxName?: string | null
  trackName: string
  onLatestActivityChange?: (activity: PixelRacingGameResult) => void
  onCollectibleCollected?: (itemType: RacingCollectibleType) => void
}

export const useCollectibleItemActions = ({
  transactionServerUrl,
  collectibleImageUrls,
  socketRef,
  hasJoined,
  playDingSound,
  ordinalAddress,
  foxOutpoint,
  foxOriginOutpoint,
  foxName,
  trackName,
  onLatestActivityChange,
  onCollectibleCollected
}: UseCollectibleItemActionsOptions) => {
  const submitItemTransactionRef = useRef<((type: RacingCollectibleType) => Promise<void>) | null>(null)
  const collectedItemsRef = useRef<Set<string>>(new Set())
  const submittedItemTransactionIdsRef = useRef<Set<string>>(new Set())

  const handleCollectItem = useCallback((itemId: string) => {
    if (collectedItemsRef.current.has(itemId)) {
      return
    }

    collectedItemsRef.current.add(itemId)
    playDingSound()

    if (socketRef.current && hasJoined) {
      globalThis.setTimeout(() => {
        socketRef.current?.emit('collectItem', { itemId })
      }, 0)
    }
  }, [hasJoined, playDingSound, socketRef])

  const submitItemTransaction = useCallback(async (itemType: RacingCollectibleType) => {
    if (!ordinalAddress || !foxOutpoint || !foxOriginOutpoint || !foxName) {
      console.error('Cannot create item inscription - missing required fields')
      return
    }

    try {
      const result = await submitCollectibleTransaction(transactionServerUrl, itemType, ordinalAddress)

      if (result.txid) {
        console.log(`✅ Collectible ${itemType} txid received:`, result.txid)

        const itemImageUrl = getCollectibleImageUrl(itemType, collectibleImageUrls)
        const timestampMs = Date.now()
        const collectiblePayloadInput = {
          identity: {
            ownerAddress: ordinalAddress,
            outpoint: foxOutpoint,
            originOutpoint: foxOriginOutpoint,
            foxName
          },
          itemType,
          itemImage: itemImageUrl,
          timestampMs,
          txid: result.txid,
          trackName,
          dummy: result.dummy === true
        }

        if (onLatestActivityChange) {
          onLatestActivityChange(buildCollectibleActivityResult(collectiblePayloadInput))
        }

        if (onCollectibleCollected) {
          onCollectibleCollected(itemType)
        }

        if (socketRef.current) {
          socketRef.current.emit('shareTransaction', buildSharedCollectibleTransactionPayload(collectiblePayloadInput))
        }
      }
    } catch (e) {
      // Preserve existing silent error handling for failed collectible submissions.
    }
  }, [
    collectibleImageUrls,
    foxName,
    foxOriginOutpoint,
    foxOutpoint,
    onCollectibleCollected,
    onLatestActivityChange,
    ordinalAddress,
    socketRef,
    trackName,
    transactionServerUrl
  ])

  useEffect(() => {
    submitItemTransactionRef.current = submitItemTransaction
  }, [submitItemTransaction])

  const submitCollectedItemTransaction = useCallback((itemId: string, itemType: RacingCollectibleType) => {
    if (submittedItemTransactionIdsRef.current.has(itemId)) {
      return
    }

    submittedItemTransactionIdsRef.current.add(itemId)
    submitItemTransactionRef.current?.(itemType)
  }, [])

  return {
    collectedItemsRef,
    submitItemTransactionRef,
    submitCollectedItemTransaction,
    handleCollectItem
  }
}
