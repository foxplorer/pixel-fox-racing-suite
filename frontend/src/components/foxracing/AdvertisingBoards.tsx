import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { startFinishPosition, startFinishDirection, trackCurve } from './TrackData'
import { getCenterlineOffset } from '../../racing/core/trackProfile'
import { getTrackRuntimeConfig } from '../../racing/tracks/trackRuntimeConfig'
import pixelRacingLogoImage from '../../assets/pixel_racing_logo.png'
import yourAdHereImage from '../../assets/your_ad_here.png'

const trackRuntimeConfig = getTrackRuntimeConfig('australia')

interface CurvedBoardData {
  curve: THREE.CatmullRomCurve3
  startT: number
  endT: number
  height: number
  offset: number
  side: 'left' | 'right'
}

// Curved board component that follows a curve path
// Memoized to prevent unnecessary re-renders
const CurvedBoard: React.FC<CurvedBoardData> = React.memo(({ curve, startT, endT, height, offset, side }) => {
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
  const logoWidth = 2 // Smaller logos
  const logoHeight = 1 // Smaller logos
  const logoSpacing = 8 // Double spacing = half as many logos
  const postHeight = height + 0.3
  const postRadius = 0.2
  
  // Grass level
  const grassLevel = -1
  const boardGroundOffset = 0.1
  const boardCenterHeight = grassLevel + boardGroundOffset + height / 2
  
  // Store the canvas so we can create multiple textures from it
  const [logoCanvas, setLogoCanvas] = React.useState<HTMLCanvasElement | null>(null)
  
  React.useEffect(() => {
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
      const LOGOS_PER_PATTERN = 5
      const AD_PROBABILITY = 0.5 // 50% chance for "your ad here"

      // Create canvas for pattern with multiple logos
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!

      // Canvas size: multiple logos per pattern
      const singleLogoWidth = logoSpacing * 100 // Scale up for better quality
      const canvasWidth = singleLogoWidth * LOGOS_PER_PATTERN
      const canvasHeight = logoHeight * 100

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
        let logoDisplayWidth = logoWidth
        let logoDisplayHeight = logoHeight

        if (imageAspectRatio > (logoWidth / logoHeight)) {
          logoDisplayHeight = logoWidth / imageAspectRatio
        } else {
          logoDisplayWidth = logoHeight * imageAspectRatio
        }

        // Draw logo centered in its slot
        const logoCanvasWidth = logoDisplayWidth * 100
        const logoCanvasHeight = logoDisplayHeight * 100
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
      // If placeholder ad artwork fails to load, still create canvas with the project logo
      yourAdLoaded = true
      createCanvas()
    }

    pixelRacingLogoImg.src = pixelRacingLogoImage
    yourAdImg.src = yourAdHereImage
  }, [logoWidth, logoHeight, logoSpacing])
  
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
  
  // Sample points along the curve (shared by all faces)
  const curvePoints = useMemo(() => {
    const segments = 100
    const points: THREE.Vector3[] = []
    const tangents: THREE.Vector3[] = []
    const perpDirs: THREE.Vector3[] = []
    const accumulatedLengths: number[] = [0]
    let currentLength = 0
    
    for (let i = 0; i <= segments; i++) {
      const t = startT + (endT - startT) * (i / segments)
      const wrappedT = t < 0 ? t + 1 : (t > 1 ? t - 1 : t)
      const point = curve.getPointAt(wrappedT)
      const tangent = curve.getTangentAt(wrappedT).normalize()
      const perpDir = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
      
      const offsetDir = side === 'left' ? perpDir : perpDir.clone().multiplyScalar(-1)
      const boardPoint = point.clone().add(offsetDir.multiplyScalar(offset))
      boardPoint.y = boardCenterHeight
      
      points.push(boardPoint)
      tangents.push(tangent)
      perpDirs.push(offsetDir)
      
      if (i > 0) {
        currentLength += points[i - 1].distanceTo(boardPoint)
      }
      accumulatedLengths.push(currentLength)
    }
    
    return { points, tangents, perpDirs, accumulatedLengths }
  }, [curve, startT, endT, offset, side, boardCenterHeight])
  
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
      
      const u = finalAccumulatedLengths[i] / totalLength
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
      
      const u = finalAccumulatedLengths[i] / totalLength
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
  
  // Pattern contains 5 logos, so adjust repeat accordingly
  const LOGOS_PER_PATTERN = 5
  const patternSpacing = logoSpacing * LOGOS_PER_PATTERN

  // Create separate texture instances for each face with correct orientation
  const frontTexture = useMemo(() => {
    if (!logoCanvas) return null
    const texture = new THREE.CanvasTexture(logoCanvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    // Enable mipmaps for better quality at distance
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 16 // Sharper at oblique angles
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
    // Enable mipmaps for better quality at distance
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 16
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
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 16
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
    texture.anisotropy = 16
    texture.rotation = Math.PI / 2
    texture.repeat.set(1, height / patternSpacing)
    return texture
  }, [logoCanvas, height, patternSpacing])
  
  return (
    <group>
      {/* Front face with texture-mapped logos */}
      <mesh geometry={frontFaceGeometry} receiveShadow castShadow>
        <meshStandardMaterial 
          map={frontTexture || fallbackTexture}
          color="#36bffa"
          side={THREE.DoubleSide}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      
      {/* Back face with texture-mapped logos */}
      <mesh geometry={backFaceGeometry} receiveShadow castShadow>
        <meshStandardMaterial 
          map={backTexture || fallbackTexture}
          color="#36bffa"
          side={THREE.DoubleSide}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      
      {/* Left edge front face with texture-mapped logos */}
      <mesh geometry={leftEdgeFrontGeometry} receiveShadow castShadow>
        <meshStandardMaterial 
          map={leftEdgeTexture || fallbackTexture}
          color="#36bffa"
          side={THREE.DoubleSide}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      
      {/* Left edge back face with texture-mapped logos */}
      <mesh geometry={leftEdgeBackGeometry} receiveShadow castShadow>
        <meshStandardMaterial 
          map={leftEdgeTexture || fallbackTexture}
          color="#36bffa"
          side={THREE.DoubleSide}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      
      {/* Right edge front face with texture-mapped logos */}
      <mesh geometry={rightEdgeFrontGeometry} receiveShadow castShadow>
        <meshStandardMaterial 
          map={rightEdgeTexture || fallbackTexture}
          color="#36bffa"
          side={THREE.DoubleSide}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      
      {/* Right edge back face with texture-mapped logos */}
      <mesh geometry={rightEdgeBackGeometry} receiveShadow castShadow>
        <meshStandardMaterial 
          map={rightEdgeTexture || fallbackTexture}
          color="#36bffa"
          side={THREE.DoubleSide}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      
      {/* Top and bottom edges with solid color (no texture) */}
      <mesh geometry={topBottomGeometry} receiveShadow castShadow>
        <meshStandardMaterial 
          color="#36bffa"
          side={THREE.DoubleSide}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      
      {/* Support posts at start and end */}
      {(() => {
        const startPoint = curve.getPointAt(startT < 0 ? startT + 1 : (startT > 1 ? startT - 1 : startT))
        const endPoint = curve.getPointAt(endT < 0 ? endT + 1 : (endT > 1 ? endT - 1 : endT))
        const startTangent = curve.getTangentAt(startT < 0 ? startT + 1 : (startT > 1 ? startT - 1 : startT)).normalize()
        const endTangent = curve.getTangentAt(endT < 0 ? endT + 1 : (endT > 1 ? endT - 1 : endT)).normalize()
        const startPerp = new THREE.Vector3(-startTangent.z, 0, startTangent.x).normalize()
        const endPerp = new THREE.Vector3(-endTangent.z, 0, endTangent.x).normalize()
        const startOffsetDir = side === 'left' ? startPerp : startPerp.clone().multiplyScalar(-1)
        const endOffsetDir = side === 'left' ? endPerp : endPerp.clone().multiplyScalar(-1)
        const startPos = startPoint.clone().add(startOffsetDir.multiplyScalar(offset))
        const endPos = endPoint.clone().add(endOffsetDir.multiplyScalar(offset))
        startPos.y = boardCenterHeight
        endPos.y = boardCenterHeight
        
        return (
          <>
            <mesh position={[startPos.x, 0, startPos.z]} castShadow>
              <cylinderGeometry args={[postRadius, postRadius, postHeight, 8]} />
              <meshStandardMaterial color="#2a2a2a" />
            </mesh>
            <mesh position={[endPos.x, 0, endPos.z]} castShadow>
              <cylinderGeometry args={[postRadius, postRadius, postHeight, 8]} />
              <meshStandardMaterial color="#2a2a2a" />
            </mesh>
          </>
        )
      })()}
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
    prevProps.side === nextProps.side
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
    const offsetFromTrack = getCenterlineOffset(trackRuntimeConfig.surfaceProfile)
    const totalBoardLength = 200
    const boardHeight = 3.5 // Shorter boards
    
    // Find start/finish t value
    const samples = 1000
    let startT = 0
    let minDist = Infinity
    
    for (let i = 0; i < samples; i++) {
      const t = i / samples
      const point = trackCurve.getPointAt(t)
      const dist = point.distanceTo(startFinishPosition)
      if (dist < minDist) {
        minDist = dist
        startT = t
      }
    }
    
    // Calculate t range for the board
    const tStep = totalBoardLength / trackCurve.getLength()
    const startTOffset = -tStep / 2
    const boardStartT = (startT + startTOffset + 1) % 1
    const boardEndT = (startT + startTOffset + tStep + 1) % 1
    
    const boardData = [
      {
        curve: trackCurve,
        startT: boardStartT,
        endT: boardEndT,
        offset: offsetFromTrack,
        side: 'left' as const,
        height: boardHeight
      },
      {
        curve: trackCurve,
        startT: boardStartT,
        endT: boardEndT,
        offset: offsetFromTrack,
        side: 'right' as const,
        height: boardHeight
      }
    ]
    
    boardsRef.current = boardData
    
    return boardData
  }, [])
  
  // Notify parent of board data for collision detection
  React.useEffect(() => {
    if (onBoardsGenerated && boardsRef.current.length > 0 && !hasNotified.current) {
      hasNotified.current = true
      onBoardsGenerated(boardsRef.current)
      console.log(`📋 Advertising boards: Generated ${boardsRef.current.length} continuous curved boards for collision detection`)
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
