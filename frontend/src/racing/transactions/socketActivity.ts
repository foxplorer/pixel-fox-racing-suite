import type { PixelRacingGameResult } from './lapResult'
import { buildPixelRacingActivityFromTransaction } from './lapResult'

interface SocketTransactionActivityOptions {
  data: any
  fallbackTrackName: string
  timestampMs?: number
  onLatestActivityChange?: (activity: PixelRacingGameResult) => void
  logItemTransaction?: boolean
  invalidItemError?: boolean
}

export const handleSocketTransactionActivity = ({
  data,
  fallbackTrackName,
  timestampMs = Date.now(),
  onLatestActivityChange,
  logItemTransaction = false,
  invalidItemError = false
}: SocketTransactionActivityOptions): boolean => {
  if (logItemTransaction) {
    console.log(`📦 Received newItemTransaction:`, data)
  }

  if (!data || !data.txid) {
    if (invalidItemError) {
      console.error('❌ Invalid item transaction data:', data)
    }
    return false
  }

  const activityData = buildPixelRacingActivityFromTransaction(data, fallbackTrackName, timestampMs)

  if (onLatestActivityChange) {
    onLatestActivityChange(activityData)
  }

  return true
}

interface RacingTransactionSocketLike {
  on(event: 'newItemTransaction' | 'newGameTransaction', listener: (data: any) => void): void
}

interface RegisterRacingTransactionSocketListenersOptions {
  socket: RacingTransactionSocketLike
  fallbackTrackName: string
  onLatestActivityChange?: (activity: PixelRacingGameResult) => void
}

export const registerRacingTransactionSocketListeners = ({
  socket,
  fallbackTrackName,
  onLatestActivityChange
}: RegisterRacingTransactionSocketListenersOptions): void => {
  socket.on('newItemTransaction', data => {
    handleSocketTransactionActivity({
      data,
      fallbackTrackName,
      onLatestActivityChange,
      logItemTransaction: true,
      invalidItemError: true
    })
  })

  socket.on('newGameTransaction', data => {
    handleSocketTransactionActivity({
      data,
      fallbackTrackName,
      onLatestActivityChange
    })
  })
}
