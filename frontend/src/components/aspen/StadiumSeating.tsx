import React, { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { startFinishPosition, startFinishDirection } from '../snowmobilerace/TrackData'
import { getTerrainHeight } from '../snowmobilerace/TerrainSystem'
import { BillboardStadiumFoxes } from '../../racing/components/BillboardStadiumFoxes'
import { getStadiumStandPlacement } from '../../racing/components/stadiumPlacement'
import { DEFAULT_STADIUM_FOX_HOP_DISTANCE, shouldRenderStadiumDetail } from '../../racing/components/stadiumVisibility'
import { useStadiumFoxes } from '../../racing/components/useStadiumFoxes'

// Aspen hides the whole stadium at distance; car tracks currently hide foxes only.
const HOP_DISTANCE = DEFAULT_STADIUM_FOX_HOP_DISTANCE // Only animate hopping when close

// Vertical offset to raise seats, foxes, and stairs above the ground
// The gray base platform stays buried, only the seating structures are raised
const SEAT_Y_OFFSET = 0.5

// Extra width on each side to cover the stairs with the roof/platform
const STAIR_COVER_WIDTH = 5

interface StadiumSeatingProps {
  rows?: number
  seatsPerRow?: number
  seatWidth?: number
  rowDepth?: number
  rowHeightStep?: number
  isSoundEnabled?: boolean
  // Optional custom position/direction (defaults to start/finish line)
  customPosition?: THREE.Vector3
  customDirection?: THREE.Vector3
  // Optional: only render one side ('left', 'right', or 'both')
  side?: 'left' | 'right' | 'both'
  // Distance from track center (default 38)
  distanceFromTrack?: number
}

export const StadiumSeating: React.FC<StadiumSeatingProps> = ({
  rows = 7,
  seatsPerRow = 20,
  seatWidth = 3.0,
  rowDepth = 4.5,
  rowHeightStep = 2.8,
  isSoundEnabled = false,
  customPosition,
  customDirection,
  side = 'both',
  distanceFromTrack: distanceFromTrackProp
}) => {
  const foxGroupRef = useRef<THREE.Group>(null)
  const structureGroupRef = useRef<THREE.Group>(null)
  const { camera } = useThree()

  // Distance-based visibility for entire stadium (structure + foxes appear together)
  const basePosition = customPosition || startFinishPosition
  useFrame(() => {
    const shouldShow = shouldRenderStadiumDetail(camera.position, basePosition)

    // Show/hide foxes
    if (foxGroupRef.current && foxGroupRef.current.visible !== shouldShow) {
      foxGroupRef.current.visible = shouldShow
    }
    // Show/hide structure (roof, stands, poles) - same distance as foxes for consistency
    if (structureGroupRef.current && structureGroupRef.current.visible !== shouldShow) {
      structureGroupRef.current.visible = shouldShow
    }
  })

  // Stadium positioning data
  const stadiumData = useMemo(() => {
    // Use custom position/direction if provided, otherwise use start/finish line
    const basePosition = customPosition || startFinishPosition
    const baseDirection = customDirection || startFinishDirection
    // Use terrain height from customPosition if provided, otherwise default to -1
    return getStadiumStandPlacement({
      basePosition,
      baseDirection,
      distanceFromTrack: distanceFromTrackProp ?? 38,
      groundY: getTerrainHeight(basePosition.x, basePosition.z)
    })
  }, [customPosition, customDirection, distanceFromTrackProp])

  const { foxPlacements, textureAtlas, atlasSize } = useStadiumFoxes({
    stadiumData,
    rows,
    seatsPerRow,
    seatWidth,
    rowDepth,
    rowHeightStep,
    side
  })

  // Generate stand geometry - SIMPLIFIED for performance (was 1400 meshes, now ~35)
  // Visual improvements: side walls, back wall, better colors, accent stripes
  const createStand = (position: THREE.Vector3, rotation: number, standIndex: number) => {
    const structures: JSX.Element[] = []

    const baseWidth = seatsPerRow * seatWidth + 2
    const baseDepth = rows * rowDepth + 3
    const baseHeight = 0.5

    // Racing-inspired color scheme - alternating red and white seats
    const seatColors = ['#cc0000', '#ffffff', '#cc0000', '#ffffff', '#cc0000', '#ffffff', '#cc0000']

    // Structural colors
    const concreteColor = '#3a3a3a'
    const concreteDark = '#2a2a2a'
    const metalColor = '#4a4a4a'
    const accentColor = '#cc0000' // Racing red

    // Base platform - extends to roof pillar positions at corners
    const pillarOffset = baseWidth / 2 + STAIR_COVER_WIDTH + 2
    const platformWidth = pillarOffset * 2 + 0.6 // Full width to outer edges of pillars
    const platformDepthFull = baseDepth + 2 + 0.6 // Extend to outer edges of back pillars
    structures.push(
      <mesh key="base" position={[0, baseHeight / 2 + SEAT_Y_OFFSET, baseDepth / 2 - 2]} receiveShadow>
        <boxGeometry args={[platformWidth, baseHeight, platformDepthFull]} />
        <meshStandardMaterial color={concreteColor} roughness={0.9} />
      </mesh>
    )

    // Snow layer on entire base platform
    structures.push(
      <mesh key="base-snow" position={[0, baseHeight + SEAT_Y_OFFSET + 0.3, baseDepth / 2 - 2]} receiveShadow>
        <boxGeometry args={[platformWidth - 0.5, 0.6, platformDepthFull - 0.5]} />
        <meshStandardMaterial color="#f0f5f8" roughness={0.95} metalness={0} />
      </mesh>
    )

    // Create stepped rows - simplified: one colored block per row instead of individual seats
    const footSpaceDepth = 1.8 // Space in front of seats for feet
    const platformDepth = rowDepth - footSpaceDepth // Platform under and behind seats

    for (let row = 0; row < rows; row++) {
      const rowY = baseHeight + row * rowHeightStep + SEAT_Y_OFFSET
      const rowZ = row * rowDepth
      const seatColor = seatColors[row % seatColors.length]

      // Row platform (concrete step) - positioned forward for foot room
      // This is the floor where you put your feet, in front of the seats
      structures.push(
        <mesh key={`step-${row}`} position={[0, rowY + 0.15, rowZ + footSpaceDepth / 2]} receiveShadow>
          <boxGeometry args={[baseWidth, 0.3, footSpaceDepth]} />
          <meshStandardMaterial color={concreteColor} roughness={0.95} />
        </mesh>
      )

      // Simplified seat row - positioned behind the foot space
      structures.push(
        <mesh key={`seats-${row}`} position={[0, rowY + 0.7, rowZ + footSpaceDepth + 0.8]}>
          <boxGeometry args={[baseWidth - 2, 0.5, seatWidth * 0.9]} />
          <meshStandardMaterial color={seatColor} roughness={0.5} />
        </mesh>
      )

      // Simplified seat backs - behind the seats
      structures.push(
        <mesh key={`backs-${row}`} position={[0, rowY + 1.5, rowZ + footSpaceDepth + 1.2 + seatWidth * 0.4]}>
          <boxGeometry args={[baseWidth - 2, 1.5, 0.2]} />
          <meshStandardMaterial color={seatColor} roughness={0.5} />
        </mesh>
      )
    }

    // === IMPROVED TOP RAILING with posts - connects to stairs ===
    const topY = baseHeight + rows * rowHeightStep + SEAT_Y_OFFSET
    const topZ = rows * rowDepth
    const stairWidth = 3
    const stairX = baseWidth / 2 + stairWidth / 2 + 0.5 // Same as stair position

    // Back rail - extends to the stair railing posts
    const sideRailX = stairX + stairWidth / 2 // Aligned with outer edge of stairs
    const backRailWidth = sideRailX * 2 // Full width from left stair post to right stair post

    structures.push(
      <mesh key="railing" position={[0, topY + 2.2, topZ]}>
        <boxGeometry args={[backRailWidth, 0.15, 0.15]} />
        <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
      </mesh>
    )
    // Middle back rail
    structures.push(
      <mesh key="railing-lower" position={[0, topY + 1.2, topZ]}>
        <boxGeometry args={[backRailWidth, 0.1, 0.1]} />
        <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
      </mesh>
    )
    // Bottom back rail
    structures.push(
      <mesh key="railing-bottom" position={[0, topY + 0.2, topZ]}>
        <boxGeometry args={[backRailWidth, 0.1, 0.1]} />
        <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
      </mesh>
    )

    // Side rails running along the stairs - angled to follow stair slope
    // sideRailX already defined above

    // Calculate the angle of the stairs
    const totalRise = rows * rowHeightStep // Total height change
    const totalRun = topZ // Total depth
    const stairAngle = -Math.atan2(totalRise, totalRun) // Negative to slope down from back to front
    const sideRailLength = Math.sqrt(totalRise * totalRise + totalRun * totalRun) // Hypotenuse length

    // Center position of the angled rail (midpoint of the slope)
    const railMidY = topY + 1.2 - totalRise / 2
    const railMidZ = topZ / 2

    // Left side rails - angled
    structures.push(
      <mesh key="side-rail-l-top" position={[-sideRailX, railMidY + 1, railMidZ]} rotation={[stairAngle, 0, 0]}>
        <boxGeometry args={[0.15, 0.15, sideRailLength]} />
        <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
      </mesh>
    )
    structures.push(
      <mesh key="side-rail-l-lower" position={[-sideRailX, railMidY, railMidZ]} rotation={[stairAngle, 0, 0]}>
        <boxGeometry args={[0.1, 0.1, sideRailLength]} />
        <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
      </mesh>
    )

    // Right side rails - angled
    structures.push(
      <mesh key="side-rail-r-top" position={[sideRailX, railMidY + 1, railMidZ]} rotation={[stairAngle, 0, 0]}>
        <boxGeometry args={[0.15, 0.15, sideRailLength]} />
        <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
      </mesh>
    )
    structures.push(
      <mesh key="side-rail-r-lower" position={[sideRailX, railMidY, railMidZ]} rotation={[stairAngle, 0, 0]}>
        <boxGeometry args={[0.1, 0.1, sideRailLength]} />
        <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
      </mesh>
    )

    // Posts along back rail - 3 posts
    const backPostSpacing = baseWidth / 2
    for (let i = 0; i < 3; i++) {
      const postX = -baseWidth / 2 + i * backPostSpacing
      structures.push(
        <mesh key={`post-back-${i}`} position={[postX, topY + 1.2, topZ]}>
          <boxGeometry args={[0.12, 2.2, 0.12]} />
          <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
        </mesh>
      )
    }

    // Posts at top of stairs - where side rails meet back
    structures.push(
      <mesh key="post-stair-top-l" position={[-sideRailX, topY + 1.2, topZ]}>
        <boxGeometry args={[0.15, 2.2, 0.15]} />
        <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
      </mesh>
    )
    structures.push(
      <mesh key="post-stair-top-r" position={[sideRailX, topY + 1.2, topZ]}>
        <boxGeometry args={[0.15, 2.2, 0.15]} />
        <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
      </mesh>
    )

    // Posts along side rails - follow the stair slope
    for (let row = 0; row <= rows; row += 2) {
      const postY = baseHeight + row * rowHeightStep + SEAT_Y_OFFSET + 1.2
      const postZ = row * rowDepth
      structures.push(
        <mesh key={`post-side-l-${row}`} position={[-sideRailX, postY, postZ]}>
          <boxGeometry args={[0.12, 2.2, 0.12]} />
          <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
        </mesh>
      )
      structures.push(
        <mesh key={`post-side-r-${row}`} position={[sideRailX, postY, postZ]}>
          <boxGeometry args={[0.12, 2.2, 0.12]} />
          <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
        </mesh>
      )
    }

    // === CHECKERED ACCENT STRIPE at front edge ===
    const stripeWidth = 1.5
    const numCheckers = 16
    const checkerSize = baseWidth / numCheckers
    for (let i = 0; i < numCheckers; i++) {
      const isBlack = i % 2 === 0
      structures.push(
        <mesh key={`checker-${i}`} position={[(i - numCheckers / 2 + 0.5) * checkerSize, SEAT_Y_OFFSET + 0.51, -stripeWidth / 2]}>
          <boxGeometry args={[checkerSize, 0.02, stripeWidth]} />
          <meshStandardMaterial color={isBlack ? '#111111' : '#eeeeee'} roughness={0.6} />
        </mesh>
      )
    }

    // Stairs on both sides - continuous staircase with landings at each row
    // stairWidth already defined above (= 3)
    const landingDepth = 1.5 // Flat area where foxes enter each row
    const stepsPerRow = 3
    const stepDepth = (rowDepth - landingDepth) / stepsPerRow // Steps fill remaining space
    const stepHeight = rowHeightStep / stepsPerRow

    // Left stairs
    for (let row = 0; row < rows; row++) {
      const rowY = baseHeight + row * rowHeightStep + SEAT_Y_OFFSET
      const rowZ = row * rowDepth
      const stairX = -baseWidth / 2 - stairWidth / 2 - 0.5

      // Landing at start of each row (flat area for foxes to enter)
      structures.push(
        <mesh key={`landing-l-${row}`} position={[stairX, rowY + 0.15, rowZ + landingDepth / 2]}>
          <boxGeometry args={[stairWidth, 0.3, landingDepth]} />
          <meshStandardMaterial color={concreteColor} roughness={0.95} />
        </mesh>
      )

      // Steps going up from landing to next row level
      for (let step = 0; step < stepsPerRow; step++) {
        const stepY = rowY + step * stepHeight + stepHeight / 2
        const stepZ = rowZ + landingDepth + step * stepDepth + stepDepth / 2

        structures.push(
          <mesh key={`stair-l-${row}-${step}`} position={[stairX, stepY, stepZ]}>
            <boxGeometry args={[stairWidth, stepHeight, stepDepth]} />
            <meshStandardMaterial color={concreteColor} roughness={0.95} />
          </mesh>
        )
      }
    }

    // Right stairs
    for (let row = 0; row < rows; row++) {
      const rowY = baseHeight + row * rowHeightStep + SEAT_Y_OFFSET
      const rowZ = row * rowDepth
      const stairX = baseWidth / 2 + stairWidth / 2 + 0.5

      // Landing at start of each row (flat area for foxes to enter)
      structures.push(
        <mesh key={`landing-r-${row}`} position={[stairX, rowY + 0.15, rowZ + landingDepth / 2]}>
          <boxGeometry args={[stairWidth, 0.3, landingDepth]} />
          <meshStandardMaterial color={concreteColor} roughness={0.95} />
        </mesh>
      )

      // Steps going up from landing to next row level
      for (let step = 0; step < stepsPerRow; step++) {
        const stepY = rowY + step * stepHeight + stepHeight / 2
        const stepZ = rowZ + landingDepth + step * stepDepth + stepDepth / 2

        structures.push(
          <mesh key={`stair-r-${row}-${step}`} position={[stairX, stepY, stepZ]}>
            <boxGeometry args={[stairWidth, stepHeight, stepDepth]} />
            <meshStandardMaterial color={concreteColor} roughness={0.95} />
          </mesh>
        )
      }
    }

    return (
      <group position={[position.x, position.y, position.z]} rotation={[0, rotation, 0]}>
        {structures}
      </group>
    )
  }

  // Create roof structure (always visible from distance)
  // Improved design with fascia, supports, and accent colors
  const createRoof = (position: THREE.Vector3, rotation: number) => {
    const baseWidth = seatsPerRow * seatWidth + 2
    const baseDepth = rows * rowDepth + 3
    const baseHeight = 0.5
    const topY = baseHeight + rows * rowHeightStep + SEAT_Y_OFFSET
    const roofY = topY + 6

    const roofElements: JSX.Element[] = []

    // Colors
    const roofColor = '#1a1a1a'
    const fasciaColor = '#cc0000' // Racing red accent
    const pillarColor = '#2a2a2a'
    const metalColor = '#3a3a3a'

    // Roof canopy - widened to cover stairs, with slight overhang
    const roofWidth = baseWidth + STAIR_COVER_WIDTH * 2 + 6
    const roofDepth = baseDepth + 4

    // Main roof panel
    roofElements.push(
      <mesh key="roof" position={[0, roofY, baseDepth / 2 - 1]} castShadow receiveShadow>
        <boxGeometry args={[roofWidth, 0.4, roofDepth]} />
        <meshStandardMaterial color={roofColor} roughness={0.6} metalness={0.1} />
      </mesh>
    )

    // Snow layer on roof (thick layer)
    roofElements.push(
      <mesh key="roof-snow" position={[0, roofY + 0.5, baseDepth / 2 - 1]} receiveShadow>
        <boxGeometry args={[roofWidth - 0.5, 0.6, roofDepth - 0.5]} />
        <meshStandardMaterial color="#f0f5f8" roughness={0.95} metalness={0} />
      </mesh>
    )

    // Front fascia - red accent strip
    roofElements.push(
      <mesh key="fascia-front" position={[0, roofY - 0.6, -roofDepth / 2 + baseDepth / 2 - 1]} castShadow>
        <boxGeometry args={[roofWidth, 1.2, 0.3]} />
        <meshStandardMaterial color={fasciaColor} roughness={0.4} metalness={0.3} />
      </mesh>
    )

    // Back fascia
    roofElements.push(
      <mesh key="fascia-back" position={[0, roofY - 0.6, roofDepth / 2 + baseDepth / 2 - 1 - roofDepth]} castShadow>
        <boxGeometry args={[roofWidth, 1.2, 0.3]} />
        <meshStandardMaterial color={metalColor} roughness={0.5} />
      </mesh>
    )

    // Roof support beams (trusses) - just 3 for performance
    const beamSpacing = roofWidth / 3
    for (let i = 0; i < 3; i++) {
      const beamX = -roofWidth / 3 + i * beamSpacing
      roofElements.push(
        <mesh key={`beam-${i}`} position={[beamX, roofY - 0.8, baseDepth / 2 - 1]}>
          <boxGeometry args={[0.3, 0.6, roofDepth - 1]} />
          <meshStandardMaterial color={metalColor} roughness={0.4} metalness={0.5} />
        </mesh>
      )
    }

    // Roof pillars - structural columns at corners of base platform
    const pillarOffset = baseWidth / 2 + STAIR_COVER_WIDTH + 2
    const pillarPositions = [
      [-pillarOffset, -2],  // Front left corner of platform
      [pillarOffset, -2],   // Front right corner of platform
      [-pillarOffset, baseDepth - 1],  // Back left corner of platform
      [pillarOffset, baseDepth - 1]    // Back right corner of platform
    ]

    const pillarBase = baseHeight + SEAT_Y_OFFSET
    const pillarHeight = roofY - pillarBase

    pillarPositions.forEach((pos, i) => {
      // Main pillar
      roofElements.push(
        <mesh key={`pillar-${i}`} position={[pos[0], pillarBase + pillarHeight / 2, pos[1]]} castShadow>
          <boxGeometry args={[0.6, pillarHeight, 0.6]} />
          <meshStandardMaterial color={pillarColor} roughness={0.7} />
        </mesh>
      )
      // Pillar cap accent
      roofElements.push(
        <mesh key={`pillar-cap-${i}`} position={[pos[0], roofY - 0.3, pos[1]]}>
          <boxGeometry args={[0.8, 0.3, 0.8]} />
          <meshStandardMaterial color={fasciaColor} roughness={0.4} metalness={0.3} />
        </mesh>
      )
    })

    return (
      <group position={[position.x, position.y, position.z]} rotation={[0, rotation, 0]}>
        {roofElements}
      </group>
    )
  }

  return (
    <group>
      {/* Structure (roof, stands, poles) - hidden at distance for performance */}
      <group ref={structureGroupRef}>
        {/* Roofs */}
        {(side === 'left' || side === 'both') && createRoof(stadiumData.leftPos, stadiumData.leftRotation)}
        {(side === 'right' || side === 'both') && createRoof(stadiumData.rightPos, stadiumData.rightRotation)}

        {/* Stands with benches and stairs */}
        {(side === 'left' || side === 'both') && createStand(stadiumData.leftPos, stadiumData.leftRotation, 0)}
        {(side === 'right' || side === 'both') && createStand(stadiumData.rightPos, stadiumData.rightRotation, 1)}
      </group>

      {/* Foxes - hidden at distance (same threshold as structure for consistency) */}
      <group ref={foxGroupRef}>
        {foxPlacements.length > 0 && textureAtlas && (
          <BillboardStadiumFoxes
            foxPlacements={foxPlacements}
            textureAtlas={textureAtlas}
            atlasSize={atlasSize}
            stadiumPosition={stadiumData.basePosition}
            hopDistance={HOP_DISTANCE}
            isSoundEnabled={isSoundEnabled}
          />
        )}
      </group>
    </group>
  )
}
