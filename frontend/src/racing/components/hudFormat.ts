export const formatLapTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const millis = Math.floor((seconds % 1) * 1000)

  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`
}

export const shortenTxid = (txid: string): string => {
  if (txid.length <= 16) return txid

  return `${txid.substring(0, 8)}...${txid.substring(txid.length - 8)}`
}
