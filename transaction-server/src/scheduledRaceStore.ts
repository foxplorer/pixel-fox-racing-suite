import {
  buildScheduledRaceId,
  getScheduledRaceTrackForStart,
  getUpcomingScheduledRaceStarts,
  normalizeScheduledRaceTrackName,
  resolveScheduledRaceStatus,
  SCHEDULED_RACE_LAPS_REQUIRED,
  SCHEDULED_RACE_MAX_ENTRANTS,
  SCHEDULED_RACE_MIN_LAP_TIME_MS,
  SCHEDULED_RACE_TIMEOUT_MS,
} from './scheduledRaceLifecycle.js'
import {
  SCHEDULED_RACE_CAR_TRACKS,
  ScheduledRaceError,
  type ScheduledRaceFinalInscription,
  type ScheduledRaceFinalInscriptionPayload,
  type ScheduledRace,
  type ScheduledRaceLapProgressInput,
  type ScheduledRaceListOptions,
  type ScheduledRaceResult,
  type ScheduledRaceResultInput,
  type ScheduledRaceSignup,
  type ScheduledRaceSignupInput,
  type ScheduledRaceSignupStatus,
  type ScheduledRaceStore,
  type ScheduledRaceTrackName,
  type ScheduledRaceWithRoster,
} from './scheduledRaceTypes.js'
import {
  buildDummyMultiplayerRaceInscription,
  buildMultiplayerRaceInscriptionPayload,
  MULTIPLAYER_RACE_INSCRIPTION_NAME,
} from './multiplayerRaceInscription.js'
import { pool } from './db.js'
import type { PoolClient, QueryResult } from 'pg'

const DEFAULT_LIST_LIMIT = 3
const MAX_LIST_LIMIT = 12
const UPCOMING_LOOKAHEAD_PADDING = SCHEDULED_RACE_CAR_TRACKS.length

const normalizeEntrantId = (foxOriginOutpoint: string): string => foxOriginOutpoint.trim().replace('.', '_')

const requireText = (value: string | null | undefined, fieldName: string): string => {
  const trimmed = value?.trim()
  if (!trimmed) {
    throw new ScheduledRaceError('missing_field', `${fieldName} is required`)
  }
  return trimmed
}

const isActiveSignupStatus = (status: ScheduledRaceSignupStatus): boolean => (
  status !== 'withdrawn'
)

const sameText = (left: string, right: string): boolean => left.trim() === right.trim()

const toIso = (timestampMs: number): string => new Date(timestampMs).toISOString()

const makeDeterministicDummyTxid = (value: string): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return Array.from({ length: 64 }, (_, index) => ((hash >>> ((index % 4) * 8)) & 0xff).toString(16).padStart(2, '0')[index % 2]).join('')
}

export class MemoryScheduledRaceStore implements ScheduledRaceStore {
  private readonly races = new Map<string, ScheduledRace>()
  private readonly signups = new Map<string, ScheduledRaceSignup[]>()
  private readonly results = new Map<string, ScheduledRaceResult[]>()
  private readonly lapProgress = new Map<string, Map<string, number[]>>()
  private readonly finalInscriptions = new Map<string, ScheduledRaceFinalInscription>()

  constructor(private readonly intervalMs?: number) {}

  async listUpcoming(options: ScheduledRaceListOptions = {}): Promise<ScheduledRaceWithRoster[]> {
    const nowMs = options.nowMs ?? Date.now()
    const limit = Math.min(Math.max(Math.floor(options.limit ?? DEFAULT_LIST_LIMIT), 1), MAX_LIST_LIMIT)
    const requestedTrack = normalizeScheduledRaceTrackName(options.trackName)
    const starts = getUpcomingScheduledRaceStarts(nowMs, limit + UPCOMING_LOOKAHEAD_PADDING, this.intervalMs)

    for (const startsAtMs of starts) {
      if (requestedTrack) {
        this.ensureRace(requestedTrack, startsAtMs, nowMs)
      } else {
        this.ensureRace(getScheduledRaceTrackForStart(startsAtMs, this.intervalMs), startsAtMs, nowMs)
      }
    }

    return Array.from(this.races.values())
      .filter(race => requestedTrack ? race.trackName === requestedTrack : race.trackName === getScheduledRaceTrackForStart(new Date(race.startsAt).getTime(), this.intervalMs))
      .filter(race => new Date(race.startsAt).getTime() >= starts[0])
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() || a.trackName.localeCompare(b.trackName))
      .map(race => this.buildRaceWithRoster(race.id, nowMs))
      .filter(race => race.status !== 'cancelled')
      .slice(0, limit)
  }

  async listCompleted(options: ScheduledRaceListOptions = {}): Promise<ScheduledRaceWithRoster[]> {
    const nowMs = options.nowMs ?? Date.now()
    const limit = Math.min(Math.max(Math.floor(options.limit ?? DEFAULT_LIST_LIMIT), 1), MAX_LIST_LIMIT)
    const requestedTrack = normalizeScheduledRaceTrackName(options.trackName)
    const tracks = requestedTrack ? [requestedTrack] : [...SCHEDULED_RACE_CAR_TRACKS]
    const completedStatuses = new Set<ScheduledRace['status']>(['finalizing', 'settled', 'no_contest'])

    return Array.from(this.races.values())
      .filter(race => tracks.includes(race.trackName))
      .filter(race => completedStatuses.has(race.status))
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime() || a.trackName.localeCompare(b.trackName))
      .slice(0, limit)
      .map(race => this.buildRaceWithRoster(race.id, nowMs))
  }

  async signUp(raceId: string, input: ScheduledRaceSignupInput, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    const race = this.getRaceOrThrow(raceId)
    const current = this.buildRaceWithRoster(raceId, nowMs)

    if (!['scheduled', 'staging'].includes(current.status)) {
      throw new ScheduledRaceError('signup_closed', `Race ${raceId} is not accepting signups`, 409)
    }

    const identityKey = requireText(input.identityKey, 'identityKey')
    const ownerAddress = requireText(input.ownerAddress, 'ownerAddress')
    const foxOutpoint = requireText(input.foxOutpoint, 'foxOutpoint')
    const foxOriginOutpoint = requireText(input.foxOriginOutpoint, 'foxOriginOutpoint')
    const foxName = requireText(input.foxName, 'foxName')
    const entrantId = normalizeEntrantId(foxOriginOutpoint)
    const roster = this.signups.get(raceId) || []
    const nowIso = toIso(nowMs)
    const existing = roster.find(signup => signup.entrantId === entrantId)

    if (existing && isActiveSignupStatus(existing.status)) {
      if (!sameText(existing.ownerAddress, ownerAddress)) {
        throw new ScheduledRaceError('fox_already_signed_up', `Fox ${foxOriginOutpoint} is already signed up for ${raceId}`, 409)
      }
      existing.identityKey = identityKey
      existing.ownerAddress = ownerAddress
      existing.foxOutpoint = foxOutpoint
      existing.foxOriginOutpoint = foxOriginOutpoint
      existing.foxName = foxName
      existing.carColor = input.carColor ?? existing.carColor ?? null
      existing.status = 'signed_up'
      existing.stagedAt = null
      existing.stagedGridSlot = null
      race.updatedAt = nowIso
      return this.buildRaceWithRoster(raceId, nowMs)
    }

    const activeOwnerSignup = roster.find(signup => (
      isActiveSignupStatus(signup.status) && sameText(signup.ownerAddress, ownerAddress)
    ))
    if (activeOwnerSignup) {
      throw new ScheduledRaceError('owner_already_signed_up', `Owner ${ownerAddress} is already signed up for ${raceId}`, 409)
    }

    const activeIdentitySignup = roster.find(signup => (
      isActiveSignupStatus(signup.status) && sameText(signup.identityKey, identityKey)
    ))
    if (activeIdentitySignup) {
      throw new ScheduledRaceError('identity_already_signed_up', `Identity ${identityKey} is already signed up for ${raceId}`, 409)
    }

    const activeFoxOutpointSignup = roster.find(signup => (
      isActiveSignupStatus(signup.status) && sameText(signup.foxOutpoint, foxOutpoint)
    ))
    if (activeFoxOutpointSignup) {
      throw new ScheduledRaceError('fox_already_signed_up', `Fox ${foxOutpoint} is already signed up for ${raceId}`, 409)
    }

    if (roster.filter(signup => isActiveSignupStatus(signup.status)).length >= race.maxEntrants) {
      throw new ScheduledRaceError('race_full', `Race ${raceId} is full`, 409)
    }

    const gridSlot = this.getLowestAvailableGridSlot(roster, race.maxEntrants)
    if (existing) {
      existing.identityKey = identityKey
      existing.ownerAddress = ownerAddress
      existing.foxOutpoint = foxOutpoint
      existing.foxOriginOutpoint = foxOriginOutpoint
      existing.foxName = foxName
      existing.carColor = input.carColor ?? existing.carColor ?? null
      existing.gridSlot = gridSlot
      existing.status = 'signed_up'
      existing.signedUpAt = nowIso
      existing.stagedAt = null
      existing.stagedGridSlot = null
      race.updatedAt = nowIso
      return this.buildRaceWithRoster(raceId, nowMs)
    }

    roster.push({
      raceId,
      entrantId,
      identityKey,
      ownerAddress,
      foxOutpoint,
      foxOriginOutpoint,
      foxName,
      carColor: input.carColor ?? null,
      gridSlot,
      stagedGridSlot: null,
      status: 'signed_up',
      signedUpAt: nowIso,
      stagedAt: null,
    })
    this.signups.set(raceId, roster)
    race.updatedAt = nowIso
    return this.buildRaceWithRoster(raceId, nowMs)
  }

  async withdraw(raceId: string, entrantId: string, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    const race = this.getRaceOrThrow(raceId)
    const current = this.buildRaceWithRoster(raceId, nowMs)
    if (!['scheduled', 'staging'].includes(current.status)) {
      throw new ScheduledRaceError('withdrawal_closed', `Race ${raceId} is no longer accepting withdrawals`, 409)
    }

    const signup = this.getSignupOrThrow(raceId, entrantId)
    signup.status = 'withdrawn'
    signup.stagedAt = null
    signup.stagedGridSlot = null
    race.updatedAt = toIso(nowMs)
    return this.buildRaceWithRoster(raceId, nowMs)
  }

  async stage(raceId: string, entrantId: string, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    const race = this.getRaceOrThrow(raceId)
    const current = this.buildRaceWithRoster(raceId, nowMs)
    if (!['staging', 'countdown'].includes(current.status) || nowMs >= new Date(race.startsAt).getTime()) {
      throw new ScheduledRaceError('staging_closed', `Race ${raceId} is not in its staging window`, 409)
    }

    const signup = this.getSignupOrThrow(raceId, entrantId)
    if (signup.status === 'withdrawn') {
      throw new ScheduledRaceError('not_signed_up', `Entrant ${entrantId} is not signed up`, 404)
    }

    if (signup.status !== 'staged') {
      signup.stagedGridSlot = this.getLowestAvailableStagedGridSlot(this.signups.get(raceId) || [], race.maxEntrants)
      signup.status = 'staged'
      signup.stagedAt = toIso(nowMs)
    }
    race.updatedAt = toIso(nowMs)
    return this.buildRaceWithRoster(raceId, nowMs)
  }

  async unstage(raceId: string, entrantId: string, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    const race = this.getRaceOrThrow(raceId)
    const signup = this.getSignupOrThrow(raceId, entrantId)
    if (signup.status !== 'staged') {
      return this.buildRaceWithRoster(raceId, nowMs)
    }
    if (nowMs >= new Date(race.startsAt).getTime()) {
      throw new ScheduledRaceError('unstage_closed', `Race ${raceId} has already started`, 409)
    }

    signup.status = 'signed_up'
    signup.stagedAt = null
    signup.stagedGridSlot = null
    race.updatedAt = toIso(nowMs)
    return this.buildRaceWithRoster(raceId, nowMs)
  }

  async submitResult(raceId: string, input: ScheduledRaceResultInput, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    const race = this.getRaceOrThrow(raceId)
    const signup = this.getSignupOrThrow(raceId, input.entrantId)
    if (signup.status !== 'staged' && signup.status !== 'finished') {
      throw new ScheduledRaceError('entrant_not_staged', `Entrant ${input.entrantId} is not staged for ${raceId}`, 409)
    }

    const lapTimesMs = this.validateResultTiming(race, input)
    const existingResults = this.results.get(raceId) || []
    const existing = existingResults.find(result => result.entrantId === signup.entrantId)
    const nowIso = toIso(nowMs)

    if (existing) {
      if (existing.totalTimeMs !== input.totalTimeMs || JSON.stringify(existing.lapTimesMs) !== JSON.stringify(lapTimesMs)) {
        throw new ScheduledRaceError('result_conflict', `Result already exists for entrant ${input.entrantId}`, 409)
      }
      return this.buildRaceWithRoster(raceId, nowMs)
    }

    this.assertRaceAcceptsResults(race, nowMs)

    const result: ScheduledRaceResult = {
      raceId,
      entrantId: signup.entrantId,
      finishPosition: existingResults.length + 1,
      totalTimeMs: input.totalTimeMs,
      lapTimesMs,
      status: 'finished',
      finishedAt: nowIso,
    }
    existingResults.push(result)
    this.sortAndRankResults(existingResults)
    this.results.set(raceId, existingResults)
    signup.status = 'finished'
    race.updatedAt = nowIso

    if (this.shouldSettleEarly(raceId, nowMs)) {
      return this.settleRace(raceId, nowMs)
    }
    return this.buildRaceWithRoster(raceId, nowMs)
  }

  private assertRaceAcceptsResults(race: ScheduledRace, nowMs: number): void {
    const currentStatus = this.resolveRaceStatus(race, nowMs)
    if (['cancelled', 'settled', 'no_contest', 'finalizing'].includes(currentStatus)) {
      throw new ScheduledRaceError('race_not_accepting_results', `Race ${race.id} is no longer accepting results`, 409)
    }
    if (nowMs < new Date(race.startsAt).getTime()) {
      throw new ScheduledRaceError('race_not_started', `Race ${race.id} has not started yet`, 409)
    }
  }

  private shouldSettleEarly(raceId: string, nowMs: number): boolean {
    const race = this.races.get(raceId)
    if (!race || this.resolveRaceStatus(race, nowMs) !== 'racing') return false
    const participants = (this.signups.get(raceId) || [])
      .filter(signup => signup.status === 'staged' || signup.status === 'finished')
    if (participants.length === 0) return false
    const results = this.results.get(raceId) || []
    return participants.every(participant => (
      results.some(result => result.entrantId === participant.entrantId && result.status === 'finished')
    ))
  }

  async recordLapProgress(raceId: string, input: ScheduledRaceLapProgressInput, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    const race = this.getRaceOrThrow(raceId)
    const signup = this.getSignupOrThrow(raceId, input.entrantId)
    if (signup.status !== 'staged' && signup.status !== 'finished') {
      throw new ScheduledRaceError('entrant_not_staged', `Entrant ${input.entrantId} is not staged for ${raceId}`, 409)
    }

    const lapTimesMs = this.validateLapProgress(race, input)
    const progressByEntrant = this.lapProgress.get(raceId) || new Map<string, number[]>()
    const existing = progressByEntrant.get(signup.entrantId) || []
    if (lapTimesMs.length >= existing.length) {
      progressByEntrant.set(signup.entrantId, lapTimesMs)
      this.lapProgress.set(raceId, progressByEntrant)
      race.updatedAt = toIso(nowMs)
    }
    return this.buildRaceWithRoster(raceId, nowMs)
  }

  async finalizeRace(raceId: string, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    const race = this.getRaceOrThrow(raceId)
    if (['settled', 'no_contest', 'cancelled'].includes(race.status)) {
      return this.buildRaceWithRoster(raceId, nowMs)
    }

    const roster = this.signups.get(raceId) || []
    const results = this.results.get(raceId) || []
    const nowIso = toIso(nowMs)

    for (const signup of roster) {
      if (signup.status !== 'staged') continue
      signup.status = 'dnf'
      if (!results.some(result => result.entrantId === signup.entrantId)) {
        const lapTimesMs = this.lapProgress.get(raceId)?.get(signup.entrantId) || []
        results.push({
          raceId,
          entrantId: signup.entrantId,
          finishPosition: null,
          totalTimeMs: null,
          lapTimesMs: [...lapTimesMs],
          status: 'dnf',
          finishedAt: nowIso,
        })
      }
    }

    this.sortAndRankResults(results)
    this.results.set(raceId, results)
    race.status = results.some(result => result.status === 'finished') ? 'finalizing' : 'no_contest'
    race.updatedAt = nowIso
    return this.buildRaceWithRoster(raceId, nowMs)
  }

  async createFinalInscription(raceId: string, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    const race = this.getRaceOrThrow(raceId)
    const existingFinalInscription = this.finalInscriptions.get(raceId)
    if (existingFinalInscription) {
      return this.buildRaceWithRoster(raceId, nowMs)
    }

    const current = this.buildRaceWithRoster(raceId, nowMs)
    if (!['finalizing', 'no_contest'].includes(current.status)) {
      throw new ScheduledRaceError('race_not_finalized', `Race ${raceId} is not ready for final inscription`, 409)
    }

    const nowIso = toIso(nowMs)
    const finalInscriptionPayload = this.buildFinalInscriptionPayload(current, nowIso)
    const hasFinishers = current.results.some(result => result.status === 'finished')
    const dummyInscription = buildDummyMultiplayerRaceInscription({
      txid: hasFinishers ? makeDeterministicDummyTxid(`multiplayer-race:${raceId}`) : null,
      payload: finalInscriptionPayload.inscriptionPayload as ReturnType<typeof buildMultiplayerRaceInscriptionPayload>,
    })
    const finalInscription: ScheduledRaceFinalInscription = {
      raceId,
      txid: dummyInscription.txid,
      status: dummyInscription.status === 'success' ? 'broadcasted' : 'no_contest',
      dummy: dummyInscription.dummy,
      inscriptionName: dummyInscription.inscriptionName,
      outputIndex: dummyInscription.outputIndex,
      finalInscriptionPayload,
      errorMessage: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    this.finalInscriptions.set(raceId, finalInscription)
    race.status = finalInscription.status === 'broadcasted' ? 'settled' : 'no_contest'
    race.updatedAt = nowIso
    return this.buildRaceWithRoster(raceId, nowMs)
  }

  async settleRace(raceId: string, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    const finalized = await this.finalizeRace(raceId, nowMs)
    if (finalized.status === 'finalizing' || finalized.status === 'no_contest') {
      return this.createFinalInscription(raceId, nowMs)
    }
    return finalized
  }

  async settleDueRaces(nowMs = Date.now()): Promise<ScheduledRaceWithRoster[]> {
    const settled: ScheduledRaceWithRoster[] = []
    for (const race of this.races.values()) {
      const startsAtMs = new Date(race.startsAt).getTime()
      if (!Number.isFinite(startsAtMs) || nowMs < startsAtMs + SCHEDULED_RACE_TIMEOUT_MS) continue
      if (['settled', 'cancelled', 'no_contest'].includes(race.status)) continue
      settled.push(await this.settleRace(race.id, nowMs))
    }
    return settled
  }

  private ensureRace(trackName: ScheduledRaceTrackName, startsAtMs: number, nowMs: number): ScheduledRace {
    const id = buildScheduledRaceId(trackName, startsAtMs)
    const existing = this.races.get(id)
    if (existing) {
      existing.status = this.resolveRaceStatus(existing, nowMs)
      return existing
    }

    const nowIso = toIso(nowMs)
    const race: ScheduledRace = {
      id,
      trackName,
      startsAt: toIso(startsAtMs),
      status: 'scheduled',
      maxEntrants: SCHEDULED_RACE_MAX_ENTRANTS,
      lapsRequired: SCHEDULED_RACE_LAPS_REQUIRED,
      createdAt: nowIso,
      updatedAt: nowIso,
    }
    this.races.set(id, race)
    this.signups.set(id, [])
    this.results.set(id, [])
    this.lapProgress.set(id, new Map())
    return race
  }

  private buildFinalInscriptionPayload(race: ScheduledRaceWithRoster, finalizedAt: string): ScheduledRaceFinalInscriptionPayload {
    const inscriptionPayload = buildMultiplayerRaceInscriptionPayload(race, finalizedAt)

    return {
      raceId: race.id,
      trackName: race.trackName,
      startsAt: race.startsAt,
      lapsRequired: race.lapsRequired,
      results: race.results.map(result => ({ ...result, lapTimesMs: [...result.lapTimesMs] })),
      recipients: [],
      finalizedAt,
      inscriptionName: MULTIPLAYER_RACE_INSCRIPTION_NAME,
      outputIndex: race.results.some(result => result.status === 'finished') ? 0 : null,
      inscriptionPayload,
    }
  }

  private validateResultTiming(race: ScheduledRace, input: ScheduledRaceResultInput): number[] {
    if (!Number.isFinite(input.totalTimeMs) || input.totalTimeMs <= 0) {
      throw new ScheduledRaceError('invalid_result_time', 'totalTimeMs must be a positive finite number')
    }
    if (!Array.isArray(input.lapTimesMs) || input.lapTimesMs.length !== race.lapsRequired) {
      throw new ScheduledRaceError('invalid_lap_count', `Race ${race.id} requires ${race.lapsRequired} laps`)
    }
    const lapTimesMs = input.lapTimesMs.map(lapTimeMs => Math.round(lapTimeMs))
    if (!lapTimesMs.every(lapTimeMs => Number.isFinite(lapTimeMs) && lapTimeMs > 0)) {
      throw new ScheduledRaceError('invalid_lap_time', 'lapTimesMs must contain positive finite numbers')
    }
    if (!lapTimesMs.every(lapTimeMs => lapTimeMs >= SCHEDULED_RACE_MIN_LAP_TIME_MS)) {
      throw new ScheduledRaceError('invalid_lap_time', `Each lap must be at least ${SCHEDULED_RACE_MIN_LAP_TIME_MS / 1000} seconds`)
    }

    const totalTimeMs = Math.round(input.totalTimeMs)
    const summedLapTimesMs = lapTimesMs.reduce((total, lapTimeMs) => total + lapTimeMs, 0)
    if (Math.abs(summedLapTimesMs - totalTimeMs) > 1) {
      throw new ScheduledRaceError('result_total_mismatch', 'totalTimeMs must equal summed lapTimesMs', 409)
    }

    input.totalTimeMs = totalTimeMs
    return lapTimesMs
  }

  private validateLapProgress(race: ScheduledRace, input: ScheduledRaceLapProgressInput): number[] {
    if (!Array.isArray(input.lapTimesMs) || input.lapTimesMs.length > race.lapsRequired) {
      throw new ScheduledRaceError('invalid_lap_count', `Race ${race.id} accepts up to ${race.lapsRequired} progress laps`)
    }
    const lapTimesMs = input.lapTimesMs.map(lapTimeMs => Math.round(lapTimeMs))
    if (!lapTimesMs.every(lapTimeMs => Number.isFinite(lapTimeMs) && lapTimeMs > 0)) {
      throw new ScheduledRaceError('invalid_lap_time', 'lapTimesMs must contain positive finite numbers')
    }
    if (!lapTimesMs.every(lapTimeMs => lapTimeMs >= SCHEDULED_RACE_MIN_LAP_TIME_MS)) {
      throw new ScheduledRaceError('invalid_lap_time', `Each lap must be at least ${SCHEDULED_RACE_MIN_LAP_TIME_MS / 1000} seconds`)
    }
    return lapTimesMs
  }

  private sortAndRankResults(results: ScheduledRaceResult[]): void {
    results.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'finished' ? -1 : 1
      if (a.status === 'dnf' || b.status === 'dnf') return a.finishedAt.localeCompare(b.finishedAt)
      return (a.totalTimeMs ?? Number.MAX_SAFE_INTEGER) - (b.totalTimeMs ?? Number.MAX_SAFE_INTEGER)
        || a.finishedAt.localeCompare(b.finishedAt)
    })

    let finishPosition = 1
    for (const result of results) {
      if (result.status === 'finished') {
        result.finishPosition = finishPosition
        finishPosition += 1
      } else {
        result.finishPosition = null
      }
    }
  }

  private getRaceOrThrow(raceId: string): ScheduledRace {
    const race = this.races.get(raceId)
    if (!race) {
      throw new ScheduledRaceError('race_not_found', `Race ${raceId} was not found`, 404)
    }
    return race
  }

  private getSignupOrThrow(raceId: string, entrantId: string): ScheduledRaceSignup {
    const normalizedEntrantId = normalizeEntrantId(entrantId)
    const signup = (this.signups.get(raceId) || []).find(candidate => candidate.entrantId === normalizedEntrantId)
    if (!signup || signup.status === 'withdrawn') {
      throw new ScheduledRaceError('signup_not_found', `Entrant ${entrantId} is not signed up for ${raceId}`, 404)
    }
    return signup
  }

  private getLowestAvailableGridSlot(roster: ScheduledRaceSignup[], maxEntrants: number): number {
    const usedSlots = new Set(roster.filter(signup => isActiveSignupStatus(signup.status)).map(signup => signup.gridSlot))
    for (let slot = 1; slot <= maxEntrants; slot++) {
      if (!usedSlots.has(slot)) return slot
    }
    throw new ScheduledRaceError('race_full', 'No grid slots are available', 409)
  }

  private getLowestAvailableStagedGridSlot(roster: ScheduledRaceSignup[], maxEntrants: number): number {
    const usedSlots = new Set(
      roster
        .filter(signup => signup.status === 'staged')
        .map(signup => signup.stagedGridSlot ?? signup.gridSlot)
    )
    for (let slot = 1; slot <= maxEntrants; slot++) {
      if (!usedSlots.has(slot)) return slot
    }
    throw new ScheduledRaceError('race_full', 'No staged grid slots are available', 409)
  }

  private buildRaceWithRoster(raceId: string, nowMs: number): ScheduledRaceWithRoster {
    const race = this.getRaceOrThrow(raceId)
    race.status = this.resolveRaceStatus(race, nowMs)
    const roster = (this.signups.get(raceId) || [])
      .filter(signup => isActiveSignupStatus(signup.status))
      .sort((a, b) => a.gridSlot - b.gridSlot)
      .map(signup => ({ ...signup }))
    const signupCount = roster.length
    const stagedCount = roster.filter(signup => signup.status === 'staged').length
    const results = [...(this.results.get(raceId) || [])].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'finished' ? -1 : 1
      return (a.finishPosition ?? Number.MAX_SAFE_INTEGER) - (b.finishPosition ?? Number.MAX_SAFE_INTEGER)
        || a.finishedAt.localeCompare(b.finishedAt)
    })
    const podium = results.filter(result => result.status === 'finished' && (result.finishPosition ?? 0) <= 3)

    return {
      ...race,
      roster,
      results,
      podium,
      finalInscription: this.finalInscriptions.get(raceId) ?? null,
      signupCount,
      stagedCount,
      openSlots: Math.max(0, race.maxEntrants - signupCount),
      serverTime: toIso(nowMs),
    }
  }

  private resolveRaceStatus(race: ScheduledRace, nowMs: number) {
    const roster = (this.signups.get(race.id) || []).filter(signup => isActiveSignupStatus(signup.status))
    return resolveScheduledRaceStatus({
      startsAtMs: new Date(race.startsAt).getTime(),
      nowMs,
      signupCount: roster.length,
      stagedCount: roster.filter(signup => ['staged', 'finished', 'dnf'].includes(signup.status)).length,
      currentStatus: race.status,
    })
  }
}

type DbClient = Pick<PoolClient, 'query'>

const isUniqueViolation = (error: unknown): boolean => (
  typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === '23505'
)

const parseJsonNumberArray = (value: unknown): number[] => {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value
  return Array.isArray(parsed) ? parsed.map(item => Number(item)).filter(Number.isFinite) : []
}

export class PostgresScheduledRaceStore implements ScheduledRaceStore {
  constructor(private readonly intervalMs?: number) {}

  async listUpcoming(options: ScheduledRaceListOptions = {}): Promise<ScheduledRaceWithRoster[]> {
    const nowMs = options.nowMs ?? Date.now()
    const limit = Math.min(Math.max(Math.floor(options.limit ?? DEFAULT_LIST_LIMIT), 1), MAX_LIST_LIMIT)
    const requestedTrack = normalizeScheduledRaceTrackName(options.trackName)
    const starts = getUpcomingScheduledRaceStarts(nowMs, limit + UPCOMING_LOOKAHEAD_PADDING, this.intervalMs)

    for (const startsAtMs of starts) {
      await this.ensureRace(
        requestedTrack || getScheduledRaceTrackForStart(startsAtMs, this.intervalMs),
        startsAtMs,
        nowMs
      )
    }

    const rows = await pool.query(`
      SELECT *
      FROM scheduled_races
      WHERE starts_at >= $1
        AND ($2::text IS NULL OR track_name = $2)
      ORDER BY starts_at ASC, track_name ASC
      LIMIT $3
    `, [toIso(starts[0]), requestedTrack, limit + UPCOMING_LOOKAHEAD_PADDING])

    const races = []
    for (const row of rows.rows) {
      const race = await this.buildRaceWithRoster(String(row.id), nowMs)
      if (!requestedTrack && race.trackName !== getScheduledRaceTrackForStart(new Date(race.startsAt).getTime(), this.intervalMs)) {
        continue
      }
      if (race.status !== 'cancelled') races.push(race)
      if (races.length >= limit) break
    }
    return races
  }

  async listCompleted(options: ScheduledRaceListOptions = {}): Promise<ScheduledRaceWithRoster[]> {
    const nowMs = options.nowMs ?? Date.now()
    const limit = Math.min(Math.max(Math.floor(options.limit ?? DEFAULT_LIST_LIMIT), 1), MAX_LIST_LIMIT)
    const requestedTrack = normalizeScheduledRaceTrackName(options.trackName)
    const rows = await pool.query(`
      SELECT *
      FROM scheduled_races
      WHERE status = ANY($1)
        AND ($2::text IS NULL OR track_name = $2)
      ORDER BY starts_at DESC, track_name ASC
      LIMIT $3
    `, [['finalizing', 'settled', 'no_contest'], requestedTrack, limit])

    return Promise.all(rows.rows.map(row => this.buildRaceWithRoster(String(row.id), nowMs)))
  }

  async signUp(raceId: string, input: ScheduledRaceSignupInput, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const race = await this.getRaceOrThrow(raceId, client)
      const current = await this.buildRaceWithRoster(raceId, nowMs, client)
      if (!['scheduled', 'staging'].includes(current.status)) {
        throw new ScheduledRaceError('signup_closed', `Race ${raceId} is not accepting signups`, 409)
      }

      const identityKey = requireText(input.identityKey, 'identityKey')
      const ownerAddress = requireText(input.ownerAddress, 'ownerAddress')
      const foxOutpoint = requireText(input.foxOutpoint, 'foxOutpoint')
      const foxOriginOutpoint = requireText(input.foxOriginOutpoint, 'foxOriginOutpoint')
      const foxName = requireText(input.foxName, 'foxName')
      const entrantId = normalizeEntrantId(foxOriginOutpoint)
      const roster = await this.getRoster(raceId, client, true)
      const existing = roster.find(signup => signup.entrantId === entrantId)
      const nowIso = toIso(nowMs)

      if (existing && isActiveSignupStatus(existing.status)) {
        if (!sameText(existing.ownerAddress, ownerAddress)) {
          throw new ScheduledRaceError('fox_already_signed_up', `Fox ${foxOriginOutpoint} is already signed up for ${raceId}`, 409)
        }
        await client.query(`
          UPDATE scheduled_race_signups
          SET identity_key = $3,
              owner_address = $4,
              fox_outpoint = $5,
              fox_origin_outpoint = $6,
              fox_name = $7,
              car_color = $8,
              status = 'signed_up',
              staged_at = NULL,
              staged_grid_slot = NULL
          WHERE race_id = $1 AND entrant_id = $2
        `, [raceId, entrantId, identityKey, ownerAddress, foxOutpoint, foxOriginOutpoint, foxName, input.carColor ?? existing.carColor ?? null])
        await this.touchRace(raceId, nowIso, client)
        await client.query('COMMIT')
        return this.buildRaceWithRoster(raceId, nowMs)
      }

      this.assertNoSignupConflict(roster, {
        identityKey,
        ownerAddress,
        foxOutpoint,
        foxOriginOutpoint,
        raceId,
      })

      if (roster.filter(signup => isActiveSignupStatus(signup.status)).length >= race.maxEntrants) {
        throw new ScheduledRaceError('race_full', `Race ${raceId} is full`, 409)
      }

      const gridSlot = this.getLowestAvailableGridSlot(roster, race.maxEntrants)
      try {
        await client.query(`
          INSERT INTO scheduled_race_signups (
            race_id, entrant_id, identity_key, owner_address, fox_outpoint,
            fox_origin_outpoint, fox_name, car_color, grid_slot, staged_grid_slot,
            status, signed_up_at, staged_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, 'signed_up', $10, NULL)
          ON CONFLICT (race_id, entrant_id)
          DO UPDATE SET
            identity_key = EXCLUDED.identity_key,
            owner_address = EXCLUDED.owner_address,
            fox_outpoint = EXCLUDED.fox_outpoint,
            fox_origin_outpoint = EXCLUDED.fox_origin_outpoint,
            fox_name = EXCLUDED.fox_name,
            car_color = EXCLUDED.car_color,
            grid_slot = EXCLUDED.grid_slot,
            staged_grid_slot = NULL,
            status = 'signed_up',
            signed_up_at = EXCLUDED.signed_up_at,
            staged_at = NULL
          WHERE scheduled_race_signups.status = 'withdrawn'
        `, [raceId, entrantId, identityKey, ownerAddress, foxOutpoint, foxOriginOutpoint, foxName, input.carColor ?? null, gridSlot, nowIso])
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ScheduledRaceError('signup_conflict', `Signup conflicts with an active entrant for ${raceId}`, 409)
        }
        throw error
      }
      await this.touchRace(raceId, nowIso, client)
      await client.query('COMMIT')
      return this.buildRaceWithRoster(raceId, nowMs)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async withdraw(raceId: string, entrantId: string, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const current = await this.buildRaceWithRoster(raceId, nowMs, client)
      if (!['scheduled', 'staging'].includes(current.status)) {
        throw new ScheduledRaceError('withdrawal_closed', `Race ${raceId} is no longer accepting withdrawals`, 409)
      }
      const signup = await this.getSignupOrThrow(raceId, entrantId, client)
      await client.query(`
        UPDATE scheduled_race_signups
        SET status = 'withdrawn', staged_at = NULL, staged_grid_slot = NULL
        WHERE race_id = $1 AND entrant_id = $2
      `, [raceId, signup.entrantId])
      await this.touchRace(raceId, toIso(nowMs), client)
      await client.query('COMMIT')
      return this.buildRaceWithRoster(raceId, nowMs)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async stage(raceId: string, entrantId: string, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const race = await this.getRaceOrThrow(raceId, client)
      const current = await this.buildRaceWithRoster(raceId, nowMs, client)
      if (!['staging', 'countdown'].includes(current.status) || nowMs >= new Date(race.startsAt).getTime()) {
        throw new ScheduledRaceError('staging_closed', `Race ${raceId} is not in its staging window`, 409)
      }
      const signup = await this.getSignupOrThrow(raceId, entrantId, client)
      if (signup.status !== 'staged') {
        const roster = await this.getRoster(raceId, client, true)
        const stagedGridSlot = this.getLowestAvailableStagedGridSlot(roster, race.maxEntrants)
        await client.query(`
          UPDATE scheduled_race_signups
          SET status = 'staged', staged_grid_slot = $3, staged_at = $4
          WHERE race_id = $1 AND entrant_id = $2
        `, [raceId, signup.entrantId, stagedGridSlot, toIso(nowMs)])
      }
      await this.touchRace(raceId, toIso(nowMs), client)
      await client.query('COMMIT')
      return this.buildRaceWithRoster(raceId, nowMs)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async unstage(raceId: string, entrantId: string, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const race = await this.getRaceOrThrow(raceId, client)
      const signup = await this.getSignupOrThrow(raceId, entrantId, client)
      if (signup.status !== 'staged') {
        await client.query('COMMIT')
        return this.buildRaceWithRoster(raceId, nowMs)
      }
      if (nowMs >= new Date(race.startsAt).getTime()) {
        throw new ScheduledRaceError('unstage_closed', `Race ${raceId} has already started`, 409)
      }
      await client.query(`
        UPDATE scheduled_race_signups
        SET status = 'signed_up', staged_at = NULL, staged_grid_slot = NULL
        WHERE race_id = $1 AND entrant_id = $2
      `, [raceId, signup.entrantId])
      await this.touchRace(raceId, toIso(nowMs), client)
      await client.query('COMMIT')
      return this.buildRaceWithRoster(raceId, nowMs)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async recordLapProgress(raceId: string, input: ScheduledRaceLapProgressInput, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const race = await this.getRaceOrThrow(raceId, client)
      const signup = await this.getSignupOrThrow(raceId, input.entrantId, client)
      if (signup.status !== 'staged' && signup.status !== 'finished') {
        throw new ScheduledRaceError('entrant_not_staged', `Entrant ${input.entrantId} is not staged for ${raceId}`, 409)
      }
      const lapTimesMs = this.validateLapProgress(race, input)
      const existingResult = await client.query(`
        SELECT lap_times_ms FROM scheduled_race_lap_progress WHERE race_id = $1 AND entrant_id = $2
      `, [raceId, signup.entrantId])
      const existing = existingResult.rows[0] ? parseJsonNumberArray(existingResult.rows[0].lap_times_ms) : []
      if (lapTimesMs.length >= existing.length) {
        await client.query(`
          INSERT INTO scheduled_race_lap_progress (race_id, entrant_id, lap_times_ms, updated_at)
          VALUES ($1, $2, $3::jsonb, $4)
          ON CONFLICT (race_id, entrant_id)
          DO UPDATE SET lap_times_ms = EXCLUDED.lap_times_ms, updated_at = EXCLUDED.updated_at
        `, [raceId, signup.entrantId, JSON.stringify(lapTimesMs), toIso(nowMs)])
        await this.touchRace(raceId, toIso(nowMs), client)
      }
      await client.query('COMMIT')
      return this.buildRaceWithRoster(raceId, nowMs)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async submitResult(raceId: string, input: ScheduledRaceResultInput, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    let settleEarly = false
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const race = await this.getRaceOrThrow(raceId, client)
      const signup = await this.getSignupOrThrow(raceId, input.entrantId, client)
      if (signup.status !== 'staged' && signup.status !== 'finished') {
        throw new ScheduledRaceError('entrant_not_staged', `Entrant ${input.entrantId} is not staged for ${raceId}`, 409)
      }
      const lapTimesMs = this.validateResultTiming(race, input)
      const existingResults = await this.getResults(raceId, client)
      const existing = existingResults.find(result => result.entrantId === signup.entrantId)
      if (existing) {
        if (existing.totalTimeMs !== input.totalTimeMs || JSON.stringify(existing.lapTimesMs) !== JSON.stringify(lapTimesMs)) {
          throw new ScheduledRaceError('result_conflict', `Result already exists for entrant ${input.entrantId}`, 409)
        }
        await client.query('COMMIT')
        return this.buildRaceWithRoster(raceId, nowMs)
      }

      const roster = await this.getRoster(raceId, client)
      const startsAtMs = new Date(race.startsAt).getTime()
      const currentStatus = resolveScheduledRaceStatus({
        startsAtMs,
        nowMs,
        signupCount: roster.length,
        stagedCount: roster.filter(candidate => ['staged', 'finished', 'dnf'].includes(candidate.status)).length,
        currentStatus: race.status,
      })
      if (['cancelled', 'settled', 'no_contest', 'finalizing'].includes(currentStatus)) {
        throw new ScheduledRaceError('race_not_accepting_results', `Race ${raceId} is no longer accepting results`, 409)
      }
      if (nowMs < startsAtMs) {
        throw new ScheduledRaceError('race_not_started', `Race ${raceId} has not started yet`, 409)
      }

      const results = [...existingResults, {
        raceId,
        entrantId: signup.entrantId,
        finishPosition: existingResults.length + 1,
        totalTimeMs: input.totalTimeMs,
        lapTimesMs,
        status: 'finished' as const,
        finishedAt: toIso(nowMs),
      }]
      this.sortAndRankResults(results)
      await this.replaceResults(raceId, results, client)
      await client.query(`
        UPDATE scheduled_race_signups SET status = 'finished' WHERE race_id = $1 AND entrant_id = $2
      `, [raceId, signup.entrantId])
      await this.touchRace(raceId, toIso(nowMs), client)

      const participants = roster
        .map(candidate => candidate.entrantId === signup.entrantId ? { ...candidate, status: 'finished' as const } : candidate)
        .filter(candidate => candidate.status === 'staged' || candidate.status === 'finished')
      settleEarly = currentStatus === 'racing'
        && participants.length > 0
        && participants.every(participant => (
          results.some(result => result.entrantId === participant.entrantId && result.status === 'finished')
        ))
      await client.query('COMMIT')
      if (settleEarly) {
        return this.settleRace(raceId, nowMs)
      }
      return this.buildRaceWithRoster(raceId, nowMs)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async finalizeRace(raceId: string, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const race = await this.getRaceOrThrow(raceId, client)
      if (['settled', 'no_contest', 'cancelled'].includes(race.status)) {
        await client.query('COMMIT')
        return this.buildRaceWithRoster(raceId, nowMs)
      }
      const roster = await this.getRoster(raceId, client, true)
      const progress = await this.getLapProgress(raceId, client)
      const results = await this.getResults(raceId, client)
      const nowIso = toIso(nowMs)
      for (const signup of roster) {
        if (signup.status !== 'staged') continue
        await client.query(`
          UPDATE scheduled_race_signups SET status = 'dnf' WHERE race_id = $1 AND entrant_id = $2
        `, [raceId, signup.entrantId])
        if (!results.some(result => result.entrantId === signup.entrantId)) {
          results.push({
            raceId,
            entrantId: signup.entrantId,
            finishPosition: null,
            totalTimeMs: null,
            lapTimesMs: progress.get(signup.entrantId) || [],
            status: 'dnf',
            finishedAt: nowIso,
          })
        }
      }
      this.sortAndRankResults(results)
      await this.replaceResults(raceId, results, client)
      const nextStatus = results.some(result => result.status === 'finished') ? 'finalizing' : 'no_contest'
      await client.query(`
        UPDATE scheduled_races SET status = $2, updated_at = $3 WHERE id = $1
      `, [raceId, nextStatus, nowIso])
      await client.query('COMMIT')
      return this.buildRaceWithRoster(raceId, nowMs)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async createFinalInscription(raceId: string, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await this.getRaceOrThrow(raceId, client)
      const existingFinalInscription = await this.getFinalInscription(raceId, client)
      if (existingFinalInscription) {
        await client.query('COMMIT')
        return this.buildRaceWithRoster(raceId, nowMs)
      }
      const current = await this.buildRaceWithRoster(raceId, nowMs, client)
      if (!['finalizing', 'no_contest'].includes(current.status)) {
        throw new ScheduledRaceError('race_not_finalized', `Race ${raceId} is not ready for final inscription`, 409)
      }
      const nowIso = toIso(nowMs)
      const finalInscriptionPayload = this.buildFinalInscriptionPayload(current, nowIso)
      const hasFinishers = current.results.some(result => result.status === 'finished')
      const dummyInscription = buildDummyMultiplayerRaceInscription({
        txid: hasFinishers ? makeDeterministicDummyTxid(`multiplayer-race:${raceId}`) : null,
        payload: finalInscriptionPayload.inscriptionPayload as ReturnType<typeof buildMultiplayerRaceInscriptionPayload>,
      })
      const finalInscription: ScheduledRaceFinalInscription = {
        raceId,
        txid: dummyInscription.txid,
        status: dummyInscription.status === 'success' ? 'broadcasted' : 'no_contest',
        dummy: dummyInscription.dummy,
        inscriptionName: dummyInscription.inscriptionName,
        outputIndex: dummyInscription.outputIndex,
        finalInscriptionPayload,
        errorMessage: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      }
      await client.query(`
        INSERT INTO scheduled_race_final_inscriptions (
          race_id, txid, dummy, inscription_name, output_index, status,
          final_inscription_payload, error_message, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
      `, [
        finalInscription.raceId,
        finalInscription.txid,
        finalInscription.dummy === true,
        finalInscription.inscriptionName ?? null,
        finalInscription.outputIndex,
        finalInscription.status,
        JSON.stringify(finalInscription.finalInscriptionPayload),
        finalInscription.errorMessage,
        finalInscription.createdAt,
        finalInscription.updatedAt,
      ])
      await client.query(`
        UPDATE scheduled_races SET status = $2, updated_at = $3 WHERE id = $1
      `, [raceId, finalInscription.status === 'broadcasted' ? 'settled' : 'no_contest', nowIso])
      await client.query('COMMIT')
      return this.buildRaceWithRoster(raceId, nowMs)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async settleRace(raceId: string, nowMs = Date.now()): Promise<ScheduledRaceWithRoster> {
    const finalized = await this.finalizeRace(raceId, nowMs)
    if (finalized.status === 'finalizing' || finalized.status === 'no_contest') {
      return this.createFinalInscription(raceId, nowMs)
    }
    return finalized
  }

  async settleDueRaces(nowMs = Date.now()): Promise<ScheduledRaceWithRoster[]> {
    const rows = await pool.query(`
      SELECT id
      FROM scheduled_races
      WHERE starts_at <= $1::timestamptz - ($2::text)::interval
        AND status <> ALL($3)
      ORDER BY starts_at ASC
      LIMIT 24
    `, [toIso(nowMs), `${Math.floor(SCHEDULED_RACE_TIMEOUT_MS / 1000)} seconds`, ['settled', 'cancelled', 'no_contest']])
    const settled: ScheduledRaceWithRoster[] = []
    for (const row of rows.rows) {
      settled.push(await this.settleRace(String(row.id), nowMs))
    }
    return settled
  }

  private async ensureRace(trackName: ScheduledRaceTrackName, startsAtMs: number, nowMs: number): Promise<ScheduledRace> {
    const id = buildScheduledRaceId(trackName, startsAtMs)
    const nowIso = toIso(nowMs)
    await pool.query(`
      INSERT INTO scheduled_races (id, track_name, starts_at, status, max_entrants, laps_required, created_at, updated_at)
      VALUES ($1, $2, $3, 'scheduled', $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING
    `, [id, trackName, toIso(startsAtMs), SCHEDULED_RACE_MAX_ENTRANTS, SCHEDULED_RACE_LAPS_REQUIRED, nowIso, nowIso])
    return this.buildRaceFromRow((await pool.query('SELECT * FROM scheduled_races WHERE id = $1', [id])).rows[0], nowMs)
  }

  private buildFinalInscriptionPayload(race: ScheduledRaceWithRoster, finalizedAt: string): ScheduledRaceFinalInscriptionPayload {
    const inscriptionPayload = buildMultiplayerRaceInscriptionPayload(race, finalizedAt)
    return {
      raceId: race.id,
      trackName: race.trackName,
      startsAt: race.startsAt,
      lapsRequired: race.lapsRequired,
      results: race.results.map(result => ({ ...result, lapTimesMs: [...result.lapTimesMs] })),
      recipients: [],
      finalizedAt,
      inscriptionName: MULTIPLAYER_RACE_INSCRIPTION_NAME,
      outputIndex: race.results.some(result => result.status === 'finished') ? 0 : null,
      inscriptionPayload,
    }
  }

  private validateResultTiming(race: ScheduledRace, input: ScheduledRaceResultInput): number[] {
    return MemoryScheduledRaceStore.prototype['validateResultTiming'].call(this, race, input)
  }

  private validateLapProgress(race: ScheduledRace, input: ScheduledRaceLapProgressInput): number[] {
    return MemoryScheduledRaceStore.prototype['validateLapProgress'].call(this, race, input)
  }

  private sortAndRankResults(results: ScheduledRaceResult[]): void {
    MemoryScheduledRaceStore.prototype['sortAndRankResults'].call(this, results)
  }

  private getLowestAvailableGridSlot(roster: ScheduledRaceSignup[], maxEntrants: number): number {
    return MemoryScheduledRaceStore.prototype['getLowestAvailableGridSlot'].call(this, roster, maxEntrants)
  }

  private getLowestAvailableStagedGridSlot(roster: ScheduledRaceSignup[], maxEntrants: number): number {
    return MemoryScheduledRaceStore.prototype['getLowestAvailableStagedGridSlot'].call(this, roster, maxEntrants)
  }

  private assertNoSignupConflict(roster: ScheduledRaceSignup[], input: {
    raceId: string
    identityKey: string
    ownerAddress: string
    foxOutpoint: string
    foxOriginOutpoint: string
  }): void {
    if (roster.some(signup => isActiveSignupStatus(signup.status) && sameText(signup.ownerAddress, input.ownerAddress))) {
      throw new ScheduledRaceError('owner_already_signed_up', `Owner ${input.ownerAddress} is already signed up for ${input.raceId}`, 409)
    }
    if (roster.some(signup => isActiveSignupStatus(signup.status) && sameText(signup.identityKey, input.identityKey))) {
      throw new ScheduledRaceError('identity_already_signed_up', `Identity ${input.identityKey} is already signed up for ${input.raceId}`, 409)
    }
    if (roster.some(signup => isActiveSignupStatus(signup.status) && (
      sameText(signup.foxOutpoint, input.foxOutpoint) || sameText(signup.foxOriginOutpoint, input.foxOriginOutpoint)
    ))) {
      throw new ScheduledRaceError('fox_already_signed_up', `Fox ${input.foxOriginOutpoint} is already signed up for ${input.raceId}`, 409)
    }
  }

  private async getRaceOrThrow(raceId: string, client: DbClient = pool): Promise<ScheduledRace> {
    const result = await client.query('SELECT * FROM scheduled_races WHERE id = $1 FOR UPDATE', [raceId])
    if (!result.rows[0]) {
      throw new ScheduledRaceError('race_not_found', `Race ${raceId} was not found`, 404)
    }
    return this.buildRaceFromRow(result.rows[0], Date.now())
  }

  private async getSignupOrThrow(raceId: string, entrantId: string, client: DbClient = pool): Promise<ScheduledRaceSignup> {
    const normalizedEntrantId = normalizeEntrantId(entrantId)
    const result = await client.query(`
      SELECT * FROM scheduled_race_signups
      WHERE race_id = $1 AND entrant_id = $2 AND status <> 'withdrawn'
      FOR UPDATE
    `, [raceId, normalizedEntrantId])
    if (!result.rows[0]) {
      throw new ScheduledRaceError('signup_not_found', `Entrant ${entrantId} is not signed up for ${raceId}`, 404)
    }
    return this.buildSignupFromRow(result.rows[0])
  }

  private async getRoster(raceId: string, client: DbClient = pool, lock = false): Promise<ScheduledRaceSignup[]> {
    const result = await client.query(`
      SELECT * FROM scheduled_race_signups
      WHERE race_id = $1 AND status <> 'withdrawn'
      ORDER BY grid_slot ASC
      ${lock ? 'FOR UPDATE' : ''}
    `, [raceId])
    return result.rows.map(row => this.buildSignupFromRow(row))
  }

  private async getResults(raceId: string, client: DbClient = pool): Promise<ScheduledRaceResult[]> {
    const result = await client.query(`
      SELECT * FROM scheduled_race_results
      WHERE race_id = $1
      ORDER BY COALESCE(finish_position, 2147483647), finished_at ASC
    `, [raceId])
    return result.rows.map(row => ({
      raceId: String(row.race_id),
      entrantId: String(row.entrant_id),
      finishPosition: row.finish_position == null ? null : Number(row.finish_position),
      totalTimeMs: row.total_time_ms == null ? null : Number(row.total_time_ms),
      lapTimesMs: parseJsonNumberArray(row.lap_times_ms),
      status: row.status === 'finished' ? 'finished' : 'dnf',
      finishedAt: new Date(row.finished_at).toISOString(),
    }))
  }

  private async replaceResults(raceId: string, results: ScheduledRaceResult[], client: DbClient): Promise<void> {
    await client.query('DELETE FROM scheduled_race_results WHERE race_id = $1', [raceId])
    for (const result of results) {
      await client.query(`
        INSERT INTO scheduled_race_results (
          race_id, entrant_id, finish_position, total_time_ms, lap_times_ms, status, finished_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
      `, [
        raceId,
        result.entrantId,
        result.finishPosition,
        result.totalTimeMs,
        JSON.stringify(result.lapTimesMs),
        result.status,
        result.finishedAt,
      ])
    }
  }

  private async getLapProgress(raceId: string, client: DbClient = pool): Promise<Map<string, number[]>> {
    const result = await client.query('SELECT entrant_id, lap_times_ms FROM scheduled_race_lap_progress WHERE race_id = $1', [raceId])
    return new Map(result.rows.map(row => [String(row.entrant_id), parseJsonNumberArray(row.lap_times_ms)]))
  }

  private async getFinalInscription(raceId: string, client: DbClient = pool): Promise<ScheduledRaceFinalInscription | null> {
    const result = await client.query('SELECT * FROM scheduled_race_final_inscriptions WHERE race_id = $1 FOR UPDATE', [raceId])
    const row = result.rows[0]
    if (!row) return null
    const payload = typeof row.final_inscription_payload === 'string' ? JSON.parse(row.final_inscription_payload) : row.final_inscription_payload
    return {
      raceId: String(row.race_id),
      txid: row.txid == null ? null : String(row.txid),
      status: row.status,
      dummy: row.dummy === true,
      inscriptionName: row.inscription_name == null ? undefined : String(row.inscription_name),
      outputIndex: row.output_index == null ? null : Number(row.output_index),
      finalInscriptionPayload: payload,
      errorMessage: row.error_message == null ? null : String(row.error_message),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    }
  }

  private async buildRaceWithRoster(raceId: string, nowMs: number, client: DbClient = pool): Promise<ScheduledRaceWithRoster> {
    const raceResult = await client.query('SELECT * FROM scheduled_races WHERE id = $1', [raceId])
    if (!raceResult.rows[0]) {
      throw new ScheduledRaceError('race_not_found', `Race ${raceId} was not found`, 404)
    }
    const race = this.buildRaceFromRow(raceResult.rows[0], nowMs)
    const roster = await this.getRoster(raceId, client)
    const resolvedStatus = resolveScheduledRaceStatus({
      startsAtMs: new Date(race.startsAt).getTime(),
      nowMs,
      signupCount: roster.length,
      stagedCount: roster.filter(signup => ['staged', 'finished', 'dnf'].includes(signup.status)).length,
      currentStatus: race.status,
    })
    if (resolvedStatus !== race.status) {
      await client.query('UPDATE scheduled_races SET status = $2, updated_at = $3 WHERE id = $1', [raceId, resolvedStatus, toIso(nowMs)])
      race.status = resolvedStatus
      race.updatedAt = toIso(nowMs)
    }
    const results = await this.getResults(raceId, client)
    const podium = results.filter(result => result.status === 'finished' && (result.finishPosition ?? 0) <= 3)
    const finalInscription = await this.getFinalInscription(raceId, client)
    return {
      ...race,
      roster,
      results,
      podium,
      finalInscription,
      signupCount: roster.length,
      stagedCount: roster.filter(signup => signup.status === 'staged').length,
      openSlots: Math.max(0, race.maxEntrants - roster.length),
      serverTime: toIso(nowMs),
    }
  }

  private buildRaceFromRow(row: Record<string, unknown>, nowMs: number): ScheduledRace {
    return {
      id: String(row.id),
      trackName: row.track_name as ScheduledRaceTrackName,
      startsAt: new Date(row.starts_at as string | Date).toISOString(),
      status: row.status as ScheduledRace['status'],
      maxEntrants: Number(row.max_entrants),
      lapsRequired: Number(row.laps_required),
      createdAt: new Date(row.created_at as string | Date).toISOString(),
      updatedAt: new Date(row.updated_at as string | Date).toISOString() || toIso(nowMs),
    }
  }

  private buildSignupFromRow(row: Record<string, unknown>): ScheduledRaceSignup {
    return {
      raceId: String(row.race_id),
      entrantId: String(row.entrant_id),
      identityKey: String(row.identity_key),
      ownerAddress: String(row.owner_address),
      foxOutpoint: String(row.fox_outpoint),
      foxOriginOutpoint: String(row.fox_origin_outpoint),
      foxName: String(row.fox_name),
      carColor: row.car_color == null ? null : String(row.car_color),
      gridSlot: Number(row.grid_slot),
      stagedGridSlot: row.staged_grid_slot == null ? null : Number(row.staged_grid_slot),
      status: row.status as ScheduledRaceSignupStatus,
      signedUpAt: new Date(row.signed_up_at as string | Date).toISOString(),
      stagedAt: row.staged_at == null ? null : new Date(row.staged_at as string | Date).toISOString(),
    }
  }

  private async touchRace(raceId: string, updatedAt: string, client: DbClient): Promise<QueryResult> {
    return client.query('UPDATE scheduled_races SET updated_at = $2 WHERE id = $1', [raceId, updatedAt])
  }
}
