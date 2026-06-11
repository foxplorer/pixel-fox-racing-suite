import assert from 'node:assert/strict'
import test from 'node:test'
import { createImportedCarTrackDefinition } from './importedCarTrackDefinition'
import {
  createImportedCarTrackPreviewDefinition,
  getBuiltInTrackPreviewDefinitionsByVehicleMode,
  getTrackPreviewDefinitions
} from './trackPreviewDefinitions'

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

test('track preview definitions preserve current built-in showroom ordering', () => {
  assert.deepEqual(
    getTrackPreviewDefinitions(['car']).map(definition => definition.trackName),
    ['Australia', 'San Luis', 'Belgium']
  )

  assert.deepEqual(
    getTrackPreviewDefinitions(['snowmobile']).map(definition => definition.trackName),
    ['Aspen']
  )
})

test('track preview definitions can include imported car tracks after built-ins', () => {
  const unitedKingdom = createImportedCarTrackDefinition({
    authoring: {
      id: 'united-kingdom',
      displayName: 'United Kingdom',
      geoJson: {
        jsonPath: 'tracks/uk.json'
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

  const previews = getTrackPreviewDefinitions(['car'], [unitedKingdom])

  assert.deepEqual(previews.map(definition => definition.trackName), [
    'Australia',
    'San Luis',
    'Belgium',
    'United Kingdom'
  ])
  assert.equal(previews.at(-1)?.curve, unitedKingdom.trackCurve)
  assert.equal(previews.at(-1)?.trackId, 'united-kingdom')
})

test('imported car preview definitions keep contributor display names and curves', () => {
  const importedDefinition = createImportedCarTrackDefinition({
    authoring: {
      id: 'preview-only',
      displayName: 'Preview Only',
      geoJson: {
        jsonPath: 'tracks/preview-only.json'
      },
      startGate: {
        position: [0, 0.1, 0],
        direction: [1, 0, 0],
        gateWidth: 14
      },
      scenery: {
        preset: 'australia-park'
      }
    },
    geoJsonData: squareGeoJson
  })

  const preview = createImportedCarTrackPreviewDefinition(importedDefinition)

  assert.equal(preview.trackName, 'Preview Only')
  assert.equal(preview.vehicleMode, 'car')
  assert.equal(preview.curve, importedDefinition.trackCurve)
})

test('built-in preview definitions expose curves for every current event in a mode', () => {
  for (const definition of getBuiltInTrackPreviewDefinitionsByVehicleMode('car')) {
    assert.equal(definition.curve.closed, true)
    assert.equal(definition.eventId?.endsWith('-car'), true)
  }
})
