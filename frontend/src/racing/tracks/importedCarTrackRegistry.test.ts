import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findImportedCarTrackCatalogEntryByDisplayName,
  IMPORTED_CAR_TRACK_DISPLAY_NAMES
} from './importedCarTrackCatalog'
import {
  findImportedCarTrackDefinitionById,
  IMPORTED_CAR_TRACK_DEFINITIONS
} from './importedCarTrackRegistry'

test('imported car track catalog exposes lightweight display names', () => {
  assert.deepEqual(IMPORTED_CAR_TRACK_DISPLAY_NAMES, ['United Kingdom', 'Germany', 'Volcanoes'])
  assert.equal(findImportedCarTrackCatalogEntryByDisplayName('United Kingdom')?.id, 'united-kingdom')
  assert.equal(findImportedCarTrackCatalogEntryByDisplayName('Germany')?.id, 'germany')
  assert.equal(findImportedCarTrackCatalogEntryByDisplayName('Volcanoes')?.id, 'volcanoes')
  assert.equal(findImportedCarTrackCatalogEntryByDisplayName('united-kingdom'), undefined)
})

test('imported car track registry resolves runtime definitions by id', () => {
  assert.equal(IMPORTED_CAR_TRACK_DEFINITIONS.length, 3)
  assert.equal(findImportedCarTrackDefinitionById('united-kingdom')?.metadata.displayName, 'United Kingdom')
  assert.equal(findImportedCarTrackDefinitionById('germany')?.metadata.displayName, 'Germany')
  assert.equal(findImportedCarTrackDefinitionById('volcanoes')?.metadata.displayName, 'Volcanoes')
  assert.equal(findImportedCarTrackDefinitionById('missing'), undefined)
})
