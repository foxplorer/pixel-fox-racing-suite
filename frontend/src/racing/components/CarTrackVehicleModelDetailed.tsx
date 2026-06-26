import React from 'react'
import { RoundedBox } from '@react-three/drei'
import { VoxelFox } from '../../components/VoxelFox'
import type { VoxelBackgroundRemovalStrategy } from '../../components/voxelization/voxelBackgroundStrategy'
import { getOrdinalContentUrl } from '../transactions/ordinalLinks'

interface CarTrackVehicleModelDetailedProps {
  foxOriginOutpoint?: string | null
  foxTextureUrl?: string
  backgroundRemovalStrategy?: VoxelBackgroundRemovalStrategy
  playerColor: string
  localChatMessage?: { text: string; timestamp: number } | null
  /** High tier layers on extra trim (mirrors, exhausts, wheel spokes) and a clearcoat finish. */
  highDetail?: boolean
  headlightsEnabled?: boolean
  /** Fired once the fox texture finishes loading (used by the showroom loading indicator). */
  onFoxLoaded?: () => void
}

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)))

// Lighten (amount > 0) or darken (amount < 0) a hex colour for body accents/trim.
const shade = (hex: string, amount: number): string => {
  const value = parseInt(hex.replace('#', ''), 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  const target = amount >= 0 ? 255 : 0
  const t = Math.abs(amount)
  const mix = (c: number) => clampByte(c + (target - c) * t)
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, '0')}`
}

// Glossy car-paint finish. High tier upgrades to a clearcoat physical material; medium
// stays on the cheaper standard material with the same tones.
const BodyMaterial: React.FC<{ color: string; highDetail: boolean }> = ({ color, highDetail }) =>
  highDetail ? (
    <meshPhysicalMaterial color={color} metalness={0.5} roughness={0.28} clearcoat={1} clearcoatRoughness={0.15} />
  ) : (
    <meshStandardMaterial color={color} metalness={0.5} roughness={0.32} />
  )

const Wheel: React.FC<{
  position: [number, number, number]
  radius: number
  width: number
  highDetail: boolean
}> = ({ position, radius, width, highDetail }) => {
  const segments = highDetail ? 32 : 18
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[radius, radius, width, segments]} />
        <meshStandardMaterial color="#0d0d10" metalness={0.2} roughness={0.8} />
      </mesh>
      {/* Hub cap */}
      <mesh position={[width / 2 + 0.01, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius * 0.45, radius * 0.45, 0.04, segments]} />
        <meshStandardMaterial color="#c9ccd2" metalness={0.95} roughness={0.15} />
      </mesh>
      {/* Spokes — high tier only */}
      {highDetail && Array.from({ length: 5 }).map((_, i) => (
        <mesh
          key={i}
          position={[width / 2 + 0.005, 0, 0]}
          rotation={[(i / 5) * Math.PI * 2, Math.PI / 2, 0]}
        >
          <boxGeometry args={[0.05, radius * 0.8, 0.04]} />
          <meshStandardMaterial color="#9aa0a8" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
    </group>
  )
}

// A sleeker open-cockpit racer used on Medium/High: sculpted body, low side bolsters, a
// short windshield, rear wing and lighting trim — a step up from the boxy Low-tier kart.
// The cockpit centre is left fully open (no roof/canopy) so the driver fox reads clearly,
// and it keeps the Low kart's footprint, ride height and fox seat so physics, collisions
// (which use a fixed collider radius) and the camera all stay aligned.
export const CarTrackVehicleModelDetailed: React.FC<CarTrackVehicleModelDetailedProps> = ({
  foxOriginOutpoint,
  foxTextureUrl,
  backgroundRemovalStrategy = 'default',
  playerColor,
  localChatMessage = null,
  highDetail = false,
  headlightsEnabled = false,
  onFoxLoaded
}) => {
  const accent = shade(playerColor, -0.45)
  const trim = shade(playerColor, 0.12)

  return (
    <group rotation={[0, Math.PI, 0]}>
      {/* Lower chassis pan — full ~2 x 3.8 footprint, matching the Low kart so the silhouette
          and ride height line up. (Collisions use a fixed collider radius, not this mesh.) */}
      <RoundedBox args={[1.96, 0.28, 3.7]} radius={0.1} smoothness={3} position={[0, 0.34, 0]} castShadow receiveShadow>
        <BodyMaterial color={playerColor} highDetail={highDetail} />
      </RoundedBox>

      {/* Front splitter */}
      <mesh position={[0, 0.22, 1.9]} castShadow>
        <boxGeometry args={[1.86, 0.08, 0.42]} />
        <meshStandardMaterial color={accent} metalness={0.3} roughness={0.6} />
      </mesh>

      {/* Sculpted hood — sits ahead of the cockpit; its back face lands at z≈0.9 so the open
          centre spans the same z range as the Low kart (≈ -0.9 … 0.9). */}
      <RoundedBox args={[1.78, 0.42, 1.0]} radius={0.1} smoothness={3} position={[0, 0.58, 1.4]} rotation={[0.1, 0, 0]} castShadow receiveShadow>
        <BodyMaterial color={playerColor} highDetail={highDetail} />
      </RoundedBox>

      {/* Nose tip */}
      <RoundedBox args={[1.55, 0.34, 0.4]} radius={0.1} smoothness={3} position={[0, 0.46, 1.84]} castShadow receiveShadow>
        <BodyMaterial color={playerColor} highDetail={highDetail} />
      </RoundedBox>

      {/* Rear engine deck — front face lands at z≈-0.9 to mirror the Low kart's trunk. */}
      <RoundedBox args={[1.86, 0.5, 1.0]} radius={0.1} smoothness={3} position={[0, 0.6, -1.4]} castShadow receiveShadow>
        <BodyMaterial color={playerColor} highDetail={highDetail} />
      </RoundedBox>

      {/* Open cockpit side bolsters — thin, low walls at the Low kart's ±0.9 rail line, leaving
          the same wide-open centre so the full-size fox sits in clear air. */}
      {[-0.9, 0.9].map(x => (
        <RoundedBox key={x} args={[0.22, 0.4, 1.7]} radius={0.07} smoothness={3} position={[x, 0.56, 0]} castShadow receiveShadow>
          <BodyMaterial color={trim} highDetail={highDetail} />
        </RoundedBox>
      ))}

      {/* Raked windshield — sits forward over the hood (z≈1.4, like the Low kart) so it clears
          the driver fox, which is a flat billboard reaching back through the cockpit. */}
      <mesh position={[0, 0.98, 1.4]} rotation={[-0.4, 0, 0]}>
        <boxGeometry args={[1.45, 0.5, 0.06]} />
        <meshPhysicalMaterial color="#bfe0ff" transmission={0.7} opacity={0.5} transparent roughness={0.05} metalness={0} />
      </mesh>

      {/* Rear wing */}
      {[-0.66, 0.66].map(x => (
        <mesh key={x} position={[x, 0.92, -1.8]} castShadow>
          <boxGeometry args={[0.08, 0.4, 0.12]} />
          <meshStandardMaterial color={accent} metalness={0.3} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 1.14, -1.86]} castShadow>
        <boxGeometry args={[1.8, 0.06, 0.46]} />
        <meshStandardMaterial color={accent} metalness={0.4} roughness={0.45} />
      </mesh>

      {/* Side skirts */}
      {[-0.97, 0.97].map(x => (
        <mesh key={x} position={[x, 0.3, 0]} castShadow>
          <boxGeometry args={[0.12, 0.2, 2.6]} />
          <meshStandardMaterial color={accent} metalness={0.3} roughness={0.6} />
        </mesh>
      ))}

      {/* Headlights — set on the nose's front face (z≈2.04) so they sit proud of the bodywork
          instead of being buried inside the nose tip. */}
      {[-0.5, 0.5].map(x => (
        <mesh key={x} position={[x, 0.5, 2.05]}>
          <boxGeometry args={[0.36, 0.14, 0.08]} />
          <meshStandardMaterial
            color={headlightsEnabled ? '#fffbe0' : '#c9c2a4'}
            emissive={headlightsEnabled ? '#fff4c2' : '#000000'}
            emissiveIntensity={headlightsEnabled ? 1.8 : 0}
          />
        </mesh>
      ))}

      {headlightsEnabled && (
        <>
          {[-0.5, 0.5].map(x => (
            <pointLight
              key={`headlight-glow-${x}`}
              position={[x, 0.5, 2.15]}
              color="#fff4c2"
              intensity={highDetail ? 2.8 : 2.4}
              distance={highDetail ? 24 : 20}
              decay={1.5}
            />
          ))}
        </>
      )}

      {/* Taillights */}
      {[-0.54, 0.54].map(x => (
        <mesh key={x} position={[x, 0.64, -1.92]}>
          <boxGeometry args={[0.44, 0.13, 0.06]} />
          <meshStandardMaterial color="#ff3b30" emissive="#ff1a0d" emissiveIntensity={1.2} />
        </mesh>
      ))}

      {/* Roll bar behind the driver — twin posts grounded into the rear deck (their bottoms
          sink below the deck's top face) joined by a top cross-bar, so it reads as attached.
          Sits at the back z-edge and off the fox's centreline, so it never clips the driver. */}
      {[-0.32, 0.32].map(x => (
        <mesh key={x} position={[x, 0.98, -0.88]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.46, 12]} />
          <meshStandardMaterial color={accent} metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, 1.19, -0.88]} castShadow>
        <boxGeometry args={[0.7, 0.08, 0.1]} />
        <meshStandardMaterial color={accent} metalness={0.6} roughness={0.35} />
      </mesh>

      {/* High-detail trim: mirrors and exhaust tips */}
      {highDetail && (
        <>
          {[-0.94, 0.94].map(x => (
            <group key={x} position={[x, 0.82, 0.5]}>
              <mesh castShadow>
                <boxGeometry args={[0.16, 0.08, 0.08]} />
                <meshStandardMaterial color={accent} metalness={0.5} roughness={0.4} />
              </mesh>
            </group>
          ))}
          {[-0.34, 0.34].map(x => (
            <mesh key={x} position={[x, 0.32, -1.94]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.18, 16]} />
              <meshStandardMaterial color="#cfd3d8" metalness={0.95} roughness={0.2} />
            </mesh>
          ))}
        </>
      )}

      {/* Wheels — same hub heights and radii as the Low kart (centres at y=0.3) so the wheel
          bottoms reach the same ground line and the car sits on the track instead of floating. */}
      <Wheel position={[-1.02, 0.3, 1.2]} radius={0.4} width={0.4} highDetail={highDetail} />
      <Wheel position={[1.02, 0.3, 1.2]} radius={0.4} width={0.4} highDetail={highDetail} />
      <Wheel position={[-1.02, 0.3, -1.2]} radius={0.45} width={0.5} highDetail={highDetail} />
      <Wheel position={[1.02, 0.3, -1.2]} radius={0.45} width={0.5} highDetail={highDetail} />

      {/* Driver fox — seated in the open cockpit at the same position and scale as the Low kart */}
      <group position={[0, 0.5, 0.2]}>
        <VoxelFox
          position={[0, 0, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          foxTextureUrl={foxTextureUrl ?? (getOrdinalContentUrl(foxOriginOutpoint) || undefined)}
          backgroundRemovalStrategy={backgroundRemovalStrategy}
          color={playerColor}
          message={localChatMessage?.text}
          messageTime={localChatMessage?.timestamp}
          onTextureLoaded={onFoxLoaded}
        />
      </group>
    </group>
  )
}
