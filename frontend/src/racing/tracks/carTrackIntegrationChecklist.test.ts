import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCarTrackIntegrationChecklist,
  getMissingRequiredCarTrackIntegrationItems
} from './carTrackIntegrationChecklist'
import {
  createImportedCarTrackAuthoringMetadata,
  type ImportedCarTrackAuthoringInput
} from './importedCarTrackAuthoring'

const baseInput: ImportedCarTrackAuthoringInput = {
  id: 'example-park',
  displayName: 'Example Park',
  geoJson: {
    jsonPath: 'tracks/example-park.json'
  },
  startGate: {
    position: [0, 0.1, 0],
    direction: [0, 0, 1],
    gateWidth: 20
  },
  scenery: {
    preset: 'australia-park',
    file: 'tracks/example-park.scenery.ts'
  }
}

const metadata = createImportedCarTrackAuthoringMetadata(baseInput)

test('car track integration checklist names all systems a new track must reach', () => {
  const checklist = buildCarTrackIntegrationChecklist(metadata)

  assert.deepEqual(checklist.map(item => item.area), [
    'authoring',
    'authoring',
    'rendering',
    'routing',
    'multiplayer',
    'stats',
    'transactions',
    'scenery',
    'terrain'
  ])
})

test('car track integration checklist requires socket track-name registration', () => {
  const checklist = buildCarTrackIntegrationChecklist(metadata, {
    hasRuntimeDefinition: true,
    hasTrackEvent: true,
    socketAllowedTrackNames: ['Australia', 'Belgium']
  })

  const missing = getMissingRequiredCarTrackIntegrationItems(checklist)
  assert.deepEqual(missing.map(item => item.area), ['multiplayer'])
})

test('car track integration checklist passes when a flat imported track is fully registered', () => {
  const checklist = buildCarTrackIntegrationChecklist(metadata, {
    hasRuntimeDefinition: true,
    hasTrackEvent: true,
    socketAllowedTrackNames: ['Australia', 'Example Park'],
    hasSceneryFile: true
  })

  assert.deepEqual(getMissingRequiredCarTrackIntegrationItems(checklist), [])
})

test('car track integration checklist requires a height provider for hilly imported tracks', () => {
  const hillyMetadata = createImportedCarTrackAuthoringMetadata({
    ...baseInput,
    terrain: {
      heightProvider: 'future-heightfield',
      currentElevationSource: 'sampled-real-world'
    }
  })

  const missing = getMissingRequiredCarTrackIntegrationItems(buildCarTrackIntegrationChecklist(hillyMetadata, {
    hasRuntimeDefinition: true,
    hasTrackEvent: true,
    socketAllowedTrackNames: ['Example Park']
  }))

  assert.deepEqual(missing.map(item => item.area), ['terrain'])
})
