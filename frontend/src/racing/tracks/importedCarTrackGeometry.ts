import * as THREE from 'three'
import {
  convertGeoJSONToWaypoints,
  createHorizontalTrackFrames,
  type TrackFrames
} from '../core/trackGeometry'
import { getTrackSurfaceProfile } from '../core/trackProfile'
import {
  createRoadCorridorTerrainHeightSampler,
  findNearestTrackSample,
  type RoadCorridorConfig,
  type TerrainHeightSampler
} from '../core/roadCorridor'
import {
  createSpatialTrackIndex,
  type SpatialTrackIndex
} from '../core/spatialTrackIndex'
import type { ImportedCarTrackAuthoringMetadata } from './importedCarTrackAuthoring'

type ImportedGeoJsonData = Parameters<typeof convertGeoJSONToWaypoints>[0]

export interface ImportedCarTrackGeometryOptions {
  metadata: ImportedCarTrackAuthoringMetadata
  geoJsonData: ImportedGeoJsonData
  trackSegments?: number
  curveArcLengthDivisions?: number
  appendClosurePoint?: boolean
  curveType?: 'centripetal' | 'chordal' | 'catmullrom'
  tension?: number
  getY?: (x: number, z: number, coordinate?: number[], index?: number) => number
  getTerrainHeight?: TerrainHeightSampler
}

export interface ImportedCarTrackGeometry {
  trackCurve: THREE.CatmullRomCurve3
  trackFrames: TrackFrames
  trackSegments: number
  trackLength: number
  spatialIndex: SpatialTrackIndex
  roadCorridor: RoadCorridorConfig
  terrainHeightSampler: TerrainHeightSampler
  startFinishPosition: THREE.Vector3
  startFinishDirection: THREE.Vector3
  startingGateHalfWidth: number
}

export const DEFAULT_IMPORTED_CAR_TRACK_SEGMENTS = 900

const createVector3 = (value: readonly [number, number, number]): THREE.Vector3 => {
  return new THREE.Vector3(value[0], value[1], value[2])
}

export const createImportedCarTrackGeometry = ({
  metadata,
  geoJsonData,
  trackSegments = DEFAULT_IMPORTED_CAR_TRACK_SEGMENTS,
  curveArcLengthDivisions,
  appendClosurePoint,
  curveType = 'centripetal',
  tension = 0.5,
  getY,
  getTerrainHeight
}: ImportedCarTrackGeometryOptions): ImportedCarTrackGeometry => {
  const waypoints = convertGeoJSONToWaypoints(geoJsonData, {
    worldSize: metadata.layout.worldSize,
    groundY: 0,
    coordinateElevationScale: metadata.geoJsonElevation?.coordinateElevationScale,
    coordinateElevationOffset: metadata.geoJsonElevation?.coordinateElevationOffset,
    appendClosurePoint,
    getY
  })

  if (waypoints.length < 4) {
    throw new Error(`Imported car track "${metadata.displayName}" needs at least 4 GeoJSON waypoints after conversion.`)
  }

  const trackCurve = new THREE.CatmullRomCurve3(waypoints, true, curveType, tension)
  if (curveArcLengthDivisions !== undefined) {
    trackCurve.arcLengthDivisions = curveArcLengthDivisions
    trackCurve.updateArcLengths()
  }
  const trackFrames = createHorizontalTrackFrames(trackCurve, trackSegments)
  const spatialIndex = createSpatialTrackIndex(trackCurve, metadata.spatialIndex)
  const surfaceProfile = getTrackSurfaceProfile(metadata.road.profileKey)
  const roadCorridor: RoadCorridorConfig = {
    roadWidth: surfaceProfile.trackWidth,
    shoulderWidth: surfaceProfile.shoulderWidth,
    blendDistance: metadata.terrain.roadBlendDistance,
    roadClearance: metadata.terrain.roadClearance
  }
  const defaultTerrainHeight: TerrainHeightSampler = metadata.terrain.currentElevationSource === 'none'
    ? () => 0
    : (x, z) => findNearestTrackSample(spatialIndex, x, z).sample?.pos.y ?? 0
  const terrainHeightSampler = createRoadCorridorTerrainHeightSampler(
    spatialIndex,
    roadCorridor,
    getTerrainHeight ?? defaultTerrainHeight
  )
  const startFinishPosition = createVector3(metadata.start.position ?? [0, 0.1, 0])
  if (metadata.terrain.currentElevationSource !== 'none') {
    startFinishPosition.y = terrainHeightSampler(startFinishPosition.x, startFinishPosition.z)
  }
  const startFinishDirection = createVector3(metadata.start.directionVector ?? [0, 0, 1]).normalize()

  return {
    trackCurve,
    trackFrames,
    trackSegments,
    trackLength: trackCurve.getLength(),
    spatialIndex,
    roadCorridor,
    terrainHeightSampler,
    startFinishPosition,
    startFinishDirection,
    startingGateHalfWidth: metadata.start.gateWidth / 2
  }
}
