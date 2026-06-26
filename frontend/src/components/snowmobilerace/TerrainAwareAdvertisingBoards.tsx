import React, { useMemo, useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { trackCurve } from './TrackData'
import { getTerrainHeight } from './TerrainSystem'
import { getCenterlineOffset } from '../../racing/core/trackProfile'
import { getTrackRuntimeConfig } from '../../racing/tracks/trackRuntimeConfig'
import pixelRacingLogoImage from '../../assets/pixel_racing_logo.png'
import yourAdHereImage from '../../assets/your_ad_here.png'

const trackRuntimeConfig = getTrackRuntimeConfig('aspen')

interface CurvedBoardData {
  curve: THREE.CatmullRomCurve3
  startT: number
  endT: number
  height: number
  offset: number
  side: 'left' | 'right'
  globalTrackLength: number
  cumulativeLengthBefore: number
}

// Curved board component that follows a curve path AND terrain height
const CurvedBoard: React.FC<CurvedBoardData> = React.memo(({ curve, startT, endT, height, offset, side, globalTrackLength, cumulativeLengthBefore }) => {
  const { gl } = useThree()

  // Texture orientation constants
  const LEFT_BOARD_FRONT_REVERSE_LENGTHS = false
  const LEFT_BOARD_FRONT_NEGATIVE_REPEAT = false
  const LEFT_BOARD_BACK_REVERSE_LENGTHS = false
  const LEFT_BOARD_BACK_NEGATIVE_REPEAT = false
  const LEFT_BOARD_BACK_FLIP_UVS = true

  const RIGHT_BOARD_FRONT_REVERSE_LENGTHS = false
  const RIGHT_BOARD_FRONT_NEGATIVE_REPEAT = true
  const RIGHT_BOARD_BACK_REVERSE_LENGTHS = false
  const RIGHT_BOARD_BACK_NEGATIVE_REPEAT = true
  const RIGHT_BOARD_BACK_FLIP_UVS = true

  const frameThickness = 0.05
  const logoDisplayHeight = 1.2
  const logoSpacing = 24
  const CANVAS_SCALE = 100
  const boardGroundOffset = 0.3 // Offset above snow

  const [logoCanvas, setLogoCanvas] = React.useState<HTMLCanvasElement | null>(null)

  React.useEffect(() => {
    const pixelRacingLogoImg = new Image()
    const yourAdImg = new Image()
    pixelRacingLogoImg.crossOrigin = 'anonymous'
    yourAdImg.crossOrigin = 'anonymous'

    let pixelRacingLogoLoaded = false
    let yourAdLoaded = false

    const createCanvas = () => {
      if (!pixelRacingLogoLoaded || !yourAdLoaded) return

      const LOGOS_PER_PATTERN = 2
      const AD_PROBABILITY = 0.5

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!

      const singleLogoWidth = logoSpacing * CANVAS_SCALE
      const canvasWidth = singleLogoWidth * LOGOS_PER_PATTERN
      const canvasHeight = height * CANVAS_SCALE

      canvas.width = canvasWidth
      canvas.height = canvasHeight

      ctx.fillStyle = '#36bffa'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      for (let i = 0; i < LOGOS_PER_PATTERN; i++) {
        const useAd = Math.random() < AD_PROBABILITY
        const img = useAd ? yourAdImg : pixelRacingLogoImg

        const imageAspectRatio = img.width / img.height
        const targetHeight = logoDisplayHeight
        const targetWidth = targetHeight * imageAspectRatio

        const logoCanvasWidth = targetWidth * CANVAS_SCALE
        const logoCanvasHeight = targetHeight * CANVAS_SCALE
        const slotX = i * singleLogoWidth
        const logoX = slotX + (singleLogoWidth - logoCanvasWidth) / 2
        const logoY = (canvasHeight - logoCanvasHeight) / 2

        ctx.drawImage(img, logoX, logoY, logoCanvasWidth, logoCanvasHeight)
      }

      setLogoCanvas(canvas)
    }

    pixelRacingLogoImg.onload = () => {
      pixelRacingLogoLoaded = true
      createCanvas()
    }

    yourAdImg.onload = () => {
      yourAdLoaded = true
      createCanvas()
    }

    pixelRacingLogoImg.onerror = () => {
      setLogoCanvas(null)
    }

    yourAdImg.onerror = () => {
      yourAdLoaded = true
      createCanvas()
    }

    pixelRacingLogoImg.src = pixelRacingLogoImage
    yourAdImg.src = yourAdHereImage
  }, [height, logoDisplayHeight, logoSpacing])

  const fallbackTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = 100
    canvas.height = 100
    ctx.fillStyle = '#36bffa'
    ctx.fillRect(0, 0, 100, 100)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    return texture
  }, [])

  // Sample points along the curve with TERRAIN-AWARE height
  // Also calculate accumulated lengths using 2D (XZ) distance for consistent UV mapping
  const curvePoints = useMemo(() => {
    const segments = 100
    const points: THREE.Vector3[] = []
    const tangents: THREE.Vector3[] = []
    const perpDirs: THREE.Vector3[] = []
    const accumulatedLengths: number[] = []
    let currentLength = 0
    let prevPerpDir: THREE.Vector3 | null = null

    for (let i = 0; i <= segments; i++) {
      const t = startT + (endT - startT) * (i / segments)
      const wrappedT = t < 0 ? t + 1 : (t > 1 ? t - 1 : t)
      const point = curve.getPointAt(wrappedT)
      const tangent = curve.getTangentAt(wrappedT).normalize()
      let perpDir = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()

      // Sharp corner smoothing
      if (prevPerpDir) {
        const dot = perpDir.dot(prevPerpDir)
        if (dot < 0.7) {
          perpDir = prevPerpDir.clone().multiplyScalar(0.7).add(perpDir.multiplyScalar(0.3)).normalize()
        }
      }
      prevPerpDir = perpDir.clone()

      const offsetDir = side === 'left' ? perpDir : perpDir.clone().multiplyScalar(-1)
      const boardPoint = point.clone().add(offsetDir.multiplyScalar(offset))

      // Sample terrain height at this XZ position
      const terrainY = getTerrainHeight(boardPoint.x, boardPoint.z)
      // Board center is terrain height + ground offset + half board height
      boardPoint.y = terrainY + boardGroundOffset + height / 2

      points.push(boardPoint)
      tangents.push(tangent)
      perpDirs.push(offsetDir)

      // Calculate 2D (XZ) distance for UV mapping - ignores terrain height changes
      // This ensures texture spacing is consistent regardless of hills/valleys
      if (i > 0) {
        const prevPoint = points[i - 1]
        const dx = boardPoint.x - prevPoint.x
        const dz = boardPoint.z - prevPoint.z
        currentLength += Math.sqrt(dx * dx + dz * dz)
      }
      accumulatedLengths.push(currentLength)
    }

    return { points, tangents, perpDirs, accumulatedLengths }
  }, [curve, startT, endT, offset, side, height, boardGroundOffset])

  // Derive totalLength from accumulated lengths for consistency
  const totalLength = useMemo(() => {
    const { accumulatedLengths } = curvePoints
    return accumulatedLengths[accumulatedLengths.length - 1] || 1
  }, [curvePoints])

  // Front face geometry (facing track)
  const frontFaceGeometry = useMemo(() => {
    const segments = 100
    const geometry = new THREE.BufferGeometry()
    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    const { points, perpDirs, accumulatedLengths } = curvePoints

    const shouldReverse = side === 'left' ? LEFT_BOARD_FRONT_REVERSE_LENGTHS : RIGHT_BOARD_FRONT_REVERSE_LENGTHS
    let finalAccumulatedLengths = accumulatedLengths
    if (shouldReverse) {
      const maxLength = accumulatedLengths[accumulatedLengths.length - 1]
      finalAccumulatedLengths = accumulatedLengths.map(len => maxLength - len)
    }

    for (let i = 0; i <= segments; i++) {
      const point = points[i]
      const up = new THREE.Vector3(0, 1, 0)
      const offsetDir = perpDirs[i]

      const u = Math.max(0, Math.min(1, finalAccumulatedLengths[i] / totalLength))
      const frontOffset = offsetDir.clone().multiplyScalar(frameThickness / 2)

      const bottomPos = point.clone().add(up.clone().multiplyScalar(-height / 2)).add(frontOffset)
      vertices.push(bottomPos.x, bottomPos.y, bottomPos.z)
      normals.push(offsetDir.x, offsetDir.y, offsetDir.z)
      uvs.push(u, 0)

      const topPos = point.clone().add(up.clone().multiplyScalar(height / 2)).add(frontOffset)
      vertices.push(topPos.x, topPos.y, topPos.z)
      normals.push(offsetDir.x, offsetDir.y, offsetDir.z)
      uvs.push(u, 1)
    }

    for (let i = 0; i < segments; i++) {
      const a = i * 2
      const b = i * 2 + 1
      const c = (i + 1) * 2
      const d = (i + 1) * 2 + 1
      indices.push(a, b, c)
      indices.push(b, d, c)
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    return geometry
  }, [curvePoints, totalLength, height, frameThickness, side])

  // Back face geometry
  const backFaceGeometry = useMemo(() => {
    const segments = 100
    const geometry = new THREE.BufferGeometry()
    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    const { points, perpDirs, accumulatedLengths } = curvePoints

    const shouldReverse = side === 'left' ? LEFT_BOARD_BACK_REVERSE_LENGTHS : RIGHT_BOARD_BACK_REVERSE_LENGTHS
    const shouldFlipUVs = side === 'left' ? LEFT_BOARD_BACK_FLIP_UVS : RIGHT_BOARD_BACK_FLIP_UVS
    let finalAccumulatedLengths = accumulatedLengths
    if (shouldReverse) {
      const maxLength = accumulatedLengths[accumulatedLengths.length - 1]
      finalAccumulatedLengths = accumulatedLengths.map(len => maxLength - len)
    }

    for (let i = 0; i <= segments; i++) {
      const point = points[i]
      const up = new THREE.Vector3(0, 1, 0)
      const offsetDir = perpDirs[i]

      const u = Math.max(0, Math.min(1, finalAccumulatedLengths[i] / totalLength))
      const backOffset = offsetDir.clone().multiplyScalar(-frameThickness / 2)

      const bottomPos = point.clone().add(up.clone().multiplyScalar(-height / 2)).add(backOffset)
      vertices.push(bottomPos.x, bottomPos.y, bottomPos.z)
      normals.push(-offsetDir.x, -offsetDir.y, -offsetDir.z)
      uvs.push(shouldFlipUVs ? 1 - u : u, 0)

      const topPos = point.clone().add(up.clone().multiplyScalar(height / 2)).add(backOffset)
      vertices.push(topPos.x, topPos.y, topPos.z)
      normals.push(-offsetDir.x, -offsetDir.y, -offsetDir.z)
      uvs.push(shouldFlipUVs ? 1 - u : u, 1)
    }

    for (let i = 0; i < segments; i++) {
      const a = i * 2
      const b = i * 2 + 1
      const c = (i + 1) * 2
      const d = (i + 1) * 2 + 1
      indices.push(a, c, b)
      indices.push(b, c, d)
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    return geometry
  }, [curvePoints, totalLength, height, frameThickness, side])

  // Left edge front geometry
  const leftEdgeFrontGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    const { points, perpDirs } = curvePoints
    const point = points[0]
    const offsetDir = perpDirs[0]
    const up = new THREE.Vector3(0, 1, 0)

    const frontOffset = offsetDir.clone().multiplyScalar(frameThickness / 2)
    const backOffset = offsetDir.clone().multiplyScalar(-frameThickness / 2)

    const frontBottom = point.clone().add(up.clone().multiplyScalar(-height / 2)).add(frontOffset)
    const frontTop = point.clone().add(up.clone().multiplyScalar(height / 2)).add(frontOffset)
    const backBottom = point.clone().add(up.clone().multiplyScalar(-height / 2)).add(backOffset)
    const backTop = point.clone().add(up.clone().multiplyScalar(height / 2)).add(backOffset)

    vertices.push(frontBottom.x, frontBottom.y, frontBottom.z)
    vertices.push(frontTop.x, frontTop.y, frontTop.z)
    vertices.push(backBottom.x, backBottom.y, backBottom.z)
    vertices.push(backTop.x, backTop.y, backTop.z)

    const leftNormal = offsetDir.clone().multiplyScalar(side === 'left' ? -1 : 1)
    normals.push(leftNormal.x, leftNormal.y, leftNormal.z)
    normals.push(leftNormal.x, leftNormal.y, leftNormal.z)
    normals.push(leftNormal.x, leftNormal.y, leftNormal.z)
    normals.push(leftNormal.x, leftNormal.y, leftNormal.z)

    uvs.push(0, 1)
    uvs.push(0, 0)
    uvs.push(0, 1)
    uvs.push(0, 0)

    indices.push(0, 1, 2)
    indices.push(1, 3, 2)

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    return geometry
  }, [curvePoints, height, frameThickness, side])

  // Left edge back geometry
  const leftEdgeBackGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    const { points, perpDirs } = curvePoints
    const point = points[0]
    const offsetDir = perpDirs[0]
    const up = new THREE.Vector3(0, 1, 0)

    const frontOffset = offsetDir.clone().multiplyScalar(frameThickness / 2)
    const backOffset = offsetDir.clone().multiplyScalar(-frameThickness / 2)

    const frontBottom = point.clone().add(up.clone().multiplyScalar(-height / 2)).add(frontOffset)
    const frontTop = point.clone().add(up.clone().multiplyScalar(height / 2)).add(frontOffset)
    const backBottom = point.clone().add(up.clone().multiplyScalar(-height / 2)).add(backOffset)
    const backTop = point.clone().add(up.clone().multiplyScalar(height / 2)).add(backOffset)

    vertices.push(backBottom.x, backBottom.y, backBottom.z)
    vertices.push(backTop.x, backTop.y, backTop.z)
    vertices.push(frontBottom.x, frontBottom.y, frontBottom.z)
    vertices.push(frontTop.x, frontTop.y, frontTop.z)

    const rightNormal = offsetDir.clone().multiplyScalar(side === 'left' ? 1 : -1)
    normals.push(rightNormal.x, rightNormal.y, rightNormal.z)
    normals.push(rightNormal.x, rightNormal.y, rightNormal.z)
    normals.push(rightNormal.x, rightNormal.y, rightNormal.z)
    normals.push(rightNormal.x, rightNormal.y, rightNormal.z)

    uvs.push(1, 1)
    uvs.push(1, 0)
    uvs.push(1, 1)
    uvs.push(1, 0)

    indices.push(0, 2, 1)
    indices.push(2, 3, 1)

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    return geometry
  }, [curvePoints, height, frameThickness, side])

  // Right edge front geometry
  const rightEdgeFrontGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    const { points, perpDirs } = curvePoints
    const segments = points.length - 1
    const point = points[segments]
    const offsetDir = perpDirs[segments]
    const up = new THREE.Vector3(0, 1, 0)

    const frontOffset = offsetDir.clone().multiplyScalar(frameThickness / 2)
    const backOffset = offsetDir.clone().multiplyScalar(-frameThickness / 2)

    const frontBottom = point.clone().add(up.clone().multiplyScalar(-height / 2)).add(frontOffset)
    const frontTop = point.clone().add(up.clone().multiplyScalar(height / 2)).add(frontOffset)
    const backBottom = point.clone().add(up.clone().multiplyScalar(-height / 2)).add(backOffset)
    const backTop = point.clone().add(up.clone().multiplyScalar(height / 2)).add(backOffset)

    vertices.push(frontBottom.x, frontBottom.y, frontBottom.z)
    vertices.push(frontTop.x, frontTop.y, frontTop.z)
    vertices.push(backBottom.x, backBottom.y, backBottom.z)
    vertices.push(backTop.x, backTop.y, backTop.z)

    const rightNormal = offsetDir.clone().multiplyScalar(side === 'left' ? 1 : -1)
    normals.push(rightNormal.x, rightNormal.y, rightNormal.z)
    normals.push(rightNormal.x, rightNormal.y, rightNormal.z)
    normals.push(rightNormal.x, rightNormal.y, rightNormal.z)
    normals.push(rightNormal.x, rightNormal.y, rightNormal.z)

    uvs.push(0, 1)
    uvs.push(0, 0)
    uvs.push(0, 1)
    uvs.push(0, 0)

    indices.push(0, 2, 1)
    indices.push(2, 3, 1)

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    return geometry
  }, [curvePoints, height, frameThickness, side])

  // Right edge back geometry
  const rightEdgeBackGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    const { points, perpDirs } = curvePoints
    const segments = points.length - 1
    const point = points[segments]
    const offsetDir = perpDirs[segments]
    const up = new THREE.Vector3(0, 1, 0)

    const frontOffset = offsetDir.clone().multiplyScalar(frameThickness / 2)
    const backOffset = offsetDir.clone().multiplyScalar(-frameThickness / 2)

    const frontBottom = point.clone().add(up.clone().multiplyScalar(-height / 2)).add(frontOffset)
    const frontTop = point.clone().add(up.clone().multiplyScalar(height / 2)).add(frontOffset)
    const backBottom = point.clone().add(up.clone().multiplyScalar(-height / 2)).add(backOffset)
    const backTop = point.clone().add(up.clone().multiplyScalar(height / 2)).add(backOffset)

    vertices.push(backBottom.x, backBottom.y, backBottom.z)
    vertices.push(backTop.x, backTop.y, backTop.z)
    vertices.push(frontBottom.x, frontBottom.y, frontBottom.z)
    vertices.push(frontTop.x, frontTop.y, frontTop.z)

    const leftNormal = offsetDir.clone().multiplyScalar(side === 'left' ? -1 : 1)
    normals.push(leftNormal.x, leftNormal.y, leftNormal.z)
    normals.push(leftNormal.x, leftNormal.y, leftNormal.z)
    normals.push(leftNormal.x, leftNormal.y, leftNormal.z)
    normals.push(leftNormal.x, leftNormal.y, leftNormal.z)

    uvs.push(1, 1)
    uvs.push(1, 0)
    uvs.push(1, 1)
    uvs.push(1, 0)

    indices.push(0, 1, 2)
    indices.push(1, 3, 2)

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    return geometry
  }, [curvePoints, height, frameThickness, side])

  // Top and bottom edge geometries
  const topBottomGeometry = useMemo(() => {
    const segments = 100
    const geometry = new THREE.BufferGeometry()
    const vertices: number[] = []
    const normals: number[] = []
    const indices: number[] = []

    const { points, perpDirs } = curvePoints
    const up = new THREE.Vector3(0, 1, 0)

    for (let i = 0; i <= segments; i++) {
      const point = points[i]
      const offsetDir = perpDirs[i]

      const frontOffset = offsetDir.clone().multiplyScalar(frameThickness / 2)
      const backOffset = offsetDir.clone().multiplyScalar(-frameThickness / 2)

      const topFront = point.clone().add(up.clone().multiplyScalar(height / 2)).add(frontOffset)
      const topBack = point.clone().add(up.clone().multiplyScalar(height / 2)).add(backOffset)
      vertices.push(topFront.x, topFront.y, topFront.z)
      vertices.push(topBack.x, topBack.y, topBack.z)
      normals.push(0, 1, 0)
      normals.push(0, 1, 0)

      const bottomFront = point.clone().add(up.clone().multiplyScalar(-height / 2)).add(frontOffset)
      const bottomBack = point.clone().add(up.clone().multiplyScalar(-height / 2)).add(backOffset)
      vertices.push(bottomFront.x, bottomFront.y, bottomFront.z)
      vertices.push(bottomBack.x, bottomBack.y, bottomBack.z)
      normals.push(0, -1, 0)
      normals.push(0, -1, 0)
    }

    const topStart = 0
    for (let i = 0; i < segments; i++) {
      const a = topStart + i * 4
      const b = topStart + i * 4 + 1
      const c = topStart + (i + 1) * 4
      const d = topStart + (i + 1) * 4 + 1
      indices.push(a, c, b)
      indices.push(b, c, d)
    }

    const bottomStart = 2
    for (let i = 0; i < segments; i++) {
      const a = bottomStart + i * 4
      const b = bottomStart + i * 4 + 1
      const c = bottomStart + (i + 1) * 4
      const d = bottomStart + (i + 1) * 4 + 1
      indices.push(a, b, c)
      indices.push(b, d, c)
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    return geometry
  }, [curvePoints, height, frameThickness])

  const LOGOS_PER_PATTERN = 2
  const patternSpacing = logoSpacing * LOGOS_PER_PATTERN

  const frontTexture = useMemo(() => {
    if (!logoCanvas) return null
    const texture = new THREE.CanvasTexture(logoCanvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 4
    if (totalLength > 0) {
      const repeatX = totalLength / patternSpacing
      const useNegative = side === 'left' ? LEFT_BOARD_FRONT_NEGATIVE_REPEAT : RIGHT_BOARD_FRONT_NEGATIVE_REPEAT
      texture.repeat.set(useNegative ? -repeatX : repeatX, 1)
      // Apply UV offset based on cumulative position along track for seamless continuity
      const uvOffset = (cumulativeLengthBefore / patternSpacing) % 1
      texture.offset.set(useNegative ? -uvOffset : uvOffset, 0)
    }
    return texture
  }, [logoCanvas, totalLength, patternSpacing, side, cumulativeLengthBefore])

  const backTexture = useMemo(() => {
    if (!logoCanvas) return null
    const texture = new THREE.CanvasTexture(logoCanvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 4
    if (totalLength > 0) {
      const repeatX = totalLength / patternSpacing
      const useNegative = side === 'left' ? LEFT_BOARD_BACK_NEGATIVE_REPEAT : RIGHT_BOARD_BACK_NEGATIVE_REPEAT
      texture.repeat.set(useNegative ? -repeatX : repeatX, 1)
      // Apply UV offset based on cumulative position along track for seamless continuity
      const uvOffset = (cumulativeLengthBefore / patternSpacing) % 1
      texture.offset.set(useNegative ? -uvOffset : uvOffset, 0)
    }
    return texture
  }, [logoCanvas, totalLength, patternSpacing, side, cumulativeLengthBefore])

  const leftEdgeTexture = useMemo(() => {
    if (!logoCanvas) return null
    const texture = new THREE.CanvasTexture(logoCanvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 4
    texture.rotation = Math.PI / 2
    texture.repeat.set(1, height / patternSpacing)
    return texture
  }, [logoCanvas, height, patternSpacing])

  const rightEdgeTexture = useMemo(() => {
    if (!logoCanvas) return null
    const texture = new THREE.CanvasTexture(logoCanvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 4
    texture.rotation = Math.PI / 2
    texture.repeat.set(1, height / patternSpacing)
    return texture
  }, [logoCanvas, height, patternSpacing])

  // Staggered texture upload
  const uploadedTexturesRef = useRef<Set<THREE.Texture>>(new Set())
  const uploadQueueRef = useRef<THREE.Texture[]>([])
  const isUploadingRef = useRef(false)

  useEffect(() => {
    const textures = [frontTexture, backTexture, leftEdgeTexture, rightEdgeTexture, fallbackTexture]
    const newTextures = textures.filter(t => t !== null && !uploadedTexturesRef.current.has(t)) as THREE.Texture[]

    if (newTextures.length === 0) return

    uploadQueueRef.current.push(...newTextures)

    if (!isUploadingRef.current) {
      isUploadingRef.current = true

      const uploadNext = () => {
        const texture = uploadQueueRef.current.shift()
        if (texture && !uploadedTexturesRef.current.has(texture)) {
          try {
            gl.initTexture(texture)
            uploadedTexturesRef.current.add(texture)
          } catch (e) {
            texture.needsUpdate = true
          }
        }

        if (uploadQueueRef.current.length > 0) {
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => setTimeout(uploadNext, 30), { timeout: 200 })
          } else {
            setTimeout(uploadNext, 80)
          }
        } else {
          isUploadingRef.current = false
        }
      }

      setTimeout(uploadNext, 2000)
    }
  }, [gl, frontTexture, backTexture, leftEdgeTexture, rightEdgeTexture, fallbackTexture])

  return (
    <group>
      <mesh geometry={frontFaceGeometry}>
        <meshStandardMaterial
          map={frontTexture || fallbackTexture}
          color="#777777"
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh geometry={backFaceGeometry}>
        <meshStandardMaterial
          map={backTexture || fallbackTexture}
          color="#777777"
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh geometry={leftEdgeFrontGeometry}>
        <meshStandardMaterial
          map={leftEdgeTexture || fallbackTexture}
          color="#777777"
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh geometry={leftEdgeBackGeometry}>
        <meshStandardMaterial
          map={leftEdgeTexture || fallbackTexture}
          color="#777777"
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh geometry={rightEdgeFrontGeometry}>
        <meshStandardMaterial
          map={rightEdgeTexture || fallbackTexture}
          color="#777777"
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh geometry={rightEdgeBackGeometry}>
        <meshStandardMaterial
          map={rightEdgeTexture || fallbackTexture}
          color="#777777"
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh geometry={topBottomGeometry}>
        <meshStandardMaterial
          color="#1a5f8a"
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.curve === nextProps.curve &&
    prevProps.startT === nextProps.startT &&
    prevProps.endT === nextProps.endT &&
    prevProps.height === nextProps.height &&
    prevProps.offset === nextProps.offset &&
    prevProps.side === nextProps.side &&
    prevProps.globalTrackLength === nextProps.globalTrackLength &&
    prevProps.cumulativeLengthBefore === nextProps.cumulativeLengthBefore
  )
})

interface TerrainAwareAdvertisingBoardsProps {
  onBoardsGenerated?: (boards: Array<{
    curve: THREE.CatmullRomCurve3
    startT: number
    endT: number
    offset: number
    side: 'left' | 'right'
    height: number
  }>) => void
}

export const TerrainAwareAdvertisingBoards: React.FC<TerrainAwareAdvertisingBoardsProps> = ({ onBoardsGenerated }) => {
  const boardsRef = useRef<Array<{
    curve: THREE.CatmullRomCurve3
    startT: number
    endT: number
    offset: number
    side: 'left' | 'right'
    height: number
  }>>([])
  const hasNotified = useRef(false)

  const boards = useMemo(() => {
    const offsetFromTrack = getCenterlineOffset(trackRuntimeConfig.surfaceProfile, 4)
    const boardHeight = 3.5

    const NUM_SEGMENTS = 8

    // Calculate length of each segment and total track length
    const segmentLengths: number[] = []
    let globalTrackLength = 0

    for (let i = 0; i < NUM_SEGMENTS; i++) {
      const segmentStartT = i / NUM_SEGMENTS
      const segmentEndT = (i + 1) / NUM_SEGMENTS

      // Calculate segment length by sampling points
      let segmentLength = 0
      const sampleCount = 50
      for (let j = 0; j < sampleCount; j++) {
        const t1 = segmentStartT + (segmentEndT - segmentStartT) * (j / sampleCount)
        const t2 = segmentStartT + (segmentEndT - segmentStartT) * ((j + 1) / sampleCount)
        const p1 = trackCurve.getPointAt(t1)
        const p2 = trackCurve.getPointAt(t2)
        segmentLength += p1.distanceTo(p2)
      }
      segmentLengths.push(segmentLength)
      globalTrackLength += segmentLength
    }

    // Build cumulative lengths for each segment start
    const cumulativeLengths: number[] = [0]
    for (let i = 0; i < NUM_SEGMENTS - 1; i++) {
      cumulativeLengths.push(cumulativeLengths[i] + segmentLengths[i])
    }

    const boardData: Array<{
      curve: THREE.CatmullRomCurve3
      startT: number
      endT: number
      offset: number
      side: 'left' | 'right'
      height: number
      globalTrackLength: number
      cumulativeLengthBefore: number
    }> = []

    for (let i = 0; i < NUM_SEGMENTS; i++) {
      const segmentStartT = i / NUM_SEGMENTS
      const segmentEndT = (i + 1) / NUM_SEGMENTS
      const cumulativeLengthBefore = cumulativeLengths[i]

      boardData.push({
        curve: trackCurve,
        startT: segmentStartT,
        endT: segmentEndT,
        offset: offsetFromTrack,
        side: 'left' as const,
        height: boardHeight,
        globalTrackLength,
        cumulativeLengthBefore
      })

      boardData.push({
        curve: trackCurve,
        startT: segmentStartT,
        endT: segmentEndT,
        offset: offsetFromTrack,
        side: 'right' as const,
        height: boardHeight,
        globalTrackLength,
        cumulativeLengthBefore
      })
    }

    boardsRef.current = boardData

    return boardData
  }, [])

  React.useEffect(() => {
    if (onBoardsGenerated && boardsRef.current.length > 0 && !hasNotified.current) {
      hasNotified.current = true
      onBoardsGenerated(boardsRef.current)
    }
  }, [onBoardsGenerated])

  return (
    <>
      {boards.map((board, i) => (
        <CurvedBoard
          key={i}
          curve={board.curve}
          startT={board.startT}
          endT={board.endT}
          height={board.height}
          offset={board.offset}
          side={board.side}
          globalTrackLength={board.globalTrackLength}
          cumulativeLengthBefore={board.cumulativeLengthBefore}
        />
      ))}
    </>
  )
}
