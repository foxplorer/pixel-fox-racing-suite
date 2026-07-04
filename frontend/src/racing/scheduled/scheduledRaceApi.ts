import type { ScheduledRace, ScheduledRaceSignupInput } from './scheduledRaceTypes'

export interface ScheduledRaceListOptions {
  transactionServerUrl: string
  trackName?: string
  limit?: number
  status?: 'upcoming' | 'completed'
  fetcher?: typeof fetch
}

export interface ScheduledRaceSignupOptions {
  transactionServerUrl: string
  raceId: string
  signup: ScheduledRaceSignupInput
  fetcher?: typeof fetch
}

export interface ScheduledRaceStageOptions {
  transactionServerUrl: string
  raceId: string
  entrantId: string
  fetcher?: typeof fetch
}

export interface ScheduledRaceWithdrawOptions {
  transactionServerUrl: string
  raceId: string
  entrantId: string
  fetcher?: typeof fetch
}

export interface ScheduledRaceResultOptions {
  transactionServerUrl: string
  raceId: string
  entrantId: string
  totalTimeMs: number
  lapTimesMs: number[]
  fetcher?: typeof fetch
}

export interface ScheduledRaceActionOptions {
  transactionServerUrl: string
  raceId: string
  fetcher?: typeof fetch
}

const trimTrailingSlash = (url: string): string => url.replace(/\/+$/, '')

const parseScheduledRaceResponse = async (response: Response): Promise<unknown> => {
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? String((payload as { message?: unknown }).message)
      : `Scheduled race request failed with ${response.status}`
    throw new Error(message)
  }
  return payload
}

export const fetchScheduledRaces = async ({
  transactionServerUrl,
  trackName,
  limit = 3,
  status,
  fetcher = fetch,
}: ScheduledRaceListOptions): Promise<ScheduledRace[]> => {
  const url = new URL(`${trimTrailingSlash(transactionServerUrl)}/scheduled-races`)
  if (trackName) url.searchParams.set('trackName', trackName)
  url.searchParams.set('limit', String(limit))
  if (status === 'completed') url.searchParams.set('status', status)

  const payload = await parseScheduledRaceResponse(await fetcher(url.toString()))
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { races?: unknown }).races)) {
    throw new Error('Scheduled race response did not include races')
  }
  return (payload as { races: ScheduledRace[] }).races
}

export const fetchCompletedScheduledRaces = async (options: Omit<ScheduledRaceListOptions, 'status'>): Promise<ScheduledRace[]> => (
  fetchScheduledRaces({ ...options, status: 'completed' })
)

export const signUpForScheduledRace = async ({
  transactionServerUrl,
  raceId,
  signup,
  fetcher = fetch,
}: ScheduledRaceSignupOptions): Promise<ScheduledRace> => {
  const url = `${trimTrailingSlash(transactionServerUrl)}/scheduled-races/${encodeURIComponent(raceId)}/signup`
  const payload = await parseScheduledRaceResponse(await fetcher(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(signup),
  }))
  if (!payload || typeof payload !== 'object' || !(payload as { race?: unknown }).race) {
    throw new Error('Scheduled race signup response did not include race')
  }
  return (payload as { race: ScheduledRace }).race
}

export const stageScheduledRaceEntrant = async ({
  transactionServerUrl,
  raceId,
  entrantId,
  fetcher = fetch,
}: ScheduledRaceStageOptions): Promise<ScheduledRace> => {
  const url = `${trimTrailingSlash(transactionServerUrl)}/scheduled-races/${encodeURIComponent(raceId)}/stage`
  const payload = await parseScheduledRaceResponse(await fetcher(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ entrantId }),
  }))
  if (!payload || typeof payload !== 'object' || !(payload as { race?: unknown }).race) {
    throw new Error('Scheduled race stage response did not include race')
  }
  return (payload as { race: ScheduledRace }).race
}

export const withdrawScheduledRaceSignup = async ({
  transactionServerUrl,
  raceId,
  entrantId,
  fetcher = fetch,
}: ScheduledRaceWithdrawOptions): Promise<ScheduledRace> => {
  const url = new URL(`${trimTrailingSlash(transactionServerUrl)}/scheduled-races/${encodeURIComponent(raceId)}/signup`)
  url.searchParams.set('entrantId', entrantId)
  const payload = await parseScheduledRaceResponse(await fetcher(url.toString(), {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  }))
  if (!payload || typeof payload !== 'object' || !(payload as { race?: unknown }).race) {
    throw new Error('Scheduled race withdrawal response did not include race')
  }
  return (payload as { race: ScheduledRace }).race
}

export const submitScheduledRaceResult = async ({
  transactionServerUrl,
  raceId,
  entrantId,
  totalTimeMs,
  lapTimesMs,
  fetcher = fetch,
}: ScheduledRaceResultOptions): Promise<ScheduledRace> => {
  const url = `${trimTrailingSlash(transactionServerUrl)}/scheduled-races/${encodeURIComponent(raceId)}/results`
  const payload = await parseScheduledRaceResponse(await fetcher(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ entrantId, totalTimeMs, lapTimesMs }),
  }))
  if (!payload || typeof payload !== 'object' || !(payload as { race?: unknown }).race) {
    throw new Error('Scheduled race result response did not include race')
  }
  return (payload as { race: ScheduledRace }).race
}

const postScheduledRaceAction = async ({
  transactionServerUrl,
  raceId,
  fetcher = fetch,
}: ScheduledRaceActionOptions, action: 'finalize' | 'final-inscription' | 'settle'): Promise<ScheduledRace> => {
  const url = `${trimTrailingSlash(transactionServerUrl)}/scheduled-races/${encodeURIComponent(raceId)}/${action}`
  const payload = await parseScheduledRaceResponse(await fetcher(url, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  }))
  if (!payload || typeof payload !== 'object' || !(payload as { race?: unknown }).race) {
    throw new Error(`Scheduled race ${action} response did not include race`)
  }
  return (payload as { race: ScheduledRace }).race
}

export const finalizeScheduledRace = async (options: ScheduledRaceActionOptions): Promise<ScheduledRace> => (
  postScheduledRaceAction(options, 'finalize')
)

export const createScheduledRaceFinalInscription = async (options: ScheduledRaceActionOptions): Promise<ScheduledRace> => (
  postScheduledRaceAction(options, 'final-inscription')
)

export const settleScheduledRace = async (options: ScheduledRaceActionOptions): Promise<ScheduledRace> => (
  postScheduledRaceAction(options, 'settle')
)

export const getScheduledRaceEntrantId = (foxOriginOutpoint: string | null | undefined): string | null => {
  const trimmed = foxOriginOutpoint?.trim()
  return trimmed ? trimmed.replace('.', '_') : null
}
