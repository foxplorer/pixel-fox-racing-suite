import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_OUTPUT = 'frontend/src/racing/tracks/generated/custom-track.source.json'

const TRACK_PRESETS = {
  club: {
    name: 'Club Circuit',
    anchors: [
      [0.82, -0.1],
      [0.92, -0.34],
      [0.74, -0.62],
      [0.38, -0.72],
      [-0.08, -0.64],
      [-0.46, -0.43],
      [-0.72, -0.08],
      [-0.66, 0.28],
      [-0.35, 0.55],
      [0.08, 0.66],
      [0.48, 0.53],
      [0.76, 0.22]
    ]
  },
  mountain: {
    name: 'Mountain Circuit',
    anchors: [
      [0.72, -0.2],
      [0.88, -0.48],
      [0.62, -0.76],
      [0.12, -0.82],
      [-0.42, -0.66],
      [-0.76, -0.3],
      [-0.84, 0.16],
      [-0.56, 0.54],
      [-0.08, 0.76],
      [0.44, 0.68],
      [0.82, 0.36],
      [0.98, 0.04]
    ]
  },
  technical: {
    name: 'Technical Circuit',
    anchors: [
      [0.86, -0.06],
      [0.76, -0.34],
      [0.92, -0.58],
      [0.48, -0.78],
      [0.04, -0.58],
      [-0.34, -0.76],
      [-0.76, -0.48],
      [-0.62, -0.08],
      [-0.82, 0.28],
      [-0.42, 0.62],
      [0.02, 0.44],
      [0.34, 0.72],
      [0.78, 0.42]
    ]
  }
}

const ELEVATION_MODES = new Set(['flat', 'rolling', 'hill-climb'])

const round = (value, digits = 6) => Number(value.toFixed(digits))
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1])

const parseArgs = (argv) => {
  const args = {
    output: DEFAULT_OUTPUT,
    id: 'custom-track',
    displayName: 'Custom Track',
    preset: 'club',
    points: 96,
    worldSize: 2500,
    elevationMode: 'rolling',
    elevationScale: 36,
    baseElevation: 0,
    validation: true
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]

    switch (arg) {
      case '--output':
        args.output = next
        i++
        break
      case '--id':
        args.id = next
        i++
        break
      case '--name':
        args.displayName = next
        i++
        break
      case '--preset':
        args.preset = next
        i++
        break
      case '--points':
        args.points = Number(next)
        i++
        break
      case '--world-size':
        args.worldSize = Number(next)
        i++
        break
      case '--elevation':
        args.elevationMode = next
        i++
        break
      case '--elevation-scale':
        args.elevationScale = Number(next)
        i++
        break
      case '--base-elevation':
        args.baseElevation = Number(next)
        i++
        break
      case '--no-validation':
        args.validation = false
        break
      case '--help':
        args.help = true
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return args
}

const printHelp = () => {
  console.log(`
Usage:
  npm run tracks:generate-custom -- --output frontend/src/racing/tracks/generated/my-track.source.json

Options:
  --preset <club|mountain|technical>  Layout style. Default: club
  --id <id>                           Stable track id. Default: custom-track
  --name <display name>               Feature display name. Default: Custom Track
  --points <count>                    Output control samples. Default: 96
  --world-size <units>                Target runtime scale note. Default: 2500
  --elevation <flat|rolling|hill-climb>
  --elevation-scale <number>          Elevation amplitude. Default: 36
  --base-elevation <number>           Elevation baseline. Default: 0
  --no-validation                     Write even if quality checks fail
`)
}

const catmullRom = (p0, p1, p2, p3, t) => {
  const t2 = t * t
  const t3 = t2 * t
  return [
    0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
  ]
}

const sampleClosedAnchors = (anchors, sampleCount) => {
  const samples = []
  const count = anchors.length

  for (let i = 0; i < sampleCount; i++) {
    const raw = (i / sampleCount) * count
    const index = Math.floor(raw)
    const t = raw - index
    samples.push(catmullRom(
      anchors[(index - 1 + count) % count],
      anchors[index % count],
      anchors[(index + 1) % count],
      anchors[(index + 2) % count],
      t
    ))
  }

  return samples
}

const getElevation = (index, count, mode, scale, base) => {
  const t = index / count
  if (mode === 'flat') return base

  if (mode === 'hill-climb') {
    const climb = Math.sin(Math.PI * t)
    const profile = Math.pow(Math.max(0, climb), 1.15)
    const texture = Math.sin(Math.PI * 6 * t + 0.4) * 0.1
    return base + scale * clamp(profile + texture, 0, 1.08)
  }

  return base +
    Math.sin(Math.PI * 2 * t - 0.4) * scale * 0.42 +
    Math.sin(Math.PI * 6 * t + 1.1) * scale * 0.18
}

const toCoordinates = (points, args) => {
  const coordinates = points.map((point, index) => [
    round(point[0]),
    round(point[1]),
    round(getElevation(index, points.length, args.elevationMode, args.elevationScale, args.baseElevation), 3)
  ])

  coordinates.push([...coordinates[0]])
  return coordinates
}

const validateCoordinates = (coordinates) => {
  const points = coordinates.slice(0, -1).map(([x, y]) => [x, y])
  const issues = []
  const segmentLengths = points.map((point, index) => distance(point, points[(index + 1) % points.length]))
  const minSegmentLength = Math.min(...segmentLengths)

  if (minSegmentLength < 0.025) {
    issues.push(`minimum segment length ${minSegmentLength.toFixed(4)} is too short`)
  }

  let minTurnDegrees = 180
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length]
    const point = points[i]
    const next = points[(i + 1) % points.length]
    const inVector = [prev[0] - point[0], prev[1] - point[1]]
    const outVector = [next[0] - point[0], next[1] - point[1]]
    const dot = inVector[0] * outVector[0] + inVector[1] * outVector[1]
    const length = Math.hypot(...inVector) * Math.hypot(...outVector)
    const angle = Math.acos(clamp(dot / Math.max(length, 0.000001), -1, 1)) * 180 / Math.PI
    minTurnDegrees = Math.min(minTurnDegrees, angle)
  }

  if (minTurnDegrees < 72) {
    issues.push(`minimum turn angle ${minTurnDegrees.toFixed(1)} degrees is too acute`)
  }

  let minNonAdjacentDistance = Infinity
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const separation = Math.min(Math.abs(j - i), points.length - Math.abs(j - i))
      if (separation < 8) continue
      minNonAdjacentDistance = Math.min(minNonAdjacentDistance, distance(points[i], points[j]))
    }
  }

  if (minNonAdjacentDistance < 0.12) {
    issues.push(`non-adjacent points get too close (${minNonAdjacentDistance.toFixed(4)})`)
  }

  return {
    valid: issues.length === 0,
    issues,
    metrics: {
      minSegmentLength,
      minTurnDegrees,
      minNonAdjacentDistance
    }
  }
}

const createGeoJson = (args) => {
  const preset = TRACK_PRESETS[args.preset]
  if (!preset) {
    throw new Error(`Unknown preset "${args.preset}". Expected one of: ${Object.keys(TRACK_PRESETS).join(', ')}`)
  }
  if (!ELEVATION_MODES.has(args.elevationMode)) {
    throw new Error(`Unknown elevation mode "${args.elevationMode}". Expected one of: ${[...ELEVATION_MODES].join(', ')}`)
  }
  if (!Number.isFinite(args.points) || args.points < 32) {
    throw new Error('--points must be at least 32.')
  }

  const coordinates = toCoordinates(sampleClosedAnchors(preset.anchors, Math.round(args.points)), args)
  const lons = coordinates.map(coordinate => coordinate[0])
  const lats = coordinates.map(coordinate => coordinate[1])
  const elevations = coordinates.map(coordinate => coordinate[2])
  const bbox = [
    round(Math.min(...lons)),
    round(Math.min(...lats)),
    round(Math.max(...lons)),
    round(Math.max(...lats))
  ]
  const validation = validateCoordinates(coordinates)

  if (args.validation && !validation.valid) {
    throw new Error(`Generated track failed validation:\n- ${validation.issues.join('\n- ')}`)
  }

  return {
    type: 'FeatureCollection',
    name: args.id,
    bbox,
    properties: {
      generatedBy: 'scripts/generate-custom-track.mjs',
      generatorVersion: 1,
      preset: args.preset,
      worldSize: args.worldSize,
      elevation: {
        mode: args.elevationMode,
        scale: args.elevationScale,
        base: args.baseElevation,
        range: [round(Math.min(...elevations), 3), round(Math.max(...elevations), 3)]
      },
      validation
    },
    features: [{
      type: 'Feature',
      properties: {
        id: args.id,
        Location: args.displayName,
        Name: args.displayName,
        source: 'custom-generated',
        pointCount: coordinates.length - 1
      },
      bbox,
      geometry: {
        type: 'LineString',
        coordinates
      }
    }]
  }
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const geoJson = createGeoJson(args)
  const outputPath = path.resolve(args.output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(geoJson, null, 2)}\n`)

  const validation = geoJson.properties.validation
  const elevation = geoJson.properties.elevation
  console.log(`Wrote ${geoJson.features[0].geometry.coordinates.length} coordinates to ${args.output}`)
  console.log(`Validation: ${validation.valid ? 'passed' : 'failed'}; min angle ${validation.metrics.minTurnDegrees.toFixed(1)} deg; non-adjacent clearance ${validation.metrics.minNonAdjacentDistance.toFixed(3)}`)
  console.log(`Elevation: ${elevation.mode}, range ${elevation.range[0]}..${elevation.range[1]}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
