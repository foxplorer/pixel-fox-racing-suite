import assert from 'node:assert/strict'
import test from 'node:test'
import { createImportedCarTrackDefinition } from './importedCarTrackDefinition'
import {
  findImportedCarTrackByDisplayName,
  resolveTrackSelectionByDisplayName
} from './trackSelection'

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

const createUnitedKingdomDefinition = () => createImportedCarTrackDefinition({
  authoring: {
    id: 'united-kingdom',
    displayName: 'United Kingdom',
    geoJson: {
      jsonPath: 'tracks/united-kingdom.json'
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

test('track selection resolves official event display names first', () => {
  const unitedKingdom = createUnitedKingdomDefinition()
  const selection = resolveTrackSelectionByDisplayName('Belgium', {
    vehicleMode: 'car',
    importedCarTracks: [unitedKingdom]
  })

  assert.equal(selection?.kind, 'official-event')
  assert.equal(selection?.kind === 'official-event' ? selection.event.id : undefined, 'belgium-car')
})

test('track selection resolves imported car track display names', () => {
  const unitedKingdom = createUnitedKingdomDefinition()
  const selection = resolveTrackSelectionByDisplayName('United Kingdom', {
    vehicleMode: 'car',
    importedCarTracks: [unitedKingdom]
  })

  assert.equal(selection?.kind, 'imported-car-track')
  assert.equal(selection?.kind === 'imported-car-track' ? selection.definition : undefined, unitedKingdom)
})

test('track selection does not offer imported car tracks for non-car modes', () => {
  const unitedKingdom = createUnitedKingdomDefinition()

  assert.equal(
    resolveTrackSelectionByDisplayName('United Kingdom', {
      vehicleMode: 'snowmobile',
      importedCarTracks: [unitedKingdom]
    }),
    undefined
  )
})

test('imported car display-name lookup is exact and optional', () => {
  const unitedKingdom = createUnitedKingdomDefinition()

  assert.equal(findImportedCarTrackByDisplayName('United Kingdom', [unitedKingdom]), unitedKingdom)
  assert.equal(findImportedCarTrackByDisplayName('united-kingdom', [unitedKingdom]), undefined)
  assert.equal(findImportedCarTrackByDisplayName('United Kingdom'), undefined)
})
