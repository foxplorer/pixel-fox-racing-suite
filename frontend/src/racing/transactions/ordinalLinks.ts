import { normalizeOrdinalOutpoint } from './ordinalOutpoint'

export const ORDINAL_CONTENT_BASE_URL = 'https://ordfs.network/content'
export const ORDINAL_INSCRIPTION_BASE_URL = 'https://alpha.1satordinals.com/outpoint'
export const WHATSONCHAIN_TRANSACTION_BASE_URL = 'https://whatsonchain.com/tx'

export const getOrdinalContentUrl = (originOutpoint?: string | null): string => (
  originOutpoint
    ? `${ORDINAL_CONTENT_BASE_URL}/${normalizeOrdinalOutpoint(originOutpoint)}`
    : ''
)

export const getOrdinalInscriptionUrl = (outpoint?: string | null): string => (
  outpoint
    ? `${ORDINAL_INSCRIPTION_BASE_URL}/${normalizeOrdinalOutpoint(outpoint)}/inscription`
    : ''
)

export const getWhatsOnChainTransactionUrl = (txid?: string | null): string => (
  txid ? `${WHATSONCHAIN_TRANSACTION_BASE_URL}/${txid}` : ''
)
