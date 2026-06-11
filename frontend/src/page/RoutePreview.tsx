import React, { useMemo, useState } from 'react'

type ElevationMode = 'flat' | 'rolling' | 'hill-climb'
type TrackStyle = 'club' | 'mountain' | 'technical'
type TurnCharacter = 'balanced' | 'flowing' | 'technical' | 'hairpins'
type EditorMode = 'edit' | 'draw'

type GeneratedTrackJson = {
  name?: string
  properties?: {
    preset?: string
    turnCharacter?: string
    allowDoubleBack?: boolean
    elevation?: {
      mode?: string
      scale?: number
      range?: [number, number]
    }
    validation?: {
      valid?: boolean
      metrics?: {
        minTurnDegrees?: number
        minNonAdjacentDistance?: number
      }
    }
  }
  features?: Array<{
    properties?: {
      id?: string
      Name?: string
      pointCount?: number
      source?: string
    }
    geometry?: {
      type?: string
      coordinates?: number[][]
    }
  }>
}

type RoutePreviewTrack = {
  id: string
  name: string
  path: string
  source: string
  preset?: string
  elevationMode?: string
  elevationRange?: [number, number]
  pointCount: number
  validation?: GeneratedTrackJson['properties']['validation']
  coordinates: number[][]
  json?: GeneratedTrackJson
}

type GeneratorOptions = {
  style: TrackStyle
  turnCharacter: TurnCharacter
  turns: number
  points: number
  elevationMode: ElevationMode
  elevationScale: number
  seed: number
  allowDoubleBack: boolean
}

const generatedTrackModules = import.meta.glob('../racing/tracks/imported/**/*.source.json', {
  eager: true
}) as Record<string, { default: GeneratedTrackJson }>

const styleSettings: Record<TrackStyle, { eccentricity: number; radiusJitter: number; straightBias: number }> = {
  club: { eccentricity: 0.82, radiusJitter: 0.14, straightBias: 0.58 },
  mountain: { eccentricity: 0.7, radiusJitter: 0.26, straightBias: 0.5 },
  technical: { eccentricity: 0.76, radiusJitter: 0.32, straightBias: 0.42 }
}

const turnSettings: Record<TurnCharacter, { cornerCut: number; arcSteps: number; radiusPulse: number; foldChance: number }> = {
  balanced: { cornerCut: 0.32, arcSteps: 6, radiusPulse: 0.14, foldChance: 0.08 },
  flowing: { cornerCut: 0.42, arcSteps: 8, radiusPulse: 0.08, foldChance: 0.02 },
  technical: { cornerCut: 0.24, arcSteps: 5, radiusPulse: 0.2, foldChance: 0.16 },
  hairpins: { cornerCut: 0.18, arcSteps: 7, radiusPulse: 0.3, foldChance: 0.28 }
}

const round = (value: number, digits = 6) => Number(value.toFixed(digits))
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const getTrackFeature = (json: GeneratedTrackJson) => {
  return json.features?.find(feature => feature.geometry?.type === 'LineString')
}

const getCoordinateBounds = (coordinates: number[][]) => {
  const xs = coordinates.map(coordinate => coordinate[0])
  const ys = coordinates.map(coordinate => coordinate[1])
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  }
}

const distance = (a: number[], b: number[]) => Math.hypot(b[0] - a[0], b[1] - a[1])
const normalizeVector = (x: number, y: number) => {
  const length = Math.hypot(x, y) || 1
  return [x / length, y / length]
}

const createRandom = (seed: number) => {
  let value = Math.imul(seed || 1, 0x9e3779b1)
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const getElevation = (index: number, count: number, mode: ElevationMode, scale: number) => {
  const t = index / count
  if (mode === 'flat') return 0
  if (mode === 'hill-climb') {
    const climb = Math.sin(Math.PI * t)
    return scale * clamp(Math.pow(Math.max(0, climb), 1.12) + Math.sin(Math.PI * 6 * t) * 0.08, 0, 1.08)
  }
  return Math.sin(Math.PI * 2 * t - 0.4) * scale * 0.42 + Math.sin(Math.PI * 6 * t + 1.1) * scale * 0.18
}

const generateCoordinates = (options: GeneratorOptions) => {
  const settings = styleSettings[options.style]
  const cornerSettings = turnSettings[options.turnCharacter]
  const count = Math.max(48, Math.round(options.points))
  const random = createRandom(options.seed)
  const anchorCount = clamp(Math.round(options.turns * 0.72), 6, 15)
  const anchors: number[][] = []

  for (let index = 0; index < anchorCount; index++) {
    const t = index / anchorCount
    const angleNoise = (random() - 0.5) * 0.18
    const angle = Math.PI * 2 * (t + angleNoise / anchorCount)
    const classicPulse = Math.sin(angle * 2 + options.seed * 0.31) * cornerSettings.radiusPulse
    const radius = 0.82 + classicPulse + (random() - 0.5) * settings.radiusJitter
    const fold = options.allowDoubleBack && random() < cornerSettings.foldChance
    const foldScale = fold ? 0.45 + random() * 0.18 : 1
    anchors.push([
      Math.cos(angle) * radius * foldScale,
      Math.sin(angle) * radius * settings.eccentricity * foldScale
    ])
  }

  const rawPoints: number[][] = []
  for (let index = 0; index < anchors.length; index++) {
    const prev = anchors[(index - 1 + anchors.length) % anchors.length]
    const current = anchors[index]
    const next = anchors[(index + 1) % anchors.length]
    const incomingLength = distance(prev, current)
    const outgoingLength = distance(current, next)
    const cut = Math.min(incomingLength, outgoingLength) * cornerSettings.cornerCut * settings.straightBias
    const incomingUnit = normalizeVector(prev[0] - current[0], prev[1] - current[1])
    const outgoingUnit = normalizeVector(next[0] - current[0], next[1] - current[1])
    const before = [current[0] + incomingUnit[0] * cut, current[1] + incomingUnit[1] * cut]
    const after = [current[0] + outgoingUnit[0] * cut, current[1] + outgoingUnit[1] * cut]

    if (rawPoints.length > 0) {
      const last = rawPoints[rawPoints.length - 1]
      const straightSteps = Math.max(2, Math.round(distance(last, before) * 8))
      for (let step = 1; step <= straightSteps; step++) {
        const t = step / straightSteps
        rawPoints.push([
          last[0] + (before[0] - last[0]) * t,
          last[1] + (before[1] - last[1]) * t
        ])
      }
    } else {
      rawPoints.push(before)
    }

    const arcSteps = cornerSettings.arcSteps + Math.round(random() * 2)
    for (let step = 1; step <= arcSteps; step++) {
      const t = step / arcSteps
      const inverse = 1 - t
      rawPoints.push([
        inverse * inverse * before[0] + 2 * inverse * t * current[0] + t * t * after[0],
        inverse * inverse * before[1] + 2 * inverse * t * current[1] + t * t * after[1]
      ])
    }
  }

  const bounds = getCoordinateBounds(rawPoints)
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 0.000001)
  const sampled: number[][] = []
  const step = rawPoints.length / count

  for (let index = 0; index < count; index++) {
    const source = rawPoints[Math.floor(index * step) % rawPoints.length]
    sampled.push([
      round((source[0] - centerX) / span * 2),
      round((source[1] - centerY) / span * 2),
      round(getElevation(index, count, options.elevationMode, options.elevationScale), 3)
    ])
  }

  sampled.push([...sampled[0]])
  return sampled
}

const validateCoordinates = (coordinates: number[][], allowDoubleBack = false) => {
  const points = coordinates.slice(0, -1)
  const issues: string[] = []
  const segmentLengths = points.map((point, index) => distance(point, points[(index + 1) % points.length]))
  const minSegmentLength = Math.min(...segmentLengths)
  let minTurnDegrees = 180

  for (let index = 0; index < points.length; index++) {
    const prev = points[(index - 1 + points.length) % points.length]
    const point = points[index]
    const next = points[(index + 1) % points.length]
    const inVector = [prev[0] - point[0], prev[1] - point[1]]
    const outVector = [next[0] - point[0], next[1] - point[1]]
    const dot = inVector[0] * outVector[0] + inVector[1] * outVector[1]
    const length = Math.hypot(...inVector) * Math.hypot(...outVector)
    const angle = Math.acos(clamp(dot / Math.max(length, 0.000001), -1, 1)) * 180 / Math.PI
    minTurnDegrees = Math.min(minTurnDegrees, angle)
  }

  let minNonAdjacentDistance = Infinity
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const separation = Math.min(Math.abs(j - i), points.length - Math.abs(j - i))
      if (separation < 8) continue
      minNonAdjacentDistance = Math.min(minNonAdjacentDistance, distance(points[i], points[j]))
    }
  }

  if (minSegmentLength < 0.025) issues.push('collapsed segment')
  if (minTurnDegrees < 70) issues.push('acute angle')
  if (!allowDoubleBack && minNonAdjacentDistance < 0.11) issues.push('near overlap')

  return {
    valid: issues.length === 0,
    issues,
    metrics: { minSegmentLength, minTurnDegrees, minNonAdjacentDistance }
  }
}

const createGeneratedTrackJson = (options: GeneratorOptions): GeneratedTrackJson => {
  const coordinates = generateCoordinates(options)
  const elevations = coordinates.map(coordinate => coordinate[2]).filter((value): value is number => Number.isFinite(value))
  const bounds = getCoordinateBounds(coordinates)
  const validation = validateCoordinates(coordinates, options.allowDoubleBack)
  const id = `preview-${options.style}-${options.turnCharacter}-${options.turns}-${options.seed}`
  const name = `${options.style[0].toUpperCase()}${options.style.slice(1)} ${options.turnCharacter} ${options.turns}`

  return {
    type: 'FeatureCollection',
    name: id,
    bbox: [round(bounds.minX), round(bounds.minY), round(bounds.maxX), round(bounds.maxY)],
    properties: {
      preset: options.style,
      turnCharacter: options.turnCharacter,
      allowDoubleBack: options.allowDoubleBack,
      elevation: {
        mode: options.elevationMode,
        scale: options.elevationScale,
        range: [round(Math.min(...elevations), 3), round(Math.max(...elevations), 3)]
      },
      validation
    },
    features: [{
      properties: {
        id,
        Name: name,
        source: 'browser-generated',
        pointCount: coordinates.length - 1
      },
      geometry: {
        type: 'LineString',
        coordinates
      }
    }]
  }
}

const createTrackJsonFromCoordinates = (
  baseTrack: RoutePreviewTrack,
  coordinates: number[][],
  options: GeneratorOptions,
  id: string,
  name: string
): GeneratedTrackJson => {
  const closedCoordinates = coordinates.map(coordinate => [...coordinate])
  if (closedCoordinates.length > 1) {
    closedCoordinates[closedCoordinates.length - 1] = [...closedCoordinates[0]]
  }
  const elevations = closedCoordinates.map(coordinate => coordinate[2]).filter((value): value is number => Number.isFinite(value))
  const bounds = getCoordinateBounds(closedCoordinates)
  const validation = validateCoordinates(closedCoordinates, options.allowDoubleBack)

  return {
    type: 'FeatureCollection',
    name: id,
    bbox: [round(bounds.minX), round(bounds.minY), round(bounds.maxX), round(bounds.maxY)],
    properties: {
      preset: baseTrack.preset ?? options.style,
      turnCharacter: options.turnCharacter,
      allowDoubleBack: options.allowDoubleBack,
      elevation: {
        mode: baseTrack.elevationMode ?? options.elevationMode,
        scale: options.elevationScale,
        range: elevations.length > 0 ? [round(Math.min(...elevations), 3), round(Math.max(...elevations), 3)] : [0, 0]
      },
      validation
    },
    features: [{
      properties: {
        id,
        Name: name,
        source: 'browser-edited',
        pointCount: closedCoordinates.length - 1
      },
      geometry: {
        type: 'LineString',
        coordinates: closedCoordinates
      }
    }]
  }
}

const normalizeTrackCoordinates = (coordinates: number[][], width: number, height: number, padding: number) => {
  const bounds = getCoordinateBounds(coordinates)
  const spanX = Math.max(bounds.maxX - bounds.minX, 0.000001)
  const spanY = Math.max(bounds.maxY - bounds.minY, 0.000001)
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY)
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2

  const toScreen = (coordinate: number[]) => ({
    x: offsetX + (coordinate[0] - bounds.minX) * scale,
    y: height - (offsetY + (coordinate[1] - bounds.minY) * scale),
    elevation: coordinate[2]
  })

  const toCoordinate = (x: number, y: number, elevation?: number) => [
    round((x - offsetX) / scale + bounds.minX),
    round((height - y - offsetY) / scale + bounds.minY),
    round(elevation ?? 0, 3)
  ]

  return {
    points: coordinates.map(toScreen),
    toCoordinate
  }
}

const createPathData = (points: Array<{ x: number; y: number }>) => {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
}

const createDrawPathData = (points: Array<{ x: number; y: number }>) => {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
}

const smoothClosedPoints = (points: number[][], iterations = 3) => {
  let smoothed = points
  for (let pass = 0; pass < iterations; pass++) {
    const next: number[][] = []
    for (let index = 0; index < smoothed.length; index++) {
      const current = smoothed[index]
      const following = smoothed[(index + 1) % smoothed.length]
      next.push([
        current[0] * 0.75 + following[0] * 0.25,
        current[1] * 0.75 + following[1] * 0.25
      ])
      next.push([
        current[0] * 0.25 + following[0] * 0.75,
        current[1] * 0.25 + following[1] * 0.75
      ])
    }
    smoothed = next
  }
  return smoothed
}

const createCoordinatesFromSketch = (
  sketchPoints: Array<{ x: number; y: number }>,
  options: GeneratorOptions
) => {
  const deduped = sketchPoints.filter((point, index) => {
    if (index === 0) return true
    const previous = sketchPoints[index - 1]
    return Math.hypot(point.x - previous.x, point.y - previous.y) > 5
  })
  if (deduped.length < 8) return null

  const targetCount = clamp(Math.round(options.points), 64, 180)
  const scale = 390
  const normalized = deduped.map(point => [
    (point.x - 450) / scale,
    (280 - point.y) / scale
  ])
  const smoothed = smoothClosedPoints(normalized, 3)
  const step = smoothed.length / targetCount
  const coordinates: number[][] = []

  for (let index = 0; index < targetCount; index++) {
    const source = smoothed[Math.floor(index * step) % smoothed.length]
    coordinates.push([
      round(source[0]),
      round(source[1]),
      round(getElevation(index, targetCount, options.elevationMode, options.elevationScale), 3)
    ])
  }

  coordinates.push([...coordinates[0]])
  return coordinates
}

const toPreviewTrack = (json: GeneratedTrackJson, path: string): RoutePreviewTrack | null => {
  const feature = getTrackFeature(json)
  const coordinates = feature?.geometry?.coordinates ?? []
  if (coordinates.length < 2) return null

  const id = feature?.properties?.id ?? json.name ?? path
  const name = feature?.properties?.Name ?? json.name ?? id
  return {
    id,
    name,
    path,
    source: feature?.properties?.source ?? 'unknown',
    preset: json.properties?.preset,
    elevationMode: json.properties?.elevation?.mode,
    elevationRange: json.properties?.elevation?.range,
    pointCount: feature?.properties?.pointCount ?? coordinates.length,
    validation: json.properties?.validation,
    coordinates,
    json
  }
}

const loadGeneratedTracks = (): RoutePreviewTrack[] => {
  return Object.entries(generatedTrackModules)
    .map(([path, module]) => toPreviewTrack(module.default, path))
    .filter((track): track is RoutePreviewTrack => Boolean(track))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 10px',
  borderRadius: 6,
  border: '1px solid #33424e',
  background: '#070a0d',
  color: '#f4f8fb'
}

const formatNumber = (value: number | undefined, digits = 2) => {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : 'n/a'
}

const downloadJson = (track: RoutePreviewTrack) => {
  if (!track.json) return
  const blob = new Blob([`${JSON.stringify(track.json, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${track.id}.source.json`
  link.click()
  URL.revokeObjectURL(url)
}

export const RoutePreview = () => {
  const savedTracks = useMemo(() => loadGeneratedTracks(), [])
  const [options, setOptions] = useState<GeneratorOptions>({
    style: 'mountain',
    turnCharacter: 'balanced',
    turns: 12,
    points: 96,
    elevationMode: 'hill-climb',
    elevationScale: 72,
    seed: 1,
    allowDoubleBack: false
  })
  const [generatedTracks, setGeneratedTracks] = useState<RoutePreviewTrack[]>(() => {
    const json = createGeneratedTrackJson(options)
    const track = toPreviewTrack(json, 'browser-generated')
    return track ? [track] : []
  })
  const tracks = [...generatedTracks, ...savedTracks]
  const [selectedTrackId, setSelectedTrackId] = useState(() => tracks[0]?.id ?? '')
  const [editorMode, setEditorMode] = useState<EditorMode>('edit')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawPoints, setDrawPoints] = useState<Array<{ x: number; y: number }>>([])
  const selectedTrack = tracks.find(track => track.id === selectedTrackId) ?? tracks[0]
  const projection = selectedTrack ? normalizeTrackCoordinates(selectedTrack.coordinates, 900, 560, 42) : null
  const previewPoints = projection?.points ?? []
  const pathData = createPathData(previewPoints)
  const startPoint = previewPoints[0]
  const elevationValues = selectedTrack?.coordinates.map(coordinate => coordinate[2]).filter((value): value is number => Number.isFinite(value)) ?? []
  const minElevation = elevationValues.length > 0 ? Math.min(...elevationValues) : undefined
  const maxElevation = elevationValues.length > 0 ? Math.max(...elevationValues) : undefined

  const generateTrack = () => {
    const json = createGeneratedTrackJson(options)
    const track = toPreviewTrack(json, 'browser-generated')
    if (!track) return
    setGeneratedTracks(current => [track, ...current.filter(existing => existing.id !== track.id)].slice(0, 10))
    setSelectedTrackId(track.id)
    setOptions(current => ({ ...current, seed: current.seed + 1 }))
  }

  const updateSelectedTrackCoordinates = (coordinates: number[][]) => {
    if (!selectedTrack) return
    const editableId = selectedTrack.source === 'browser-generated' || selectedTrack.source === 'browser-edited'
      ? selectedTrack.id
      : `edited-${selectedTrack.id}`
    const editableName = selectedTrack.source === 'browser-generated' || selectedTrack.source === 'browser-edited'
      ? selectedTrack.name
      : `Edited ${selectedTrack.name}`
    const json = createTrackJsonFromCoordinates(selectedTrack, coordinates, options, editableId, editableName)
    const track = toPreviewTrack(json, 'browser-edited')
    if (!track) return

    setGeneratedTracks(current => [track, ...current.filter(existing => existing.id !== track.id)].slice(0, 10))
    setSelectedTrackId(track.id)
  }

  const createTrackFromSketch = (sketchPoints: Array<{ x: number; y: number }>) => {
    const coordinates = createCoordinatesFromSketch(sketchPoints, options)
    if (!coordinates || !selectedTrack) return
    const id = `drawn-${options.style}-${options.turnCharacter}-${options.seed}`
    const name = `Drawn ${options.style} ${options.seed}`
    const json = createTrackJsonFromCoordinates(selectedTrack, coordinates, options, id, name)
    const track = toPreviewTrack(json, 'browser-drawn')
    if (!track) return

    setGeneratedTracks(current => [track, ...current.filter(existing => existing.id !== track.id)].slice(0, 10))
    setSelectedTrackId(track.id)
    setOptions(current => ({ ...current, seed: current.seed + 1 }))
  }

  const getSvgPoint = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: clamp((event.clientX - rect.left) / rect.width * 900, 0, 900),
      y: clamp((event.clientY - rect.top) / rect.height * 560, 0, 560)
    }
  }

  const moveDraggedPoint = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!selectedTrack || !projection || dragIndex === null) return
    const point = getSvgPoint(event)
    const currentElevation = selectedTrack.coordinates[dragIndex]?.[2] ?? 0
    const nextCoordinate = projection.toCoordinate(point.x, point.y, currentElevation)
    const nextCoordinates = selectedTrack.coordinates.map(coordinate => [...coordinate])
    nextCoordinates[dragIndex] = nextCoordinate
    if (dragIndex === 0 || dragIndex === nextCoordinates.length - 1) {
      nextCoordinates[0] = [...nextCoordinate]
      nextCoordinates[nextCoordinates.length - 1] = [...nextCoordinate]
    }
    updateSelectedTrackCoordinates(nextCoordinates)
  }

  const handlePreviewPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (editorMode !== 'draw') return
    const point = getSvgPoint(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDrawing(true)
    setDrawPoints([point])
  }

  const handlePreviewPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (editorMode === 'draw' && isDrawing) {
      const point = getSvgPoint(event)
      setDrawPoints(current => {
        const previous = current[current.length - 1]
        if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 4) return current
        return [...current, point]
      })
      return
    }
    moveDraggedPoint(event)
  }

  const finishDrawing = () => {
    if (!isDrawing) {
      setDragIndex(null)
      return
    }
    setIsDrawing(false)
  }

  const smoothSketchToTrack = () => {
    createTrackFromSketch(drawPoints)
    setDrawPoints([])
    setEditorMode('edit')
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0a0d10', color: '#f4f8fb', padding: 24, fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, letterSpacing: 0 }}>Route Generator</h1>
            <p style={{ margin: '8px 0 0', color: '#a8b8c5' }}>Generate custom routes in-browser and preview saved <code>*.source.json</code> tracks.</p>
          </div>
          <a href="/pixelfoxracing" style={{ color: '#36bffa', textDecoration: 'none', fontWeight: 700 }}>Back to game</a>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 18, alignItems: 'start' }}>
          <aside style={{ border: '1px solid #27323a', borderRadius: 8, padding: 14, background: '#10161b' }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <span style={{ display: 'block', marginBottom: 6, color: '#a8b8c5' }}>Mode</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditorMode('edit')}
                    style={{ padding: '9px 10px', borderRadius: 6, border: `1px solid ${editorMode === 'edit' ? '#36bffa' : '#33424e'}`, background: editorMode === 'edit' ? '#123346' : '#070a0d', color: '#f4f8fb', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('draw')}
                    style={{ padding: '9px 10px', borderRadius: 6, border: `1px solid ${editorMode === 'draw' ? '#36bffa' : '#33424e'}`, background: editorMode === 'draw' ? '#123346' : '#070a0d', color: '#f4f8fb', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Draw
                  </button>
                </div>
              </div>
              <label>
                <span style={{ display: 'block', marginBottom: 6, color: '#a8b8c5' }}>Style</span>
                <select value={options.style} onChange={event => setOptions({ ...options, style: event.target.value as TrackStyle })} style={inputStyle}>
                  <option value="club">Club</option>
                  <option value="mountain">Mountain</option>
                  <option value="technical">Technical</option>
                </select>
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: 6, color: '#a8b8c5' }}>Turn Shape</span>
                <select value={options.turnCharacter} onChange={event => setOptions({ ...options, turnCharacter: event.target.value as TurnCharacter })} style={inputStyle}>
                  <option value="balanced">Balanced</option>
                  <option value="flowing">Flowing sweepers</option>
                  <option value="technical">Technical esses</option>
                  <option value="hairpins">Hairpins</option>
                </select>
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: 6, color: '#a8b8c5' }}>Turns: {options.turns}</span>
                <input type="range" min="6" max="20" value={options.turns} onChange={event => setOptions({ ...options, turns: Number(event.target.value) })} style={{ width: '100%' }} />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: 6, color: '#a8b8c5' }}>Points: {options.points}</span>
                <input type="range" min="64" max="180" step="4" value={options.points} onChange={event => setOptions({ ...options, points: Number(event.target.value) })} style={{ width: '100%' }} />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: 6, color: '#a8b8c5' }}>Elevation</span>
                <select value={options.elevationMode} onChange={event => setOptions({ ...options, elevationMode: event.target.value as ElevationMode })} style={inputStyle}>
                  <option value="flat">Flat</option>
                  <option value="rolling">Rolling</option>
                  <option value="hill-climb">Hill Climb</option>
                </select>
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: 6, color: '#a8b8c5' }}>Elevation Scale: {options.elevationScale}</span>
                <input type="range" min="0" max="140" value={options.elevationScale} onChange={event => setOptions({ ...options, elevationScale: Number(event.target.value) })} style={{ width: '100%' }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#d7e3ea' }}>
                <input
                  type="checkbox"
                  checked={options.allowDoubleBack}
                  onChange={event => setOptions({ ...options, allowDoubleBack: event.target.checked })}
                />
                Allow double-back sections
              </label>
              <button type="button" onClick={generateTrack} style={{ padding: '11px 14px', border: 0, borderRadius: 6, background: '#36bffa', color: '#061015', fontWeight: 800, cursor: 'pointer' }}>
                Generate
              </button>
              {drawPoints.length > 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    onClick={smoothSketchToTrack}
                    disabled={drawPoints.length < 8}
                    style={{ padding: '10px 12px', border: 0, borderRadius: 6, background: drawPoints.length < 8 ? '#47525c' : '#ffb703', color: '#061015', fontWeight: 800, cursor: drawPoints.length < 8 ? 'not-allowed' : 'pointer' }}
                  >
                    Smooth Sketch
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawPoints([])}
                    style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid #ffb703', background: 'transparent', color: '#ffb703', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                </div>
              )}
              {selectedTrack?.json && (
                <button type="button" onClick={() => downloadJson(selectedTrack)} style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #36bffa', background: 'transparent', color: '#36bffa', fontWeight: 700, cursor: 'pointer' }}>
                  Download GeoJSON
                </button>
              )}
            </div>

            <hr style={{ border: 0, borderTop: '1px solid #27323a', margin: '16px 0' }} />

            <label htmlFor="route-track-select" style={{ display: 'block', marginBottom: 8, color: '#a8b8c5' }}>Track</label>
            <select id="route-track-select" value={selectedTrack?.id ?? ''} onChange={event => setSelectedTrackId(event.target.value)} style={inputStyle}>
              {tracks.map(track => <option key={`${track.path}-${track.id}`} value={track.id}>{track.name}</option>)}
            </select>

            {selectedTrack && (
              <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', margin: '16px 0 0' }}>
                <dt style={{ color: '#a8b8c5' }}>Preset</dt><dd style={{ margin: 0 }}>{selectedTrack.preset ?? 'n/a'}</dd>
                <dt style={{ color: '#a8b8c5' }}>Points</dt><dd style={{ margin: 0 }}>{selectedTrack.pointCount}</dd>
                <dt style={{ color: '#a8b8c5' }}>Elevation</dt><dd style={{ margin: 0 }}>{selectedTrack.elevationMode ?? 'n/a'}</dd>
                <dt style={{ color: '#a8b8c5' }}>Range</dt><dd style={{ margin: 0 }}>{formatNumber(minElevation)}..{formatNumber(maxElevation)}</dd>
                <dt style={{ color: '#a8b8c5' }}>Status</dt><dd style={{ margin: 0, color: selectedTrack.validation?.valid === false ? '#ff9f9f' : '#9ff2c8' }}>{selectedTrack.validation?.valid === false ? 'Needs edit' : 'Usable'}</dd>
                <dt style={{ color: '#a8b8c5' }}>Min Angle</dt><dd style={{ margin: 0 }}>{formatNumber(selectedTrack.validation?.metrics?.minTurnDegrees, 1)} deg</dd>
                <dt style={{ color: '#a8b8c5' }}>Clearance</dt><dd style={{ margin: 0 }}>{formatNumber(selectedTrack.validation?.metrics?.minNonAdjacentDistance, 3)}</dd>
              </dl>
            )}
          </aside>

          <section style={{ border: '1px solid #27323a', borderRadius: 8, background: '#071013', overflow: 'hidden' }}>
            <svg
              viewBox="0 0 900 560"
              role="img"
              aria-label={`${selectedTrack?.name ?? 'Track'} route preview`}
              onPointerDown={handlePreviewPointerDown}
              onPointerMove={handlePreviewPointerMove}
              onPointerUp={finishDrawing}
              onPointerLeave={finishDrawing}
              style={{ width: '100%', display: 'block', touchAction: 'none', cursor: editorMode === 'draw' ? 'crosshair' : dragIndex === null ? 'default' : 'grabbing' }}
            >
              <rect width="900" height="560" fill="#071013" />
              <g opacity="0.16" stroke="#ffffff" strokeWidth="1">
                {Array.from({ length: 10 }, (_, index) => <line key={`v-${index}`} x1={index * 100} y1="0" x2={index * 100} y2="560" />)}
                {Array.from({ length: 7 }, (_, index) => <line key={`h-${index}`} x1="0" y1={index * 90} x2="900" y2={index * 90} />)}
              </g>
              <path d={pathData} fill="none" stroke={selectedTrack?.validation?.valid === false ? '#ff6b6b' : '#36bffa'} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" opacity="0.24" />
              <path d={pathData} fill="none" stroke="#e9f7ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              {editorMode === 'edit' && previewPoints.slice(0, -1).map((point, index) => (
                <circle
                  key={`handle-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={dragIndex === index ? 7 : 4}
                  fill={dragIndex === index ? '#ffb703' : '#071013'}
                  stroke="#ffb703"
                  strokeWidth="2"
                  opacity={index % 2 === 0 || dragIndex === index ? 1 : 0.55}
                  style={{ cursor: 'grab' }}
                  onPointerDown={event => {
                    event.stopPropagation()
                    event.currentTarget.setPointerCapture(event.pointerId)
                    setDragIndex(index)
                  }}
                />
              ))}
              {drawPoints.length > 1 && (
                <path d={createDrawPathData(drawPoints)} fill="none" stroke="#ffb703" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.86" />
              )}
              {startPoint && (
                <g>
                  <circle cx={startPoint.x} cy={startPoint.y} r="9" fill="#ffd166" stroke="#111" strokeWidth="3" />
                  <text x={startPoint.x + 14} y={startPoint.y - 12} fill="#ffd166" fontSize="16" fontWeight="700">START</text>
                </g>
              )}
            </svg>
          </section>
        </section>

        {selectedTrack && (
          <p style={{ marginTop: 14, color: '#7890a0', wordBreak: 'break-word' }}>
            Source: <code>{selectedTrack.path.replace('../', 'frontend/src/')}</code>
          </p>
        )}
      </div>
    </main>
  )
}
