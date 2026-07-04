import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { getOrdinalContentUrl } from '../transactions/ordinalLinks'
import {
  fetchScheduledRaces,
  getScheduledRaceEntrantId,
  signUpForScheduledRace,
  stageScheduledRaceEntrant,
} from '../scheduled/scheduledRaceApi'
import type { ScheduledRace, ScheduledRaceSignup, ScheduledRaceSignupInput } from '../scheduled/scheduledRaceTypes'

interface ScheduledRacePanelProps {
  transactionServerUrl: string
  trackName: string
  identityKey?: string | null
  ownerAddress?: string | null
  foxOutpoint?: string | null
  foxOriginOutpoint?: string | null
  foxName?: string | null
  carColor?: string | null
  onEnterRace?: (race: ScheduledRace, signup: ScheduledRaceSignup) => void
}

const formatUtcStart = (startsAt: string): string => {
  const date = new Date(startsAt)
  if (Number.isNaN(date.getTime())) return 'UTC --:--'
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }) + ' UTC'
}

const formatCountdown = (startsAt: string, nowMs: number): string => {
  const remainingMs = new Date(startsAt).getTime() - nowMs
  if (!Number.isFinite(remainingMs)) return '--:--'
  if (remainingMs <= 0) return 'now'
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const getRaceActionLabel = (race: ScheduledRace, isSignedUp: boolean): string => {
  if (isSignedUp && ['staging', 'countdown'].includes(race.status)) return 'Enter'
  if (isSignedUp && race.status === 'scheduled') return 'Joined'
  if (isSignedUp) return 'Joined'
  if (race.openSlots <= 0) return 'Full'
  if (!['scheduled', 'staging'].includes(race.status)) return 'Closed'
  return 'Sign Up'
}

const getResultSummary = (race: ScheduledRace): string | null => {
  if (race.finalInscription?.status === 'broadcasted') return race.finalInscription.finalInscriptionPayload.inscriptionName || 'Race inscription'
  if (race.finalInscription?.status === 'no_contest') return 'No contest'
  if (race.status === 'no_contest') return 'No contest'
  if (!race.podium.length) return null

  return race.podium
    .slice(0, 3)
    .map(result => {
      const signup = race.roster.find(candidate => candidate.entrantId === result.entrantId)
      const name = signup?.foxName || result.entrantId.slice(0, 8)
      return `P${result.finishPosition ?? '?'} ${name}`
    })
    .join('  ')
}

export const ScheduledRacePanel = memo(function ScheduledRacePanel({
  transactionServerUrl,
  trackName,
  identityKey,
  ownerAddress,
  foxOutpoint,
  foxOriginOutpoint,
  foxName,
  carColor,
  onEnterRace,
}: ScheduledRacePanelProps) {
  const [races, setRaces] = useState<ScheduledRace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pendingRaceId, setPendingRaceId] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(Date.now())

  const entrantId = useMemo(() => getScheduledRaceEntrantId(foxOriginOutpoint), [foxOriginOutpoint])
  const canSignUp = Boolean(identityKey && ownerAddress && foxOutpoint && foxOriginOutpoint && foxName)

  const loadRaces = useCallback(async () => {
    setErrorMessage(null)
    try {
      const upcoming = await fetchScheduledRaces({
        transactionServerUrl,
        limit: 3,
      })
      setRaces(upcoming)
      setIsLoading(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Scheduled races unavailable')
      setIsLoading(false)
    }
  }, [transactionServerUrl])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      await loadRaces()
    }
    run()
    const poll = window.setInterval(run, 30000)
    return () => {
      cancelled = true
      window.clearInterval(poll)
    }
  }, [loadRaces])

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const handleSignUp = useCallback(async (race: ScheduledRace) => {
    if (!canSignUp || !identityKey || !ownerAddress || !foxOutpoint || !foxOriginOutpoint || !foxName) return
    setPendingRaceId(race.id)
    setErrorMessage(null)
    try {
      const updatedRace = await signUpForScheduledRace({
        transactionServerUrl,
        raceId: race.id,
        signup: {
          identityKey,
          ownerAddress,
          foxOutpoint,
          foxOriginOutpoint,
          foxName,
          carColor,
        } satisfies ScheduledRaceSignupInput,
      })
      setRaces(prev => prev.map(candidate => candidate.id === updatedRace.id ? updatedRace : candidate))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Signup failed')
    } finally {
      setPendingRaceId(null)
    }
  }, [canSignUp, carColor, foxName, foxOriginOutpoint, foxOutpoint, identityKey, ownerAddress, transactionServerUrl])

  const handleEnterRace = useCallback(async (race: ScheduledRace) => {
    if (!entrantId) return
    if (new Date(race.startsAt).getTime() <= Date.now() || !['staging', 'countdown'].includes(race.status)) {
      setErrorMessage('Race entry is closed for this start.')
      return
    }
    setPendingRaceId(race.id)
    setErrorMessage(null)
    try {
      const updatedRace = await stageScheduledRaceEntrant({
        transactionServerUrl,
        raceId: race.id,
        entrantId,
      })
      setRaces(prev => prev.map(candidate => candidate.id === updatedRace.id ? updatedRace : candidate))
      const stagedSignup = updatedRace.roster.find(signup => signup.entrantId === entrantId)
      if (stagedSignup) {
        onEnterRace?.(updatedRace, stagedSignup)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Enter race failed')
    } finally {
      setPendingRaceId(null)
    }
  }, [entrantId, onEnterRace, transactionServerUrl])

  const panelStyle: CSSProperties = {
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    marginBottom: '8px',
    paddingBottom: '8px',
  }

  const raceRowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '72px minmax(0, 1fr)',
    gap: '8px',
    alignItems: 'center',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.05)',
    padding: '7px 8px',
    minHeight: '58px',
  }

  return (
    <div style={panelStyle}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: '8px',
        marginBottom: '7px',
      }}>
        <div style={{ color: '#ffffff', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Upcoming Races
        </div>
        <div style={{ color: '#9BE7E0', fontSize: '10px', whiteSpace: 'nowrap' }}>
          Pixel Fox Racing Track Series
        </div>
      </div>

      {isLoading && (
        <div style={{ color: '#cfcfcf', fontSize: '12px', minHeight: '42px', display: 'flex', alignItems: 'center' }}>
          Loading race rack...
        </div>
      )}

      {!isLoading && errorMessage && (
        <div style={{ color: '#ffb3b3', fontSize: '12px', minHeight: '42px', display: 'flex', alignItems: 'center' }}>
          {errorMessage}
        </div>
      )}

      {!isLoading && !errorMessage && races.length === 0 && (
        <div style={{ color: '#cfcfcf', fontSize: '12px', minHeight: '42px', display: 'flex', alignItems: 'center' }}>
          No scheduled races available.
        </div>
      )}

      {!isLoading && !errorMessage && races.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '6px' }}>
          {races.map(race => {
            const isSignedUp = Boolean(entrantId && race.roster.some(signup => signup.entrantId === entrantId))
            const actionLabel = getRaceActionLabel(race, isSignedUp)
            const canPressSignUp = !isSignedUp && canSignUp && race.openSlots > 0 && ['scheduled', 'staging'].includes(race.status)
            const canPressEnter = isSignedUp && ['staging', 'countdown'].includes(race.status) && new Date(race.startsAt).getTime() > nowMs
            const isPending = pendingRaceId === race.id
            const resultSummary = getResultSummary(race)
            const activeActionColor = canPressEnter ? '#35D06F' : '#2F80ED'
            const activeActionTextColor = canPressEnter ? '#061616' : '#ffffff'
            const activeActionShadow = canPressEnter ? 'rgba(53,208,111,0.28)' : 'rgba(47,128,237,0.3)'

            return (
              <div key={race.id} style={raceRowStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#ffffff', fontSize: '11px', fontWeight: 700, marginBottom: '4px', lineHeight: 1.2, whiteSpace: 'normal', overflowWrap: 'break-word' }}>
                    {race.trackName}
                  </div>
                  <div style={{ color: '#FFD166', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {formatUtcStart(race.startsAt)}
                  </div>
                  <div style={{ color: '#9BE7E0', fontSize: '11px', marginTop: '3px' }}>
                    {formatCountdown(race.startsAt, nowMs)}
                  </div>
                  <div style={{ color: '#cfcfcf', fontSize: '10px', marginTop: '3px', textTransform: 'uppercase' }}>
                    {race.status}
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#fff', fontSize: '11px', marginBottom: '5px' }}>
                    {race.signupCount}/{race.maxEntrants} slots
                  </div>
                  <div style={{ display: 'flex', gap: '4px', overflow: 'hidden' }}>
                    {race.roster.length === 0 && (
                      <span style={{ color: '#cfcfcf', fontSize: '11px' }}>No signups yet</span>
                    )}
                    {race.roster.map(signup => (
                      <div
                        key={signup.entrantId}
                        title={`${signup.gridSlot}. ${signup.foxName}`}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '5px',
                          border: `2px solid ${signup.carColor || '#9BE7E0'}`,
                          overflow: 'hidden',
                          background: 'rgba(255,255,255,0.1)',
                          flex: '0 0 auto',
                        }}
                      >
                        <img
                          src={getOrdinalContentUrl(signup.foxOriginOutpoint)}
                          alt={signup.foxName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated' }}
                        />
                      </div>
                    ))}
                  </div>
                  {resultSummary && (
                    <div
                      title={resultSummary}
                      style={{
                        color: race.status === 'no_contest' ? '#ffb3b3' : '#FFD166',
                        fontSize: '10px',
                        marginTop: '5px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {resultSummary}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => isSignedUp ? handleEnterRace(race) : handleSignUp(race)}
                  disabled={(!canPressSignUp && !canPressEnter) || isPending}
                  style={{
                    gridColumn: '1 / -1',
                    width: '100%',
                    height: 34,
                    borderRadius: '6px',
                    border: (canPressSignUp || canPressEnter) ? '1px solid rgba(255,255,255,0.34)' : '1px solid rgba(255,255,255,0.18)',
                    background: (canPressSignUp || canPressEnter) ? activeActionColor : 'rgba(255,255,255,0.08)',
                    color: (canPressSignUp || canPressEnter) ? activeActionTextColor : '#cfcfcf',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: (canPressSignUp || canPressEnter) ? 'pointer' : 'default',
                    padding: '0 6px',
                    whiteSpace: 'nowrap',
                    boxShadow: (canPressSignUp || canPressEnter) ? `0 0 14px ${activeActionShadow}` : 'none',
                  }}
                >
                  {isPending ? '...' : actionLabel}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})
