import React, { Suspense, lazy, useState, useEffect, useRef } from "react";
import { FaucetPandaConnectButton } from "../components/FaucetPandaConnectButton";
import pixelRacingLogo from '../assets/pixel_racing_logo.png';
import { NewGameChoosePlayerModal } from "../components/NewGameChoosePlayerModal";
import { ExitButton } from "../components/ExitButton";
import { usePandaWallet, Addresses } from "panda-wallet-provider";
import { useNavigate } from "react-router-dom";
import { PulseLoader } from "react-spinners";
import PixelRacingStats from "../components/PixelRacingStats";
import type { PixelRacingGameResult } from "../components/foxracing/types";
import FooterHome from "../components/FooterHome";
import { getVoxelBackgroundStrategy } from "../components/voxelization/voxelBackgroundStrategy";
import blueberryUrl from '../assets/blueberries.svg';
import rabbitUrl from '../assets/rabbit-face.svg';
import saladUrl from '../assets/salad.svg';
import {
  getTrackEventMetadata,
  type TrackEventId
} from "../racing/tracks/trackEvents";
import { resolveTrackSelectionByDisplayName } from "../racing/tracks/trackSelection";
import {
  findImportedCarTrackCatalogEntryByDisplayName,
  type ImportedCarTrackId
} from "../racing/tracks/importedCarTrackCatalog";
import { belgiumCarTrackDefinition } from "../racing/tracks/carTrackDefinitions";

const DEFAULT_TRACK_EVENT_ID: TrackEventId = 'australia-car';

const FoxRacingGame = lazy(() => import("../components/foxracing/FoxRacingGame").then(module => ({ default: module.FoxRacingGame })));
const FoxRacingGameSanLuis = lazy(() => import("../components/foxracingsanluis/FoxRacingGame").then(module => ({ default: module.FoxRacingGame })));
const FoxRacingGameAspen = lazy(() => import("../components/foxracingaspen/FoxRacingGame").then(module => ({ default: module.FoxRacingGame })));

const TrackEventLoadingFallback = () => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontFamily: 'PublicPixel, monospace',
    fontSize: '16px',
    textAlign: 'center',
    padding: '24px'
  }}>
    <PulseLoader color="#ffffff" size={16} />
  </div>
);

export const FoxRacing = () => {
  const navigate = useNavigate();
  const wallet = usePandaWallet();
  
  // Wallet & Player State
  const [loading, setLoading] = useState<boolean>(false);
  const [addresses, setAddresses] = useState<Addresses | undefined>();
  const [myordaddress, setMyOrdAddress] = useState<string>("");
  const [bsvaddress, setBsvAddress] = useState<string | undefined>();
  
  // Fox State
  const [foxSelected, setFoxSelected] = useState<boolean>(false);
  const [foxname, setFoxName] = useState<string | undefined>();
  const [foxoutpoint, setFoxOutpoint] = useState<string | undefined>();
  const [foximagesrc, setFoxImageSrc] = useState<string | undefined>();
  const [foxBackground, setFoxBackground] = useState<string | undefined>();
  const [foxesowned, setFoxesOwned] = useState<number>(0);
  
  // Wallet Totals State
  const [walletSaladCount, setWalletSaladCount] = useState<number>(0);
  const [walletBlueberryCount, setWalletBlueberryCount] = useState<number>(0);
  const [walletRabbitCount, setWalletRabbitCount] = useState<number>(0);
  
  // Stats State
  const [latestActivity, setLatestActivity] = useState<PixelRacingGameResult | null>(null);
  const [currentPlayersSection, setCurrentPlayersSection] = useState<React.ReactNode>(null);
  
  // Track Event Selection State
  const [selectedEventId, setSelectedEventId] = useState<TrackEventId>(DEFAULT_TRACK_EVENT_ID);
  const [pendingStartEventId, setPendingStartEventId] = useState<TrackEventId | null>(null);
  const [selectedImportedCarTrackId, setSelectedImportedCarTrackId] = useState<ImportedCarTrackId | null>(null);
  const [selectedCarColor, setSelectedCarColor] = useState<string>('#FF6B6B');
  
  // Modal State
  const [isChoosePlayerModalOpen, setIsChoosePlayerModalOpen] = useState<boolean>(false);

  // Game Racing State - to hide outer fox info panel when game shows its own
  const [isGameRacing, setIsGameRacing] = useState<boolean>(false);

  // Handle Address Updates
  useEffect(() => {
    if (addresses) {
      if (addresses.ordAddress) {
        setMyOrdAddress(addresses.ordAddress);
        setIsChoosePlayerModalOpen(true);
      }
      if (addresses.bsvAddress) {
        setBsvAddress(addresses.bsvAddress);
      }
    }
  }, [addresses]);

  const handleGetAddresses = async () => {
    const addrs = await wallet.getAddresses();
    if (addrs) setAddresses(addrs);
  };

  const handleConnect = async () => {
    // If wallet is already connected but no fox selected, reopen the modal
    if (myordaddress && !foxSelected) {
      setIsChoosePlayerModalOpen(true);
      return;
    }

    setLoading(true);
    if (!wallet.connect) {
      window.open("https://github.com/Panda-Wallet/panda-wallet#getting-started-alpha", "_blank");
      setLoading(false);
      return;
    }

    const key = await wallet.connect();
    if (key) {
      setTimeout(() => handleGetAddresses(), 1000);
    } else {
      setLoading(false);
    }
  };

  const handleFoxSelected = (foxData: any) => {
    setFoxName(foxData.foxname);
    setFoxImageSrc(foxData.originoutpoint);
    setFoxOutpoint(foxData.outpoint);
    setFoxBackground(foxData.traits?.background);
    setMyOrdAddress(foxData.owneraddress);
    setFoxesOwned(foxData.foxes);
    setFoxSelected(true);
    setIsChoosePlayerModalOpen(false);
    setLoading(false);
    
    // Set wallet totals from foxData
    if (foxData.walletSaladCount !== undefined) {
      setWalletSaladCount(foxData.walletSaladCount);
    }
    if (foxData.walletBlueberryCount !== undefined) {
      setWalletBlueberryCount(foxData.walletBlueberryCount);
    }
    if (foxData.walletRabbitCount !== undefined) {
      setWalletRabbitCount(foxData.walletRabbitCount);
    }
  };
  const backgroundRemovalStrategy = getVoxelBackgroundStrategy(foxBackground);
  const selectedEvent = getTrackEventMetadata(selectedEventId);
  
  // Handle collectible collection - increment wallet totals after successful transaction
  const handleCollectibleCollected = (itemType: 'blueberry' | 'salad' | 'rabbit') => {
    if (itemType === 'blueberry') {
      setWalletBlueberryCount(prev => prev + 1);
    } else if (itemType === 'salad') {
      setWalletSaladCount(prev => prev + 1);
    } else if (itemType === 'rabbit') {
      setWalletRabbitCount(prev => prev + 1);
    }
  };

  const handleExitGame = () => {
    window.location.href = "/pixelfoxracing";
  };

  const goToIndex = () => {
    window.location.href = "/pixelfoxracing";
  };

  // Helper function to shorten addresses
  const shortenAddress = (address: string) => {
    if (!address) return '';
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const handleTrackEventChange = (trackName: string, color?: string) => {
    // Only start race if color is passed (indicates START RACE was clicked)
    const shouldStartRace = !!color;
    if (color) {
      setSelectedCarColor(color);
    }

    const importedCarTrack = findImportedCarTrackCatalogEntryByDisplayName(trackName);
    if (importedCarTrack) {
      setSelectedImportedCarTrackId(importedCarTrack.id);
      setSelectedEventId(DEFAULT_TRACK_EVENT_ID);
      setPendingStartEventId(shouldStartRace ? DEFAULT_TRACK_EVENT_ID : null);
      return;
    }

    const selection = resolveTrackSelectionByDisplayName(trackName);
    if (!selection) {
      console.warn(`Ignoring unsupported track event selection: ${trackName}`);
      return;
    }

    setSelectedImportedCarTrackId(null);
    setSelectedEventId(selection.event.id);
    setPendingStartEventId(shouldStartRace ? selection.event.id : null);
  };

  const renderSelectedTrackEvent = () => {
    switch (selectedEventId) {
      case 'australia-car':
        return (
          <FoxRacingGame
            key={selectedImportedCarTrackId ?? 'australia-car'}
            identityKey={null}
            onConnectWallet={handleConnect}
            foxName={foxname}
            foxOriginOutpoint={foximagesrc}
            foxOutpoint={foxoutpoint}
            backgroundRemovalStrategy={backgroundRemovalStrategy}
            ordinalAddress={myordaddress}
            onPlayerInfoChange={() => {}}
            onLatestActivityChange={setLatestActivity}
            onCurrentPlayersRender={setCurrentPlayersSection}
            walletSaladCount={walletSaladCount}
            walletBlueberryCount={walletBlueberryCount}
            walletRabbitCount={walletRabbitCount}
            onCollectibleCollected={handleCollectibleCollected}
            onTrackChange={handleTrackEventChange}
            trackDefinitionId={selectedImportedCarTrackId ?? undefined}
            startRaceImmediately={pendingStartEventId === 'australia-car'}
            selectedColor={selectedCarColor}
          />
        );
      case 'san-luis-car':
        return (
          <FoxRacingGameSanLuis
            identityKey={null}
            onConnectWallet={handleConnect}
            foxName={foxname}
            foxOriginOutpoint={foximagesrc}
            foxOutpoint={foxoutpoint}
            backgroundRemovalStrategy={backgroundRemovalStrategy}
            ordinalAddress={myordaddress}
            onPlayerInfoChange={() => {}}
            onLatestActivityChange={setLatestActivity}
            onCurrentPlayersRender={setCurrentPlayersSection}
            walletSaladCount={walletSaladCount}
            walletBlueberryCount={walletBlueberryCount}
            walletRabbitCount={walletRabbitCount}
            onCollectibleCollected={handleCollectibleCollected}
            startRaceImmediately={pendingStartEventId === 'san-luis-car'}
            selectedColor={selectedCarColor}
            onTrackChange={handleTrackEventChange}
          />
        );
      case 'belgium-car':
        return (
          <FoxRacingGame
            key="belgium-car"
            identityKey={null}
            onConnectWallet={handleConnect}
            foxName={foxname}
            foxOriginOutpoint={foximagesrc}
            foxOutpoint={foxoutpoint}
            backgroundRemovalStrategy={backgroundRemovalStrategy}
            ordinalAddress={myordaddress}
            onPlayerInfoChange={() => {}}
            onLatestActivityChange={setLatestActivity}
            onCurrentPlayersRender={setCurrentPlayersSection}
            walletSaladCount={walletSaladCount}
            walletBlueberryCount={walletBlueberryCount}
            walletRabbitCount={walletRabbitCount}
            onCollectibleCollected={handleCollectibleCollected}
            startRaceImmediately={pendingStartEventId === 'belgium-car'}
            selectedColor={selectedCarColor}
            onTrackChange={handleTrackEventChange}
            trackDefinition={belgiumCarTrackDefinition}
            localTrackName="Belgium"
            trackLocationLabel="Belgium"
            sceneryMode="imported-basic"
          />
        );
      case 'aspen-snowmobile':
        return (
          <FoxRacingGameAspen
            identityKey={null}
            onConnectWallet={handleConnect}
            foxName={foxname}
            foxOriginOutpoint={foximagesrc}
            foxOutpoint={foxoutpoint}
            backgroundRemovalStrategy={backgroundRemovalStrategy}
            ordinalAddress={myordaddress}
            bsvAddress={bsvaddress}
            onPlayerInfoChange={() => {}}
            onLatestActivityChange={setLatestActivity}
            onCurrentPlayersRender={setCurrentPlayersSection}
            walletSaladCount={walletSaladCount}
            walletBlueberryCount={walletBlueberryCount}
            walletRabbitCount={walletRabbitCount}
            onCollectibleCollected={handleCollectibleCollected}
            onGameStatusChange={setIsGameRacing}
            startRaceImmediately={pendingStartEventId === 'aspen-snowmobile'}
            selectedColor={selectedCarColor}
            onTrackChange={handleTrackEventChange}
          />
        );
      default:
        console.warn(`Unsupported selected track event: ${selectedEventId}`);
        return null;
    }
  };

  return (
    <div className="App">
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1, backgroundColor: '#000000' }} />

      <div className="Topbar">
        <img 
          src={pixelRacingLogo} 
          alt="Logo" 
          onClick={goToIndex}
          style={{ cursor: 'pointer', maxWidth: '200px', margin: '10px' }}
        />
      </div>

      <div id="Live" style={{ position: 'relative', marginTop: 0, paddingTop: 0, minHeight: foxSelected ? '100vh' : '80vh' }}>
        <>
            {/* Container for overlay elements - respects Topbar */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
              zIndex: 1000
            }}>
              {/* Fox info display - hide when Aspen snowmobile game is racing because that track has its own panel */}
              {foxSelected && foximagesrc && !(isGameRacing && selectedEvent.vehicleMode === 'snowmobile') && (
                <div style={{
                  position: 'absolute',
                  top: 10, // 60px Topbar + 10px padding
                  left: 10,
                  pointerEvents: 'auto',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                borderRadius: '8px',
                padding: '15px',
                minWidth: '300px',
                maxWidth: '400px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px'
                }}>
                  {/* Fox Image */}
                  <a 
                    target="blank" 
                    href={`https://ordfs.network/content/${foximagesrc}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <img 
                      src={`https://ordfs.network/content/${foximagesrc}`}
                      alt={foxname || 'Fox'}
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '4px'
                      }}
                    />
                  </a>
                  
                  {/* Fox Info */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                    flex: 1
                  }}>
                    {/* Fox Name */}
                    <a 
                      target="blank" 
                      href={`https://ordfs.network/content/${foximagesrc}`}
                      style={{ 
                        textDecoration: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ 
                        color: '#36bffa', 
                        fontSize: '1.1em',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'block'
                      }}>
                        {foxname || 'Fox'}
                      </span>
                    </a>
                    
                    {/* Addresses Section */}
                    <div style={{
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      {/* Ordinal Address */}
                      {myordaddress && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '8px'
                        }}>
                          <span style={{
                            color: '#888',
                            fontSize: '0.85em',
                            fontWeight: '600'
                          }}>
                            Ord:
                          </span>
                          <span style={{
                            color: '#ccc',
                            fontSize: '0.85em',
                            fontFamily: 'monospace'
                          }}>
                            {shortenAddress(myordaddress)}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(myordaddress);
                              const button = document.activeElement as HTMLButtonElement;
                              if (button) {
                                const originalText = button.textContent;
                                button.textContent = 'Copied!';
                                setTimeout(() => {
                                  button.textContent = originalText;
                                }, 1000);
                              }
                            }}
                            style={{
                              backgroundColor: 'transparent',
                              border: '1px solid #36bffa',
                              color: '#36bffa',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              cursor: 'pointer',
                              fontFamily: 'monospace'
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      )}
                      
                      {/* BSV Address */}
                      {bsvaddress && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '8px'
                        }}>
                          <span style={{
                            color: '#888',
                            fontSize: '0.85em',
                            fontWeight: '600'
                          }}>
                            BSV:
                          </span>
                          <span style={{
                            color: '#ccc',
                            fontSize: '0.85em',
                            fontFamily: 'monospace'
                          }}>
                            {shortenAddress(bsvaddress)}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(bsvaddress);
                              const button = document.activeElement as HTMLButtonElement;
                              if (button) {
                                const originalText = button.textContent;
                                button.textContent = 'Copied!';
                                setTimeout(() => {
                                  button.textContent = originalText;
                                }, 1000);
                              }
                            }}
                            style={{
                              backgroundColor: 'transparent',
                              border: '1px solid #36bffa',
                              color: '#36bffa',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              cursor: 'pointer',
                              fontFamily: 'monospace'
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      )}
                      
                      {/* Wallet Totals - Always show all three items, below both addresses */}
                      <div style={{
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <img src={blueberryUrl} alt="Blueberries" style={{ width: '16px', height: '16px' }} />
                            <span style={{ color: '#ccc', fontSize: '0.85em' }}>{walletBlueberryCount}</span>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <img src={saladUrl} alt="Salads" style={{ width: '16px', height: '16px' }} />
                            <span style={{ color: '#ccc', fontSize: '0.85em' }}>{walletSaladCount}</span>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <img src={rabbitUrl} alt="Rabbits" style={{ width: '16px', height: '16px' }} />
                            <span style={{ color: '#ccc', fontSize: '0.85em' }}>{walletRabbitCount}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

              {/* Exit Button - Upper Right */}
              {/* {foxSelected && (
                <div style={{ 
                  position: 'absolute', 
                  top: 10, // 60px Topbar + 10px padding
                  right: 10,
                  pointerEvents: 'auto'
                }}>
                  <ExitButton onClick={handleExitGame} />
                </div>
              )} */}
            </div>

            <Suspense fallback={<TrackEventLoadingFallback />}>
              {renderSelectedTrackEvent()}
            </Suspense>
        </>
      </div>

      {/* Stats Component - Below the game area */}
      <PixelRacingStats 
        latestactivity={latestActivity}
        userOrdinalAddress={myordaddress || undefined}
        renderBeforeLeaderboard={currentPlayersSection}
      />
      <FooterHome />
      <NewGameChoosePlayerModal
        isOpen={isChoosePlayerModalOpen}
        onClose={() => {
          setIsChoosePlayerModalOpen(false);
          setLoading(false);
        }}
        ownerAddress={myordaddress || undefined}
        logo={pixelRacingLogo}
        onFoxSelected={handleFoxSelected}
      />
    </div>
  );
};
