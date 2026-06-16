import { useEffect, useMemo, useState } from 'react'
import blueberriesUrl from '../../assets/blueberries.svg'
import rabbitUrl from '../../assets/rabbit-face.svg'
import saladUrl from '../../assets/salad.svg'
import {
  getOrdinalContentUrl,
  getOrdinalInscriptionUrl,
  getWhatsOnChainTransactionUrl,
} from '../../racing/transactions/ordinalLinks'
import { getOutpointTxid } from '../../racing/transactions/ordinalOutpoint'
import {
  getWalletCollectibles,
  type WalletCollectibleKind,
} from './collectibleDisplay'

type CollectibleResultsProps = {
  ordinalsstring: string
  ordinalSource: 'onesat' | 'metanet'
}

const FALLBACK_IMAGES: Record<WalletCollectibleKind, string> = {
  blueberries: blueberriesUrl,
  salad: saladUrl,
  rabbit: rabbitUrl,
}
const RESULTS_PAGE_SIZE = 25

export default function CollectibleResults({
  ordinalsstring,
  ordinalSource,
}: CollectibleResultsProps) {
  const [visibleCount, setVisibleCount] = useState(RESULTS_PAGE_SIZE)
  const collectibles = useMemo(() => {
    try {
      return getWalletCollectibles(JSON.parse(ordinalsstring))
    } catch {
      return []
    }
  }, [ordinalsstring])
  const displayed = collectibles.slice(0, visibleCount)
  const basketName = ordinalSource === 'metanet'
    ? 'pixel foxes'
    : 'p 1sat ordinals'

  useEffect(() => {
    setVisibleCount(RESULTS_PAGE_SIZE)
  }, [ordinalsstring])

  return (
    <section style={{
      maxWidth: '1200px',
      margin: '28px auto',
      padding: '0 20px 20px',
      color: '#ffffff',
      fontFamily: 'PublicPixel, monospace',
    }}>
      <div style={{
        borderTop: '1px solid rgba(54, 191, 250, 0.5)',
        paddingTop: '22px',
      }}>
        <h3 style={{ color: '#36bffa', margin: '0 0 8px' }}>
          Collectibles ({collectibles.length})
        </h3>
        <p style={{ color: '#aaa', fontSize: '12px', lineHeight: 1.6 }}>
          From your <strong style={{ color: '#ffffff' }}>{basketName}</strong> basket
        </p>
      </div>

      {collectibles.length === 0 ? (
        <p style={{ color: '#aaa', fontSize: '12px', padding: '20px 0' }}>
          No Pixel Racing collectibles found.
        </p>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '14px',
          }}>
            {displayed.map(collectible => {
              const txid = getOutpointTxid(collectible.outpoint)
              const inscriptionUrl = getOrdinalInscriptionUrl(
                collectible.originOutpoint
              )

              return (
              <article
                key={collectible.outpoint}
                style={{
                  display: 'block',
                  padding: '12px',
                  border: '1px solid rgba(54, 191, 250, 0.45)',
                  borderRadius: '8px',
                  background: 'rgba(54, 191, 250, 0.07)',
                  color: '#ffffff',
                  textAlign: 'center',
                }}
              >
                <a
                  href={inscriptionUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`View ${collectible.name} inscription`}
                >
                  <img
                    src={collectible.imageOutpoint
                      ? getOrdinalContentUrl(collectible.imageOutpoint)
                      : FALLBACK_IMAGES[collectible.kind]}
                    alt={collectible.name}
                    onError={event => {
                      event.currentTarget.onerror = null
                      event.currentTarget.src = FALLBACK_IMAGES[collectible.kind]
                    }}
                    style={{
                      width: '96px',
                      height: '96px',
                      objectFit: 'contain',
                      imageRendering: 'pixelated',
                    }}
                  />
                </a>
                <div style={{ marginTop: '8px', fontSize: '11px' }}>
                  {collectible.name}
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '12px',
                  marginTop: '10px',
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '12px',
                }}>
                  {txid && (
                    <a
                      href={getWhatsOnChainTransactionUrl(txid)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#36bffa' }}
                    >
                      Transaction
                    </a>
                  )}
                  <a
                    href={inscriptionUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#36bffa' }}
                  >
                    Inscription
                  </a>
                </div>
              </article>
              )
            })}
          </div>

          {collectibles.length > displayed.length && (
            <button
              type="button"
              onClick={() => setVisibleCount(count => count + RESULTS_PAGE_SIZE)}
              style={{
                marginTop: '18px',
                padding: '8px 14px',
                border: '1px solid #36bffa',
                borderRadius: '4px',
                background: '#000000',
                color: '#36bffa',
                cursor: 'pointer',
                fontFamily: 'PublicPixel, monospace',
              }}
            >
              Show more collectibles
            </button>
          )}
        </>
      )}
    </section>
  )
}
