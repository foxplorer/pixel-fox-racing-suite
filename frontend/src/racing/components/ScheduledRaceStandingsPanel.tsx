import { memo, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { getOrdinalContentUrl } from '../transactions/ordinalLinks'
import type { ScheduledRaceRoomSnapshot } from '../scheduled/scheduledRaceSocket'

export type ScheduledRaceLapProgressByEntrant = Record<string, number[]>
export type ScheduledRaceFinishOrderByEntrant = Record<string, number>

export interface ScheduledRaceSettlementState {
  status: 'settled' | 'no_contest' | 'cancelled'
  txid?: string | null
}

interface ScheduledRaceStandingsPanelProps {
  snapshot: ScheduledRaceRoomSnapshot | null
  activeRaceId?: string | null
  localEntrantId?: string | null
  lapProgressByEntrant: ScheduledRaceLapProgressByEntrant
  finishOrderByEntrant?: ScheduledRaceFinishOrderByEntrant
  lapsRequired?: number
  settlement?: ScheduledRaceSettlementState | null
}

const formatSplit = (milliseconds: number | undefined): string => {
  if (!Number.isFinite(milliseconds) || milliseconds === undefined) return ''
  const seconds = milliseconds / 1000
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(3)
  return `${mins}:${secs.padStart(6, '0')}`
}

export const getOrdinal = (place: number): string => {
  const mod100 = place % 100
  if (mod100 >= 11 && mod100 <= 13) return `${place}th`
  switch (place % 10) {
    case 1:
      return `${place}st`
    case 2:
      return `${place}nd`
    case 3:
      return `${place}rd`
    default:
      return `${place}th`
  }
}

const getFinalizesAtMs = (startsAt: string): number | null => {
  const startsAtMs = Date.parse(startsAt)
  if (!Number.isFinite(startsAtMs)) return null
  return startsAtMs + 15 * 60 * 1000
}

const formatFinalizesAt = (startsAt: string): string | null => {
  const finalizesAtMs = getFinalizesAtMs(startsAt)
  if (finalizesAtMs === null) return null

  const finalizesAt = new Date(finalizesAtMs)
  const localTime = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(finalizesAt)
  const utcTime = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(finalizesAt)
  return `${localTime} / ${utcTime}`
}

const formatRemainingTime = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const getTrophyColor = (place: number): string | null => {
  if (place === 1) return '#FFD166'
  if (place === 2) return '#D8DEE9'
  if (place === 3) return '#CD7F32'
  return null
}

const TrophyPicture = ({ color }: { color: string }) => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 64 64"
    role="img"
    aria-label="Trophy"
    style={{ display: 'block', filter: `drop-shadow(0 0 10px ${color}88)` }}
  >
    <path d="M22 10h20v11c0 8-4 14-10 16-6-2-10-8-10-16V10Z" fill={color} stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2" />
    <path d="M22 15H11v5c0 8 5 14 13 15" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
    <path d="M42 15h11v5c0 8-5 14-13 15" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
    <path d="M29 37h6v10h-6z" fill={color} />
    <path d="M21 50h22v6H21z" fill={color} />
    <path d="M17 56h30v5H17z" fill={color} opacity="0.78" />
    <path d="M27 15h10" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const getSettlementStatusLine = (settlement: ScheduledRaceSettlementState): string => {
  if (settlement.status === 'settled') {
    return settlement.txid ? 'Results final — race inscribed ✓' : 'Results final'
  }
  if (settlement.status === 'no_contest') return 'Race ended — no contest, not inscribed'
  return 'Race cancelled — not inscribed'
}

export const ScheduledRaceFinishStatusBanner = memo(function ScheduledRaceFinishStatusBanner({
  snapshot,
  activeRaceId,
  localEntrantId,
  lapProgressByEntrant,
  finishOrderByEntrant = {},
  lapsRequired = 3,
  settlement = null,
}: ScheduledRaceStandingsPanelProps) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const localLapTimes = localEntrantId ? (lapProgressByEntrant[localEntrantId] || []) : []
  const finalizesAtMs = snapshot ? getFinalizesAtMs(snapshot.startsAt) : null
  const finalizesAtLabel = snapshot ? formatFinalizesAt(snapshot.startsAt) : null
  const localPlace = localEntrantId ? finishOrderByEntrant[localEntrantId] : undefined
  const shouldShow = Boolean(
    snapshot &&
    activeRaceId &&
    snapshot.raceId === activeRaceId &&
    localEntrantId &&
    finalizesAtMs !== null &&
    (settlement || (localLapTimes.length >= lapsRequired && localPlace))
  )

  useEffect(() => {
    if (!shouldShow || settlement) return
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [shouldShow, settlement])

  if (!shouldShow || finalizesAtMs === null) return null

  const remainingMs = Math.max(0, finalizesAtMs - nowMs)
  const trophyColor = localPlace ? getTrophyColor(localPlace) : null
  const finalTitle = localPlace ? `Finished ${getOrdinal(localPlace)}` : 'Race Complete'
  const finalSubtitle = localPlace
    ? trophyColor ? `${getOrdinal(localPlace)} place trophy` : 'No trophy for this finish'
    : settlement?.status === 'settled' ? 'Results final' : 'Race ended'

  return (
    <div style={{
      position: 'absolute',
      top: 18,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 95,
      pointerEvents: 'none',
      padding: '9px 14px',
      borderRadius: 8,
      border: '1px solid rgba(255, 209, 102, 0.34)',
      background: 'rgba(0, 0, 0, 0.72)',
      color: '#ffffff',
      fontFamily: 'monospace',
      textAlign: 'center',
      textShadow: '2px 2px 4px rgba(0,0,0,0.75)',
      boxShadow: '0 10px 28px rgba(0,0,0,0.32)',
      backdropFilter: 'blur(8px)',
      maxWidth: 'min(92vw, 520px)',
      lineHeight: 1.35,
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: trophyColor ? '48px minmax(0, 1fr)' : 'minmax(0, 1fr)',
        alignItems: 'center',
        gap: 10,
      }}>
        {trophyColor && <TrophyPicture color={trophyColor} />}
        <div>
          <div style={{ color: trophyColor || '#ffffff', fontSize: 15, fontWeight: 800 }}>
            {finalTitle}
          </div>
          <div style={{ color: trophyColor || '#d7d7d7', fontSize: 12, fontWeight: 800 }}>
            {finalSubtitle}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: settlement?.status === 'settled' ? '#35D06F' : undefined }}>
        {settlement
          ? getSettlementStatusLine(settlement)
          : `${remainingMs > 0 ? `Finalizes in ${formatRemainingTime(remainingMs)} — sooner if everyone finishes` : 'Finalizing now'}${finalizesAtLabel ? ` · ${finalizesAtLabel}` : ''}`}
      </div>
    </div>
  )
})

const panelStyle: CSSProperties = {
  background: 'rgba(0, 0, 0, 0.68)',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.12)',
  minWidth: 230,
  maxWidth: 270,
  pointerEvents: 'auto',
  textAlign: 'left',
  backdropFilter: 'blur(8px)'
}

export const ScheduledRaceStandingsPanel = memo(function ScheduledRaceStandingsPanel({
  snapshot,
  activeRaceId,
  localEntrantId,
  lapProgressByEntrant,
  finishOrderByEntrant = {},
  lapsRequired = 3,
}: ScheduledRaceStandingsPanelProps) {
  const rows = useMemo(() => {
    if (!snapshot || !activeRaceId || snapshot.raceId !== activeRaceId) return []

    return (snapshot.entrants || [])
      .slice()
      .sort((a, b) => a.gridSlot - b.gridSlot || a.joinedAt - b.joinedAt)
      .map((entrant, index) => {
        const lapTimes = lapProgressByEntrant[entrant.entrantId] || []
        const completedLaps = Math.min(lapTimes.length, lapsRequired)
        const requiredLapTimes = lapTimes.slice(0, lapsRequired)
        const totalTime = requiredLapTimes.reduce((total, lapTime) => total + lapTime, 0)
        return {
          entrant,
          completedLaps,
          lapTimes: requiredLapTimes,
          finishOrder: finishOrderByEntrant[entrant.entrantId],
          lastSplit: lapTimes[Math.min(lapTimes.length, lapsRequired) - 1],
          totalTime,
          isFinished: completedLaps >= lapsRequired,
        }
      })
      .sort((a, b) => {
        if (a.isFinished !== b.isFinished) return a.isFinished ? -1 : 1
        if (a.isFinished && b.isFinished) {
          const aOrder = a.finishOrder ?? Number.POSITIVE_INFINITY
          const bOrder = b.finishOrder ?? Number.POSITIVE_INFINITY
          if (aOrder !== bOrder) return aOrder - bOrder
          return a.totalTime - b.totalTime
        }
        if (a.completedLaps !== b.completedLaps) return b.completedLaps - a.completedLaps
        if (a.lastSplit !== b.lastSplit) return (a.lastSplit ?? Number.POSITIVE_INFINITY) - (b.lastSplit ?? Number.POSITIVE_INFINITY)
        return a.entrant.gridSlot - b.entrant.gridSlot
      })
      .map((row, index) => ({ ...row, place: row.isFinished && row.finishOrder ? row.finishOrder : index + 1 }))
  }, [activeRaceId, finishOrderByEntrant, lapProgressByEntrant, lapsRequired, snapshot])

  if (rows.length === 0) return null

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: '0.08em' }}>
        MULTIPLAYER
      </div>
      {rows.map(row => {
        const imageUrl = getOrdinalContentUrl(row.entrant.originOutpoint || row.entrant.entrantId)
        const isLocal = row.entrant.entrantId === localEntrantId
        const isDisconnected = row.entrant.gameStatus === 'disconnected'

        return (
          <div
            key={row.entrant.entrantId}
            style={{
              display: 'grid',
              gridTemplateColumns: '18px 24px minmax(0, 1fr)',
              alignItems: 'center',
              gap: 7,
              minHeight: 40,
              color: isDisconnected ? '#b8b8b8' : (isLocal ? '#FFD166' : '#ffffff'),
              fontFamily: 'monospace',
              fontSize: 11,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              padding: '4px 5px',
              borderRadius: 6,
              background: isLocal ? 'rgba(255, 209, 102, 0.12)' : (isDisconnected ? 'rgba(255,255,255,0.05)' : 'transparent'),
              boxShadow: isLocal ? '0 0 14px rgba(255, 209, 102, 0.28)' : 'none',
            }}
          >
            <div style={{ color: row.isFinished ? '#35D06F' : 'inherit', fontWeight: 700 }}>{row.place}</div>
            <div style={{
              width: 24,
              height: 24,
              borderRadius: 5,
              border: `2px solid ${row.entrant.carColor || '#9BE7E0'}`,
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.1)',
              boxShadow: isLocal ? '0 0 0 2px rgba(255,255,255,0.92), 0 0 14px rgba(255, 209, 102, 0.9)' : 'none',
            }}>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={row.entrant.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated' }}
                />
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>
                {row.entrant.name || 'Fox'}
              </div>
              <div style={{ color: isDisconnected ? '#ffb3b3' : '#cfcfcf', fontSize: 10, marginBottom: 3 }}>
                {isDisconnected ? `Left - Lap ${row.completedLaps}/${lapsRequired}` : (row.isFinished ? 'Finished' : `Lap ${row.completedLaps}/${lapsRequired}`)}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${lapsRequired}, minmax(42px, 1fr))`,
                gap: 4,
                color: '#9BE7E0',
                fontSize: 10,
                fontWeight: 700,
              }}>
                {Array.from({ length: lapsRequired }, (_, lapIndex) => (
                  <div key={lapIndex} style={{
                    minHeight: 13,
                    textAlign: 'right',
                    color: row.lapTimes[lapIndex] ? (row.isFinished ? '#35D06F' : '#9BE7E0') : 'transparent',
                  }}>
                    {formatSplit(row.lapTimes[lapIndex])}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
})
