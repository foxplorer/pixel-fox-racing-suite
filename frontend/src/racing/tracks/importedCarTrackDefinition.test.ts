import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createImportedCarTrackDefinition,
  createImportedCarTrackDefinitionFromMetadata
} from './importedCarTrackDefinition'
import { createImportedCarTrackAuthoringMetadata } from './importedCarTrackAuthoring'

const squareGeoJson = {
  features: [{
    geometry: {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0]
      ]
    }
  }]
}

test('imported car track definition builds the runtime contract for arbitrary contributed tracks', () => {
  const definition = createImportedCarTrackDefinition({
    authoring: {
      id: 'example-park',
      displayName: 'Example Park',
      geoJson: {
        jsonPath: 'tracks/example-park.json',
        worldSize: 1200
      },
      startGate: {
        position: [12, 0.1, -8],
        direction: [1, 0, 0],
        gateWidth: 16
      },
      scenery: {
        preset: 'belgium-forest',
        file: 'tracks/example-park.scenery.ts'
      }
    },
    geoJsonData: squareGeoJson,
    trackSegments: 48,
    curveArcLengthDivisions: 2048,
    appendClosurePoint: false,
    manualCamera: {
      followLerp: 0.15
    },
    renderBudget: {
      sampledTerrain: {
        resolution: {
          low: 180,
          medium: 240,
          high: 320
        }
      },
      shadows: {
        mapSize: 2048
      }
    }
  })

  assert.equal(definition.trackId, 'example-park')
  assert.equal(definition.metadata.id, 'example-park')
  assert.equal(definition.metadata.displayName, 'Example Park')
  assert.equal(definition.metadata.layout.curveSource, 'tracks/example-park.json')
  assert.equal(definition.metadata.contributorSceneryFile, 'tracks/example-park.scenery.ts')
  assert.equal(definition.startingGateHalfWidth, 8)
  assert.deepEqual(definition.startFinishPosition.toArray(), [12, 0.1, -8])
  assert.deepEqual(definition.startFinishDirection.toArray(), [1, 0, 0])
  assert.equal(definition.trackSegments, 48)
  assert.equal(definition.trackCurve.arcLengthDivisions, 2048)
  assert.equal(definition.trackCurve.points.length, 4)
  assert.equal(definition.trackLength > 0, true)
  assert.equal(definition.manualCamera?.followLerp, 0.15)
  const terrainResolutionBudget = definition.renderBudget?.sampledTerrain?.resolution
  assert.equal(typeof terrainResolutionBudget === 'object' ? terrainResolutionBudget.medium : undefined, 240)
  assert.equal(definition.renderBudget?.shadows?.mapSize, 2048)
})

test('imported car track definition can reuse precomputed authoring metadata', () => {
  const metadata = createImportedCarTrackAuthoringMetadata({
    id: 'metadata-first',
    displayName: 'Metadata First',
    geoJson: {
      jsonPath: 'tracks/metadata-first.json'
    },
    startGate: {
      position: [0, 0.1, 0],
      direction: [0, 0, 1],
      gateWidth: 20
    },
    scenery: {
      preset: 'australia-park'
    }
  })

  const definition = createImportedCarTrackDefinitionFromMetadata({
    metadata,
    geoJsonData: squareGeoJson,
    startGateLayout: {
      stripColumns: 10
    }
  })

  assert.equal(definition.trackId, 'metadata-first')
  assert.equal(definition.metadata, metadata)
  assert.equal(definition.startGateLayout?.stripColumns, 10)
})

test('imported car track definition rejects invalid authoring before runtime wiring', () => {
  assert.throws(() => {
    createImportedCarTrackDefinition({
      authoring: {
        id: 'bad-track',
        displayName: 'Bad Track',
        geoJson: {
          jsonPath: 'tracks/bad-track.geojson'
        },
        startGate: {
          position: [0, 0.1, 0],
          direction: [0, 0, 1],
          gateWidth: 20
        },
        scenery: {
          preset: 'belgium-forest'
        }
      },
      geoJsonData: squareGeoJson
    })
  }, /GeoJSON path must point to a \.json file/)
})
