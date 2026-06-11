import { useState, useEffect, useRef } from "react";
import { ShowMoreButton } from "../../components/ShowMoreButton";
import { PulseLoader } from 'react-spinners';
import { Button } from '@mui/material';
import { useNavigate } from "react-router-dom";
import { getOrdinalContentUrl, getOrdinalInscriptionUrl } from "../../racing/transactions/ordinalLinks";

type SearchResultsProps = {
  myordinalsaddress: string,
  todisplay: string,
  background: string,
  name: string,
  body: string,
  mouth: string,
  head: string,
  eyes: string,
  item: string,
  totalresults: number,
  clearFilters: () => void,
  passedFunctionFromFilters: () => void,
  setsearchloading: boolean,
  walletSaladCount: number,
  walletBlueberryCount: number,
  walletRabbitCount: number,
  onFoxSelected?: (foxData: {
    originoutpoint: string;
    outpoint: string;
    owneraddress: string;
    foxes: number;
    foxname: string;
    walletSaladCount?: number;
    walletBlueberryCount?: number;
    walletRabbitCount?: number;
    traits?: {
      background: string;
      fox: string;
      body: string;
      mouth: string;
      headItem: string;
      eyes: string;
      item: string;
    };
  }) => void;
  filtersLoading?: boolean;
  highlightedFoxOutpoints?: string[]; // Foxes shown with gold outline
}

type ToDisplay = {
  name: string;
  link: string;
  img: string;
  imgid: string;
  owner: string;
  ownertrimmed: string;
  ownerlink: string;
  trait1: string;
  trait2: string;
  trait3: string;
  trait4: string;
  trait5: string;
  trait6: string;
  trait7: string;
  outpoint: string;
}

const SearchResults = ({ setsearchloading, passedFunctionFromFilters, clearFilters, myordinalsaddress, todisplay, background, name, body, mouth, head, eyes, item, totalresults, walletSaladCount, walletBlueberryCount, walletRabbitCount, onFoxSelected, filtersLoading, highlightedFoxOutpoints }: SearchResultsProps) => {

  //loading for results
  const [loading, setLoading] = useState<boolean>(true);

  //display show more
  const [displayshowmore, setDisplayShowMore] = useState<boolean>(true);

  // Message to display (e.g., "no foxes" message)
  const [infoMessage, setInfoMessage] = useState<string>("");

  // use navigate
  const navigate = useNavigate();

  //setnumresults
  const [foxresults, setFoxResults] = useState<number>(100);
  const [numresults, setNumResults] = useState<number | string>("?");

  // foxes to map
  const [displayfaucetfoxes, setDisplayFaucetFoxes] = useState<ToDisplay[]>([]);

  const addElement = (newElement) => {
    let c = [...displayfaucetfoxes, ...newElement];
    setDisplayFaucetFoxes(c);
  };

  // Track if initial data load has completed (prevents premature "no foxes" message)
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false);
  const initialLoadTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Set initialLoadComplete after a short delay to prevent premature "no foxes" message
  useEffect(() => {
    if (initialLoadTimerRef.current) {
      clearTimeout(initialLoadTimerRef.current);
    }

    setInitialLoadComplete(false);

    // Start once we have data to process, including an empty result array.
    if (todisplay && todisplay !== "") {
      initialLoadTimerRef.current = setTimeout(() => {
        setInitialLoadComplete(true);
      }, 1500);
    }

    return () => {
      if (initialLoadTimerRef.current) {
        clearTimeout(initialLoadTimerRef.current);
      }
    };
  }, [todisplay]);
  
  // Track submitted txids to avoid duplicate API calls
  const submittedTxidsRef = useRef<Set<string>>(new Set());
  // Track retry attempts per outpoint to prevent infinite loops
  const retryAttemptsRef = useRef<Map<string, number>>(new Map());
  const MAX_RETRY_ATTEMPTS = 2; // Maximum number of retries per image

  // Function to extract txid from outpoint (format: txid_vout)
  const extractTxid = (outpoint: string): string | null => {
    if (!outpoint) return null;
    const parts = outpoint.split('_');
    return parts[0] || null;
  };

  // Function to submit txid to gorillapool
  const submitTxidToGorillapool = async (txid: string): Promise<void> => {
    if (!txid || submittedTxidsRef.current.has(txid)) {
      return; // Already submitted or invalid
    }
    
    submittedTxidsRef.current.add(txid);
    
    try {
      const response = await fetch(`https://ordinals.gorillapool.io/api/tx/${txid}/submit`, {
        method: 'POST',
        headers: {
          'accept': '*/*'
        }
      });
      
      if (response.status === 204 || response.ok) {
        console.log(`✅ Submitted txid to gorillapool: ${txid}`);
      } else {
        console.warn(`⚠️ Gorillapool submission returned status ${response.status} for txid: ${txid}`);
      }
    } catch (error) {
      console.error(`❌ Error submitting txid ${txid} to gorillapool:`, error);
      // Remove from set so it can be retried
      submittedTxidsRef.current.delete(txid);
    }
  };

  // Handle image load error - submit txid to gorillapool and retry image (with retry limit)
  const handleImageError = async (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const imgElement = e.currentTarget;
    const outpoint = imgElement.id || imgElement.getAttribute('data-outpoint');
    
    if (!outpoint) {
      console.warn('No outpoint found for failed image');
      return;
    }
    
    // Check retry attempts for this specific outpoint
    const currentAttempts = retryAttemptsRef.current.get(outpoint) || 0;
    
    if (currentAttempts >= MAX_RETRY_ATTEMPTS) {
      console.warn(`⚠️ Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached for outpoint ${outpoint}, stopping retries`);
      return; // Stop retrying this image
    }
    
    // Increment retry count
    retryAttemptsRef.current.set(outpoint, currentAttempts + 1);
    
    const txid = extractTxid(outpoint);
    if (!txid) {
      console.warn('Could not extract txid from outpoint:', outpoint);
      return;
    }
    
    // Only submit to gorillapool on first attempt (to avoid duplicate submissions)
    if (currentAttempts === 0) {
      console.log(`🔄 Image failed to load for outpoint ${outpoint}, submitting txid ${txid} to gorillapool...`);
      await submitTxidToGorillapool(txid);
    } else {
      console.log(`🔄 Retry attempt ${currentAttempts + 1}/${MAX_RETRY_ATTEMPTS} for outpoint ${outpoint}`);
    }
    
    // Retry loading the image after a short delay (only if under max attempts)
    if (currentAttempts + 1 < MAX_RETRY_ATTEMPTS) {
      setTimeout(() => {
        const originalSrc = imgElement.src;
        // Force reload by clearing src first
        imgElement.src = '';
        setTimeout(() => {
          imgElement.src = originalSrc;
        }, 100);
      }, 2000); // Wait 2 seconds for gorillapool to process
    }
  };

  //resetLoading
  const resetLoading = () => {
    clearFilters()
  };



  //get action
  const pickFox = (e) => {
    const foxData = {
      originoutpoint: e.currentTarget.getAttribute("data-imgid") || "",
      outpoint: e.currentTarget.getAttribute("data-outpoint") || "",
      owneraddress: e.currentTarget.getAttribute("data-owner") || myordinalsaddress || "",
      foxes: totalresults,
      foxname: e.currentTarget.getAttribute("data-name") || "",
      walletSaladCount,
      walletBlueberryCount,
      walletRabbitCount,
      traits: {
        background: e.currentTarget.getAttribute("data-trait-background") || "",
        fox: e.currentTarget.getAttribute("data-trait-fox") || "",
        body: e.currentTarget.getAttribute("data-trait-body") || "",
        mouth: e.currentTarget.getAttribute("data-trait-mouth") || "",
        headItem: e.currentTarget.getAttribute("data-trait-head") || "",
        eyes: e.currentTarget.getAttribute("data-trait-eyes") || "",
        item: e.currentTarget.getAttribute("data-trait-item") || ""
      }
    };

    if (onFoxSelected) {
      onFoxSelected(foxData);
    } else {
      navigate("/pixelforest", {
        state: foxData
      });
    }
  };




  //handle show more
  const showMore = () => {
    let rrr = todisplay;
    if (rrr) {
      let ppp = JSON.parse(rrr)!;
      let foxcount = (foxresults - 50);
      let d = 0;
      let displayfaucetfoxestemp = [];

      //show up to 50 more
      for (let i = (foxresults - 50); i < foxresults; i++) {
        if (ppp[i] !== undefined) if (ppp[i].origin.data.map.subTypeData.collectionId === "1611d956f397caa80b56bc148b4bce87b54f39b234aeca4668b4d5a7785eb9fa_0") {
          // fox
          displayfaucetfoxestemp[d] = { img: "", name: "" }
          displayfaucetfoxestemp[d].img = getOrdinalContentUrl(ppp[i].origin.outpoint);
          displayfaucetfoxestemp[d].name = ppp[i].origin.data.map.name;
          displayfaucetfoxestemp[d].link = getOrdinalInscriptionUrl(ppp[i].origin.outpoint);
          displayfaucetfoxestemp[d].imgid = ppp[i].origin.outpoint;
          displayfaucetfoxestemp[d].trait1 = ppp[i].origin.data.map.subTypeData.traits[0]?.value || ' ';
          displayfaucetfoxestemp[d].trait2 = ppp[i].origin.data.map.subTypeData.traits[1]?.value || ' ';
          displayfaucetfoxestemp[d].trait3 = ppp[i].origin.data.map.subTypeData.traits[2]?.value || ' ';
          displayfaucetfoxestemp[d].trait4 = ppp[i].origin.data.map.subTypeData.traits[3]?.value || ' ';
          displayfaucetfoxestemp[d].trait5 = ppp[i].origin.data.map.subTypeData.traits[4]?.value || ' ';
          displayfaucetfoxestemp[d].trait6 = ppp[i].origin.data.map.subTypeData.traits[5]?.value || ' ';
          displayfaucetfoxestemp[d].trait7 = ppp[i].origin.data.map.subTypeData.traits[6]?.value || ' ';
          displayfaucetfoxestemp[d].owner = ppp[i].owner;
          let own = ppp[i].owner;
          displayfaucetfoxestemp[d].ownerlink = "https://whatsonchain.com/address/" + own;
          displayfaucetfoxestemp[d].ownertrimmed = own.substring(0, 10) + "...";
          displayfaucetfoxestemp[d].outpoint = ppp[i].outpoint;
          d++;
          foxcount++;
        }
      }
      addElement(displayfaucetfoxestemp)

      //hide if no more foxes or add more foxes
      if (foxcount - foxresults < 0) {
        // console.log(foxcount -foxresults)
        setDisplayShowMore(false)
      } else {
        setFoxResults(foxresults + 50)
      }
    }
  };

  // Track displayed fox IDs to avoid duplicates when new foxes load
  const displayedFoxIdsRef = useRef<Set<string>>(new Set());
  // Track previous filter values to detect filter changes
  const prevFiltersRef = useRef<string>('');
  // Track previous todisplay to detect when filtered results actually change
  const prevTodisplayRef = useRef<string>('');

  useEffect(
    () => {
      // Clear any previous message
      setInfoMessage("");

      let rrr = todisplay;

      // Show loader if todisplay is empty (still waiting for filtered results)
      if (!rrr || rrr === "") {
        setLoading(true);
        return;
      }

      if (rrr) {
        let ppp = JSON.parse(rrr)!;

        // Check if filters changed - if so, we need to replace the list, not append
        const currentFilters = `${background}|${name}|${body}|${mouth}|${head}|${eyes}|${item}`;
        const filtersChanged = prevFiltersRef.current !== '' && prevFiltersRef.current !== currentFilters;
        prevFiltersRef.current = currentFilters;

        // Check if todisplay content actually changed
        const todisplayChanged = prevTodisplayRef.current !== rrr;
        prevTodisplayRef.current = rrr;

        // If filters changed but todisplay hasn't updated yet, show loader and skip processing
        // This prevents showing stale results while waiting for handleChange() to filter
        if (filtersChanged && !todisplayChanged) {
          // Filters changed but todisplay is stale - show loader and wait for the correct todisplay
          setLoading(true);
          return;
        }

        // If filters changed (and todisplay is now correct), or if todisplay changed, clear tracking
        if (filtersChanged || todisplayChanged) {
          displayedFoxIdsRef.current.clear();
        }

        // First, get total count for all foxes
        let foxcount = 0;
        let foxlength = ppp.length;
        //get total length
        for (let i = 0; i < foxlength; i++) {
          if (ppp[i] !== undefined) if (ppp[i].origin.data.map.subTypeData.collectionId === "1611d956f397caa80b56bc148b4bce87b54f39b234aeca4668b4d5a7785eb9fa_0") {
            foxcount++;
          }
        }
        setNumResults(foxcount);

        // Build new foxes list, only adding foxes we haven't displayed yet
        let newFoxes: ToDisplay[] = [];
        let displayedCount = 0;
        const maxToShow = 100;

        for (let i = 0; i < ppp.length && displayedCount < maxToShow; i++) {
          if (ppp[i] !== undefined && ppp[i].origin?.data?.map?.subTypeData?.collectionId === "1611d956f397caa80b56bc148b4bce87b54f39b234aeca4668b4d5a7785eb9fa_0") {
            const foxId = ppp[i].origin.outpoint;

            // Only add if not already displayed
            if (!displayedFoxIdsRef.current.has(foxId)) {
              displayedFoxIdsRef.current.add(foxId);
              const own = ppp[i].owner || '';
              newFoxes.push({
                img: getOrdinalContentUrl(ppp[i].origin.outpoint),
                name: ppp[i].origin.data.map.name,
                link: getOrdinalInscriptionUrl(ppp[i].origin.outpoint),
                imgid: ppp[i].origin.outpoint,
                trait1: ppp[i].origin.data.map.subTypeData.traits[0]?.value || ' ',
                trait2: ppp[i].origin.data.map.subTypeData.traits[1]?.value || ' ',
                trait3: ppp[i].origin.data.map.subTypeData.traits[2]?.value || ' ',
                trait4: ppp[i].origin.data.map.subTypeData.traits[3]?.value || ' ',
                trait5: ppp[i].origin.data.map.subTypeData.traits[4]?.value || ' ',
                trait6: ppp[i].origin.data.map.subTypeData.traits[5]?.value || ' ',
                trait7: ppp[i].origin.data.map.subTypeData.traits[6]?.value || ' ',
                owner: own,
                ownerlink: "https://whatsonchain.com/address/" + own,
                ownertrimmed: own.substring(0, 10) + "...",
                outpoint: ppp[i].outpoint
              });
            }
            displayedCount++;
          }
        }

        // Update display: replace if filters or todisplay changed, append if just new data
        if (filtersChanged || todisplayChanged) {
          // Replace entire list in one operation (no intermediate empty state)
          setDisplayFaucetFoxes(newFoxes);
          setFoxResults(100);
        } else if (newFoxes.length > 0) {
          // Append new foxes to existing list
          setDisplayFaucetFoxes(prev => [...prev, ...newFoxes]);
        }
        
        //show/hide display more as necessary
        if ((foxcount - 50) > 0) {
          setDisplayShowMore(true)
        } else {
          setDisplayShowMore(false)
        }

        //no foxes message
        if (foxcount === 0) {
          if (initialLoadComplete) {
            if ((background === "all") && (name === "all") && (body === "all") && (mouth === "all") && (head === "all") && (eyes === "all") && (item === "all")) {
              setInfoMessage("You don't have any foxes in your wallet.");
            } else {
              setInfoMessage(`You don't have any Foxes with these attributes:\n\nBackground: ${background}\nFox: ${name}\nBody: ${body}\nMouth: ${mouth}\nHead Item: ${head}\nEyes: ${eyes}\nItem: ${item}`);
            }
          }
        }
        setLoading(false)
      }
      // else: todisplay is "" (not yet set) - keep loading state, waiting for data


    },
    [todisplay, background, name, body, mouth, head, eyes, item, totalresults, initialLoadComplete] // with dependency: run every time variable changes
  )




  // Combined loading state - show loader if:
  // 1. Our own loading state is true
  // 2. OR filters are still processing
  // 3. OR no foxes displayed yet AND (totalresults > 0 means foxes are coming, OR initial load not complete)
  const hasNoFoxesToShow = displayfaucetfoxes.length === 0;
  const hasEmptyResultMessage = infoMessage.length > 0;
  const userHasFoxes = totalresults > 0;
  const isLoading = loading || filtersLoading || (!hasEmptyResultMessage && hasNoFoxesToShow && (userHasFoxes || !initialLoadComplete));

  return (
    <>
      {/* Show centered loader while loading */}
      {isLoading && (
        <div className="PixelRacingResults">
          <div className="CenterLoader" style={{ padding: '40px 0' }}>
            <PulseLoader color="#ffffff" />
          </div>
        </div>
      )}

      {/* Show content only when not loading */}
      {!isLoading && (
        <>
          <div className="H3Wrapper">
            <h3>Results: {numresults} / {totalresults}</h3>
          </div>
          <div className="PixelRacingResults">
            <ul id="image-container">
              {displayfaucetfoxes &&

                <>

                  {displayfaucetfoxes.map(function (data) {
                    const isHighlightedFox = highlightedFoxOutpoints?.includes(data.imgid);
                    return (
                      <li key={data.imgid} style={isHighlightedFox ? {
                        border: '3px solid #d4af37',
                        borderRadius: '8px',
                        boxShadow: '0 0 12px rgba(212, 175, 55, 0.6)',
                        padding: '8px',
                        backgroundColor: 'rgba(212, 175, 55, 0.1)'
                      } : undefined}><a target="blank"
                        href={data.link}>
                        <img src={data.img}
                          className="seventraitfoxes"
                          id={data.imgid}
                          alt={data.name}
                          onError={handleImageError} />
                      </a>
                      <br />

                        <span className="TwinName"><a target="blank"
                          href={data.link}>{data.name}</a>
                        </span>
                        <div className="ResultsTraits">{data.trait1}<br />{data.trait2}<br />{data.trait3}<br />{data.trait4}<br />{data.trait5}<br />{data.trait6}<br />{data.trait7}</div>

                          <Button className="ButtonPadded" variant="contained" data-name={data.name} data-imgid={data.imgid} data-outpoint={data.outpoint} data-owner={data.owner} data-trait-background={data.trait1} data-trait-fox={data.trait2} data-trait-body={data.trait3} data-trait-mouth={data.trait4} data-trait-head={data.trait5} data-trait-eyes={data.trait6} data-trait-item={data.trait7} onClick={pickFox} sx={{ color: "#fefefe" }}>Play Now</Button>

                      </li>
                    )
                  })}

                </>
              }
            </ul>
            {infoMessage && (
              <p className="InfoMessage" style={{ color: '#ffffff', textAlign: 'center', padding: '10px', whiteSpace: 'pre-line' }}>
                {infoMessage}
              </p>
            )}
            {displayshowmore && (
              <>
                <div id="ShowMore">
                  <ShowMoreButton onClick={showMore} />
                </div>
              </>
            )}

            <button className="WhiteClear" type="button" onClick={resetLoading} style={{ background: 'none', border: 0, padding: 0 }}>
              <u>Reset Filters</u>
            </button>
            {setsearchloading && (
              <>
                <span className="ResetLoaderCenter">
                  <PulseLoader color="#ffffff" />
                </span>
              </>
            )}
            <br />
          </div>
        </>
      )}

        </>

  )
};

export default SearchResults;
