import { RefObject, useCallback, useEffect, useRef } from 'react'
import { useWallet } from '@1sat/react'
import { prepareCollectibleDeliveryTarget } from '../../wallet/deliveryTarget'
import { METANET_WALLET_PROVIDER } from '../../wallet/walletProviders'
import type { PixelRacingGameResult } from '../transactions/lapResult'
import {
  buildCollectibleActivityResult,
  buildSharedCollectibleTransactionPayload,
  getCollectibleImageUrl,
  internalizeMetanetCollectibleDeliveryWithRetry,
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
  identityKey?: string | null
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
  identityKey,
  ordinalAddress,
  foxOutpoint,
  foxOriginOutpoint,
  foxName,
  trackName,
  onLatestActivityChange,
  onCollectibleCollected
}: UseCollectibleItemActionsOptions) => {
  const { wallet, providerType } = useWallet()
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
    if (!identityKey || !foxOutpoint || !foxOriginOutpoint || !foxName) {
      console.error('Cannot create item inscription - missing required fields')
      return
    }

    try {
      if (!wallet) {
        throw new Error('Cannot prepare collectible delivery without a connected wallet')
      }
      const deliveryTarget = await prepareCollectibleDeliveryTarget(
        wallet,
        providerType,
        identityKey,
        ordinalAddress,
      )
      const result = await submitCollectibleTransaction(
        transactionServerUrl,
        itemType,
        identityKey,
        deliveryTarget,
      )

      if (providerType === METANET_WALLET_PROVIDER && result.deliveryMode === 'metanet') {
        if (!wallet) {
          throw new Error('Cannot internalize Metanet collectible without a connected wallet')
        }
        try {
          await internalizeMetanetCollectibleDeliveryWithRetry(wallet, result, {
            maxAttempts: 3,
            initialDelayMs: 500,
            onRetry: (attempt, error, nextDelayMs) => {
              console.warn(
                `Metanet collectible internalization attempt ${attempt} failed; retrying in ${nextDelayMs}ms`,
                error
              )
            }
          })
        } catch (error) {
          console.error('Metanet collectible internalization failed after retries:', error)
        }
      }

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
    } catch (error) {
      console.error('Collectible delivery failed:', error)
    }
  }, [
    collectibleImageUrls,
    foxName,
    foxOriginOutpoint,
    foxOutpoint,
    identityKey,
    onCollectibleCollected,
    onLatestActivityChange,
    ordinalAddress,
    providerType,
    socketRef,
    trackName,
    transactionServerUrl,
    wallet
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
