import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import {
  createClosedTrackCurveFromWaypoints,
  createHorizontalTrackFrames,
  createParallelTransportFrames,
  createSmoothedClosedWaypointPath,
  convertGeoJSONToWaypoints,
  DEFAULT_GEOJSON_WORLD_SIZE,
  getCurveStartPose
} from './trackGeometry'

const createWaypoints = () => [
  new THREE.Vector3(0, 0.1, 0),
  new THREE.Vector3(100, 0.1, 0),
  new THREE.Vector3(100, 0.1, 100),
  new THREE.Vector3(0, 0.1, 100),
  new THREE.Vector3(0, 0.1, 0)
]

test('createSmoothedClosedWaypointPath preserves a closed path', () => {
  const points = createSmoothedClosedWaypointPath(createWaypoints(), {
    pointsBetweenWaypoints: 4,
    groundY: 0.1
  })

  assert.ok(points.length > createWaypoints().length)
  assert.equal(points[0].distanceTo(points[points.length - 1]), 0)
  assert.equal(points.every(point => point.y === 0.1), true)
})

test('createClosedTrackCurveFromWaypoints creates a closed curve', () => {
  const curve = createClosedTrackCurveFromWaypoints(createWaypoints(), {
    pointsBetweenWaypoints: 4,
    groundY: 0.1
  })

  assert.ok(curve.getLength() > 0)
  assert.ok(curve.getPointAt(0).distanceTo(curve.getPointAt(1)) < 0.001)
})

test('createParallelTransportFrames returns one closing frame', () => {
  const curve = createClosedTrackCurveFromWaypoints(createWaypoints(), {
    pointsBetweenWaypoints: 4,
    groundY: 0.1
  })
  const frames = createParallelTransportFrames(curve, 20)

  assert.equal(frames.tangents.length, 21)
  assert.equal(frames.normals.length, 21)
  assert.equal(frames.binormals.length, 21)
  assert.ok(frames.tangents[0].distanceTo(frames.tangents[20]) < 0.001)
})

test('createHorizontalTrackFrames preserves horizontal right-vector convention', () => {
  const curve = createClosedTrackCurveFromWaypoints(createWaypoints(), {
    pointsBetweenWaypoints: 4,
    groundY: 0.1
  })
  const frames = createHorizontalTrackFrames(curve, 20)
  const expectedRight = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), frames.tangents[0])
    .normalize()

  assert.equal(frames.tangents.length, 21)
  assert.equal(frames.normals.every(normal => normal.equals(new THREE.Vector3(0, 1, 0))), true)
  assert.ok(frames.binormals[0].distanceTo(expectedRight) < 0.001)
  assert.equal(frames.binormals.every(binormal => Math.abs(binormal.y) < 0.001), true)
})

test('getCurveStartPose returns point, direction, optional height, and optional inverted direction', () => {
  const curve = createClosedTrackCurveFromWaypoints(createWaypoints(), {
    pointsBetweenWaypoints: 4,
    groundY: 0.1
  })
  const normalPose = getCurveStartPose(curve, 0.25)
  const invertedPose = getCurveStartPose(curve, 0.25, {
    invertDirection: true,
    getY: () => 7
  })

  assert.equal(invertedPose.position.y, 7)
  assert.ok(normalPose.direction.dot(invertedPose.direction) < -0.999)
})

test('DEFAULT_GEOJSON_WORLD_SIZE preserves current import scale', () => {
  assert.equal(DEFAULT_GEOJSON_WORLD_SIZE, 2500)
})

test('convertGeoJSONToWaypoints preserves optional coordinate elevation', () => {
  const waypoints = convertGeoJSONToWaypoints({
    features: [{
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0, 10],
          [1, 0, 12],
          [1, 1, 15]
        ]
      }
    }]
  }, {
    coordinateElevationScale: 2,
    coordinateElevationOffset: -5
  })

  assert.equal(waypoints[0].y, 15)
  assert.equal(waypoints[1].y, 19)
  assert.equal(waypoints[2].y, 25)
})

test('convertGeoJSONToWaypoints lets getY override coordinate elevation', () => {
  const waypoints = convertGeoJSONToWaypoints({
    features: [{
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0, 10],
          [1, 0, 12]
        ]
      }
    }]
  }, {
    getY: (_x, _z, coordinate, index) => (coordinate?.[2] ?? 0) + index
  })

  assert.equal(waypoints[0].y, 10)
  assert.equal(waypoints[1].y, 13)
})

test('convertGeoJSONToWaypoints can avoid appending a duplicate closure control point', () => {
  const waypoints = convertGeoJSONToWaypoints({
    features: [{
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0]
        ]
      }
    }]
  }, {
    appendClosurePoint: false
  })

  assert.equal(waypoints.length, 3)
  assert.equal(waypoints[0].distanceTo(waypoints[waypoints.length - 1]) > 0.1, true)
})
