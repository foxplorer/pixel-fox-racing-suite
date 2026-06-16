const CANONICAL_OUTPOINT_PATTERN = /^[0-9a-fA-F]{64}_\d+$/
const REQUEST_OUTPOINT_FIELDS = [
  'playeroutpoint',
  'playeroriginoutpoint',
  'outpoint',
  'originoutpoint',
  'foxOutpoint',
  'originOutpoint',
] as const

export function isCanonicalOrdinalOutpoint(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_OUTPOINT_PATTERN.test(value)
}

export function getInvalidRequestOutpointFields(
  body: Record<string, unknown> | null | undefined
): string[] {
  if (!body) return []
  return REQUEST_OUTPOINT_FIELDS.filter(
    key => key in body && !isCanonicalOrdinalOutpoint(body[key])
  )
}
