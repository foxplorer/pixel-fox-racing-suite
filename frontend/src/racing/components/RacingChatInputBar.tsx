import React from 'react'

export const RACING_CHAT_MESSAGE_MAX_LENGTH = 30
export const SNOWMOBILE_CHAT_MESSAGE_MAX_LENGTH = 50

const RACING_CHAT_GAME_KEYS = ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'c']

interface RacingChatInputBarProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  placeholder?: string
  maxLength?: number
  buttonLabel?: string
  buttonBackground?: string
  bottom?: number | string
  left?: number | string
  width?: number | string
  maxWidth?: number | string
  gap?: number | string
  zIndex?: number
  className?: string
  compact?: boolean
  stopOnlyGameKeys?: boolean
  preventDefaultOnEnter?: boolean
}

export const RacingChatInputBar: React.FC<RacingChatInputBarProps> = ({
  value,
  onChange,
  onSend,
  placeholder = 'Say something...',
  maxLength = RACING_CHAT_MESSAGE_MAX_LENGTH,
  buttonLabel = 'Say',
  buttonBackground = '#1565C0',
  bottom = '20px',
  left = '280px',
  width = '300px',
  maxWidth = 'calc(100% - 320px)',
  gap = '10px',
  zIndex = 100,
  className = 'chat-bar',
  compact = false,
  stopOnlyGameKeys = false,
  preventDefaultOnEnter = false
}) => (
  <div className={className} style={{
    position: 'absolute',
    bottom,
    left,
    width,
    maxWidth,
    display: 'flex',
    gap,
    zIndex,
    pointerEvents: compact ? 'auto' : undefined
  }}>
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          if (preventDefaultOnEnter) {
            event.preventDefault()
          }
          onSend()
        }

        if (stopOnlyGameKeys) {
          const isGameKey = RACING_CHAT_GAME_KEYS.includes(event.key.toLowerCase())
          if (isGameKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.stopPropagation()
          }
        } else {
          event.stopPropagation()
        }
      }}
      placeholder={placeholder}
      maxLength={maxLength}
      style={{
        flex: compact ? undefined : 1,
        width: compact ? '200px' : undefined,
        padding: compact ? '8px 12px' : '10px 15px',
        borderRadius: compact ? '6px' : '20px',
        border: compact ? '1px solid rgba(255,255,255,0.2)' : '2px solid #fff',
        background: compact ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0,0,0,0.7)',
        color: '#fff',
        fontFamily: compact ? 'monospace' : 'PublicPixel, monospace',
        fontSize: '12px',
        outline: 'none',
        minWidth: compact ? undefined : '0'
      }}
    />
    <button
      onClick={onSend}
      style={{
        padding: compact ? '8px 16px' : '0 20px',
        borderRadius: compact ? '6px' : '20px',
        border: compact ? 'none' : '2px solid #fff',
        background: buttonBackground,
        color: '#fff',
        fontFamily: compact ? 'monospace' : 'PublicPixel, monospace',
        fontSize: '12px',
        fontWeight: compact ? 'bold' : undefined,
        cursor: 'pointer',
        textTransform: compact ? undefined : 'uppercase'
      }}
    >
      {buttonLabel}
    </button>
  </div>
)
