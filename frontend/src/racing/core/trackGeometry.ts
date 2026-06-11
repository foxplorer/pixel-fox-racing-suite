import * as THREE from 'three'

type GeoJSONLineStringFeature = {
  geometry?: {
    type?: string
    coordinates?: number[][]
  }
}

type GeoJSONLineString = {
  features?: GeoJSONLineStringFeature[]
}

type ConvertGeoJSONToWaypointsOptions = {
  worldSize?: number
  groundY?: number
  getY?: (x: number, z: number, coordinate?: number[], index?: number) => number
  coordinateElevationScale?: number
  coordinateElevationOffset?: number
  appendClosurePoint?: boolean
}

export const DEFAULT_GEOJSON_WORLD_SIZE = 2500

export type TrackFrames = {
  tangents: THREE.Vector3[]
  normals: THREE.Vector3[]
  binormals: THREE.Vector3[]
}

type CatmullRomCurveType = 'centripetal' | 'chordal' | 'catmullrom'

export type TrackInterior = {
  center: THREE.Vector3
  area: number
  width: number
  height: number
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  polygon: Array<{ x: number; z: number }>
}

export type TrackStartPose = {
  position: THREE.Vector3
  direction: THREE.Vector3
}

export const createSmoothedClosedWaypointPath = (
  waypoints: THREE.Vector3[],
  options: {
    pointsBetweenWaypoints?: number
    groundY?: number
    transitionPoints?: number
  } = {}
): THREE.Vector3[] => {
  const pointsBetweenWaypoints = options.pointsBetweenWaypoints ?? 30
  const groundY = options.groundY ?? 0.1
  const transitionPoints = options.transitionPoints ?? 10

  if (waypoints.length === 0) {
    return []
  }

  const points: THREE.Vector3[] = []

  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i]
    const end = waypoints[i + 1]

    if (i === 0) {
      points.push(start.clone())
    }

    for (let j = 1; j <= pointsBetweenWaypoints; j++) {
      const t = j / pointsBetweenWaypoints
      const smoothT = t * t * (3 - 2 * t)
      const point = start.clone().lerp(end, smoothT)
      point.y = groundY
      points.push(point)
    }
  }

  if (points.length === 0) {
    return []
  }

  const firstPoint = points[0]
  let lastPoint = points[points.length - 1]

  if (lastPoint.distanceTo(firstPoint) > 0.01) {
    points[points.length - 1] = firstPoint.clone()
  }

  lastPoint = points[points.length - 1]
  const closureDistance = lastPoint.distanceTo(firstPoint)

  if (closureDistance > 0.1) {
    for (let i = 1; i <= transitionPoints; i++) {
      const t = i / (transitionPoints + 1)
      const point = lastPoint.clone().lerp(firstPoint, t)
      point.y = groundY
      points.push(point)
    }
    points[points.length - 1] = firstPoint.clone()
  } else {
    points[points.length - 1] = firstPoint.clone()
  }

  points.push(firstPoint.clone())

  return points
}

export const createClosedTrackCurveFromWaypoints = (
  waypoints: THREE.Vector3[],
  options: {
    pointsBetweenWaypoints?: number
    groundY?: number
    transitionPoints?: number
    curveType?: CatmullRomCurveType
    tension?: number
  } = {}
): THREE.CatmullRomCurve3 => {
  const points = createSmoothedClosedWaypointPath(waypoints, options)
  return new THREE.CatmullRomCurve3(
    points,
    true,
    options.curveType ?? 'centripetal',
    options.tension ?? 0.8
  )
}

export const createParallelTransportFrames = (
  curve: THREE.CatmullRomCurve3,
  segments: number
): TrackFrames => {
  const frames: TrackFrames = {
    tangents: [],
    normals: [],
    binormals: []
  }

  const startTangent = curve.getTangentAt(0).normalize()
  let normal = new THREE.Vector3(0, 1, 0)
  const vec = new THREE.Vector3().copy(normal).projectOnVector(startTangent)
  normal.sub(vec).normalize()
  const binormal = new THREE.Vector3().crossVectors(startTangent, normal).normalize()

  frames.tangents.push(startTangent)
  frames.normals.push(normal)
  frames.binormals.push(binormal)

  const worldUp = new THREE.Vector3(0, 1, 0)
  let currentNormal = normal.clone()

  for (let i = 1; i < segments; i++) {
    const t = i / segments
    const tangent = curve.getTangentAt(t).normalize()
    const prevTangent = frames.tangents[i - 1]
    const axis = new THREE.Vector3().crossVectors(prevTangent, tangent).normalize()
    const angle = Math.acos(Math.min(Math.max(prevTangent.dot(tangent), -1), 1))

    if (angle > 0.0001) {
      currentNormal.applyAxisAngle(axis, angle)
    }

    const projectedUp = worldUp.clone().sub(tangent.clone().multiplyScalar(worldUp.dot(tangent))).normalize()
    if (projectedUp.lengthSq() > 0.5) {
      currentNormal.lerp(projectedUp, 0.05).normalize()
    }

    const currentBinormal = new THREE.Vector3().crossVectors(tangent, currentNormal).normalize()

    frames.tangents.push(tangent)
    frames.normals.push(currentNormal.clone())
    frames.binormals.push(currentBinormal)
  }

  frames.tangents.push(frames.tangents[0])
  frames.normals.push(frames.normals[0])
  frames.binormals.push(frames.binormals[0])

  return frames
}

export const createHorizontalTrackFrames = (
  curve: THREE.CatmullRomCurve3,
  segments: number,
  options: { smoothClosure?: boolean } = {}
): TrackFrames => {
  const frames: TrackFrames = {
    tangents: [],
    normals: [],
    binormals: []
  }

  const worldUp = new THREE.Vector3(0, 1, 0)

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const tangent = curve.getTangentAt(t).normalize()
    const normal = worldUp.clone()

    let right = new THREE.Vector3().crossVectors(worldUp, tangent)
    const rightLength = right.length()

    if (rightLength < 0.1) {
      if (i > 0) {
        right = frames.binormals[i - 1].clone()
        right.y = 0
        right.normalize()
      } else {
        right = new THREE.Vector3(1, 0, 0)
      }
    } else {
      right.normalize()

      if (i > 0) {
        const prevRight = frames.binormals[i - 1]
        if (prevRight.dot(right) < 0) {
          right.negate()
        }
      }
    }

    if (Math.abs(right.y) > 0.01) {
      right.y = 0
      right.normalize()
    }

    frames.tangents.push(tangent)
    frames.normals.push(normal)
    frames.binormals.push(right)
  }

  if (options.smoothClosure && frames.binormals.length > 1) {
    const firstRight = frames.binormals[0]
    const lastRight = frames.binormals[frames.binormals.length - 1]

    if (firstRight.dot(lastRight) < 0.9) {
      const avgRight = new THREE.Vector3()
        .addVectors(firstRight, lastRight)
        .normalize()

      frames.binormals[0] = avgRight.clone()
      frames.binormals[frames.binormals.length - 1] = avgRight.clone()
    }
  }

  return frames
}

export const getCurveStartPose = (
  curve: THREE.CatmullRomCurve3,
  t: number,
  options: {
    invertDirection?: boolean
    getY?: (x: number, z: number) => number
  } = {}
): TrackStartPose => {
  const position = curve.getPointAt(t)
  if (options.getY) {
    position.y = options.getY(position.x, position.z)
  }

  const direction = curve.getTangentAt(t).normalize()
  if (options.invertDirection) {
    direction.negate()
  }

  return { position, direction }
}

export const convertGeoJSONToWaypoints = (
  geojsonData: GeoJSONLineString | null | undefined,
  options: ConvertGeoJSONToWaypointsOptions = {}
): THREE.Vector3[] => {
  if (!geojsonData || !geojsonData.features || geojsonData.features.length === 0) {
    return []
  }

  const feature = geojsonData.features[0]
  if (!feature.geometry || feature.geometry.type !== 'LineString') {
    console.error('Invalid GeoJSON: Expected LineString geometry')
    return []
  }

  let coordinates = feature.geometry.coordinates
  if (!coordinates || coordinates.length === 0) {
    return []
  }

  if (coordinates.length > 1) {
    const firstCoord = coordinates[0]
    const lastCoord = coordinates[coordinates.length - 1]
    const tolerance = 0.000001

    if (
      Math.abs(firstCoord[0] - lastCoord[0]) < tolerance &&
      Math.abs(firstCoord[1] - lastCoord[1]) < tolerance
    ) {
      coordinates = coordinates.slice(0, -1)
    }
  }

  const lons: number[] = []
  const lats: number[] = []

  coordinates.forEach((coord: number[]) => {
    lons.push(coord[0])
    lats.push(coord[1])
  })

  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)

  const centerLon = (minLon + maxLon) / 2
  const centerLat = (minLat + maxLat) / 2

  const latRange = maxLat - minLat
  const lonRange = maxLon - minLon
  const maxRange = Math.max(latRange, lonRange)
  const scale = (options.worldSize ?? DEFAULT_GEOJSON_WORLD_SIZE) / maxRange
  const groundY = options.groundY ?? 0
  const coordinateElevationScale = options.coordinateElevationScale ?? 1
  const coordinateElevationOffset = options.coordinateElevationOffset ?? 0

  const waypoints = coordinates.map((coord: number[], index: number) => {
    const lon = coord[0]
    const lat = coord[1]
    const x = (lon - centerLon) * scale * Math.cos(centerLat * Math.PI / 180)
    const z = -(lat - centerLat) * scale
    const coordinateElevation = coord.length > 2 && Number.isFinite(coord[2])
      ? coord[2] * coordinateElevationScale + coordinateElevationOffset
      : groundY
    const y = options.getY ? options.getY(x, z, coord, index) : coordinateElevation

    return new THREE.Vector3(x, y, z)
  })

  if ((options.appendClosurePoint ?? true) && waypoints.length > 0) {
    const first = waypoints[0]
    const last = waypoints[waypoints.length - 1]

    if (first.distanceTo(last) > 0.1) {
      waypoints.push(first.clone())
    } else {
      waypoints[waypoints.length - 1] = first.clone()
    }
  }

  return waypoints
}

const isPointInPolygon = (point: { x: number; z: number }, polygon: Array<{ x: number; z: number }>): boolean => {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const zi = polygon[i].z
    const xj = polygon[j].x
    const zj = polygon[j].z

    const intersect = ((zi > point.z) !== (zj > point.z)) &&
      (point.x < (xj - xi) * (point.z - zi) / (zj - zi) + xi)
    if (intersect) inside = !inside
  }

  return inside
}

export const calculateTrackInterior = (
  trackCurve: THREE.CatmullRomCurve3,
  options: {
    trackSamplesCount?: number
    gridResolution?: number
    centerY?: number
  } = {}
): TrackInterior => {
  const trackSamplesCount = options.trackSamplesCount ?? 1000
  const gridResolution = options.gridResolution ?? 150
  const centerY = options.centerY ?? 0.1
  const trackPolygon: Array<{ x: number; z: number }> = []

  for (let i = 0; i < trackSamplesCount; i++) {
    const t = i / trackSamplesCount
    const point = trackCurve.getPointAt(t)
    trackPolygon.push({ x: point.x, z: point.z })
  }

  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity

  trackPolygon.forEach(point => {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minZ = Math.min(minZ, point.z)
    maxZ = Math.max(maxZ, point.z)
  })

  const stepX = (maxX - minX) / gridResolution
  const stepZ = (maxZ - minZ) / gridResolution
  const insidePoints: Array<{ x: number; z: number }> = []
  let sumX = 0
  let sumZ = 0

  for (let i = 0; i <= gridResolution; i++) {
    for (let j = 0; j <= gridResolution; j++) {
      const x = minX + i * stepX
      const z = minZ + j * stepZ
      const point = { x, z }

      if (isPointInPolygon(point, trackPolygon)) {
        insidePoints.push(point)
        sumX += x
        sumZ += z
      }
    }
  }

  const centerX = insidePoints.length > 0 ? sumX / insidePoints.length : (minX + maxX) / 2
  const centerZ = insidePoints.length > 0 ? sumZ / insidePoints.length : (minZ + maxZ) / 2
  const center = new THREE.Vector3(centerX, centerY, centerZ)
  const cellArea = stepX * stepZ
  const interiorArea = insidePoints.length * cellArea

  let interiorMinX = Infinity
  let interiorMaxX = -Infinity
  let interiorMinZ = Infinity
  let interiorMaxZ = -Infinity

  insidePoints.forEach(point => {
    interiorMinX = Math.min(interiorMinX, point.x)
    interiorMaxX = Math.max(interiorMaxX, point.x)
    interiorMinZ = Math.min(interiorMinZ, point.z)
    interiorMaxZ = Math.max(interiorMaxZ, point.z)
  })

  return {
    center,
    area: interiorArea,
    width: interiorMaxX - interiorMinX,
    height: interiorMaxZ - interiorMinZ,
    minX: interiorMinX,
    maxX: interiorMaxX,
    minZ: interiorMinZ,
    maxZ: interiorMaxZ,
    polygon: trackPolygon
  }
}
