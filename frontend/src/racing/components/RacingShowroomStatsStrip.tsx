import { memo, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { PixelRacingGameResult } from '../transactions/lapResult'
import { getOrdinalContentUrl, getOrdinalInscriptionUrl, getWhatsOnChainTransactionUrl } from '../transactions/ordinalLinks'
import { normalizeOrdinalOutpoint } from '../transactions/ordinalOutpoint'
import { fetchPixelRacingResults } from '../stats/pixelRacingResults'
import { getPixelRacingStatsTrackName } from '../stats/pixelRacingStatsTracks'

const MAX_SHOWROOM_RESULTS = 5

interface RacingShowroomStatsStripProps {
  foxName?: string | null
  foxOriginOutpoint?: string | null
}

const formatLapTime = (seconds: number): string => {
  if (!seconds || Number.isNaN(seconds)) return '0:00.000'
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(3)
  return `${mins}:${secs.padStart(6, '0')}`
}

const sortLatestResults = (results: PixelRacingGameResult[]): PixelRacingGameResult[] => (
  results
    .filter(result => !result.itemType)
    .slice()
    .sort((a, b) => (Number(b.time) || 0) - (Number(a.time) || 0))
)

export const RacingShowroomStatsStrip = memo(function RacingShowroomStatsStrip({
  foxName,
  foxOriginOutpoint
}: RacingShowroomStatsStripProps) {
  const [results, setResults] = useState<PixelRacingGameResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isCompact, setIsCompact] = useState(() => window.innerWidth < 780)

  useEffect(() => {
    const handleResize = () => setIsCompact(window.innerWidth < 780)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadResults = async () => {
      setIsLoading(true)
      setHasError(false)

      try {
        const fetchedResults = await fetchPixelRacingResults()
        if (cancelled) return
        // Keep the full sorted list so we can filter down to the player's own fox below.
        setResults(sortLatestResults(fetchedResults))
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to load showroom racing stats:', error)
        if (cancelled) return
        setHasError(true)
        setIsLoading(false)
      }
    }

    loadResults()

    return () => {
      cancelled = true
    }
  }, [])

  const normalizedFoxOrigin = useMemo(
    () => (foxOriginOutpoint ? normalizeOrdinalOutpoint(foxOriginOutpoint) : null),
    [foxOriginOutpoint]
  )

  const hasFoxIdentity = Boolean(normalizedFoxOrigin || foxName)

  // Narrow the leaderboard down to the player's own fox — match on origin outpoint first
  // (most reliable), falling back to the displayed fox name.
  const myResults = useMemo(() => results.filter(result => {
    if (normalizedFoxOrigin && result.originoutpoint) {
      return normalizeOrdinalOutpoint(result.originoutpoint) === normalizedFoxOrigin
    }
    if (foxName && result.foxname) {
      return result.foxname === foxName
    }
    return false
  }), [results, normalizedFoxOrigin, foxName])

  const displayResults = useMemo(() => myResults.slice(0, isCompact ? 3 : MAX_SHOWROOM_RESULTS), [isCompact, myResults])

  const foxImageUrl = foxOriginOutpoint ? getOrdinalContentUrl(foxOriginOutpoint) : null

  const containerStyle: CSSProperties = {
    position: 'absolute',
    left: isCompact ? 10 : 20,
    right: isCompact ? 10 : 20,
    bottom: isCompact ? 64 : 72,
    zIndex: 105,
    pointerEvents: 'auto',
    color: '#fff',
    fontFamily: 'monospace',
    background: 'rgba(0, 0, 0, 0.72)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '8px',
    backdropFilter: 'blur(10px)',
    padding: isCompact ? '10px' : '12px 14px',
    boxShadow: '0 14px 36px rgba(0,0,0,0.32)'
  }

  const rowStyle: CSSProperties = {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: isCompact ? '2px' : 0
  }

  const itemStyle: CSSProperties = {
    flex: isCompact ? '0 0 190px' : '1 1 0',
    minWidth: isCompact ? '190px' : '140px',
    maxWidth: isCompact ? '190px' : 'none',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.06)',
    padding: '8px 10px',
    minHeight: '74px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '5px'
  }

  return (
    <div style={containerStyle}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {foxImageUrl && (
            <img
              src={foxImageUrl}
              alt={foxName ?? 'Your Pixel Fox'}
              style={{
                width: isCompact ? 26 : 30,
                height: isCompact ? 26 : 30,
                borderRadius: '6px',
                objectFit: 'cover',
                imageRendering: 'pixelated',
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.08)',
                flex: '0 0 auto'
              }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, letterSpacing: '0.08em', fontSize: isCompact ? '11px' : '12px', textTransform: 'uppercase' }}>
              Your Latest Laps
            </div>
            {foxName && (
              <div style={{ color: '#9BE7E0', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {foxName}
              </div>
            )}
          </div>
        </div>
        <div style={{ color: '#9BE7E0', fontSize: '11px', whiteSpace: 'nowrap' }}>
          Ordinals + TX
        </div>
      </div>

      {isLoading && (
        <div style={{ color: '#cfcfcf', fontSize: '12px', minHeight: '42px', display: 'flex', alignItems: 'center' }}>
          Loading your lap stats...
        </div>
      )}

      {!isLoading && hasError && (
        <div style={{ color: '#ffb3b3', fontSize: '12px', minHeight: '42px', display: 'flex', alignItems: 'center' }}>
          Your lap stats are unavailable.
        </div>
      )}

      {!isLoading && !hasError && !hasFoxIdentity && (
        <div style={{ color: '#cfcfcf', fontSize: '12px', minHeight: '42px', display: 'flex', alignItems: 'center' }}>
          Connect your Pixel Fox to track your laps.
        </div>
      )}

      {!isLoading && !hasError && hasFoxIdentity && displayResults.length === 0 && (
        <div style={{ color: '#cfcfcf', fontSize: '12px', minHeight: '42px', display: 'flex', alignItems: 'center' }}>
          No laps yet — set your first lap time!
        </div>
      )}

      {!isLoading && !hasError && displayResults.length > 0 && (
        <div style={rowStyle}>
          {displayResults.map((result, index) => {
            const txUrl = getWhatsOnChainTransactionUrl(result.txid)
            const ordUrl = getOrdinalInscriptionUrl(`${result.txid}_0`)
            const trackName = getPixelRacingStatsTrackName(result)

            return (
              <div key={`${result.txid}-${result.time}-${index}`} style={itemStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                  <div style={{
                    color: '#4ECDC4',
                    fontSize: '11px',
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {trackName}
                  </div>
                  <div style={{ color: '#FFD166', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {formatLapTime(Number(result.laptime))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', fontSize: '11px' }}>
                  <a href={ordUrl} target="_blank" rel="noreferrer" style={{ color: '#ffffff', textDecoration: 'underline' }}>
                    ORD
                  </a>
                  <a href={txUrl} target="_blank" rel="noreferrer" style={{ color: '#ffffff', textDecoration: 'underline' }}>
                    TX
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})
