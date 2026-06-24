import React, { memo } from 'react'

interface RacingCrashOverlayProps {
  score: number
  onRestart: () => void
  title?: string
  description?: string
  restartLabel?: string
}

const PIXEL_FONT = "'PublicPixel', monospace"

export const RacingCrashOverlay = memo<RacingCrashOverlayProps>(function RacingCrashOverlay({
  score,
  onRestart,
  title = 'CRASHED!',
  description = 'You fell off the track.',
  restartLabel = 'Race Again'
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Slightly see-through, warm volcanic haze over the track.
        background:
          'radial-gradient(circle at 50% 42%, rgba(120,38,8,0.42), rgba(8,3,2,0.66))',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        pointerEvents: 'auto',
        zIndex: 200,
        fontFamily: PIXEL_FONT
      }}
    >
      <style>{`
        @keyframes lavaCrashGlow {
          0%, 100% { text-shadow: 0 0 10px rgba(255,90,0,0.85), 0 3px 0 #6e1900; }
          50%      { text-shadow: 0 0 24px rgba(255,150,30,1), 0 3px 0 #6e1900; }
        }
        .lava-crash-button {
          transition: transform .1s ease, box-shadow .15s ease, filter .15s ease;
        }
        .lava-crash-button:hover {
          transform: translateY(-2px) scale(1.04);
          box-shadow: 0 0 28px rgba(255,150,40,0.95);
          filter: brightness(1.12);
        }
        .lava-crash-button:active { transform: translateY(0) scale(0.98); }
      `}</style>

      <div
        style={{
          position: 'relative',
          textAlign: 'center',
          padding: '34px 40px 30px',
          maxWidth: '90%',
          // Translucent charred-rock panel with a molten rim.
          background: 'linear-gradient(180deg, rgba(48,18,8,0.86), rgba(20,7,3,0.9))',
          border: '3px solid #ff6a1f',
          borderRadius: '12px',
          boxShadow:
            '0 0 36px rgba(255,106,31,0.55), inset 0 0 26px rgba(255,60,0,0.28)',
          color: '#ffd9b0'
        }}
      >
        <h2
          style={{
            margin: '0 0 14px',
            fontFamily: PIXEL_FONT,
            fontSize: 'clamp(22px, 5vw, 36px)',
            lineHeight: 1.2,
            letterSpacing: '2px',
            color: '#ffcf4a',
            animation: 'lavaCrashGlow 1.6s ease-in-out infinite'
          }}
        >
          {title}
        </h2>

        <p
          style={{
            margin: '0 0 20px',
            fontFamily: PIXEL_FONT,
            fontSize: 'clamp(9px, 1.7vw, 12px)',
            lineHeight: 1.7,
            color: '#ff9a5a'
          }}
        >
          {description}
        </p>

        <div
          style={{
            margin: '0 0 24px',
            fontFamily: PIXEL_FONT,
            fontSize: 'clamp(20px, 4.4vw, 32px)',
            fontWeight: 'bold',
            color: '#fff5e6',
            textShadow: '0 0 12px rgba(255,170,60,0.75)'
          }}
        >
          {Math.floor(score)} m
        </div>

        <button
          onClick={onRestart}
          className="lava-crash-button"
          style={{
            fontFamily: PIXEL_FONT,
            fontSize: 'clamp(10px, 2vw, 14px)',
            letterSpacing: '1px',
            padding: '14px 24px',
            color: '#240c03',
            background: 'linear-gradient(180deg, #ffb13a, #ff6a1f)',
            border: '2px solid #ffd98a',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 0 18px rgba(255,120,30,0.7)'
          }}
        >
          {restartLabel}
        </button>
      </div>
    </div>
  )
})
