import React, { Suspense, lazy, useState, useEffect, useRef } from "react";
import pixelRacingLogo from '../assets/pixel_racing_logo.png';
import { NewGameChoosePlayerModal } from "../components/NewGameChoosePlayerModal";
import { ExitButton } from "../components/ExitButton";
import { RacingPlayerInfoPanel } from "../racing/components/RacingPlayerInfoPanel";
import { useWallet } from "@1sat/react";
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
import {
  derivePixelRacingAddresses,
  verifyMetanetPixelFoxAccess
} from "../wallet/oneSatWallet";
import { METANET_WALLET_PROVIDER } from "../wallet/walletProviders";
import {
  getExistingShualletSession,
  SHUALLET_CONNECTED_EVENT,
  type ShualletSession
} from "../wallet/shuallet";
import { normalizeOrdinalOutpoint } from "../racing/transactions/ordinalOutpoint";

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
  const { wallet, status, identityKey: walletIdentityKey, providerType } = useWallet();
  
  // Wallet & Player State
  const [myordaddress, setMyOrdAddress] = useState<string>("");
  const [bsvaddress, setBsvAddress] = useState<string | undefined>();
  const [walletOrdinalSource, setWalletOrdinalSource] = useState<'onesat' | 'metanet' | 'address'>('onesat');
  const [shualletSession, setShualletSession] = useState<ShualletSession | null>(null);
  
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
  const activeIdentityValue = walletOrdinalSource === 'metanet'
    ? walletIdentityKey
    : myordaddress || shualletSession?.identityKey;
  const activeIdentityLabel = walletOrdinalSource === 'metanet' ? 'ID:' : 'Ord:';

  const applyShualletSession = (session: ShualletSession | null, openChoosePlayer = false) => {
    setShualletSession(session);
    if (!session) {
      setWalletOrdinalSource('onesat');
      setMyOrdAddress('');
      setBsvAddress(undefined);
      setFoxSelected(false);
      return;
    }

    setWalletOrdinalSource('address');
    setMyOrdAddress(session.ordinalAddress);
    setBsvAddress(session.paymentAddress);
    setFoxSelected(false);
    if (openChoosePlayer) {
      setIsChoosePlayerModalOpen(true);
    }
  };

  useEffect(() => {
    applyShualletSession(getExistingShualletSession());

    const handleShualletConnected = () => {
      applyShualletSession(getExistingShualletSession());
    };

    window.addEventListener(SHUALLET_CONNECTED_EVENT, handleShualletConnected);
    return () => {
      window.removeEventListener(SHUALLET_CONNECTED_EVENT, handleShualletConnected);
    };
  }, []);

  useEffect(() => {
    if (status !== 'connected' || !wallet) return;

    let cancelled = false;
    const loadAddresses = async () => {
      try {
        if (providerType === METANET_WALLET_PROVIDER) {
          await verifyMetanetPixelFoxAccess(wallet);
          if (cancelled) return;
          setShualletSession(null);
          setWalletOrdinalSource('metanet');
          setMyOrdAddress(walletIdentityKey || '');
          setBsvAddress(undefined);
          setIsChoosePlayerModalOpen(true);
          return;
        }

        const addrs = await derivePixelRacingAddresses(wallet);
        if (cancelled) return;
        setShualletSession(null);
        setWalletOrdinalSource('onesat');
        setMyOrdAddress(addrs.ordAddress);
        setBsvAddress(addrs.bsvAddress);
        setIsChoosePlayerModalOpen(true);
      } catch (error) {
        console.error('Failed to initialize connected wallet:', error);
      }
    };

    loadAddresses();
    return () => {
      cancelled = true;
    };
  }, [status, wallet, walletIdentityKey, providerType]);

  const handleConnect = () => {
    if (walletOrdinalSource === 'address' || getExistingShualletSession()) {
      const session = getExistingShualletSession();
      applyShualletSession(session, true);
      return;
    }

    if ((myordaddress || walletOrdinalSource === 'metanet') && !foxSelected) {
      setIsChoosePlayerModalOpen(true);
    }
  };

  const handleFoxSelected = (foxData: any) => {
    setFoxName(foxData.foxname);
    setFoxImageSrc(normalizeOrdinalOutpoint(foxData.originoutpoint));
    setFoxOutpoint(normalizeOrdinalOutpoint(foxData.outpoint));
    setFoxBackground(foxData.traits?.background);
    setMyOrdAddress(foxData.owneraddress);
    setFoxesOwned(foxData.foxes);
    setFoxSelected(true);
    setIsChoosePlayerModalOpen(false);
    
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
            identityKey={activeIdentityValue}
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
            identityKey={activeIdentityValue}
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
            identityKey={activeIdentityValue}
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
            identityKey={activeIdentityValue}
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
              zIndex: 900
            }}>
              {/* Fox info display - hide when Aspen snowmobile game is racing because that track has its own panel */}
              {foxSelected && foximagesrc && !(isGameRacing && selectedEvent.vehicleMode === 'snowmobile') && (
                <RacingPlayerInfoPanel
                  name={foxname}
                  originOutpoint={foximagesrc}
                  addresses={activeIdentityValue ? [{
                    label: activeIdentityLabel,
                    value: activeIdentityValue,
                    canCopy: true
                  }] : []}
                  walletItems={[
                    { label: 'Blueberries', iconUrl: blueberryUrl, count: walletBlueberryCount },
                    { label: 'Salads', iconUrl: saladUrl, count: walletSaladCount },
                    { label: 'Rabbits', iconUrl: rabbitUrl, count: walletRabbitCount }
                  ]}
                  position="fixed"
                  top={70}
                  left={10}
                  zIndex={900}
                  backgroundColor="rgba(0, 0, 0, 0.8)"
                  borderColor="rgba(255, 255, 255, 0.1)"
                  accentColor="#36bffa"
                  mutedColor="#888"
                  imageSize={80}
                  minWidth={300}
                  maxWidth={400}
                  maxHeight="calc(100vh - 80px)"
                />
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
        }}
        ownerAddress={myordaddress || undefined}
        bsvAddress={bsvaddress}
        identityKey={activeIdentityValue}
        ordinalSource={walletOrdinalSource}
        logo={pixelRacingLogo}
        onFoxSelected={handleFoxSelected}
      />
    </div>
  );
};
