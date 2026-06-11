import type { CarTrackDefinition } from './carTrackDefinitions'
import {
  createImportedCarTrackAuthoringMetadata,
  type ImportedCarTrackAuthoringInput,
  type ImportedCarTrackAuthoringMetadata
} from './importedCarTrackAuthoring'
import {
  createImportedCarTrackGeometry,
  type ImportedCarTrackGeometryOptions
} from './importedCarTrackGeometry'

type ImportedGeoJsonData = ImportedCarTrackGeometryOptions['geoJsonData']

export interface ImportedCarTrackDefinitionOptions {
  authoring: ImportedCarTrackAuthoringInput
  geoJsonData: ImportedGeoJsonData
  trackSegments?: ImportedCarTrackGeometryOptions['trackSegments']
  curveArcLengthDivisions?: ImportedCarTrackGeometryOptions['curveArcLengthDivisions']
  appendClosurePoint?: ImportedCarTrackGeometryOptions['appendClosurePoint']
  curveType?: ImportedCarTrackGeometryOptions['curveType']
  tension?: ImportedCarTrackGeometryOptions['tension']
  getY?: ImportedCarTrackGeometryOptions['getY']
  getTerrainHeight?: ImportedCarTrackGeometryOptions['getTerrainHeight']
  startGateLayout?: CarTrackDefinition['startGateLayout']
  manualCamera?: CarTrackDefinition['manualCamera']
  cameraZones?: CarTrackDefinition['cameraZones']
  renderBudget?: CarTrackDefinition['renderBudget']
}

export interface ImportedCarTrackDefinitionFromMetadataOptions extends Omit<ImportedCarTrackDefinitionOptions, 'authoring'> {
  metadata: ImportedCarTrackAuthoringMetadata
}

export const createImportedCarTrackDefinitionFromMetadata = ({
  metadata,
  geoJsonData,
  trackSegments,
  curveArcLengthDivisions,
  appendClosurePoint,
  curveType,
  tension,
  getY,
  getTerrainHeight,
  startGateLayout,
  manualCamera,
  cameraZones,
  renderBudget
}: ImportedCarTrackDefinitionFromMetadataOptions): CarTrackDefinition => {
  const geometry = createImportedCarTrackGeometry({
    metadata,
    geoJsonData,
    trackSegments,
    curveArcLengthDivisions,
    appendClosurePoint,
    curveType,
    tension,
    getY,
    getTerrainHeight
  })

  return {
    trackId: metadata.id,
    metadata,
    startFinishPosition: geometry.startFinishPosition,
    startFinishDirection: geometry.startFinishDirection,
    startingGateHalfWidth: geometry.startingGateHalfWidth,
    trackCurve: geometry.trackCurve,
    trackFrames: geometry.trackFrames,
    trackSegments: geometry.trackSegments,
    trackLength: geometry.trackLength,
    spatialTrackIndex: geometry.spatialIndex,
    roadCorridor: geometry.roadCorridor,
    terrainHeightSampler: geometry.terrainHeightSampler,
    startGateLayout,
    manualCamera,
    cameraZones,
    renderBudget
  }
}

export const createImportedCarTrackDefinition = ({
  authoring,
  ...options
}: ImportedCarTrackDefinitionOptions): CarTrackDefinition => {
  return createImportedCarTrackDefinitionFromMetadata({
    ...options,
    metadata: createImportedCarTrackAuthoringMetadata(authoring)
  })
}
