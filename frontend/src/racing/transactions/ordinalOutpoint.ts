const DOT_OUTPOINT_PATTERN = /^([0-9a-fA-F]{64})\.(\d+)$/
const UNDERSCORE_OUTPOINT_PATTERN = /^([0-9a-fA-F]{64})_(\d+)$/

export const normalizeOrdinalOutpoint = (
  outpoint?: string | null,
): string => {
  if (!outpoint) return ''
  return outpoint.trim().replace(DOT_OUTPOINT_PATTERN, '$1_$2')
}

export const getOutpointTxid = (
  outpoint?: string | null,
): string | null => {
  const normalized = normalizeOrdinalOutpoint(outpoint)
  return UNDERSCORE_OUTPOINT_PATTERN.exec(normalized)?.[1] ?? null
}
