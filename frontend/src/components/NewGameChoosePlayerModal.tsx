import React, { useState, useEffect } from "react";
import { PulseLoader } from 'react-spinners';
import Filters from "./newgame/Filters";
import CollectibleResults from "./newgame/CollectibleResults";
import FooterHome from "./FooterHome";
import pixelRacingLogo from '../assets/pixel_racing_logo.png';
import { useWallet } from "@1sat/react";
import {
  loadMetanetPixelFoxes,
  loadPixelRacingOrdinals
} from "../wallet/oneSatWallet";
import { formatShortAddress } from "../racing/components/addressFormat";

type NewGameChoosePlayerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  ownerAddress?: string; // Optional - if provided, use it; otherwise get from wallet
  bsvAddress?: string;
  identityKey?: string;
  ordinalSource?: 'onesat' | 'metanet';
  logo?: string; // Optional - custom logo image, defaults to pixel_racing_logo.png
  onFoxSelected: (foxData: {
    originoutpoint: string;
    outpoint: string;
    owneraddress: string;
    foxes: number;
    foxname: string;
    walletSaladCount?: number;
    walletBlueberryCount?: number;
    walletRabbitCount?: number;
  }) => void;
};

export const NewGameChoosePlayerModal = ({ 
  isOpen, 
  onClose, 
  ownerAddress,
  bsvAddress,
  identityKey,
  ordinalSource = 'onesat',
  logo = pixelRacingLogo,
  onFoxSelected 
}: NewGameChoosePlayerModalProps) => {
  const { wallet, status } = useWallet();
  const [myordaddress, setMyOrdAddress] = useState<string | undefined>(ownerAddress);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [ordinalsstring, setOrdinalsString] = useState<string | undefined>();
  const QUICK_VIEW_LIMIT = 3000;
  const [isQuickView, setIsQuickView] = useState<boolean>(true);
  const [isFetchingFull, setIsFetchingFull] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    if (!isOpen) return;

    setLoaded(false);
    setOrdinalsString(undefined);
    setMyOrdAddress(ownerAddress);
    setIsQuickView(true);
    setLoadError(null);

    if (status !== 'connected' || !wallet) {
      setLoaded(true);
      setOrdinalsString('[]');
      return;
    }

    let cancelled = false;
    const loadOrdinals = async () => {
      try {
        const address = ownerAddress || bsvAddress || '';
        const result = ordinalSource === 'metanet'
          ? await loadMetanetPixelFoxes(wallet!, address, QUICK_VIEW_LIMIT)
          : await loadPixelRacingOrdinals(wallet, address, QUICK_VIEW_LIMIT);
        if (cancelled) return;
        setOrdinalsString(JSON.stringify(result.ordinals));
        setIsQuickView(result.hasMore);
      } catch (error) {
        console.error('Failed to load BRC-100 wallet ordinals:', error);
        if (!cancelled) {
          setOrdinalsString('[]');
          setLoadError(
            ordinalSource === 'metanet'
              ? 'Pixel Fox Racing needs permission to read the "pixel foxes" basket in Metanet Client. Allow that permission, then retry.'
              : 'The wallet ordinals could not be loaded. Check the wallet connection, then retry.'
          );
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    loadOrdinals();
    return () => {
      cancelled = true;
    };
  }, [isOpen, ownerAddress, bsvAddress, ordinalSource, retryCount, status, wallet]);

  // Handle fox selection from Filters component
  const handleFoxSelected = (foxData: any) => {
    onFoxSelected(foxData);
    onClose();
  };

  // Fetch full ordinals (no limit) - called when user clicks "Load All Foxes"
  const fetchFullOrdinals = async () => {
    if (
      isFetchingFull
      || !wallet
    ) return;
    setIsFetchingFull(true);

    try {
      const address = ownerAddress || bsvAddress || '';
      const result = ordinalSource === 'metanet'
        ? await loadMetanetPixelFoxes(wallet!, address)
        : await loadPixelRacingOrdinals(wallet, address);
      setOrdinalsString(JSON.stringify(result.ordinals));
      setIsQuickView(false);
    } catch (error) {
      console.error('Failed to load all BRC-100 wallet ordinals:', error);
    } finally {
      setIsFetchingFull(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div 
        className="modal-scrollbar"
        onClick={(event) => event.stopPropagation()}
        style={{
          backgroundColor: '#000000',
          borderRadius: '10px',
          maxWidth: '95vw',
          maxHeight: '95vh',
          overflow: 'auto',
          position: 'relative',
          width: '100%',
          scrollbarWidth: 'thin',
          scrollbarColor: '#36bffa #000000'
        }}
      >
        {/* Custom scrollbar styles using CSS-in-JS */}
        <style>
          {`
            .modal-scrollbar::-webkit-scrollbar {
              width: 8px;
            }
            .modal-scrollbar::-webkit-scrollbar-track {
              background: #000000;
            }
            .modal-scrollbar::-webkit-scrollbar-thumb {
              background: #36bffa;
              border-radius: 4px;
            }
            .modal-scrollbar::-webkit-scrollbar-thumb:hover {
              background: #2ba8e0;
            }
          `}
        </style>

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close choose player modal"
          style={{
            position: 'fixed',
            top: '24px',
            right: '32px',
            background: 'rgba(0, 0, 0, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.35)',
            color: '#ffffff',
            fontSize: '28px',
            cursor: 'pointer',
            zIndex: 10001,
            width: '44px',
            height: '44px',
            lineHeight: '38px',
            borderRadius: '6px'
          }}
        >
          ×
        </button>

        <div className="App modal-scrollbar" style={{ backgroundColor: '#000000' }}>
          {!loaded && (
            <>
              <header className="App-header">
                <img
                  src={logo}
                  alt="Pixel Fox Racing"
                  onClick={onClose}
                  style={{
                    cursor: 'pointer',
                    maxWidth: '220px',
                    width: '70%',
                    height: 'auto',
                    margin: '10px',
                  }}
                />
                <div className="LoaderHeight">
                  <div id="error"></div>
                  <PulseLoader color="#000000" />
                </div>
              </header>
            </>
          )}

          {loaded && (
            <>
              <div className="Topbar">
                <img 
                  src={logo} 
                  alt="Game Logo" 
                  onClick={onClose}
                  style={{
                    cursor: 'pointer',
                    maxWidth: '200px',
                    height: 'auto',
                    margin: '10px'
                  }}
                />
              </div>

              <div id="Faucet">
                <p className="Heading"><span className="Demo"><b>Choose Player</b></span></p>
              </div>

              {identityKey && (
                <div style={{
                  maxWidth: '900px',
                  margin: '0 auto 18px',
                  padding: '12px',
                  border: '1px solid rgba(54, 191, 250, 0.5)',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontFamily: 'PublicPixel, monospace',
                  fontSize: '11px',
                  textAlign: 'left'
                }}>
                  <div style={{ color: '#36bffa', marginBottom: '8px' }}>
                    Public identity key
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '8px'
                  }}>
                    <span style={{
                      fontFamily: 'monospace',
                      userSelect: 'text'
                    }}>
                      {formatShortAddress(identityKey)}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(identityKey)}
                      style={{
                        padding: '2px 6px',
                        border: '1px solid #36bffa',
                        borderRadius: '4px',
                        background: 'transparent',
                        color: '#36bffa',
                        cursor: 'pointer',
                        fontFamily: 'monospace',
                        fontSize: '10px'
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  <div style={{
                    marginTop: '10px',
                    color: '#aaa',
                    fontSize: '13px',
                    lineHeight: 1.6
                  }}>
                    Showing inscriptions from your{' '}
                    <span style={{
                      color: '#36bffa',
                      fontFamily: 'PublicPixel, monospace',
                      fontSize: '14px',
                      fontWeight: 700
                    }}>
                      {ordinalSource === 'metanet' ? 'pixel foxes' : 'p 1sat ordinals'}
                    </span>{' '}
                    basket.
                  </div>
                </div>
              )}

              {loadError && (
                <div style={{
                  maxWidth: '900px',
                  margin: '0 auto 18px',
                  padding: '14px',
                  border: '1px solid #ffb020',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontFamily: 'PublicPixel, monospace',
                  fontSize: '11px',
                  lineHeight: 1.6,
                  textAlign: 'center'
                }}>
                  <div>{loadError}</div>
                  <button
                    type="button"
                    onClick={() => setRetryCount(value => value + 1)}
                    style={{
                      marginTop: '12px',
                      padding: '8px 14px',
                      border: '1px solid #36bffa',
                      borderRadius: '4px',
                      background: '#000000',
                      color: '#36bffa',
                      cursor: 'pointer',
                      fontFamily: 'PublicPixel, monospace'
                    }}
                  >
                    Retry basket access
                  </button>
                </div>
              )}
              
              {!loadError && (
                <Filters
                  ordinalsstring={ordinalsstring || '[]'}
                  myordinalsaddress={myordaddress || ''}
                  onFoxSelected={handleFoxSelected}
                  isQuickView={isQuickView}
                  isFetchingFull={isFetchingFull}
                  onFetchFullOrdinals={fetchFullOrdinals}
                />
              )}

              {!loadError && (
                <CollectibleResults
                  ordinalsstring={ordinalsstring || '[]'}
                  ordinalSource={ordinalSource}
                />
              )}
              
              <FooterHome />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
