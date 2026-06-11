import React, { useState, useEffect, useRef } from "react";
import { PulseLoader } from 'react-spinners';
import Filters from "./newgame/Filters";
import FooterHome from "./FooterHome";
import pixelRacingLogo from '../assets/pixel_racing_logo.png';

import {
  usePandaWallet,
  Addresses
} from "panda-wallet-provider";

type NewGameChoosePlayerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  ownerAddress?: string; // Optional - if provided, use it; otherwise get from wallet
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
  logo = pixelRacingLogo,
  onFoxSelected 
}: NewGameChoosePlayerModalProps) => {
  const wallet = usePandaWallet();
  const [ordaddress, setOrdAddress] = useState<string>();
  const [bsvaddress, setBsvAddress] = useState<string | undefined>();
  const [addresses, setAddresses] = useState<Addresses | undefined>();
  const [myordaddress, setMyOrdAddress] = useState<string | undefined>(undefined);
  const [addressLookupComplete, setAddressLookupComplete] = useState<boolean>(false);

  //loading
  const [loading, setLoading] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);

  //ordinalsstring for Foxes Child Component
  const [ordinalsstring, setOrdinalsString] = useState<string | undefined>();

  // Quick View mode - load first 3000 quickly, then allow loading all
  const QUICK_VIEW_LIMIT = 3000;
  const [isQuickView, setIsQuickView] = useState<boolean>(true);
  const [isFetchingFull, setIsFetchingFull] = useState<boolean>(false);

  //useRefs
  const didMount1 = useRef(false);
  const didMount2 = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchedAddressesRef = useRef<Set<string>>(new Set()); // Track which addresses have been fetched
  const accumulatedOrdinalsRef = useRef<any[]>([]); // Accumulate ordinals across fetches

  // Get addresses from wallet (if connected)
  useEffect(() => {
    if (!isOpen) return; // Only run when modal is open
    
    const handleGetAddresses = async () => {
      try {
        // Check if wallet.getAddresses exists and is a function before calling
        if (!wallet || typeof wallet.getAddresses !== 'function') {
          setAddressLookupComplete(true);
          return;
        }
        const addrs = await wallet.getAddresses();
        if (addrs && addrs.ordAddress) {
          setAddresses(addrs);
        }
      } catch (error) {
        console.error('Error getting addresses:', error);
      } finally {
        setAddressLookupComplete(true);
      }
    };
    handleGetAddresses();
  }, [wallet, isOpen]);

  // Set addresses from wallet or from props
  useEffect(() => {
    if (!isOpen) return; // Only run when modal is open
    
    // If addresses from wallet are available, use those
    if (addresses) {
      if (addresses.ordAddress) {
        setMyOrdAddress(addresses.ordAddress);
        setOrdAddress(addresses.ordAddress);
      }
      if (addresses.bsvAddress) {
        setBsvAddress(addresses.bsvAddress);
      }
    } else if (ownerAddress) {
      // Fallback to prop address - use immediately when modal opens
      setMyOrdAddress(ownerAddress);
      setOrdAddress(ownerAddress);
      setAddressLookupComplete(true);
    }
  }, [addresses, ownerAddress, isOpen]);

  // get ordinals string from both addresses
  useEffect(() => {
    if (!isOpen) return; // Only run when modal is open

    const ord = ordaddress?.trim();
    const bsv = bsvaddress?.trim();

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Check which addresses need to be fetched (skip already fetched ones)
    const addressesToFetch: string[] = [];
    if (ord && !fetchedAddressesRef.current.has(ord)) addressesToFetch.push(ord);
    if (bsv && bsv !== ord && !fetchedAddressesRef.current.has(bsv)) addressesToFetch.push(bsv);

    // If we have accumulated ordinals and no new addresses to fetch, just show what we have
    if (addressesToFetch.length === 0 && accumulatedOrdinalsRef.current.length > 0) {
      setOrdinalsString(JSON.stringify(accumulatedOrdinalsRef.current));
      setLoaded(true);
      return;
    }

    // Keep the modal loader visible while any new address fetch is still in flight.
    if (addressesToFetch.length > 0 || accumulatedOrdinalsRef.current.length === 0) {
      setLoaded(false);
    }
    
    // If no addresses, try to get ordinals from wallet only, then set loaded
    // BUT: if addresses exist, skip this path and let the merge path handle it
    if (!ord && !bsv && !addressLookupComplete) {
      return;
    }

    if (!ord && !bsv && !addresses) {
      // Try to fetch from wallet even without addresses
      (async () => {
        try {
          let walletOrdinalsLocal: any[] = [];
          
          if (wallet && typeof wallet.getOrdinals === 'function') {
            try {
              // Wrap wallet call with 5 second timeout - wallet can hang with large collections
              const walletOrdinalsPromise = wallet.getOrdinals();
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Wallet getOrdinals timeout')), 5000)
              );
              const walletOrdinals = await Promise.race([walletOrdinalsPromise, timeoutPromise]) as any[];
              if (Array.isArray(walletOrdinals) && walletOrdinals.length > 0) {
                // Debug: Check if any wallet ordinals have collectible map data
                const collectiblesInWallet = walletOrdinals.filter((ord: any) => {
                  const map = ord.origin?.data?.map || ord.data?.map || ord.map;
                  const name = map?.name;
                  const collectionId = map?.subTypeData?.collectionId;
                  return name === 'rabbit' || name === 'salad' || name === 'blueberries' ||
                         collectionId === 'c37ae9cedf11c4fde02a3fee2f0b5d89926a7052ff7c3206fe1a9366b4a76013_0' ||
                         collectionId === '66fc7495388f011d273d8ce3ab5ec667121c34084e122e64fa2bc607e469e295_0' ||
                         collectionId === 'd0322f59a802bd15c412e441adaab76c10bb3c9018e2a501117cba374616ea46_0';
                });
                console.log(`Found ${collectiblesInWallet.length} collectibles in raw wallet ordinals`);
                if (collectiblesInWallet.length > 0) {
                  console.log('Sample wallet collectible before transformation:', collectiblesInWallet[0]);
                }
                
                walletOrdinalsLocal = walletOrdinals.map((ordinal: any) => {
                  const outpoint = ordinal.outpoint || ordinal.origin?.outpoint || 
                    (ordinal.txid && typeof ordinal.vout !== 'undefined' ? `${ordinal.txid}_${ordinal.vout}` : null);
                  
                  if (!outpoint) return null;

                  // Preserve all data structures - collectibles have map data with subTypeData
                  // Structure: origin.data.map = { name, subTypeData: { collectionId }, ... }
                  const existingOriginData = ordinal.origin?.data || {};
                  const existingData = ordinal.data || {};
                  
                  // Get map data from multiple possible locations, preserving nested structure
                  const mapFromOrigin = existingOriginData.map;
                  const mapFromData = existingData.map;
                  const mapFromTop = ordinal.map;
                  const mapFromOriginTop = ordinal.origin?.map;
                  
                  // Use the most complete map data (prefer origin.data.map as it's the standard)
                  const finalMapData = (mapFromOrigin && Object.keys(mapFromOrigin).length > 0)
                    ? mapFromOrigin
                    : (mapFromData && Object.keys(mapFromData).length > 0)
                    ? mapFromData
                    : (mapFromTop && Object.keys(mapFromTop).length > 0)
                    ? mapFromTop
                    : mapFromOriginTop || {};

                  // Build the transformed ordinal, ensuring map data is preserved
                  const transformed = {
                    origin: {
                      ...(ordinal.origin || {}),
                      outpoint: ordinal.origin?.outpoint || outpoint,
                      data: {
                        ...existingOriginData,
                        map: finalMapData // Preserve map with subTypeData structure
                      }
                    },
                    outpoint: ordinal.outpoint || outpoint,
                    txid: ordinal.txid,
                    vout: ordinal.vout,
                    data: {
                      ...existingData,
                      map: finalMapData // Also preserve in data
                    },
                    map: finalMapData, // Also include at top level for easier access
                    // Include other fields from original, but don't overwrite what we've set
                    ...Object.fromEntries(
                      Object.entries(ordinal).filter(([key]) => 
                        !['origin', 'data', 'map', 'outpoint', 'txid', 'vout'].includes(key)
                      )
                    )
                  };
                  
                  return transformed;
                }).filter((item: any) => item !== null);
                
                // Debug: Check if collectibles are preserved after transformation
                const collectiblesAfterTransform = walletOrdinalsLocal.filter((ord: any) => {
                  const map = ord.origin?.data?.map || ord.data?.map || ord.map;
                  const name = map?.name;
                  const collectionId = map?.subTypeData?.collectionId;
                  return name === 'rabbit' || name === 'salad' || name === 'blueberries' ||
                         collectionId === 'c37ae9cedf11c4fde02a3fee2f0b5d89926a7052ff7c3206fe1a9366b4a76013_0' ||
                         collectionId === '66fc7495388f011d273d8ce3ab5ec667121c34084e122e64fa2bc607e469e295_0' ||
                         collectionId === 'd0322f59a802bd15c412e441adaab76c10bb3c9018e2a501117cba374616ea46_0';
                });
                console.log(`Found ${collectiblesAfterTransform.length} collectibles in transformed wallet ordinals`);
                if (collectiblesAfterTransform.length > 0) {
                  console.log('Sample wallet collectible after transformation:', collectiblesAfterTransform[0]);
                }
              }
            } catch (walletError) {
              console.log('Error fetching ordinals from wallet:', walletError);
            }
          }
          
          console.log(`Fetched ${walletOrdinalsLocal.length} ordinals from wallet`);
          setOrdinalsString(JSON.stringify(walletOrdinalsLocal));
          setLoaded(true);
        } catch (error) {
          console.log(error);
          // Set loaded to true even if no ordinals found, so user can see empty state
          setLoaded(true);
        }
      })();
      return;
    }

    // QUICK VIEW: Fetch with limit for fast initial load
    const fetchPage = async (addr: string, limit: number = QUICK_VIEW_LIMIT, maxRetries = 3): Promise<any[]> => {
      const url = "https://ordinals.gorillapool.io/api/txos/address/" + addr + "/unspent?limit=" + limit;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

        try {
          const res = await fetch(url, {
            method: "GET",
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          const data = await res.json();
          return data && !data?.message && Array.isArray(data) ? data : [];
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error?.name === 'AbortError') {
            return [];
          }
          const isNetworkError = error?.message?.includes('Failed to fetch') || error?.message?.includes('network');
          if (isNetworkError && attempt < maxRetries) {
            console.log(`Network error, retrying... (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          } else {
            console.error('Error fetching ordinals:', error);
            return [];
          }
        }
      }
      return [];
    };

    const mergeUnique = (current: any[], incoming: any[]) => {
      const seen = new Set<string>(current.map(u => u?.origin?.outpoint || u?.outpoint || (u?.txid && typeof u?.vout !== 'undefined' ? `${u.txid}_${u.vout}` : '')));
      const merged = [...current];
      for (const u of incoming) {
        const key = u?.origin?.outpoint || u?.outpoint || (u?.txid && typeof u?.vout !== 'undefined' ? `${u.txid}_${u.vout}` : Math.random().toString());
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(u);
        }
      }
      return merged;
    };

    (async () => {
      try {
        let ordOkLocal: any[] = [];
        let bsvOkLocal: any[] = [];
        let walletOrdinalsLocal: any[] = [];

        // QUICK VIEW: Fetch from gorillapool API for ord address (limited)
        if (ord) {
          console.log(`Quick View - Fetching ord address (limit: ${QUICK_VIEW_LIMIT})...`);
          ordOkLocal = await fetchPage(ord, QUICK_VIEW_LIMIT);
          console.log(`Quick View - ord address: ${ordOkLocal.length} items`);
        }

        // QUICK VIEW: Fetch from gorillapool API for bsv address (limited)
        if (bsv && bsv !== ord) {
          console.log(`Quick View - Fetching bsv address (limit: ${QUICK_VIEW_LIMIT})...`);
          bsvOkLocal = await fetchPage(bsv, QUICK_VIEW_LIMIT);
          console.log(`Quick View - bsv address: ${bsvOkLocal.length} items`);
        }

        // Fetch ordinals directly from wallet (with timeout to prevent hanging)
        try {
          if (wallet && typeof wallet.getOrdinals === 'function') {
            // Wrap wallet call with 5 second timeout - wallet can hang with large collections
            const walletOrdinalsPromise = wallet.getOrdinals();
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Wallet getOrdinals timeout')), 5000)
            );
            const walletOrdinals = await Promise.race([walletOrdinalsPromise, timeoutPromise]) as any[];
            if (Array.isArray(walletOrdinals) && walletOrdinals.length > 0) {
                // Transform wallet ordinals to match gorillapool format
              walletOrdinalsLocal = walletOrdinals.map((ordinal: any) => {
                // Wallet ordinals might have different structure, try to normalize
                const outpoint = ordinal.outpoint || ordinal.origin?.outpoint || 
                  (ordinal.txid && typeof ordinal.vout !== 'undefined' ? `${ordinal.txid}_${ordinal.vout}` : null);
                
                if (!outpoint) return null;

                // Preserve all data structures - collectibles have map data with subTypeData
                // Structure: origin.data.map = { name, subTypeData: { collectionId }, ... }
                const existingOriginData = ordinal.origin?.data || {};
                const existingData = ordinal.data || {};
                
                // Get map data from multiple possible locations, preserving nested structure
                const mapFromOrigin = existingOriginData.map;
                const mapFromData = existingData.map;
                const mapFromTop = ordinal.map;
                const mapFromOriginTop = ordinal.origin?.map;
                
                // Use the most complete map data (prefer origin.data.map as it's the standard)
                const finalMapData = (mapFromOrigin && Object.keys(mapFromOrigin).length > 0)
                  ? mapFromOrigin
                  : (mapFromData && Object.keys(mapFromData).length > 0)
                  ? mapFromData
                  : (mapFromTop && Object.keys(mapFromTop).length > 0)
                  ? mapFromTop
                  : mapFromOriginTop || {};

                // Build the transformed ordinal, ensuring map data is preserved
                const transformed = {
                  origin: {
                    ...(ordinal.origin || {}),
                    outpoint: ordinal.origin?.outpoint || outpoint,
                    data: {
                      ...existingOriginData,
                      map: finalMapData // Preserve map with subTypeData structure
                    }
                  },
                  outpoint: ordinal.outpoint || outpoint,
                  txid: ordinal.txid,
                  vout: ordinal.vout,
                  data: {
                    ...existingData,
                    map: finalMapData // Also preserve in data
                  },
                  map: finalMapData, // Also include at top level for easier access
                  // Include other fields from original, but don't overwrite what we've set
                  ...Object.fromEntries(
                    Object.entries(ordinal).filter(([key]) => 
                      !['origin', 'data', 'map', 'outpoint', 'txid', 'vout'].includes(key)
                    )
                  )
                };
                
                return transformed;
              }).filter((item: any) => item !== null);
            }
          }
        } catch (walletError) {
          console.log('Error fetching ordinals from wallet:', walletError);
          // Continue with API ordinals even if wallet fetch fails
        }

        // Mark addresses as fetched
        if (ord) fetchedAddressesRef.current.add(ord);
        if (bsv && bsv !== ord) fetchedAddressesRef.current.add(bsv);

        // Merge new ordinals with accumulated ones (deduplication)
        const seenInit = new Set<string>();
        // First add all existing accumulated ordinals
        for (const u of accumulatedOrdinalsRef.current) {
          const key = u?.origin?.outpoint || u?.outpoint || (u?.txid && typeof u?.vout !== 'undefined' ? `${u.txid}_${u.vout}` : null);
          if (key) seenInit.add(key);
        }

        // Then add new ordinals that aren't duplicates
        const newOrdinals = ([] as any[]).concat(ordOkLocal, bsvOkLocal, walletOrdinalsLocal);
        const uniqueNew = newOrdinals.filter((u: any) => {
          const key = u?.origin?.outpoint || u?.outpoint || (u?.txid && typeof u?.vout !== 'undefined' ? `${u.txid}_${u.vout}` : null);
          if (!key) return false;
          if (seenInit.has(key)) return false;
          seenInit.add(key);
          return true;
        });

        // Accumulate: existing + new unique
        const mergedOrdinals = [...accumulatedOrdinalsRef.current, ...uniqueNew];
        accumulatedOrdinalsRef.current = mergedOrdinals;

        console.log(`Merged ordinals: ${ordOkLocal.length} from ord API, ${bsvOkLocal.length} from bsv API, ${walletOrdinalsLocal.length} from wallet, ${uniqueNew.length} new unique, ${mergedOrdinals.length} total accumulated`);

        // Determine if we're in quick view mode (either address hit the limit)
        const hitOrdLimit = ordOkLocal.length >= QUICK_VIEW_LIMIT;
        const hitBsvLimit = bsvOkLocal.length >= QUICK_VIEW_LIMIT;
        if (hitOrdLimit || hitBsvLimit) {
          console.log(`Quick View mode active - ord hit limit: ${hitOrdLimit}, bsv hit limit: ${hitBsvLimit}`);
          setIsQuickView(true);
        } else {
          // Got all ordinals, no need for quick view
          setIsQuickView(false);
        }

        setOrdinalsString(JSON.stringify(mergedOrdinals));
        setLoaded(true);
      } catch (error) {
        console.log(error);
        setLoaded(false);
      }
    })();
  }, [ordaddress, bsvaddress, isOpen, wallet, addresses, addressLookupComplete]);

  // Handle fox selection from Filters component
  const handleFoxSelected = (foxData: any) => {
    onFoxSelected(foxData);
    onClose();
  };

  // Fetch full ordinals (no limit) - called when user clicks "Load All Foxes"
  const fetchFullOrdinals = async () => {
    if (isFetchingFull) return;
    setIsFetchingFull(true);

    const ord = ordaddress?.trim();
    const bsv = bsvaddress?.trim();
    const FULL_LIMIT = 500000;

    const fetchPageFull = async (addr: string, maxRetries = 3): Promise<any[]> => {
      const url = "https://ordinals.gorillapool.io/api/txos/address/" + addr + "/unspent?limit=" + FULL_LIMIT;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for full fetch

        try {
          const res = await fetch(url, {
            method: "GET",
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          const data = await res.json();
          return data && !data?.message && Array.isArray(data) ? data : [];
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error?.name === 'AbortError') {
            console.error('Full fetch timed out for:', addr);
            return [];
          }
          const isNetworkError = error?.message?.includes('Failed to fetch') || error?.message?.includes('network');
          if (isNetworkError && attempt < maxRetries) {
            console.log(`Network error, retrying full fetch... (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          } else {
            console.error('Error fetching full ordinals:', error);
            return [];
          }
        }
      }
      return [];
    };

    try {
      let ordOkLocal: any[] = [];
      let bsvOkLocal: any[] = [];

      // Fetch full ordinals from ord address
      if (ord) {
        console.log('Fetching full ordinals for ord address...');
        ordOkLocal = await fetchPageFull(ord);
        console.log(`Full fetch - ord address: ${ordOkLocal.length} items`);
      }

      // Fetch full ordinals from bsv address (if different)
      if (bsv && bsv !== ord) {
        console.log('Fetching full ordinals for bsv address...');
        bsvOkLocal = await fetchPageFull(bsv);
        console.log(`Full fetch - bsv address: ${bsvOkLocal.length} items`);
      }

      // Merge with existing ordinals (keep existing on top, add new at bottom)
      const existingOrdinals = accumulatedOrdinalsRef.current;
      const seen = new Set<string>();
      const merged: any[] = [];

      // Add existing first (keep on top)
      for (const u of existingOrdinals) {
        const key = u?.origin?.outpoint || u?.outpoint || (u?.txid && typeof u?.vout !== 'undefined' ? `${u.txid}_${u.vout}` : null);
        if (key && !seen.has(key)) {
          seen.add(key);
          merged.push(u);
        }
      }

      // Add new from full fetch (only items not already present)
      const newOrdinals = ([] as any[]).concat(ordOkLocal, bsvOkLocal);
      for (const u of newOrdinals) {
        const key = u?.origin?.outpoint || u?.outpoint || (u?.txid && typeof u?.vout !== 'undefined' ? `${u.txid}_${u.vout}` : null);
        if (key && !seen.has(key)) {
          seen.add(key);
          merged.push(u);
        }
      }

      console.log(`Full fetch merged: ${existingOrdinals.length} existing + ${merged.length - existingOrdinals.length} new = ${merged.length} total`);

      accumulatedOrdinalsRef.current = merged;
      setOrdinalsString(JSON.stringify(merged));
      setIsQuickView(false);
    } catch (error) {
      console.error('Error in fetchFullOrdinals:', error);
    } finally {
      setIsFetchingFull(false);
    }
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      const canReadWalletAddresses = wallet && typeof wallet.getAddresses === 'function';

      // Reset all state when modal opens to ensure fresh start
      setLoaded(false);
      setOrdinalsString(undefined);
      setOrdAddress(ownerAddress);
      setBsvAddress(undefined);
      setMyOrdAddress(ownerAddress);
      setAddresses(undefined);
      setAddressLookupComplete(Boolean(ownerAddress) || !canReadWalletAddresses);
      // Reset Quick View state
      setIsQuickView(true);
      setIsFetchingFull(false);
      // Reset refs to allow effects to run again
      didMount1.current = false;
      didMount2.current = false;
      fetchedAddressesRef.current = new Set();
      accumulatedOrdinalsRef.current = [];
      // Clear any pending timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else {
      // Clean up when modal closes
      setLoaded(false);
      setOrdinalsString(undefined);
      setOrdAddress(undefined);
      setBsvAddress(undefined);
      setMyOrdAddress(undefined);
      setAddresses(undefined);
      setAddressLookupComplete(false);
      // Reset Quick View state
      setIsQuickView(true);
      setIsFetchingFull(false);
      // Reset refs
      didMount1.current = false;
      didMount2.current = false;
      fetchedAddressesRef.current = new Set();
      accumulatedOrdinalsRef.current = [];
      // Clear any pending timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [isOpen, ownerAddress]);

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
              
              <Filters
                ordinalsstring={ordinalsstring}
                myordinalsaddress={myordaddress}
                onFoxSelected={handleFoxSelected}
                isQuickView={isQuickView}
                isFetchingFull={isFetchingFull}
                onFetchFullOrdinals={fetchFullOrdinals}
              />
              
              <FooterHome />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
