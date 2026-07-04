import type { Express, Request, Response } from 'express'
import { ScheduledRaceError, type ScheduledRaceStore } from './scheduledRaceTypes.js'

interface RegisterScheduledRaceRoutesOptions {
  store: ScheduledRaceStore
}

const parseLimit = (value: unknown): number | undefined => {
  if (typeof value !== 'string') return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const parseNowMs = (value: unknown): number | undefined => {
  if (typeof value !== 'string') return undefined
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const getEntrantId = (req: Request): string => (
  String(req.body?.entrantId || req.query.entrantId || '').trim()
)

const sendScheduledRaceError = (res: Response, error: unknown): void => {
  if (error instanceof ScheduledRaceError) {
    res.status(error.statusCode).json({ error: error.code, message: error.message })
    return
  }

  console.error('Scheduled race route failed:', error)
  res.status(500).json({
    error: 'scheduled_race_failed',
    message: error instanceof Error ? error.message : 'Scheduled race request failed',
  })
}

export function registerScheduledRaceRoutes(app: Express, { store }: RegisterScheduledRaceRoutesOptions): void {
  app.get('/scheduled-races', async (req, res) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined
      const listMethod = status === 'completed' ? store.listCompleted.bind(store) : store.listUpcoming.bind(store)
      const races = await listMethod({
        trackName: typeof req.query.trackName === 'string' ? req.query.trackName : undefined,
        limit: parseLimit(req.query.limit),
        nowMs: parseNowMs(req.query.now),
      })
      res.json({ races })
    } catch (error) {
      sendScheduledRaceError(res, error)
    }
  })

  app.post('/scheduled-races/:raceId/signup', async (req, res) => {
    try {
      const race = await store.signUp(req.params.raceId, {
        identityKey: String(req.body?.identityKey || ''),
        ownerAddress: String(req.body?.ownerAddress || ''),
        foxOutpoint: String(req.body?.foxOutpoint || ''),
        foxOriginOutpoint: String(req.body?.foxOriginOutpoint || ''),
        foxName: String(req.body?.foxName || ''),
        carColor: req.body?.carColor == null ? null : String(req.body.carColor),
      })
      res.json({ race })
    } catch (error) {
      sendScheduledRaceError(res, error)
    }
  })

  app.delete('/scheduled-races/:raceId/signup', async (req, res) => {
    try {
      const entrantId = getEntrantId(req)
      if (!entrantId) {
        throw new ScheduledRaceError('missing_field', 'entrantId is required')
      }
      const race = await store.withdraw(req.params.raceId, entrantId)
      res.json({ race })
    } catch (error) {
      sendScheduledRaceError(res, error)
    }
  })

  app.post('/scheduled-races/:raceId/stage', async (req, res) => {
    try {
      const entrantId = getEntrantId(req)
      if (!entrantId) {
        throw new ScheduledRaceError('missing_field', 'entrantId is required')
      }
      const race = await store.stage(req.params.raceId, entrantId)
      res.json({ race })
    } catch (error) {
      sendScheduledRaceError(res, error)
    }
  })

  app.post('/scheduled-races/:raceId/results', async (req, res) => {
    try {
      const entrantId = getEntrantId(req)
      if (!entrantId) {
        throw new ScheduledRaceError('missing_field', 'entrantId is required')
      }
      const race = await store.submitResult(req.params.raceId, {
        entrantId,
        totalTimeMs: Number(req.body?.totalTimeMs),
        lapTimesMs: Array.isArray(req.body?.lapTimesMs)
          ? req.body.lapTimesMs.map((lapTimeMs: unknown) => Number(lapTimeMs))
          : [],
      })
      res.json({ race })
    } catch (error) {
      sendScheduledRaceError(res, error)
    }
  })

  app.post('/scheduled-races/:raceId/progress', async (req, res) => {
    try {
      const entrantId = getEntrantId(req)
      if (!entrantId) {
        throw new ScheduledRaceError('missing_field', 'entrantId is required')
      }
      const race = await store.recordLapProgress(req.params.raceId, {
        entrantId,
        lapTimesMs: Array.isArray(req.body?.lapTimesMs)
          ? req.body.lapTimesMs.map((lapTimeMs: unknown) => Number(lapTimeMs))
          : [],
      })
      res.json({ race })
    } catch (error) {
      sendScheduledRaceError(res, error)
    }
  })

  app.post('/scheduled-races/:raceId/finalize', async (req, res) => {
    try {
      const race = await store.finalizeRace(req.params.raceId)
      res.json({ race })
    } catch (error) {
      sendScheduledRaceError(res, error)
    }
  })

  app.post('/scheduled-races/:raceId/final-inscription', async (req, res) => {
    try {
      const race = await store.createFinalInscription(req.params.raceId)
      res.json({ race })
    } catch (error) {
      sendScheduledRaceError(res, error)
    }
  })

  app.post('/scheduled-races/:raceId/settle', async (req, res) => {
    try {
      const race = await store.settleRace(req.params.raceId)
      res.json({ race })
    } catch (error) {
      sendScheduledRaceError(res, error)
    }
  })
}
