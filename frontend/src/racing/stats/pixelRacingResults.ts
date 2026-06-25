import type { PixelRacingGameResult } from '../transactions/lapResult'
import { getPixelRacingRecordVersion } from './pixelRacingStatsPrivacy'
import { getOrdinalContentUrl, getOrdinalInscriptionUrl } from '../transactions/ordinalLinks'
import { getOutpointTxid, normalizeOrdinalOutpoint } from '../transactions/ordinalOutpoint'

export type PixelRacingResultQuery = { app: string; name: string }

const GORILLAPOOL_SEARCH_LIMIT = 10000
const RESULTS_APP = import.meta.env.VITE_PIXELRACING_RESULTS_APP || 'pixelfoxracing'
const RESULTS_NAME = import.meta.env.VITE_PIXELRACING_RESULTS_NAME || 'pixelracingtimes'
const LEGACY_RESULTS_APP = import.meta.env.VITE_PIXELRACING_LEGACY_RESULTS_APP || 'foxplorer'
const LEGACY_RESULTS_NAME = import.meta.env.VITE_PIXELRACING_LEGACY_RESULTS_NAME || 'pixelracingtimes'

const dedupeResultQueries = (queries: PixelRacingResultQuery[]): PixelRacingResultQuery[] =>
  queries.filter((query, index, allQueries) =>
    allQueries.findIndex(other => other.app === query.app && other.name === query.name) === index
  )

export const CURRENT_PIXELRACING_RESULT_QUERIES = dedupeResultQueries([
  { app: RESULTS_APP, name: RESULTS_NAME },
])

export const LEGACY_PIXELRACING_RESULT_QUERIES = dedupeResultQueries([
  { app: LEGACY_RESULTS_APP, name: LEGACY_RESULTS_NAME },
])

export const getPixelRacingResultTxid = (item: any): string => {
  const raw = item?.txid || item?.id || item?.outpoint || item?.origin?.outpoint || ''
  const value = String(raw)
  return getOutpointTxid(value) || value
}

const getMapData = (item: any): Record<string, any> => {
  return item?.origin?.data?.map || item?.data?.map || item?.map || {}
}

const getSigner = (item: any): string | undefined => {
  const sigma = item?.origin?.data?.sigma || item?.data?.sigma || item?.sigma
  if (Array.isArray(sigma)) {
    return sigma[0]?.address || sigma[0]?.pubKey || sigma[0]?.publicKey || sigma[0]?.identityKey
  }
  return sigma?.address || sigma?.pubKey || sigma?.publicKey || sigma?.identityKey || item?.signer
}

export const toPixelRacingGameResult = (
  item: any,
  allowedQueries: PixelRacingResultQuery[] = CURRENT_PIXELRACING_RESULT_QUERIES
): PixelRacingGameResult | null => {
  const mapData = getMapData(item)
  const isPixelRacingResult = allowedQueries.some(query =>
    mapData.app === query.app && mapData.name === query.name
  )
  if (!isPixelRacingResult) return null

  const txid = getPixelRacingResultTxid(item)
  const outpoint = normalizeOrdinalOutpoint(
    mapData.outpoint || mapData.playeroutpoint || ''
  )
  const originoutpoint = normalizeOrdinalOutpoint(
    mapData.originoutpoint || mapData.playeroriginoutpoint || ''
  )
  const recordVersion = getPixelRacingRecordVersion(mapData)

  return {
    recordVersion,
    owneraddress: recordVersion >= 2
      ? ''
      : mapData.owneraddress || mapData.playerowner || item?.owner || item?.address || '',
    outpoint,
    originoutpoint,
    foxname: mapData.foxname || mapData.playerfoxname || 'Unknown Fox',
    laptime: mapData.laptime || mapData.score || '0',
    time: mapData.time || item?.time || Date.now().toString(),
    txid,
    foxinfolink: getOrdinalContentUrl(originoutpoint),
    foximagelink: getOrdinalInscriptionUrl(outpoint),
    trackname: mapData.trackname || undefined,
    itemType: undefined,
    signer: getSigner(item),
  }
}

export const fetchPixelRacingResults = async (
  queries: PixelRacingResultQuery[] = CURRENT_PIXELRACING_RESULT_QUERIES
): Promise<PixelRacingGameResult[]> => {
  const searchResults = await Promise.all(queries.map(async query => {
    const response = await fetch(`https://ordinals.gorillapool.io/api/txos/search?limit=${GORILLAPOOL_SEARCH_LIMIT}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=UTF-8',
      },
      body: JSON.stringify({ map: query }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} for ${query.app}/${query.name}`)
    }

    const searchData = await response.json()
    return Array.isArray(searchData) ? searchData : []
  }))

  const searchItems = searchResults.flat()

  const historyGames = (await Promise.all(searchItems.map(async (item: any) => {
    const directResult = toPixelRacingGameResult(item, queries)
    if (directResult) return directResult

    const txid = getPixelRacingResultTxid(item)
    if (!txid) return null

    try {
      const utxoResponse = await fetch(`https://ordinals.gorillapool.io/api/txos/${txid}_0`)
      if (!utxoResponse.ok) return null
      return toPixelRacingGameResult(await utxoResponse.json(), queries)
    } catch {
      return null
    }
  }))).filter(Boolean) as PixelRacingGameResult[]

  return Array.from(
    new Map(historyGames.map(game => [game.txid || `${game.outpoint}_${game.time}`, game])).values()
  )
}
