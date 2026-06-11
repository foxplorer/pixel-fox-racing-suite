type ViteImportMeta = ImportMeta & {
  env?: {
    VITE_RACING_DIAGNOSTICS?: string
  }
}

export const isRacingDiagnosticsEnabled = (): boolean => {
  return (import.meta as ViteImportMeta).env?.VITE_RACING_DIAGNOSTICS === 'true'
}

export const logRacingDiagnostic = (...args: unknown[]): void => {
  if (isRacingDiagnosticsEnabled()) {
    console.log(...args)
  }
}

export const warnRacingDiagnostic = (...args: unknown[]): void => {
  if (isRacingDiagnosticsEnabled()) {
    console.warn(...args)
  }
}
