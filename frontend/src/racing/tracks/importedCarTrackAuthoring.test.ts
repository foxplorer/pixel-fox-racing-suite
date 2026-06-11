import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createImportedCarTrackAuthoringMetadata,
  validateImportedCarTrackAuthoringInput,
  type ImportedCarTrackAuthoringInput
} from './importedCarTrackAuthoring'

const baseInput: ImportedCarTrackAuthoringInput = {
  id: 'example-park',
  displayName: 'Example Park',
  geoJson: {
    jsonPath: 'tracks/example-park.json'
  },
  startGate: {
    position: [10, 0.1, -20],
    direction: [0, 0, 1],
    gateWidth: 20
  },
  scenery: {
    preset: 'australia-park',
    file: 'tracks/example-park.scenery.ts'
  }
}

test('imported car track metadata captures the minimum future contributor contract', () => {
  const metadata = createImportedCarTrackAuthoringMetadata(baseInput)

  assert.equal(metadata.id, 'example-park')
  assert.equal(metadata.displayName, 'Example Park')
  assert.equal(metadata.layout.kind, 'geojson-circuit')
  assert.equal(metadata.layout.curveSource, 'tracks/example-park.json')
  assert.equal(metadata.layout.worldSize, 2500)
  assert.deepEqual(metadata.supportedVehicleModes, ['car'])
  assert.deepEqual(metadata.handlingModels, ['shared-car'])
  assert.deepEqual(metadata.start.position, [10, 0.1, -20])
  assert.deepEqual(metadata.start.directionVector, [0, 0, 1])
  assert.equal(metadata.start.gateWidth, 20)
  assert.equal(metadata.start.lapCrossingWidth, 20)
  assert.equal(metadata.start.lapCrossingDepth, 4)
  assert.equal(metadata.scenery.preset, 'australia-park')
  assert.equal(metadata.contributorSceneryFile, 'tracks/example-park.scenery.ts')
})

test('imported car tracks default flat but reserve road-corridor terrain settings', () => {
  const metadata = createImportedCarTrackAuthoringMetadata(baseInput)

  assert.equal(metadata.terrain.elevationMode, 'flat')
  assert.equal(metadata.terrain.heightProvider, 'constant')
  assert.equal(metadata.terrain.currentElevationSource, 'none')
  assert.equal(metadata.terrain.plannedElevationSource, 'sampled-real-world')
  assert.equal(metadata.terrain.roadCorridorRequired, true)
  assert.equal(metadata.terrain.roadBlendDistance, 30)
  assert.equal(metadata.terrain.roadClearance, 0.1)
})

test('imported car tracks can opt into height data without changing the authoring shape', () => {
  const metadata = createImportedCarTrackAuthoringMetadata({
    ...baseInput,
    geoJson: {
      jsonPath: 'tracks/hilly-example.json',
      coordinateElevationScale: 0.5,
      coordinateElevationOffset: 3
    },
    terrain: {
      heightProvider: 'future-heightfield',
      currentElevationSource: 'sampled-real-world',
      plannedElevationSource: 'sampled-real-world',
      roadBlendDistance: 45,
      roadClearance: 0.2
    }
  })

  assert.equal(metadata.terrain.elevationMode, 'hilly')
  assert.equal(metadata.terrain.heightProvider, 'future-heightfield')
  assert.equal(metadata.terrain.roadBlendDistance, 45)
  assert.equal(metadata.terrain.roadClearance, 0.2)
  assert.deepEqual(metadata.geoJsonElevation, {
    coordinateElevationScale: 0.5,
    coordinateElevationOffset: 3
  })
})

test('imported car track validation catches missing authoring essentials', () => {
  const errors = validateImportedCarTrackAuthoringInput({
    ...baseInput,
    id: '',
    displayName: '',
    geoJson: {
      jsonPath: 'tracks/not-json.geojson'
    },
    startGate: {
      position: [0, Number.NaN, 0],
      direction: [0, 0, 0],
      gateWidth: 0
    }
  })

  assert.equal(errors.some(error => error.includes('Track id')), true)
  assert.equal(errors.some(error => error.includes('display name')), true)
  assert.equal(errors.some(error => error.includes('.json')), true)
  assert.equal(errors.some(error => error.includes('position')), true)
  assert.equal(errors.some(error => error.includes('direction')), true)
  assert.equal(errors.some(error => error.includes('width')), true)
})
