import React, { memo } from 'react'
import { FaucetPandaConnectButton } from '../../components/FaucetPandaConnectButton'

interface RacingConnectOverlayProps {
  backgroundImage: string
  onConnectWallet?: () => void | Promise<void>
  className?: string
  backdropClassName?: string
}

export const RacingConnectOverlay = memo<RacingConnectOverlayProps>(function RacingConnectOverlay({
  backgroundImage,
  onConnectWallet,
  className = 'join-overlay',
  backdropClassName = 'join-overlay-backdrop'
}) {
  return (
    <div
      className={className}
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className={backdropClassName} style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        zIndex: 1
      }} />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <FaucetPandaConnectButton onClick={onConnectWallet} />
      </div>
    </div>
  )
})
