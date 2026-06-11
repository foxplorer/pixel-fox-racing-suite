import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_DATASET = 'eudem25m'
const DEFAULT_BATCH_SIZE = 80
const DEFAULT_SMOOTHING_PASSES = 4

const parseArgs = (argv) => {
  const args = {
    dataset: DEFAULT_DATASET,
    batchSize: DEFAULT_BATCH_SIZE,
    smoothingPasses: DEFAULT_SMOOTHING_PASSES,
    interpolation: 'cubic',
    precision: 3
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]

    switch (arg) {
      case '--input':
        args.input = next
        i++
        break
      case '--output':
        args.output = next
        i++
        break
      case '--dataset':
        args.dataset = next
        i++
        break
      case '--batch-size':
        args.batchSize = Number(next)
        i++
        break
      case '--smoothing-passes':
        args.smoothingPasses = Number(next)
        i++
        break
      case '--interpolation':
        args.interpolation = next
        i++
        break
      case '--precision':
        args.precision = Number(next)
        i++
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
  node scripts/add-geojson-elevations.mjs --input track.json --output track.elevated.json

Options:
  --dataset <name>             OpenTopoData dataset. Default: ${DEFAULT_DATASET}
  --batch-size <count>         Locations per POST request. Default: ${DEFAULT_BATCH_SIZE}
  --smoothing-passes <count>   Closed-loop smoothing passes. Default: ${DEFAULT_SMOOTHING_PASSES}
  --interpolation <mode>       nearest, bilinear, or cubic. Default: cubic
  --precision <digits>         Elevation decimal places. Default: 3
`)
}

const roundNumber = (value, digits) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const getLineStringFeature = (geoJson) => {
  const feature = geoJson.features?.find(candidate => candidate.geometry?.type === 'LineString')
  if (!feature) {
    throw new Error('Expected a GeoJSON FeatureCollection with a LineString feature.')
  }
  return feature
}

const smoothClosedProfile = (profile, passes) => {
  if (profile.length <= 2 || passes <= 0) {
    return [...profile]
  }

  let smoothed = [...profile]

  for (let pass = 0; pass < passes; pass++) {
    smoothed = smoothed.map((height, index) => {
      const previous = smoothed[(index - 1 + smoothed.length) % smoothed.length]
      const next = smoothed[(index + 1) % smoothed.length]
      return previous * 0.25 + height * 0.5 + next * 0.25
    })
  }

  const first = smoothed[0]
  const last = smoothed[smoothed.length - 1]
  if (Math.abs(first - last) < 10) {
    const closureAverage = (first + last) / 2
    smoothed[0] = closureAverage
    smoothed[smoothed.length - 1] = closureAverage
  }

  return smoothed
}

const chunkArray = (values, size) => {
  const chunks = []
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size))
  }
  return chunks
}

const fetchElevations = async ({
  coordinates,
  dataset,
  batchSize,
  interpolation
}) => {
  const elevations = []
  const batches = chunkArray(coordinates, batchSize)

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]
    const locations = batch.map(([longitude, latitude]) => `${latitude},${longitude}`).join('|')
    const response = await fetch(`https://api.opentopodata.org/v1/${dataset}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        locations,
        interpolation
      })
    })

    if (!response.ok) {
      throw new Error(`OpenTopoData request failed: HTTP ${response.status} ${response.statusText}`)
    }

    const payload = await response.json()
    if (payload.status !== 'OK') {
      throw new Error(`OpenTopoData returned ${payload.status}: ${payload.error ?? 'unknown error'}`)
    }

    for (const result of payload.results ?? []) {
      if (typeof result.elevation !== 'number') {
        throw new Error(`OpenTopoData returned a missing elevation for ${JSON.stringify(result.location)}`)
      }
      elevations.push(result.elevation)
    }

    console.log(`Fetched elevation batch ${batchIndex + 1}/${batches.length}`)
  }

  if (elevations.length !== coordinates.length) {
    throw new Error(`Expected ${coordinates.length} elevations, received ${elevations.length}.`)
  }

  return elevations
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  if (!args.input || !args.output) {
    printHelp()
    throw new Error('--input and --output are required.')
  }

  const inputPath = path.resolve(args.input)
  const outputPath = path.resolve(args.output)
  const geoJson = JSON.parse(await readFile(inputPath, 'utf8'))
  const feature = getLineStringFeature(geoJson)
  const coordinates = feature.geometry.coordinates

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error('LineString must contain at least two coordinates.')
  }

  const rawElevations = await fetchElevations({
    coordinates,
    dataset: args.dataset,
    batchSize: args.batchSize,
    interpolation: args.interpolation
  })
  const smoothedElevations = smoothClosedProfile(rawElevations, args.smoothingPasses)

  feature.geometry.coordinates = coordinates.map((coordinate, index) => [
    coordinate[0],
    coordinate[1],
    roundNumber(smoothedElevations[index], args.precision)
  ])

  geoJson.properties = {
    ...(geoJson.properties ?? {}),
    elevation: {
      provider: 'OpenTopoData',
      dataset: args.dataset,
      interpolation: args.interpolation,
      smoothingPasses: args.smoothingPasses,
      source: 'https://www.opentopodata.org/api/'
    }
  }
  feature.properties = {
    ...(feature.properties ?? {}),
    elevationDataset: args.dataset,
    elevationSmoothingPasses: args.smoothingPasses
  }

  await writeFile(outputPath, `${JSON.stringify(geoJson, null, 2)}\n`)
  console.log(`Wrote ${coordinates.length} elevated coordinates to ${outputPath}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
