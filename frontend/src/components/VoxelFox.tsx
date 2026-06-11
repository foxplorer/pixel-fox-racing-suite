import { Html } from '@react-three/drei'
import { useEffect, useState } from 'react'
import { SimpleVoxelFox } from './SimpleVoxelFox'
import type { VoxelBackgroundRemovalStrategy } from './voxelization/voxelBackgroundStrategy'

interface VoxelFoxProps {
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  isWalking?: boolean
  foxTextureUrl?: string // Optional driver fox texture
  backgroundRemovalStrategy?: VoxelBackgroundRemovalStrategy
  color?: string // Optional: player color
  message?: string
  messageTime?: number
  onTextureLoaded?: () => void // Callback when fox texture finishes loading
}

/**
 * VoxelFox - Shared chat-bubble wrapper around the procedural voxel fox.
 */
export function VoxelFox(props: VoxelFoxProps) {
  const [showBubble, setShowBubble] = useState(false)
  const scale = props.scale ?? 1

  useEffect(() => {
    if (props.message) {
      setShowBubble(true)
      const t = setTimeout(() => setShowBubble(false), 7000) // Show for 7 seconds
      return () => clearTimeout(t)
    } else {
      // Reset bubble state when message is cleared (e.g., switching between walk/ski mode)
      setShowBubble(false)
    }
  }, [props.message, props.messageTime])

  // Scale the bubble height with the fox size. The larger chat bubble needs
  // extra clearance above car cockpits and snowmobile riders.
  const bubbleHeight = 2.35 * scale

  return (
    <group>
      <SimpleVoxelFox {...props} onTextureLoaded={props.onTextureLoaded} />
      {showBubble && props.message && (
        <Html position={[0, bubbleHeight, 0]} center distanceFactor={10} style={{ transform: 'translate(-50%, -100%)' }}>
          <div style={{
            background: 'white',
            border: '6px solid black',
            borderRadius: '18px',
            padding: '16px 24px',
            fontFamily: 'PublicPixel, monospace',
            fontSize: '28px',
            fontWeight: 'bold',
            color: 'black',
            minWidth: '450px',
            maxWidth: '900px',
            wordWrap: 'break-word',
            textAlign: 'center',
            lineHeight: '1.3',
            position: 'relative',
            pointerEvents: 'none',
            userSelect: 'none'
          }}>
            {props.message}
            {/* Tail */}
            <div style={{
              position: 'absolute',
              bottom: '-20px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '16px solid transparent',
              borderRight: '16px solid transparent',
              borderTop: '20px solid black'
            }}/>
            <div style={{
              position: 'absolute',
              bottom: '-15px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '12px solid transparent',
              borderRight: '12px solid transparent',
              borderTop: '15px solid white'
            }}/>
          </div>
        </Html>
      )}
    </group>
  )
}
