import React from 'react'
import { getOrdinalContentUrl } from '../transactions/ordinalLinks'
import { formatShortAddress } from './addressFormat'

interface WalletItemCount {
  label: string
  iconUrl: string
  count: number
}

interface WalletAddress {
  label?: string
  value: string | null | undefined
  canCopy?: boolean
}

interface RacingPlayerInfoPanelProps {
  name?: string | null
  originOutpoint: string
  addresses?: WalletAddress[]
  walletItems?: WalletItemCount[]
  backgroundColor?: string
  borderColor?: string
  accentColor?: string
  mutedColor?: string
  imageSize?: number
  minWidth?: number
  maxWidth?: number
  showDetailsDivider?: boolean
}

const copyToClipboard = (value: string) => {
  navigator.clipboard?.writeText(value)
}

export const RacingPlayerInfoPanel: React.FC<RacingPlayerInfoPanelProps> = ({
  name,
  originOutpoint,
  addresses = [],
  walletItems = [],
  backgroundColor = 'rgba(0, 0, 0, 0.8)',
  borderColor = 'rgba(255, 255, 255, 0.1)',
  accentColor = '#36bffa',
  mutedColor = '#888',
  imageSize = 80,
  minWidth = 300,
  maxWidth = 400,
  showDetailsDivider = true
}) => {
  const contentUrl = getOrdinalContentUrl(originOutpoint)
  const displayName = name || 'Fox'
  const visibleAddresses = addresses.filter(address => address.value)
  const hasWalletItems = walletItems.length > 0

  return (
    <div style={{
      position: 'absolute',
      top: 10,
      left: 10,
      zIndex: 1000,
      backgroundColor,
      borderRadius: '8px',
      padding: '15px',
      minWidth,
      maxWidth,
      border: `1px solid ${borderColor}`,
      pointerEvents: 'auto'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
      }}>
        <a
          target="_blank"
          rel="noopener noreferrer"
          href={contentUrl}
          style={{ textDecoration: 'none' }}
        >
          <img
            src={contentUrl}
            alt={displayName}
            style={{
              width: imageSize,
              height: imageSize,
              borderRadius: '4px'
            }}
          />
        </a>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          flex: 1
        }}>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={contentUrl}
            style={{
              textDecoration: 'none',
              cursor: 'pointer'
            }}
          >
            <span style={{
              color: accentColor,
              fontSize: '1.1em',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block'
            }}>
              {displayName}
            </span>
          </a>

          {(visibleAddresses.length > 0 || hasWalletItems) && (
            <div style={{
              marginTop: showDetailsDivider ? '8px' : '5px',
              paddingTop: showDetailsDivider ? '8px' : 0,
              borderTop: showDetailsDivider ? `1px solid ${borderColor}` : undefined
            }}>
              {visibleAddresses.map(address => (
                <div key={`${address.label ?? 'address'}-${address.value}`} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  {address.label && (
                    <span style={{
                      color: mutedColor,
                      fontSize: '0.85em',
                      fontWeight: '600'
                    }}>
                      {address.label}
                    </span>
                  )}
                  <span style={{
                    color: '#ccc',
                    fontSize: '0.85em',
                    fontFamily: 'monospace'
                  }}>
                    {formatShortAddress(address.value ?? '')}
                  </span>
                  {address.canCopy && address.value && (
                    <button
                      onClick={() => copyToClipboard(address.value ?? '')}
                      style={{
                        backgroundColor: 'transparent',
                        border: `1px solid ${accentColor}`,
                        color: accentColor,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontFamily: 'monospace'
                      }}
                    >
                      Copy
                    </button>
                  )}
                </div>
              ))}

              {hasWalletItems && (
                <div style={{
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: `1px solid ${borderColor}`
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap'
                  }}>
                    {walletItems.map(item => (
                      <div key={item.label} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <img src={item.iconUrl} alt={item.label} style={{ width: '16px', height: '16px' }} />
                        <span style={{ color: '#ccc', fontSize: '0.85em' }}>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
