import React, { useMemo, useRef, useEffect } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { startFinishPosition, startFinishDirection, trackCurve } from './TrackData'
import { getCenterlineOffset } from '../../racing/core/trackProfile'
import type { TerrainHeightSampler } from '../../racing/core/roadCorridor'
import { getTrackRuntimeConfig } from '../../racing/tracks/trackRuntimeConfig'
import pixelRacingLogoImage from '../../assets/pixel_racing_logo.png'
import yourAdHereImage from '../../assets/your_ad_here.png'

const trackRuntimeConfig = getTrackRuntimeConfig('belgium')

export interface CurvedBoardData {
  curve: THREE.CatmullRomCurve3
  startT: number
  endT: number
  height: number
  offset: number
  side: 'left' | 'right'
  showTextureLogos?: boolean
  getHeightAtPosition?: TerrainHeightSampler
}

// Curved board component that follows a curve path
// Memoized to prevent unnecessary re-renders
export const CurvedBoard: React.FC<CurvedBoardData> = React.memo(({
  curve,
  startT,
  endT,
  height,
  offset,
  side,
  showTextureLogos = true,
  getHeightAtPosition
}) => {
  const { gl } = useThree()

  // ===== TEXTURE ORIENTATION CONSTANTS - Toggle these to fix logo direction =====
  // Set to true/false to control each face independently
  const LEFT_BOARD_FRONT_REVERSE_LENGTHS = false  // Reverse accumulated lengths for left board front
  const LEFT_BOARD_FRONT_NEGATIVE_REPEAT = false   // Use negative texture repeat for left board front
  const LEFT_BOARD_BACK_REVERSE_LENGTHS = false   // Reverse accumulated lengths for left board back
  const LEFT_BOARD_BACK_NEGATIVE_REPEAT = false    // Use negative texture repeat for left board back
  const LEFT_BOARD_BACK_FLIP_UVS = true            // Flip UVs (1-u) for left board back
  
  const RIGHT_BOARD_FRONT_REVERSE_LENGTHS = false // Reverse accumulated lengths for right board front
  const RIGHT_BOARD_FRONT_NEGATIVE_REPEAT = true  // Use negative texture repeat for right board front
  const RIGHT_BOARD_BACK_REVERSE_LENGTHS = false  // Reverse accumulated lengths for right board back
  const RIGHT_BOARD_BACK_NEGATIVE_REPEAT = true   // Use negative texture repeat for right board back
  const RIGHT_BOARD_BACK_FLIP_UVS = true           // Flip UVs (1-u) for right board back
  // ================================================================================
  
  const frameThickness = 0.05
  const logoDisplayHeight = 1.2 // Actual logo height on the board (not full board height)
  const logoSpacing = 24 // Spacing between logos (3x more spread out)
  const CANVAS_SCALE = 100 // Resolution scale (keep low to avoid GPU memory issues)
  const postHeight = height + 0.3
  const postRadius = 0.2

  // Grass level
  const grassLevel = -1
  const boardGroundOffset = 0.1
  const boardCenterHeight = grassLevel + boardGroundOffset + height / 2

  // Calculate total board length for UV mapping
  const totalLength = useMemo(() => {
    let length = 0
    const segments = 200
    for (let i = 0; i < segments; i++) {
      const t1 = startT + (endT - startT) * (i / segments)
      const t2 = startT + (endT - startT) * ((i + 1) / segments)
      const wrappedT1 = t1 < 0 ? t1 + 1 : (t1 > 1 ? t1 - 1 : t1)
      const wrappedT2 = t2 < 0 ? t2 + 1 : (t2 > 1 ? t2 - 1 : t2)
      const p1 = curve.getPointAt(wrappedT1)
      const p2 = curve.getPointAt(wrappedT2)
      length += p1.distanceTo(p2)
    }
    return length
  }, [curve, startT, endT])

  // Store the canvas so we can create multiple textures from it
  const [logoCanvas, setLogoCanvas] = React.useState<HTMLCanvasElement | null>(null)

  React.useEffect(() => {
    if (!showTextureLogos) {
      setLogoCanvas(null)
      return
    }

    // Load both logo images
    const pixelRacingLogoImg = new Image()
    const yourAdImg = new Image()
    pixelRacingLogoImg.crossOrigin = 'anonymous'
    yourAdImg.crossOrigin = 'anonymous'

    let pixelRacingLogoLoaded = false
    let yourAdLoaded = false

    const createCanvas = () => {
      if (!pixelRacingLogoLoaded || !yourAdLoaded) return

      // Number of logo slots in one pattern (will be repeated)
      const LOGOS_PER_PATTERN = 2 // Reduced to keep texture size manageable
      const AD_PROBABILITY = 0.5 // 50% chance for "your ad here"

      // Create canvas for pattern with multiple logos
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!

      // Canvas represents the FULL board height so texture maps correctly
      const singleLogoWidth = logoSpacing * CANVAS_SCALE
      const canvasWidth = singleLogoWidth * LOGOS_PER_PATTERN
      const canvasHeight = height * CANVAS_SCALE // Full board height

      canvas.width = canvasWidth
      canvas.height = canvasHeight

      // Fill with board color
      ctx.fillStyle = '#36bffa'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      // Enable smooth image scaling
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Draw each logo slot
      for (let i = 0; i < LOGOS_PER_PATTERN; i++) {
        // Randomly choose between project logo and placeholder ad artwork
        const useAd = Math.random() < AD_PROBABILITY
        const img = useAd ? yourAdImg : pixelRacingLogoImg

        // Get image's natural aspect ratio
        const imageAspectRatio = img.width / img.height

        // Calculate logo size maintaining aspect ratio
        // Start with target height, calculate width from aspect ratio
        const targetHeight = logoDisplayHeight
        const targetWidth = targetHeight * imageAspectRatio

        // Draw logo centered in its slot
        const logoCanvasWidth = targetWidth * CANVAS_SCALE
        const logoCanvasHeight = targetHeight * CANVAS_SCALE
        const slotX = i * singleLogoWidth
        const logoX = slotX + (singleLogoWidth - logoCanvasWidth) / 2
        const logoY = (canvasHeight - logoCanvasHeight) / 2 // Center vertically in full board height

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
      // If placeholder ad artwork fails to load, still create canvas with the project logo
      yourAdLoaded = true
      createCanvas()
    }

    pixelRacingLogoImg.src = pixelRacingLogoImage
    yourAdImg.src = yourAdHereImage
  }, [height, logoDisplayHeight, logoSpacing, showTextureLogos])
  
  // Fallback texture (board color only)
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
  
  // Sample points along the curve (shared by all faces)
  // Includes smoothing for sharp corners to prevent visual glitches
  const curvePoints = useMemo(() => {
    const segments = 100
    const points: THREE.Vector3[] = []
    const tangents: THREE.Vector3[] = []
    const perpDirs: THREE.Vector3[] = []
    const accumulatedLengths: number[] = [0]
    let currentLength = 0
    let prevPerpDir: THREE.Vector3 | null = null

    for (let i = 0; i <= segments; i++) {
      const t = startT + (endT - startT) * (i / segments)
      const wrappedT = t < 0 ? t + 1 : (t > 1 ? t - 1 : t)
      const point = curve.getPointAt(wrappedT)
      const tangent = curve.getTangentAt(wrappedT).normalize()
      let perpDir = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()

      // Preserve the original Belgium-style turn smoothing for visual continuity.
      if (prevPerpDir) {
        const dot = perpDir.dot(prevPerpDir)
        if (dot < 0.7) {
          perpDir = prevPerpDir.clone().multiplyScalar(0.7).add(perpDir.multiplyScalar(0.3)).normalize()
        }
      }
      prevPerpDir = perpDir.clone()

      const offsetDir = side === 'left' ? perpDir : perpDir.clone().multiplyScalar(-1)
      const boardPoint = point.clone().add(offsetDir.multiplyScalar(offset))
      const sampledGroundY = getHeightAtPosition?.(boardPoint.x, boardPoint.z)
      boardPoint.y = sampledGroundY === undefined
        ? boardCenterHeight
        : sampledGroundY + boardGroundOffset + height / 2

      points.push(boardPoint)
      tangents.push(tangent)
      perpDirs.push(offsetDir)

      if (i > 0) {
        currentLength += points[i - 1].distanceTo(boardPoint)
      }
      accumulatedLengths.push(currentLength)
    }

    return { points, tangents, perpDirs, accumulatedLengths }
  }, [curve, startT, endT, offset, side, boardCenterHeight, boardGroundOffset, height, getHeightAtPosition])
  
  // Front face geometry (facing track) - logo reads left-to-right
  const frontFaceGeometry = useMemo(() => {
    const segments = 100
    const geometry = new THREE.BufferGeometry()
    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    
    const { points, perpDirs, accumulatedLengths } = curvePoints
    
    // Use constants to determine if this face should reverse accumulated lengths
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

      // Clamp UV to valid range to prevent texture artifacts at sharp corners
      const u = Math.max(0, Math.min(1, finalAccumulatedLengths[i] / totalLength))
      // Front face is offset forward by half thickness
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
  
  // Back face geometry (facing away from track) - logo reads left-to-right when viewed from behind
  const backFaceGeometry = useMemo(() => {
    const segments = 100
    const geometry = new THREE.BufferGeometry()
    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    
    const { points, perpDirs, accumulatedLengths } = curvePoints
    
    // Use constants to determine if this face should reverse accumulated lengths and flip UVs
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

      // Clamp UV to valid range to prevent texture artifacts at sharp corners
      const u = Math.max(0, Math.min(1, finalAccumulatedLengths[i] / totalLength))
      // Back face is offset backward by half thickness
      const backOffset = offsetDir.clone().multiplyScalar(-frameThickness / 2)

      const bottomPos = point.clone().add(up.clone().multiplyScalar(-height / 2)).add(backOffset)
      vertices.push(bottomPos.x, bottomPos.y, bottomPos.z)
      normals.push(-offsetDir.x, -offsetDir.y, -offsetDir.z)
      // Conditionally flip UVs based on constant
      uvs.push(shouldFlipUVs ? 1 - u : u, 0)

      const topPos = point.clone().add(up.clone().multiplyScalar(height / 2)).add(backOffset)
      vertices.push(topPos.x, topPos.y, topPos.z)
      normals.push(-offsetDir.x, -offsetDir.y, -offsetDir.z)
      // Conditionally flip UVs based on constant
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
  
  // Left edge geometry (start of curve) - logo reads top-to-bottom
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
  
  // Left edge back face
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
  
  // Right edge front face geometry (end of curve)
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
  
  // Right edge back face
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
  
  // Top and bottom edge geometries (solid color, no texture)
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
      
      // Top edge: front and back vertices
      const topFront = point.clone().add(up.clone().multiplyScalar(height / 2)).add(frontOffset)
      const topBack = point.clone().add(up.clone().multiplyScalar(height / 2)).add(backOffset)
      vertices.push(topFront.x, topFront.y, topFront.z)
      vertices.push(topBack.x, topBack.y, topBack.z)
      normals.push(0, 1, 0)
      normals.push(0, 1, 0)
      
      // Bottom edge: front and back vertices
      const bottomFront = point.clone().add(up.clone().multiplyScalar(-height / 2)).add(frontOffset)
      const bottomBack = point.clone().add(up.clone().multiplyScalar(-height / 2)).add(backOffset)
      vertices.push(bottomFront.x, bottomFront.y, bottomFront.z)
      vertices.push(bottomBack.x, bottomBack.y, bottomBack.z)
      normals.push(0, -1, 0)
      normals.push(0, -1, 0)
    }
    
    // Top edge indices
    const topStart = 0
    for (let i = 0; i < segments; i++) {
      const a = topStart + i * 4
      const b = topStart + i * 4 + 1
      const c = topStart + (i + 1) * 4
      const d = topStart + (i + 1) * 4 + 1
      indices.push(a, c, b)
      indices.push(b, c, d)
    }
    
    // Bottom edge indices
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
  
  // Pattern contains 2 logos, so adjust repeat accordingly
  const LOGOS_PER_PATTERN = 2
  const patternSpacing = logoSpacing * LOGOS_PER_PATTERN

  // Create separate texture instances for each face with correct orientation
  const frontTexture = useMemo(() => {
    if (!logoCanvas) return null
    const texture = new THREE.CanvasTexture(logoCanvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    // Keep mipmaps for quality at angles, use moderate anisotropy
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 4
    if (totalLength > 0) {
      const repeatX = totalLength / patternSpacing
      // Use constant to determine texture repeat direction
      const useNegative = side === 'left' ? LEFT_BOARD_FRONT_NEGATIVE_REPEAT : RIGHT_BOARD_FRONT_NEGATIVE_REPEAT
      texture.repeat.set(useNegative ? -repeatX : repeatX, 1)
    }
    return texture
  }, [logoCanvas, totalLength, patternSpacing, side])

  const backTexture = useMemo(() => {
    if (!logoCanvas) return null
    const texture = new THREE.CanvasTexture(logoCanvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    // Keep mipmaps for quality at angles, use moderate anisotropy
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 4
    if (totalLength > 0) {
      const repeatX = totalLength / patternSpacing
      // Use constant to determine texture repeat direction
      const useNegative = side === 'left' ? LEFT_BOARD_BACK_NEGATIVE_REPEAT : RIGHT_BOARD_BACK_NEGATIVE_REPEAT
      texture.repeat.set(useNegative ? -repeatX : repeatX, 1)
    }
    return texture
  }, [logoCanvas, totalLength, patternSpacing, side])

  const leftEdgeTexture = useMemo(() => {
    if (!logoCanvas) return null
    const texture = new THREE.CanvasTexture(logoCanvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    // Keep mipmaps for quality at angles, use moderate anisotropy
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
    // Keep mipmaps for quality at angles, use moderate anisotropy
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 4
    texture.rotation = Math.PI / 2
    texture.repeat.set(1, height / patternSpacing)
    return texture
  }, [logoCanvas, height, patternSpacing])

  // PERFORMANCE: Staggered texture upload to GPU
  // Spreads uploads over time and waits for browser idle to avoid blocking loading screen
  const uploadedTexturesRef = useRef<Set<THREE.Texture>>(new Set())
  const uploadQueueRef = useRef<THREE.Texture[]>([])
  const isUploadingRef = useRef(false)

  useEffect(() => {
    const textures = showTextureLogos
      ? [frontTexture, backTexture, leftEdgeTexture, rightEdgeTexture, fallbackTexture]
      : [fallbackTexture]
    const newTextures = textures.filter(t => t !== null && !uploadedTexturesRef.current.has(t)) as THREE.Texture[]

    if (newTextures.length === 0) return

    // Add new textures to queue
    uploadQueueRef.current.push(...newTextures)

    // Start staggered upload if not already running
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
          // Use requestIdleCallback if available, otherwise setTimeout
          // This ensures uploads happen when browser is idle, not blocking animations
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => setTimeout(uploadNext, 30), { timeout: 200 })
          } else {
            setTimeout(uploadNext, 80)
          }
        } else {
          isUploadingRef.current = false
        }
      }

      // Wait 2 seconds before starting uploads - let loading screen finish first
      setTimeout(uploadNext, 2000)
    }
  }, [gl, frontTexture, backTexture, leftEdgeTexture, rightEdgeTexture, fallbackTexture, showTextureLogos])

  return (
    <group>
      {/* PERFORMANCE: Using meshBasicMaterial instead of meshStandardMaterial
          - No complex PBR shader compilation needed
          - No lighting calculations (boards are self-lit like real billboards)
          - Much faster to render and compile */}

      {/* Front face with texture-mapped logos */}
      <mesh geometry={frontFaceGeometry}>
        <meshBasicMaterial
          map={showTextureLogos ? frontTexture || fallbackTexture : fallbackTexture}
          color="#777777"
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Back face with texture-mapped logos */}
      <mesh geometry={backFaceGeometry}>
        <meshBasicMaterial
          map={showTextureLogos ? backTexture || fallbackTexture : fallbackTexture}
          color="#777777"
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Left edge front face with texture-mapped logos */}
      <mesh geometry={leftEdgeFrontGeometry}>
        <meshBasicMaterial
          map={showTextureLogos ? leftEdgeTexture || fallbackTexture : fallbackTexture}
          color="#777777"
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Left edge back face with texture-mapped logos */}
      <mesh geometry={leftEdgeBackGeometry}>
        <meshBasicMaterial
          map={showTextureLogos ? leftEdgeTexture || fallbackTexture : fallbackTexture}
          color="#777777"
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Right edge front face with texture-mapped logos */}
      <mesh geometry={rightEdgeFrontGeometry}>
        <meshBasicMaterial
          map={showTextureLogos ? rightEdgeTexture || fallbackTexture : fallbackTexture}
          color="#777777"
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Right edge back face with texture-mapped logos */}
      <mesh geometry={rightEdgeBackGeometry}>
        <meshBasicMaterial
          map={showTextureLogos ? rightEdgeTexture || fallbackTexture : fallbackTexture}
          color="#777777"
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Top and bottom edges with solid color (no texture) */}
      <mesh geometry={topBottomGeometry}>
        <meshBasicMaterial
          color="#1a5f8a"
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders when props haven't changed
  return (
    prevProps.curve === nextProps.curve &&
    prevProps.startT === nextProps.startT &&
    prevProps.endT === nextProps.endT &&
    prevProps.height === nextProps.height &&
    prevProps.offset === nextProps.offset &&
    prevProps.side === nextProps.side &&
    prevProps.showTextureLogos === nextProps.showTextureLogos &&
    prevProps.getHeightAtPosition === nextProps.getHeightAtPosition
  )
})

export interface BoardLogoDecalData {
  curve: THREE.CatmullRomCurve3
  t: number
  offset: number
  side: 'left' | 'right'
  width: number
  height: number
  boardHeight: number
  face: 'track' | 'outer'
  logo: 'pixel-racing' | 'your-ad-here'
  getHeightAtPosition?: TerrainHeightSampler
}

export const BoardLogoDecal: React.FC<BoardLogoDecalData> = React.memo(({
  curve,
  t,
  offset,
  side,
  width,
  height,
  boardHeight,
  face,
  logo,
  getHeightAtPosition
}) => {
  const boardFrameThickness = 0.05
  const decalSurfaceGap = 0.45
  const decalVerticalCenterRatio = 0.5
  const [pixelRacingTexture, yourAdHereTexture] = useLoader(THREE.TextureLoader, [
    pixelRacingLogoImage,
    yourAdHereImage
  ])

  const texture = logo === 'your-ad-here' ? yourAdHereTexture : pixelRacingTexture
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = Math.max(texture.anisotropy, 4)

  const pose = useMemo(() => {
    const wrappedT = ((t % 1) + 1) % 1
    const point = curve.getPointAt(wrappedT)
    const tangent = curve.getTangentAt(wrappedT).normalize()
    const perpDir = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
    const offsetDir = side === 'left' ? perpDir : perpDir.clone().multiplyScalar(-1)
    const faceSign = face === 'track' ? -1 : 1
    const faceNormal = face === 'track'
      ? offsetDir.clone().multiplyScalar(-1).normalize()
      : offsetDir.clone().normalize()
    const up = new THREE.Vector3(0, 1, 0)
    const horizontal = up.clone().cross(faceNormal).normalize()
    const surfaceOffset = offset + faceSign * (boardFrameThickness / 2 + decalSurfaceGap)
    const position = point.clone().add(offsetDir.clone().multiplyScalar(surfaceOffset))
    const sampledGroundY = getHeightAtPosition?.(position.x, position.z) ?? -1
    position.y = sampledGroundY + 0.1 + boardHeight * decalVerticalCenterRatio

    const basis = new THREE.Matrix4().makeBasis(
      horizontal,
      up,
      faceNormal
    )
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis)

    return { position, quaternion }
  }, [boardHeight, curve, face, getHeightAtPosition, offset, side, t])

  return (
    <mesh position={pose.position} quaternion={pose.quaternion} renderOrder={5}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        color="#f0f0f0"
        transparent
        opacity={0.78}
        alphaTest={0.02}
        side={THREE.FrontSide}
        depthTest
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-16}
        polygonOffsetUnits={-16}
      />
    </mesh>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.curve === nextProps.curve &&
    prevProps.t === nextProps.t &&
    prevProps.offset === nextProps.offset &&
    prevProps.side === nextProps.side &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.boardHeight === nextProps.boardHeight &&
    prevProps.face === nextProps.face &&
    prevProps.logo === nextProps.logo &&
    prevProps.getHeightAtPosition === nextProps.getHeightAtPosition
  )
})

interface AdvertisingBoardsProps {
  onBoardsGenerated?: (boards: Array<{ 
    curve: THREE.CatmullRomCurve3
    startT: number
    endT: number
    offset: number
    side: 'left' | 'right'
    height: number
  }>) => void
}

export const AdvertisingBoards: React.FC<AdvertisingBoardsProps> = ({ onBoardsGenerated }) => {
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
    const offsetFromTrack = getCenterlineOffset(trackRuntimeConfig.surfaceProfile, 4) // Farther from track (22 units from center)
    const boardHeight = 3.5 // Taller barrier walls

    // Create boards around the ENTIRE track, split into segments
    const NUM_SEGMENTS = 8

    const boardData: Array<{
      curve: THREE.CatmullRomCurve3
      startT: number
      endT: number
      offset: number
      side: 'left' | 'right'
      height: number
    }> = []

    for (let i = 0; i < NUM_SEGMENTS; i++) {
      const segmentStartT = i / NUM_SEGMENTS
      const segmentEndT = (i + 1) / NUM_SEGMENTS

      // Left side board segment
      boardData.push({
        curve: trackCurve,
        startT: segmentStartT,
        endT: segmentEndT,
        offset: offsetFromTrack,
        side: 'left' as const,
        height: boardHeight
      })

      // Right side board segment
      boardData.push({
        curve: trackCurve,
        startT: segmentStartT,
        endT: segmentEndT,
        offset: offsetFromTrack,
        side: 'right' as const,
        height: boardHeight
      })
    }

    boardsRef.current = boardData

    return boardData
  }, [])

  // Notify parent of board data for collision detection
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
        />
      ))}
    </>
  )
}
