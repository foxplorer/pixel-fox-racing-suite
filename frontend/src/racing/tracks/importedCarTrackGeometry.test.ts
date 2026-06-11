import assert from 'node:assert/strict'
import test from 'node:test'
import { createImportedCarTrackAuthoringMetadata } from './importedCarTrackAuthoring'
import { createImportedCarTrackGeometry } from './importedCarTrackGeometry'

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

const metadata = createImportedCarTrackAuthoringMetadata({
  id: 'example-park',
  displayName: 'Example Park',
  geoJson: {
    jsonPath: 'tracks/example-park.json',
    worldSize: 1000
  },
  startGate: {
    position: [25, 0.1, -10],
    direction: [0, 0, 2],
    gateWidth: 18
  },
  scenery: {
    preset: 'australia-park'
  }
})

test('imported car track geometry builds runtime geometry from GeoJSON and metadata', () => {
  const geometry = createImportedCarTrackGeometry({
    metadata,
    geoJsonData: squareGeoJson,
    trackSegments: 64
  })

  assert.equal(geometry.trackSegments, 64)
  assert.equal(geometry.trackLength > 0, true)
  assert.equal(geometry.trackCurve.closed, true)
  assert.equal(geometry.trackFrames.tangents.length, 65)
  assert.equal(geometry.spatialIndex.samples.length, metadata.spatialIndex.samples + 1)
  assert.deepEqual(geometry.startFinishPosition.toArray(), [25, 0.1, -10])
  assert.deepEqual(geometry.startFinishDirection.toArray(), [0, 0, 1])
  assert.equal(geometry.startingGateHalfWidth, 9)
})

test('imported car track geometry can raise curve sampling resolution for sharp layouts', () => {
  const geometry = createImportedCarTrackGeometry({
    metadata,
    geoJsonData: squareGeoJson,
    trackSegments: 64,
    curveArcLengthDivisions: 4096
  })

  assert.equal(geometry.trackCurve.arcLengthDivisions, 4096)
})

test('imported car track geometry can keep closed curves from duplicating the first control point', () => {
  const geometry = createImportedCarTrackGeometry({
    metadata,
    geoJsonData: squareGeoJson,
    appendClosurePoint: false
  })

  assert.equal(geometry.trackCurve.closed, true)
  assert.equal(geometry.trackCurve.points.length, 4)
})

test('imported car track geometry carries road corridor settings from metadata and road profile', () => {
  const geometry = createImportedCarTrackGeometry({
    metadata,
    geoJsonData: squareGeoJson
  })

  assert.equal(geometry.roadCorridor.roadWidth > 0, true)
  assert.equal(geometry.roadCorridor.shoulderWidth >= 0, true)
  assert.equal(geometry.roadCorridor.blendDistance, metadata.terrain.roadBlendDistance)
  assert.equal(geometry.roadCorridor.roadClearance, metadata.terrain.roadClearance)
})

test('imported car track geometry exposes a road-corridor terrain height sampler', () => {
  const geometry = createImportedCarTrackGeometry({
    metadata,
    geoJsonData: squareGeoJson,
    getTerrainHeight: () => 20
  })
  const roadPoint = geometry.trackCurve.getPointAt(0)

  assert.equal(geometry.terrainHeightSampler(roadPoint.x, roadPoint.z), metadata.terrain.roadClearance)
  assert.equal(geometry.terrainHeightSampler(5000, 5000), 20)
})

test('imported car track geometry preserves GeoJSON elevation when supplied', () => {
  const hillyMetadata = createImportedCarTrackAuthoringMetadata({
    id: 'hilly-example',
    displayName: 'Hilly Example',
    geoJson: {
      jsonPath: 'tracks/hilly-example.json',
      worldSize: 1000,
      coordinateElevationScale: 2,
      coordinateElevationOffset: 1
    },
    startGate: {
      position: [0, 0.1, 0],
      direction: [0, 0, 1],
      gateWidth: 20
    },
    scenery: {
      preset: 'belgium-forest'
    },
    terrain: {
      heightProvider: 'future-heightfield',
      currentElevationSource: 'sampled-real-world'
    }
  })

  const geometry = createImportedCarTrackGeometry({
    metadata: hillyMetadata,
    geoJsonData: {
      features: [{
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0, 2],
            [1, 0, 3],
            [1, 1, 4],
            [0, 1, 5],
            [0, 0, 2]
          ]
        }
      }]
    },
    trackSegments: 32
  })

  const points = geometry.trackCurve.points
  assert.equal(points.some(point => point.y !== 0), true)
  assert.equal(points[0].y, 5)
})

test('imported car track geometry rejects unusable GeoJSON input', () => {
  assert.throws(() => {
    createImportedCarTrackGeometry({
      metadata,
      geoJsonData: {
        features: []
      }
    })
  }, /at least 4 GeoJSON waypoints/)
})
