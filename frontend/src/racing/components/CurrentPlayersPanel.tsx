import React from 'react'
import { isCurrentMultiplayerPlayer } from '../multiplayer/playerIdentity'
import { getPlayerColorByIndex } from '../core/playerColors'
import { getOrdinalContentUrl } from '../transactions/ordinalLinks'
import { formatShortAddress } from './addressFormat'

export interface CurrentPlayersPanelPlayer {
  id: string
  name?: string
  score: number
  carColor?: string
  trackName?: string
  originOutpoint?: string
  ordinalAddress?: string
  identityKey?: string
}

export interface CurrentPlayersPanelProps {
  players?: CurrentPlayersPanelPlayer[]
  socketId?: string | null
  identityKey?: string | null
  selectedPlayerColor?: string
  selectedTrackName?: string
  defaultTrackName: string
  ordinalAddress?: string | null
  walletSaladCount?: number
  walletBlueberryCount?: number
  walletRabbitCount?: number
  blueberryIconUrl: string
  saladIconUrl: string
  rabbitIconUrl: string
}

export const CurrentPlayersPanel: React.FC<CurrentPlayersPanelProps> = ({
  players,
  socketId,
  identityKey,
  selectedPlayerColor,
  selectedTrackName,
  defaultTrackName,
  ordinalAddress,
  walletSaladCount = 0,
  walletBlueberryCount = 0,
  walletRabbitCount = 0,
  blueberryIconUrl,
  saladIconUrl,
  rabbitIconUrl
}) => {
  const hasPlayers = !!players && players.length > 0

  return (
    <div className="current-players" style={{
      width: '100%',
      maxWidth: '100%',
      margin: '0 auto',
      boxSizing: 'border-box',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      padding: '20px',
      borderRadius: '8px',
      border: '2px solid #fff'
    }}>
      <h3 className="players-title" style={{
        textAlign: 'center',
        color: '#36bffa',
        marginTop: 0,
        marginBottom: '15px',
        marginLeft: 'auto',
        marginRight: 'auto',
        fontSize: '1.5em',
        width: '100%',
        padding: 0,
        display: 'block',
        fontWeight: 'bold'
      }}>
        Current Players{players ? ` (${players.length})` : ''}
      </h3>
      {hasPlayers ? (
        <div className="players-list" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '12px',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {[...players]
            .sort((a, b) => b.score - a.score)
            .map((player, index) => {
              const isCurrentPlayer = isCurrentMultiplayerPlayer({ player, socketId, identityKey })
              const displayColor = isCurrentPlayer
                ? (selectedPlayerColor || player.carColor || getPlayerColorByIndex(index))
                : (player.carColor || getPlayerColorByIndex(index))
              const displayTrackName = isCurrentPlayer
                ? (selectedTrackName || player.trackName || defaultTrackName)
                : (player.trackName || defaultTrackName)
              const showWalletTotals =
                player.ordinalAddress === ordinalAddress &&
                (walletSaladCount > 0 || walletBlueberryCount > 0 || walletRabbitCount > 0)

              return (
                <div key={player.id} className="player-item" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px',
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  borderRadius: '8px',
                  border: `2px solid ${displayColor}`,
                  minHeight: '70px'
                }}>
                  {player.originOutpoint ? (
                    <img
                      src={getOrdinalContentUrl(player.originOutpoint)}
                      alt={player.name || 'Fox'}
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '4px',
                        objectFit: 'cover',
                        border: `2px solid ${displayColor}`,
                        flexShrink: 0
                      }}
                    />
                  ) : (
                    <div
                      className="player-color-indicator"
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '4px',
                        backgroundColor: displayColor,
                        flexShrink: 0
                      }}
                    />
                  )}
                  <div className="player-info" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    flex: 1,
                    minWidth: 0
                  }}>
                    <span className="player-name" style={{
                      color: '#fff',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {(player.name && player.name.trim()) || 'Fox'}
                    </span>
                    {player.ordinalAddress && (
                      <span className="player-address" style={{
                        fontSize: '10px',
                        color: '#888',
                        fontFamily: 'monospace',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {formatShortAddress(player.ordinalAddress)}
                      </span>
                    )}
                    <span className="player-track" style={{
                      fontSize: '11px',
                      color: '#4ECDC4',
                      fontWeight: '500',
                      marginTop: '2px'
                    }}>
                      Track: {displayTrackName}
                    </span>
                    {showWalletTotals && (
                      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {walletBlueberryCount > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <img src={blueberryIconUrl} alt="Blueberries" style={{ width: '12px', height: '12px' }} />
                            <span style={{ color: '#ccc', fontSize: '0.75em' }}>{walletBlueberryCount}</span>
                          </div>
                        )}
                        {walletSaladCount > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <img src={saladIconUrl} alt="Salads" style={{ width: '12px', height: '12px' }} />
                            <span style={{ color: '#ccc', fontSize: '0.75em' }}>{walletSaladCount}</span>
                          </div>
                        )}
                        {walletRabbitCount > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <img src={rabbitIconUrl} alt="Rabbits" style={{ width: '12px', height: '12px' }} />
                            <span style={{ color: '#ccc', fontSize: '0.75em' }}>{walletRabbitCount}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      ) : (
        <div className="players-empty" style={{ textAlign: 'center', padding: '20px' }}>
          <p style={{ color: '#666', textAlign: 'center', padding: '0', margin: '0', fontSize: '16px' }}>
            There are no current players.
          </p>
        </div>
      )}
    </div>
  )
}
