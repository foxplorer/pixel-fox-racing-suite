import React from 'react'
import { ImVolumeHigh, ImVolumeMute2 } from 'react-icons/im'

export const RACING_SOUND_TOGGLE_ICON_SIZE = 24

interface RacingSoundToggleProps {
  showMuted: boolean
  showUnmuted: boolean
  onUnmute: () => void
  onMute: () => void
}

const soundIconStyle: React.CSSProperties = {
  color: '#ffffff',
  cursor: 'pointer',
  filter: 'drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.8))',
  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)'
}

export const RacingSoundToggle: React.FC<RacingSoundToggleProps> = ({
  showMuted,
  showUnmuted,
  onUnmute,
  onMute
}) => (
  <div style={{
    position: 'absolute',
    top: 20,
    right: 220,
    pointerEvents: 'auto',
    zIndex: 100
  }}>
    <ImVolumeMute2
      style={{
        ...soundIconStyle,
        display: showMuted ? 'block' : 'none'
      }}
      size={RACING_SOUND_TOGGLE_ICON_SIZE}
      onClick={onUnmute}
    />
    <ImVolumeHigh
      style={{
        ...soundIconStyle,
        display: showUnmuted ? 'block' : 'none'
      }}
      size={RACING_SOUND_TOGGLE_ICON_SIZE}
      onClick={onMute}
    />
  </div>
)
