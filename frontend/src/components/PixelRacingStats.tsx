import { useState, useEffect, useRef, memo } from "react";
import { PulseLoader } from "react-spinners";
import _ from 'underscore';
import { ShowMoreActivityButton } from "./ShowMoreActivityButton";
import { PixelRacingGameResult } from "./foxracing/types";
import { getOrdinalInscriptionUrl, getWhatsOnChainTransactionUrl } from "../racing/transactions/ordinalLinks";
import { getOutpointTxid } from "../racing/transactions/ordinalOutpoint";
import { formatShortAddress } from "../racing/components/addressFormat";
import {
  getPixelRacingStatsTrackName,
  getPixelRacingStatsTrackNames,
  getPixelRacingStatsTrackTabId,
  groupPixelRacingResultsByStatsTrack,
  PIXEL_RACING_CHAMPIONSHIP_TAB_ID,
  PIXEL_RACING_MULTIPLAYER_TAB_ID
} from "../racing/stats/pixelRacingStatsTracks";
import {
  getPixelRacingStandingKey,
} from "../racing/stats/pixelRacingStatsPrivacy";
import {
  CURRENT_PIXELRACING_RESULT_QUERIES,
  fetchPixelRacingResults,
  LEGACY_PIXELRACING_RESULT_QUERIES,
} from "../racing/stats/pixelRacingResults";
import { fetchCompletedScheduledRaces } from "../racing/scheduled/scheduledRaceApi";
import { buildScheduledRaceFinalStatsRow, buildScheduledRaceLapStatsRows } from "../racing/scheduled/scheduledRaceStats";

type PixelRacingStatsProps = {
  latestactivity: PixelRacingGameResult | null;
  userOrdinalAddress?: string | null;
  customTitle?: string;
  renderBeforeLeaderboard?: React.ReactNode;
  transactionServerUrl?: string;
}

// Driver Championship Types
interface TrackStat {
  bestLapTime: number;
  position: number;
  points: number;
  totalRaces: number;
  bestFoxName: string;
  bestFoxImage: string;
  bestFoxInfo: string;
  bestOutpoint: string;
  bestOriginOutpoint: string;
}

interface DriverStats {
  address: string;
  identityKind: 'owner-address' | 'fox-origin';
  totalPoints: number;
  trackStats: { [trackName: string]: TrackStat };
  positionCounts: { [position: number]: number };
  totalRaces: number;
  totalPodiums: number;
  totalWins: number;
  pointsFinishes: number;
  foxNames: string[];
  primaryFoxName: string;
  primaryFoxImage: string;
  primaryFoxOriginOutpoint: string;
}

// Championship points (top 10 positions)
const CHAMPIONSHIP_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const TRACK_ICON_BY_NAME: Record<string, string> = {
  'San Luis': '🏁',
  Australia: '🦘',
  Belgium: '🇧🇪',
  'United Kingdom': '🇬🇧',
  Germany: '🇩🇪',
  Aspen: '🏔️',
  Volcanoes: '🌋'
};

// Compute driver championship standings from all race data
const computeDriverChampionship = (allGames: PixelRacingGameResult[]): DriverStats[] => {
  const trackNames = getPixelRacingStatsTrackNames(allGames);
  // Group games by track
  const gamesByTrack = groupPixelRacingResultsByStatsTrack(allGames);

  // For each track, find best time per driver and count their races
  const driverBestByTrack: {
    [track: string]: {
      [address: string]: PixelRacingGameResult & { raceCount: number }
    }
  } = {};

  for (const track of trackNames) {
    driverBestByTrack[track] = {};
    const trackGames = gamesByTrack[track] ?? [];

    for (const game of trackGames) {
      const addr = getPixelRacingStandingKey(game);
      if (!addr) continue;

      const existing = driverBestByTrack[track][addr];
      if (!existing) {
        driverBestByTrack[track][addr] = { ...game, raceCount: 1 };
      } else {
        existing.raceCount++;
        // Keep the faster lap time
        if (Number(game.laptime) < Number(existing.laptime)) {
          const raceCount = existing.raceCount;
          driverBestByTrack[track][addr] = { ...game, raceCount };
        }
      }
    }
  }

  // Rank drivers per track and assign championship points
  const driverPointsByTrack: {
    [track: string]: {
      address: string;
      position: number;
      points: number;
      data: PixelRacingGameResult & { raceCount: number }
    }[]
  } = {};

  for (const track of trackNames) {
    const drivers = Object.entries(driverBestByTrack[track])
      .map(([address, data]) => ({ address, data }))
      .sort((a, b) => Number(a.data.laptime) - Number(b.data.laptime));

    driverPointsByTrack[track] = drivers.map((d, index) => ({
      address: d.address,
      position: index + 1,
      points: CHAMPIONSHIP_POINTS[index] || 0,
      data: d.data
    }));
  }

  // Aggregate into final driver stats
  const driverStatsMap: { [address: string]: DriverStats } = {};

  for (const track of trackNames) {
    for (const entry of driverPointsByTrack[track]) {
      if (!driverStatsMap[entry.address]) {
        driverStatsMap[entry.address] = {
          address: entry.address,
          identityKind: entry.data.recordVersion && entry.data.recordVersion >= 2
            ? 'fox-origin'
            : 'owner-address',
          totalPoints: 0,
          trackStats: {},
          positionCounts: {},
          totalRaces: 0,
          totalPodiums: 0,
          totalWins: 0,
          pointsFinishes: 0,
          foxNames: [],
          primaryFoxName: '',
          primaryFoxImage: '',
          primaryFoxOriginOutpoint: ''
        };
      }

      const driver = driverStatsMap[entry.address];
      driver.totalPoints += entry.points;
      driver.totalRaces += entry.data.raceCount;

      if (entry.position <= 3) driver.totalPodiums++;
      if (entry.position === 1) driver.totalWins++;
      if (entry.points > 0) driver.pointsFinishes++;

      // Track position counts (1st, 2nd, 3rd, etc.)
      driver.positionCounts[entry.position] = (driver.positionCounts[entry.position] || 0) + 1;

      driver.trackStats[track] = {
        bestLapTime: Number(entry.data.laptime),
        position: entry.position,
        points: entry.points,
        totalRaces: entry.data.raceCount,
        bestFoxName: entry.data.foxname,
        bestFoxImage: entry.data.foximagelink,
        bestFoxInfo: entry.data.foxinfolink,
        bestOutpoint: entry.data.outpoint,
        bestOriginOutpoint: entry.data.originoutpoint
      };

      if (!driver.foxNames.includes(entry.data.foxname)) {
        driver.foxNames.push(entry.data.foxname);
      }

      // Set primary fox to the one with best overall position
      const currentBestPosition = driver.primaryFoxName
        ? Math.min(...Object.values(driver.trackStats)
            .filter(ts => ts.bestFoxName === driver.primaryFoxName)
            .map(ts => ts.position))
        : Infinity;

      if (entry.position < currentBestPosition) {
        driver.primaryFoxName = entry.data.foxname;
        driver.primaryFoxImage = entry.data.foxinfolink;
        driver.primaryFoxOriginOutpoint = entry.data.originoutpoint;
      }
    }
  }

  // Sort by total points, then wins, then podiums as tiebreakers
  return Object.values(driverStatsMap).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    if (b.totalPodiums !== a.totalPodiums) return b.totalPodiums - a.totalPodiums;
    return b.totalRaces - a.totalRaces;
  });
};

const formatLapTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00.000';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, '0')}`;
};

const processFetchedGames = (games: PixelRacingGameResult[]) => {
  const sortedHistory = _.sortBy(games, item => Number(item.time) || 0).reverse();

  return {
    sortedHistory,
    leaders: [...games].sort((a, b) => Number(a.laptime) - Number(b.laptime)),
    trackLeaderboards: groupPixelRacingResultsByStatsTrack(games),
    driverChampionship: computeDriverChampionship(games),
    gameCount: sortedHistory.length,
  };
};

const ACTIVITY_PAGE_SIZE = 5;

const PixelRacingStats = memo(function PixelRacingStats({ latestactivity, userOrdinalAddress, customTitle, renderBeforeLeaderboard, transactionServerUrl }: PixelRacingStatsProps) {
  const [liveActivity, setLiveActivity] = useState<PixelRacingGameResult[]>([]); // ONLY live items/games
  const [multiplayerRaceActivity, setMultiplayerRaceActivity] = useState<PixelRacingGameResult[]>([]);
  const [gameHistory, setGameHistory] = useState<PixelRacingGameResult[]>([]); // Fetched global games
  const [trackLeaderboards, setTrackLeaderboards] = useState<Record<string, PixelRacingGameResult[]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activityresults, setActivityResults] = useState<number>(ACTIVITY_PAGE_SIZE);
  const [historyResults, setHistoryResults] = useState<number>(ACTIVITY_PAGE_SIZE);
  const [displayshowmoreactivity, setDisplayShowMoreActivity] = useState<boolean>(false);
  const [displayshowmorehistory, setDisplayShowMoreHistory] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null); // Track fetch errors for retry UI
  const [retryCount, setRetryCount] = useState<number>(0); // Track retry attempts
  const [driverChampionship, setDriverChampionship] = useState<DriverStats[]>([]); // Driver standings
  const [expandedDrivers, setExpandedDrivers] = useState<Set<string>>(new Set()); // Expanded driver cards
  const [championshipDisplayCount, setChampionshipDisplayCount] = useState<number>(10); // Pagination
  const [activeTab, setActiveTab] = useState<string>(PIXEL_RACING_CHAMPIONSHIP_TAB_ID); // Track tabs
  const [canScrollLeft, setCanScrollLeft] = useState(false); // Track if can scroll left
  const [canScrollRight, setCanScrollRight] = useState(true); // Track if more tabs to scroll

  //useRefs
  const didMount = useRef(false);
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const hasFetchedHistory = useRef(false); // Track if history has been fetched
  const MAX_RETRIES = 3;
  const BASE_DELAY = 1000; // 1 second base delay for exponential backoff
  
  // Track submitted txids to avoid duplicate API calls
  const submittedTxidsRef = useRef<Set<string>>(new Set());
  // Track retry attempts per outpoint to prevent infinite loops
  const retryAttemptsRef = useRef<Map<string, number>>(new Map());
  const MAX_RETRY_ATTEMPTS = 2; // Maximum number of retries per image

  // Function to extract txid from outpoint (format: txid_vout)
  const extractTxid = (outpoint: string): string | null => {
    return getOutpointTxid(outpoint);
  };

  // Function to extract outpoint from URL (e.g., "https://ordfs.network/content/txid_vout")
  const extractOutpointFromUrl = (url: string): string | null => {
    if (!url) return null;
    // Extract the last part of the URL path (the outpoint)
    const match = url.match(/\/([^\/]+)$/);
    return match ? match[1] : null;
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

  // Handle image load error - retry first, only submit to gorillapool as last resort
  const handleImageError = async (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const imgElement = e.currentTarget;
    // Try to get outpoint from data attribute, id, or src URL
    const outpoint = imgElement.getAttribute('data-outpoint') ||
                    imgElement.id ||
                    extractOutpointFromUrl(imgElement.src);

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

    // Only submit to gorillapool on FINAL attempt (after simple retries have failed)
    // This avoids hammering the API for transient network errors
    if (currentAttempts + 1 >= MAX_RETRY_ATTEMPTS) {
      console.log(`🔄 Final retry for outpoint ${outpoint}, submitting txid ${txid} to gorillapool...`);
      await submitTxidToGorillapool(txid);
      // Give gorillapool time to process, then do one final retry
      setTimeout(() => {
        const originalSrc = imgElement.src;
        imgElement.src = '';
        setTimeout(() => {
          imgElement.src = originalSrc;
        }, 100);
      }, 3000);
    } else {
      // Simple retry without gorillapool submission (handles transient network errors)
      console.log(`🔄 Retry attempt ${currentAttempts + 1}/${MAX_RETRY_ATTEMPTS} for outpoint ${outpoint}`);
      setTimeout(() => {
        const originalSrc = imgElement.src;
        imgElement.src = '';
        setTimeout(() => {
          imgElement.src = originalSrc;
        }, 100);
      }, 1500); // Short delay for transient errors
    }
  };

  // Fetch function with retry logic
  const fetchHistoryWithRetry = async (attempt: number = 0): Promise<void> => {
    setIsLoading(true);
    setFetchError(null);

    try {
      const [uniqueHistoryGames, legacyHistoryGames] = await Promise.all([
        fetchPixelRacingResults(CURRENT_PIXELRACING_RESULT_QUERIES),
        fetchPixelRacingResults(LEGACY_PIXELRACING_RESULT_QUERIES),
      ]);
      const completedScheduledRaces = transactionServerUrl
        ? await fetchCompletedScheduledRaces({
          transactionServerUrl,
          limit: 12,
        })
          .catch(error => {
            console.warn('Scheduled race stats unavailable:', error);
            return [];
          })
        : [];
      const scheduledRaceLapRows = completedScheduledRaces.flatMap(buildScheduledRaceLapStatsRows);
      const scheduledRaceFinalRows = completedScheduledRaces
        .map(buildScheduledRaceFinalStatsRow)
        .filter((row): row is PixelRacingGameResult => Boolean(row));
      const allLapRows = [
        ...uniqueHistoryGames,
        ...legacyHistoryGames,
        ...scheduledRaceLapRows,
      ];
      const uniqueLapRows = Array.from(
        new Map(allLapRows.map(game => [game.txid || `${game.outpoint}_${game.time}`, game])).values()
      );
      const processed = processFetchedGames(uniqueLapRows);

      console.log(`Fetched ${uniqueHistoryGames.length} current history games, ${legacyHistoryGames.length} legacy history games, ${scheduledRaceLapRows.length} scheduled race lap rows, and ${scheduledRaceFinalRows.length} multiplayer race final transactions`);

      setGameHistory(processed.sortedHistory);
      setMultiplayerRaceActivity(_.sortBy(scheduledRaceFinalRows, item => Number(item.time) || 0).reverse());
      setHistoryResults(ACTIVITY_PAGE_SIZE);
      setDisplayShowMoreHistory(processed.sortedHistory.length > ACTIVITY_PAGE_SIZE);
      setTrackLeaderboards(processed.trackLeaderboards);
      setDriverChampionship(processed.driverChampionship);
      console.log(`Computed driver championship with ${processed.driverChampionship.length} drivers`);
      setIsLoading(false);
      setRetryCount(0); // Reset retry count on success
      setFetchError(null);

    } catch (err) {
      console.error(`Error fetching pixel racing stats (attempt ${attempt + 1}/${MAX_RETRIES}):`, err);

      if (attempt < MAX_RETRIES - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = BASE_DELAY * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        setRetryCount(attempt + 1);

        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchHistoryWithRetry(attempt + 1);
      } else {
        // All retries failed
        setIsLoading(false);
        setRetryCount(MAX_RETRIES);
        setFetchError('Failed to load racing stats. Please check your connection and try again.');
      }
    }
  };

  // Manual refresh function
  const handleManualRefresh = () => {
    hasFetchedHistory.current = false;
    setRetryCount(0);
    setFetchError(null);
    fetchHistoryWithRetry(0);
  };

  // Fetch GLOBAL HISTORY only (for History & Leaderboard sections)
  useEffect(() => {
    // Prevent duplicate fetches
    if (hasFetchedHistory.current) {
      console.log('PixelRacingStats: History already fetched, skipping duplicate fetch');
      return;
    }

    hasFetchedHistory.current = true;
    fetchHistoryWithRetry(0);
  }, []);

  // Handle LIVE updates (Latest Transactions)
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    if (!latestactivity || !latestactivity.txid) {
      console.log('PixelRacingStats: No latestactivity or txid', latestactivity);
      return;
    }

    console.log('PixelRacingStats: Received latestactivity', latestactivity.txid, latestactivity.itemType);

    // Add to LIVE feed (Items + Games) - check duplicate inside setter
    setLiveActivity(prev => {
        // Check for duplicate inside the setter to avoid stale closure
        if (prev.find(a => a.txid === latestactivity.txid)) {
          console.log('PixelRacingStats: Duplicate transaction, skipping', latestactivity.txid);
          return prev;
        }
        
        console.log('PixelRacingStats: Adding to liveActivity', latestactivity.txid);
        const updated = [latestactivity, ...prev];
        return _.sortBy(updated, item => Number(item.time) || 0).reverse();
    });
    
    // Completed multiplayer race inscriptions feed the Multiplayer Races section,
    // NOT the lap history/leaderboards: their `laptime` is the winner's total race
    // time, which would rank as a (terrible) single lap. The row shape matches what
    // a prod fetch (database, or gorillapool metadata search for
    // name = "multiplayer race") will produce, so this wiring survives the source swap.
    if (latestactivity.groupRaceFinal) {
      setMultiplayerRaceActivity(prev => {
        if (prev.find(a => a.txid === latestactivity.txid)) return prev;
        return _.sortBy([latestactivity, ...prev], item => Number(item.time) || 0).reverse();
      });
      return;
    }

    // If it's a GAME (lap completion, no itemType), also add to History/Leaderboard instantly
    if (!latestactivity.itemType) {
        setGameHistory(prev => {
            // Check for duplicate
            if (prev.find(a => a.txid === latestactivity.txid)) return prev;
            const updated = [latestactivity, ...prev];
            return _.sortBy(updated, item => Number(item.time) || 0).reverse();
        });
        const statsTrackName = getPixelRacingStatsTrackName(latestactivity);
        setTrackLeaderboards(prev => {
          const existing = prev[statsTrackName] ?? [];
          if (existing.find(a => a.txid === latestactivity.txid)) return prev;
          return {
            ...prev,
            [statsTrackName]: [...existing, latestactivity].sort((a, b) => Number(a.laptime) - Number(b.laptime))
          };
        });
    }
  }, [latestactivity]);

  // Helper to show more LIVE activity (local only)
  const showMoreActivity = () => {
      setActivityResults(prev => prev + ACTIVITY_PAGE_SIZE);
  };

  // Helper to show more HISTORY
  const showMoreHistory = () => {
      const newCount = historyResults + ACTIVITY_PAGE_SIZE;

      setHistoryResults(newCount);

      // Hide button if all items are shown
      if (newCount >= gameHistory.length) {
          setDisplayShowMoreHistory(false);
      }
  };

  // Recompute championship when gameHistory changes (for live updates)
  useEffect(() => {
    if (gameHistory.length > 0 && !isLoading) {
      const championshipData = computeDriverChampionship(gameHistory);
      setDriverChampionship(championshipData);
    }
  }, [gameHistory, isLoading]);

  // Toggle expanded driver card
  const toggleDriverExpanded = (address: string) => {
    setExpandedDrivers(prev => {
      const next = new Set(prev);
      if (next.has(address)) {
        next.delete(address);
      } else {
        next.add(address);
      }
      return next;
    });
  };

  // Show more championship drivers
  const showMoreChampionship = () => {
    setChampionshipDisplayCount(prev => prev + 10);
  };

  // Helper to get ordinal suffix (1st, 2nd, 3rd, etc.)
  const getOrdinalSuffix = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // Helper to get position badge color
  const getPositionColor = (position: number): string => {
    if (position === 1) return '#FFD700'; // Gold
    if (position === 2) return '#C0C0C0'; // Silver
    if (position === 3) return '#CD7F32'; // Bronze
    if (position <= 10) return '#36bffa'; // Points position
    return '#666'; // No points
  };

  const formatRaceDuration = (milliseconds?: number | null): string => {
    if (!milliseconds || !Number.isFinite(milliseconds)) return 'DNF';
    return formatLapTime(milliseconds / 1000);
  };

  const formatBestLap = (lapTimesMs: number[]): string => {
    if (!lapTimesMs.length) return 'No lap';
    return formatRaceDuration(Math.min(...lapTimesMs));
  };

  const getRaceEntrantPositionLabel = (finishPosition?: number | null, status?: string): string => {
    if (finishPosition) return getOrdinalSuffix(finishPosition);
    return status === 'dnf' ? 'DNF' : 'DNS';
  };

  const getRaceEntrantSortValue = (entrant: NonNullable<PixelRacingGameResult['groupRaceEntrants']>[number]): number => (
    entrant.finishPosition ?? (entrant.status === 'dnf' ? 9000 : 10000)
  );

  const styles = {
    section: {
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: '8px',
      marginBottom: '20px',
      maxWidth: '100%',
      margin: '0 auto',
      width: '100%',
      padding: '20px'
    },
    sectionTitle: {
      color: '#36bffa',
      textAlign: 'center' as const,
      marginTop: 0,
      marginBottom: '15px',
      marginLeft: 'auto',
      marginRight: 'auto',
      fontSize: '1.5em',
      width: '100%',
      padding: 0,
      display: 'block'
    },
    list: {
      listStyle: 'none',
      padding: 0,
      margin: 0,
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
      gap: '15px'
    },
    listItem: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '6px',
      padding: '10px',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      transition: 'transform 0.2s'
    },
    image: {
      width: '80px',
      height: '80px',
      borderRadius: '4px',
      marginBottom: '8px'
    },
    foxName: {
      color: 'white',
      fontWeight: 'bold',
      marginBottom: '4px'
    },
    address: {
      color: '#ccc',
      fontSize: '0.8em',
      marginBottom: '4px',
      wordBreak: 'break-all' as const
    },
    laptime: {
      color: '#4CAF50',
      fontWeight: 'bold',
      marginBottom: '4px'
    },
    date: {
      color: '#bbb',
      fontSize: '0.8em',
      marginBottom: '4px'
    },
    links: {
      display: 'flex',
      gap: '10px',
      marginTop: '5px'
    },
    link: {
      color: '#36bffa',
      textDecoration: 'underline',
      fontSize: '0.8em',
      cursor: 'pointer'
    },
    imageLink: {
      cursor: 'pointer'
    }
  };

  // Check if tab container can scroll left/right
  const checkScrollPosition = () => {
    if (tabContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabContainerRef.current;
      setCanScrollLeft(scrollLeft > 10); // 10px threshold
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  // Scroll tab container left/right
  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabContainerRef.current) {
      const scrollAmount = 150;
      tabContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const trackNamesForTabs = getPixelRacingStatsTrackNames(gameHistory);
  const trackTabs = [
    {
      id: PIXEL_RACING_CHAMPIONSHIP_TAB_ID,
      label: 'Championship',
      icon: '🏆',
      count: driverChampionship.length,
      trackName: null
    },
    {
      id: PIXEL_RACING_MULTIPLAYER_TAB_ID,
      label: 'Multiplayer',
      icon: '🏎️',
      count: multiplayerRaceActivity.length,
      trackName: null
    },
    ...trackNamesForTabs.map(trackName => ({
      id: getPixelRacingStatsTrackTabId(trackName),
      label: trackName,
      icon: TRACK_ICON_BY_NAME[trackName] ?? '🏁',
      count: trackLeaderboards[trackName]?.length ?? 0,
      trackName
    }))
  ];
  const activeTrackTab = trackTabs.find(tab => tab.id === activeTab && tab.trackName);

  const tabBarStyles = {
    container: {
      display: 'flex',
      gap: '10px',
      overflowX: 'auto' as const,
      scrollbarWidth: 'none' as const,
      WebkitOverflowScrolling: 'touch' as const,
      padding: '15px 5px',
      marginBottom: '20px',
      margin: '0 35px', // Make room for arrow buttons
    },
    pill: (isActive: boolean) => ({
      flexShrink: 0,
      padding: '12px 20px',
      borderRadius: '25px',
      border: 'none',
      background: isActive
        ? 'linear-gradient(135deg, #FFD700, #FFA500)'
        : 'rgba(255,255,255,0.1)',
      color: isActive ? '#000' : '#fff',
      fontWeight: 'bold' as const,
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      boxShadow: isActive ? '0 0 20px rgba(255,215,0,0.5)' : 'none',
      fontSize: '0.95em',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }),
    badge: (isActive: boolean) => ({
      backgroundColor: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '0.8em',
    }),
  };

  // Derived displays
  const activityFeed = _.sortBy(
    [
      ...liveActivity,
      ...multiplayerRaceActivity.filter(activity => !liveActivity.some(live => live.txid === activity.txid)),
    ],
    item => Number(item.time) || 0
  ).reverse();
  const liveDisplay = activityFeed.slice(0, activityresults);
  const showMoreLiveVisible = activityFeed.length > activityresults;
  const hasDummyActivity = liveDisplay.some(activity => activity.dummy);
  // Completed multiplayer race finals. Rows come from the transaction server's
  // completed-race list today; in prod the same PixelRacingGameResult shape will
  // come from the database or a gorillapool metadata search
  // (name = "multiplayer race"), so keep this rendering source-agnostic.
  const renderMultiplayerRaces = () => (
    <div style={{...styles.section, borderRadius: '0 0 8px 8px', marginTop: '0'}}>
      <h3 style={styles.sectionTitle}>🏎️ Multiplayer Races</h3>
      {multiplayerRaceActivity.some(race => race.dummy) && (
        <p style={{ textAlign: 'center', color: '#888', fontSize: '0.85em', marginTop: '0' }}>
          Dummy Mode: race records shown here are local test data, not on-chain records.
        </p>
      )}
      {multiplayerRaceActivity.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {multiplayerRaceActivity.slice(0, 15).map((data, index) => {
            const txidlink = getWhatsOnChainTransactionUrl(data.txid);
            const inscriptionlink = getOrdinalInscriptionUrl(`${data.txid}_${data.outputIndex ?? 0}`);
            const date = new Date(Number(data.time) || 0).toLocaleString();
            const entrants = [...(data.groupRaceEntrants ?? [])].sort((a, b) => getRaceEntrantSortValue(a) - getRaceEntrantSortValue(b));
            const winner = entrants.find(entrant => entrant.finishPosition === 1);
            const fastestLapMs = entrants.flatMap(entrant => entrant.lapTimesMs).reduce<number | null>((best, lapTimeMs) => (
              best === null || lapTimeMs < best ? lapTimeMs : best
            ), null);
            const totalLaps = entrants.reduce((sum, entrant) => sum + entrant.lapTimesMs.length, 0);
            const field = entrants.length > 0 ? entrants : [{
              entrantId: `${data.txid || data.groupRaceId || index}-winner`,
              foxName: data.foxname,
              foxOutpoint: data.outpoint,
              foxOriginOutpoint: data.originoutpoint,
              foxInfoLink: data.foxinfolink,
              foxImageLink: data.foximagelink,
              ownerAddress: data.owneraddress,
              carColor: data.carcolor ?? null,
              gridSlot: null,
              finishPosition: data.groupRaceFinishPosition ?? 1,
              totalTimeMs: data.groupRaceTotalTimeMs ?? (Number(data.laptime) > 0 ? Number(data.laptime) * 1000 : null),
              lapTimesMs: [],
              status: data.groupRaceStatus ?? 'finished',
            }];

            return (
              <article key={`multiplayer-${data.txid}-${data.time}-${index}`} style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ color: '#FFD700', fontSize: '0.85em', fontWeight: 'bold', marginBottom: '4px' }}>
                      🏆 {winner?.foxName || data.foxname}
                    </div>
                    <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1.05em' }}>
                      {getPixelRacingStatsTrackName(data)}
                    </div>
                    <div style={styles.date}>{date}</div>
                  </div>
                  <div style={{ textAlign: 'right', color: '#4CAF50', fontWeight: 'bold', fontSize: '0.9em' }}>
                    {data.groupRaceFinisherCount ?? field.filter(entrant => entrant.status === 'finished').length}/{data.groupRaceEntrantCount ?? field.length} finishers
                    <div style={{ color: '#bbb', fontSize: '0.78em', fontWeight: 'normal', marginTop: '3px' }}>
                      {totalLaps || '-'} laps logged
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: '10px' }}>
                  {field.slice(0, 8).map(entrant => {
                    const positionColor = entrant.finishPosition ? getPositionColor(entrant.finishPosition) : '#666';
                    return (
                      <a
                        key={`${data.txid}-${entrant.entrantId}`}
                        target="blank"
                        href={entrant.foxImageLink || entrant.foxInfoLink}
                        style={{ ...styles.imageLink, color: '#fff', textDecoration: 'none' }}
                      >
                        <div style={{
                          border: `2px solid ${positionColor}`,
                          borderRadius: '6px',
                          padding: '6px',
                          backgroundColor: 'rgba(0, 0, 0, 0.28)',
                          minHeight: '154px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {entrant.foxInfoLink && (
                            <img
                              style={{ ...styles.image, width: '58px', height: '58px', marginBottom: 0 }}
                              src={entrant.foxInfoLink}
                              alt={entrant.foxName}
                              data-outpoint={entrant.foxOriginOutpoint}
                              onError={handleImageError}
                            />
                          )}
                          <div style={{ color: positionColor, fontWeight: 'bold', fontSize: '0.85em' }}>
                            {getRaceEntrantPositionLabel(entrant.finishPosition, entrant.status)}
                          </div>
                          <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.78em', textAlign: 'center', lineHeight: 1.25 }}>
                            {entrant.foxName}
                          </div>
                          {entrant.carColor && (
                            <span style={{
                              width: '18px',
                              height: '8px',
                              borderRadius: '999px',
                              backgroundColor: entrant.carColor,
                              border: '1px solid rgba(255,255,255,0.6)'
                            }} />
                          )}
                          <div style={{ color: '#4CAF50', fontSize: '0.72em', textAlign: 'center' }}>
                            {formatRaceDuration(entrant.totalTimeMs)}
                          </div>
                          <div style={{ color: '#aaa', fontSize: '0.68em', textAlign: 'center' }}>
                            Best {formatBestLap(entrant.lapTimesMs)}
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '8px',
                  color: '#ddd',
                  fontSize: '0.82em',
                  textAlign: 'center'
                }}>
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.24)', borderRadius: '6px', padding: '7px' }}>
                    <strong style={{ color: '#fff' }}>{field.length}</strong><br />Foxes
                  </div>
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.24)', borderRadius: '6px', padding: '7px' }}>
                    <strong style={{ color: '#fff' }}>{fastestLapMs ? formatRaceDuration(fastestLapMs) : '-'}</strong><br />Fastest Lap
                  </div>
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.24)', borderRadius: '6px', padding: '7px' }}>
                    <strong style={{ color: '#fff' }}>{data.inscriptionName || 'Final'}</strong><br />Record
                  </div>
                </div>

                <div style={styles.links}>
                  <a style={styles.link} target="blank" href={txidlink}>
                    <u>Transaction</u>
                  </a>
                  <a style={styles.link} target="blank" href={inscriptionlink}>
                    <u>Inscription</u>
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      ) : !isLoading ? (
        <div style={{ textAlign: 'center', color: '#888', padding: '20px' }}>
          <p>No multiplayer races completed yet.</p>
          <p style={{ fontSize: '0.9em', marginTop: '10px' }}>Sign up for a scheduled race to see finals here!</p>
        </div>
      ) : (
        <div className="CenterLoader">
          <PulseLoader color="#ffffff" />
        </div>
      )}
    </div>
  );

  const renderTrackLeaderboard = (trackName: string, leaders: PixelRacingGameResult[]) => (
    <div style={{...styles.section, borderRadius: '0 0 8px 8px', marginTop: '0'}}>
      <h3 style={styles.sectionTitle}>🏆 {trackName}</h3>
      <div id={`${getPixelRacingStatsTrackTabId(trackName)}Leaderboard`}>
        <div className="CenterLoader">
          {isLoading ? (
            <PulseLoader color="#ffffff" />
          ) : null}
        </div>

        {leaders && leaders.length > 0 ? (
          <ol style={styles.list}>
            {leaders.slice(0, 15).map((data, index) => {
              let txidlink = getWhatsOnChainTransactionUrl(data.txid);
              let inscriptionlink = getOrdinalInscriptionUrl(`${data.txid}_0`);
              let date = new Date(Number(data.time) || 0).toLocaleString();

              return (
                <li key={`${trackName}-leader-${data.txid}-${data.time}-${index}`} style={{
                  ...styles.listItem,
                  position: 'relative',
                  border: index === 0 ? '3px solid #FFD700' :
                          index === 1 ? '3px solid #C0C0C0' :
                          index === 2 ? '3px solid #CD7F32' :
                          'none',
                  boxShadow: index < 3 ? '0 0 10px rgba(255, 255, 255, 0.2)' : 'none'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '-10px',
                    backgroundColor: index === 0 ? '#FFD700' :
                                   index === 1 ? '#C0C0C0' :
                                   index === 2 ? '#CD7F32' :
                                   '#0066cc',
                    color: 'white',
                    borderRadius: '50%',
                    width: '34px',
                    height: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8em',
                    fontWeight: 'bold',
                    border: index < 3 ? '2px solid white' : 'none'
                  }}>
                    #{index + 1}
                  </div>
                  {data.foxinfolink && (
                    <a target="blank"
                       href={data.foximagelink}
                       style={styles.imageLink}>
                      <img
                        style={styles.image}
                        src={data.foxinfolink}
                        alt={data.foxname}
                        data-outpoint={data.originoutpoint}
                        onError={handleImageError}
                      />
                    </a>
                  )}
                  <div style={styles.foxName}>{data.foxname}</div>
                  <div style={{ fontSize: '11px', color: '#4ECDC4', fontWeight: '500', marginTop: '2px' }}>
                    Track: {trackName}
                  </div>
                  <div style={styles.laptime}>Lap Time: {formatLapTime(Number(data.laptime))}</div>
                  <div style={styles.date}>{date}</div>
                  <div style={styles.links}>
                    <a style={styles.link} target="blank" href={txidlink}>
                      <u>Transaction</u>
                    </a>
                    <a style={styles.link} target="blank" href={inscriptionlink}>
                      <u>Inscription</u>
                    </a>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : !isLoading ? (
          <div style={{ textAlign: 'center', color: '#888', padding: '20px' }}>
            <p>No {trackName} track entries yet.</p>
            <p style={{ fontSize: '0.9em', marginTop: '10px' }}>
              Play games on {trackName} track to appear here!
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      {/* Latest Activity Section */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          {customTitle || 'Latest Transactions'}
        </h3>
        {hasDummyActivity && (
          <div
            style={{
              margin: '-6px auto 14px',
              maxWidth: '560px',
              padding: '8px 12px',
              border: '1px solid rgba(255, 193, 7, 0.45)',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 193, 7, 0.12)',
              color: '#ffd166',
              fontSize: '0.9em',
              textAlign: 'center',
            }}
          >
            <strong>Dummy Mode:</strong> transaction IDs shown here are local test data, not on-chain records.
          </div>
        )}
        <div id="Activity">
          <div className="CenterLoader">
            {isLoading ? (
              <div style={{ textAlign: 'center' }}>
                <PulseLoader color="#ffffff" />
                {retryCount > 0 && retryCount < MAX_RETRIES && (
                  <p style={{ color: '#888', marginTop: '10px', fontSize: '0.9em' }}>
                    Retrying... (attempt {retryCount + 1}/{MAX_RETRIES})
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {/* Error state with refresh button */}
          {fetchError && !isLoading && (
            <div style={{ textAlign: 'center', color: '#ff6b6b', padding: '20px' }}>
              <p>{fetchError}</p>
              <button
                onClick={handleManualRefresh}
                style={{
                  marginTop: '15px',
                  padding: '10px 20px',
                  backgroundColor: '#36bffa',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1em',
                  fontWeight: 'bold'
                }}
              >
                Refresh Stats
              </button>
            </div>
          )}

          {liveDisplay && liveDisplay.length > 0 ? (
            <ol style={styles.list}>
              {liveDisplay.map((data, index) => {
                let txidlink = getWhatsOnChainTransactionUrl(data.txid);
                let inscriptionlink = getOrdinalInscriptionUrl(`${data.txid}_0`);
                let date = new Date(Number(data.time) || 0).toLocaleString();
                const compactRaceEntrants = [...(data.groupRaceEntrants ?? [])].sort((a, b) => getRaceEntrantSortValue(a) - getRaceEntrantSortValue(b));
                const compactRaceWinner = compactRaceEntrants.find(entrant => entrant.finishPosition === 1);
                const compactRaceFastestLapMs = compactRaceEntrants
                  .flatMap(entrant => entrant.lapTimesMs)
                  .reduce<number | null>((best, lapTimeMs) => (
                    best === null || lapTimeMs < best ? lapTimeMs : best
                  ), null);
                
                return (
                  <li key={`${data.txid}-${data.time}-${index}`} style={styles.listItem}>
                    {data.groupRaceFinal ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: '100%', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                          <div style={{ display: 'flex', marginLeft: compactRaceEntrants.length > 1 ? '8px' : 0 }}>
                            {(compactRaceEntrants.length ? compactRaceEntrants : [{
                              entrantId: `${data.txid || data.groupRaceId || index}-winner`,
                              foxName: data.foxname,
                              foxOutpoint: data.outpoint,
                              foxOriginOutpoint: data.originoutpoint,
                              foxInfoLink: data.foxinfolink,
                              foxImageLink: data.foximagelink,
                              ownerAddress: data.owneraddress,
                              carColor: data.carcolor ?? null,
                              gridSlot: null,
                              finishPosition: data.groupRaceFinishPosition ?? 1,
                              totalTimeMs: data.groupRaceTotalTimeMs ?? null,
                              lapTimesMs: [],
                              status: data.groupRaceStatus ?? 'finished',
                            }]).slice(0, 4).map((entrant, entrantIndex) => (
                              <a
                                key={`${data.txid}-${entrant.entrantId}-compact`}
                                target="blank"
                                href={entrant.foxImageLink || entrant.foxInfoLink}
                                style={{
                                  ...styles.imageLink,
                                  marginLeft: entrantIndex === 0 ? 0 : '-8px',
                                  position: 'relative',
                                  zIndex: 5 - entrantIndex
                                }}
                              >
                                <img
                                  style={{
                                    width: '46px',
                                    height: '46px',
                                    borderRadius: '6px',
                                    objectFit: 'cover',
                                    border: `2px solid ${entrant.finishPosition ? getPositionColor(entrant.finishPosition) : '#555'}`,
                                    backgroundColor: '#111'
                                  }}
                                  src={entrant.foxInfoLink}
                                  alt={entrant.foxName}
                                  data-outpoint={entrant.foxOriginOutpoint}
                                  onError={handleImageError}
                                />
                              </a>
                            ))}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#FFD700', fontSize: '0.78em', fontWeight: 'bold', marginBottom: '2px' }}>
                              Multiplayer Race Final
                            </div>
                            <div style={{ ...styles.foxName, marginBottom: '2px', textAlign: 'left' as const }}>
                              🏆 {compactRaceWinner?.foxName || data.foxname}
                            </div>
                            <div style={{ fontSize: '11px', color: '#4ECDC4', fontWeight: '500' }}>
                              {getPixelRacingStatsTrackName(data)}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                          gap: '6px',
                          width: '100%',
                          color: '#ddd',
                          fontSize: '0.74em',
                          textAlign: 'center'
                        }}>
                          <div style={{ backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: '5px', padding: '6px 4px' }}>
                            <strong style={{ color: '#4CAF50' }}>{data.groupRaceFinisherCount ?? 0}/{data.groupRaceEntrantCount ?? compactRaceEntrants.length}</strong><br />Finishers
                          </div>
                          <div style={{ backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: '5px', padding: '6px 4px' }}>
                            <strong style={{ color: '#fff' }}>{Number(data.laptime) > 0 ? formatLapTime(Number(data.laptime)) : '-'}</strong><br />Win Time
                          </div>
                          <div style={{ backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: '5px', padding: '6px 4px' }}>
                            <strong style={{ color: '#fff' }}>{compactRaceFastestLapMs ? formatRaceDuration(compactRaceFastestLapMs) : '-'}</strong><br />Best Lap
                          </div>
                        </div>
                        {data.inscriptionName && (
                          <div style={{ color: '#ffd166', fontSize: '0.75em', textAlign: 'center' }}>
                            {data.inscriptionName}
                          </div>
                        )}
                      </div>
                    ) : data.itemImage ? (
                      // Item Collection Layout
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          {data.foxinfolink && (
                            <a target="blank" href={data.foximagelink} style={styles.imageLink}>
                              <img 
                                style={{ width: '80px', height: '80px', borderRadius: '4px', objectFit: 'cover' }}
                                src={data.foxinfolink}
                                alt={data.foxname}
                                data-outpoint={data.originoutpoint}
                                onError={handleImageError}
                              />
                            </a>
                          )}
                          <span style={{ color: '#888' }}>➔</span>
                          <img 
                            style={{ width: '80px', height: '80px', objectFit: 'contain' }}
                            src={data.itemImage}
                            alt={data.itemType}
                          />
                        </div>
                        <div style={styles.foxName}>{data.foxname}</div>
                        <div style={{ color: '#4CAF50', fontSize: '0.9em', marginBottom: '4px' }}>
                          Found {data.itemType} (+{data.laptime})
                        </div>
                        <div style={{ fontSize: '11px', color: '#4ECDC4', fontWeight: '500', marginTop: '2px' }}>
                          Track: {getPixelRacingStatsTrackName(data)}
                        </div>
                      </div>
                    ) : (
                      // Standard Layout (lap time)
                      <>
                        {data.foxinfolink && (
                          <a target="blank" 
                             href={data.foximagelink}
                             style={styles.imageLink}>
                            <img 
                              style={styles.image}
                              src={data.foxinfolink}
                              alt={data.foxname}
                              data-outpoint={data.originoutpoint}
                              onError={handleImageError}
                            />
                          </a>
                        )}
                        <div style={styles.foxName}>{data.foxname}</div>
                        <div style={styles.laptime}>Lap Time: {formatLapTime(Number(data.laptime))}</div>
                        <div style={{ fontSize: '11px', color: '#4ECDC4', fontWeight: '500', marginTop: '2px' }}>
                          Track: {getPixelRacingStatsTrackName(data)}
                        </div>
                      </>
                    )}
                    <div style={styles.date}>{date}</div>
                    <div style={styles.links}>
                      <a style={styles.link} target="blank" href={txidlink}>
                        <u>Transaction</u>
                      </a>
                      <a style={styles.link} target="blank" href={inscriptionlink}>
                        <u>Inscription</u>
                      </a>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : !isLoading ? (
            <div style={{ textAlign: 'center', color: '#888', padding: '20px' }}>
              <p>No recent activity found.</p>
              <p style={{ fontSize: '0.9em', marginTop: '10px' }}>Play games and collect items to see them here!</p>
            </div>
          ) : null}
          
          {liveDisplay && liveDisplay.length > 0 && showMoreLiveVisible && (
            <div id="ShowMore" style={{ 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: '15px',
              width: '100%'
            }}>
              <ShowMoreActivityButton onClick={showMoreActivity} />
            </div>
          )}
        </div>
      </div>

      {/* Current Players Section - Rendered before Game History */}
      {renderBeforeLeaderboard && (
        <div style={styles.section}>
          {renderBeforeLeaderboard}
        </div>
      )}

      {/* Game History Section */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          Game History
          {gameHistory.length > 0 ? ` (${gameHistory.length.toLocaleString()})` : ''}
        </h3>
        <div id="GameHistory">
          <div className="CenterLoader">
            {isLoading ? (
              <PulseLoader color="#ffffff" />
            ) : null}
          </div>

          {fetchError && !isLoading && (
            <div style={{ textAlign: 'center', color: '#ff6b6b', padding: '20px' }}>
              <p>{fetchError}</p>
              <button
                onClick={handleManualRefresh}
                style={{
                  marginTop: '15px',
                  padding: '10px 20px',
                  backgroundColor: '#36bffa',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1em',
                  fontWeight: 'bold'
                }}
              >
                Refresh Stats
              </button>
            </div>
          )}
          
          {gameHistory && gameHistory.length > 0 ? (
            <ol style={styles.list}>
              {gameHistory.slice(0, historyResults).map((data, index) => {
                let txidlink = getWhatsOnChainTransactionUrl(data.txid);
                let inscriptionlink = getOrdinalInscriptionUrl(`${data.txid}_0`);
                let date = new Date(Number(data.time) || 0).toLocaleString();
                
                return (
                  <li key={`history-${data.txid}-${data.time}-${index}`} style={styles.listItem}>
                    {data.foxinfolink && (
                      <a target="blank" 
                         href={data.foximagelink}
                         style={styles.imageLink}>
                        <img 
                          style={styles.image}
                          src={data.foxinfolink}
                          alt={data.foxname}
                          data-outpoint={data.originoutpoint}
                          onError={handleImageError}
                        />
                      </a>
                    )}
                    <div style={styles.foxName}>{data.foxname}</div>
                        <div style={styles.laptime}>Lap Time: {formatLapTime(Number(data.laptime))}</div>
                    <div style={{ fontSize: '11px', color: '#4ECDC4', fontWeight: '500', marginTop: '2px' }}>
                      Track: {getPixelRacingStatsTrackName(data)}
                    </div>
                    <div style={styles.date}>{date}</div>
                    <div style={styles.links}>
                      <a style={styles.link} target="blank" href={txidlink}>
                        <u>Transaction</u>
                      </a>
                      <a style={styles.link} target="blank" href={inscriptionlink}>
                        <u>Inscription</u>
                      </a>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : !isLoading && !fetchError ? (
            <div style={{ textAlign: 'center', color: '#888', padding: '20px' }}>
              <p>No game history found.</p>
              <p style={{ fontSize: '0.9em', marginTop: '10px' }}>Be the first to play a game!</p>
            </div>
          ) : null}
          
          {gameHistory && gameHistory.length > 0 && displayshowmorehistory && (
            <div id="ShowMoreHistory" style={{ 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: '15px',
              width: '100%'
            }}>
              <ShowMoreActivityButton onClick={showMoreHistory} />
            </div>
          )}
        </div>
      </div>

      {/* Track/Championship Tab Bar */}
      <div style={{
        ...styles.section,
        padding: '10px 15px',
        marginBottom: '0',
        borderRadius: '8px 8px 0 0',
        background: 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(20,20,40,0.8) 100%)',
        position: 'relative' as const,
      }}>
        <div
          ref={tabContainerRef}
          onScroll={checkScrollPosition}
          style={{
            ...tabBarStyles.container as React.CSSProperties,
            marginBottom: '0',
          }}
        >
          {trackTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={tabBarStyles.pill(activeTab === tab.id) as React.CSSProperties}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span style={tabBarStyles.badge(activeTab === tab.id)}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        {/* Left scroll arrow */}
        <button
          onClick={() => scrollTabs('left')}
          style={{
            position: 'absolute',
            left: '5px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.5)',
            border: 'none',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            color: '#FFD700',
            fontSize: '1.2em',
            cursor: canScrollLeft ? 'pointer' : 'default',
            opacity: canScrollLeft ? 1 : 0.3,
            transition: 'opacity 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          disabled={!canScrollLeft}
        >
          ‹
        </button>
        {/* Right scroll arrow */}
        <button
          onClick={() => scrollTabs('right')}
          style={{
            position: 'absolute',
            right: '5px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.5)',
            border: 'none',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            color: '#FFD700',
            fontSize: '1.2em',
            cursor: canScrollRight ? 'pointer' : 'default',
            opacity: canScrollRight ? 1 : 0.3,
            transition: 'opacity 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          disabled={!canScrollRight}
        >
          ›
        </button>
      </div>

      {activeTrackTab?.trackName && renderTrackLeaderboard(
        activeTrackTab.trackName,
        trackLeaderboards[activeTrackTab.trackName] ?? []
      )}

      {activeTab === PIXEL_RACING_MULTIPLAYER_TAB_ID && renderMultiplayerRaces()}

      {/* Driver Championship Section */}
      {activeTab === PIXEL_RACING_CHAMPIONSHIP_TAB_ID && (
      <div style={{
        ...styles.section,
        background: 'linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(20,20,40,0.9) 100%)',
        border: '0px solid #FFD700',
        marginTop: '0',
        borderRadius: '0 0 8px 8px'
      }}>
        <h3 style={{
          ...styles.sectionTitle,
          fontSize: '2em',
          color: '#FFD700',
          textShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
          marginBottom: '5px'
        }}>
          Fox Championship
        </h3>
        <p style={{
          textAlign: 'center',
          color: '#888',
          fontSize: '0.9em',
          marginTop: '0',
          marginBottom: '20px'
        }}>
          Fox standings use origin outpoints when available. Points: 25-18-15-12-10-8-6-4-2-1 for the top 10 per track.
        </p>

        <div id="DriverChampionship">
          <div className="CenterLoader">
            {isLoading ? (
              <PulseLoader color="#FFD700" />
            ) : null}
          </div>

          {driverChampionship && driverChampionship.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {driverChampionship.slice(0, championshipDisplayCount).map((driver, index) => {
                const isExpanded = expandedDrivers.has(driver.address);
                const championshipPosition = index + 1;
                const tracksRaced = Object.keys(driver.trackStats).length;
                const maxPoints = tracksRaced * 25;
                const pointsPercentage = maxPoints > 0 ? (driver.totalPoints / maxPoints * 100).toFixed(1) : '0';

                return (
                  <div
                    key={`driver-${driver.address}-${index}`}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                      padding: '15px',
                      border: championshipPosition === 1 ? '3px solid #FFD700' :
                              championshipPosition === 2 ? '3px solid #C0C0C0' :
                              championshipPosition === 3 ? '3px solid #CD7F32' :
                              '1px solid rgba(255,255,255,0.1)',
                      boxShadow: championshipPosition <= 3 ? '0 0 20px rgba(255, 215, 0, 0.2)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onClick={() => toggleDriverExpanded(driver.address)}
                  >
                    {/* Main Driver Row */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '15px',
                      flexWrap: 'wrap'
                    }}>
                      {/* Position Badge */}
                      <div style={{
                        backgroundColor: getPositionColor(championshipPosition),
                        color: championshipPosition <= 3 ? '#000' : '#fff',
                        borderRadius: '50%',
                        width: '50px',
                        height: '50px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2em',
                        fontWeight: 'bold',
                        flexShrink: 0,
                        boxShadow: championshipPosition <= 3 ? '0 0 15px rgba(255,255,255,0.3)' : 'none'
                      }}>
                        #{championshipPosition}
                      </div>

                      {/* Fox Image */}
                      {driver.primaryFoxImage && (
                        <img
                          style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '8px',
                            objectFit: 'cover',
                            flexShrink: 0
                          }}
                          src={driver.primaryFoxImage}
                          alt={driver.primaryFoxName}
                          data-outpoint={driver.primaryFoxOriginOutpoint}
                          onError={handleImageError}
                        />
                      )}

                      {/* Driver Info */}
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        <div style={{
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '1.1em',
                          marginBottom: '4px'
                        }}>
                          {driver.primaryFoxName || 'Unknown Driver'}
                        </div>
                        <div style={{
                          color: '#888',
                          fontSize: '0.85em',
                          fontFamily: 'monospace'
                        }}>
                          {driver.identityKind === 'owner-address'
                            ? formatShortAddress(driver.address)
                            : 'Fox origin'}
                        </div>
                        {driver.foxNames.length > 1 && (
                          <div style={{
                            color: '#666',
                            fontSize: '0.75em',
                            marginTop: '2px'
                          }}>
                            +{driver.foxNames.length - 1} more fox{driver.foxNames.length > 2 ? 'es' : ''}
                          </div>
                        )}
                      </div>

                      {/* Points Display */}
                      <div style={{
                        textAlign: 'center',
                        minWidth: '80px'
                      }}>
                        <div style={{
                          color: '#FFD700',
                          fontSize: '2em',
                          fontWeight: 'bold',
                          lineHeight: 1
                        }}>
                          {driver.totalPoints}
                        </div>
                        <div style={{
                          color: '#888',
                          fontSize: '0.75em',
                          textTransform: 'uppercase'
                        }}>
                          Points
                        </div>
                      </div>

                      {/* Quick Stats */}
                      <div style={{
                        display: 'flex',
                        gap: '10px',
                        flexWrap: 'wrap',
                        justifyContent: 'center'
                      }}>
                        {/* Wins */}
                        <div style={{
                          backgroundColor: driver.totalWins > 0 ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255,255,255,0.05)',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          textAlign: 'center',
                          minWidth: '50px'
                        }}>
                          <div style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '1.2em' }}>
                            {driver.totalWins}
                          </div>
                          <div style={{ color: '#888', fontSize: '0.7em' }}>WINS</div>
                        </div>

                        {/* Podiums */}
                        <div style={{
                          backgroundColor: driver.totalPodiums > 0 ? 'rgba(192, 192, 192, 0.2)' : 'rgba(255,255,255,0.05)',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          textAlign: 'center',
                          minWidth: '50px'
                        }}>
                          <div style={{ color: '#C0C0C0', fontWeight: 'bold', fontSize: '1.2em' }}>
                            {driver.totalPodiums}
                          </div>
                          <div style={{ color: '#888', fontSize: '0.7em' }}>PODIUMS</div>
                        </div>

                        {/* Points Finishes */}
                        <div style={{
                          backgroundColor: 'rgba(54, 191, 250, 0.2)',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          textAlign: 'center',
                          minWidth: '50px'
                        }}>
                          <div style={{ color: '#36bffa', fontWeight: 'bold', fontSize: '1.2em' }}>
                            {driver.pointsFinishes}
                          </div>
                          <div style={{ color: '#888', fontSize: '0.7em' }}>TOP 10s</div>
                        </div>

                        {/* Total Races */}
                        <div style={{
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          textAlign: 'center',
                          minWidth: '50px'
                        }}>
                          <div style={{ color: '#4ECDC4', fontWeight: 'bold', fontSize: '1.2em' }}>
                            {driver.totalRaces}
                          </div>
                          <div style={{ color: '#888', fontSize: '0.7em' }}>RACES</div>
                        </div>
                      </div>

                      {/* Expand Arrow */}
                      <div style={{
                        color: '#888',
                        fontSize: '1.5em',
                        transition: 'transform 0.3s ease',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                      }}>
                        ▼
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div style={{
                        marginTop: '20px',
                        paddingTop: '20px',
                        borderTop: '1px solid rgba(255,255,255,0.1)'
                      }}>
                        {/* Position Breakdown */}
                        <div style={{ marginBottom: '20px' }}>
                          <h4 style={{
                            color: '#36bffa',
                            margin: '0 0 10px 0',
                            fontSize: '1em'
                          }}>
                            Position Breakdown
                          </h4>
                          <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '8px'
                          }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(pos => {
                              const count = driver.positionCounts[pos] || 0;
                              if (count === 0) return null;
                              return (
                                <div
                                  key={`pos-${pos}`}
                                  style={{
                                    backgroundColor: getPositionColor(pos),
                                    color: pos <= 3 ? '#000' : '#fff',
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    fontSize: '0.85em',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {getOrdinalSuffix(pos)}: {count}x ({CHAMPIONSHIP_POINTS[pos - 1]} pts each)
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Track-by-Track Results */}
                        <div>
                          <h4 style={{
                            color: '#36bffa',
                            margin: '0 0 10px 0',
                            fontSize: '1em'
                          }}>
                            Track Results
                          </h4>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '10px'
                          }}>
                            {trackNamesForTabs.map(track => {
                              const trackStat = driver.trackStats[track];
                              if (!trackStat) {
                                return (
                                  <div
                                    key={`track-${track}`}
                                    style={{
                                      backgroundColor: 'rgba(255,255,255,0.02)',
                                      padding: '12px',
                                      borderRadius: '8px',
                                      opacity: 0.5
                                    }}
                                  >
                                    <div style={{ color: '#666', fontWeight: 'bold', marginBottom: '5px' }}>
                                      {track}
                                    </div>
                                    <div style={{ color: '#444', fontSize: '0.85em' }}>
                                      No races yet
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={`track-${track}`}
                                  style={{
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: trackStat.position <= 3
                                      ? `2px solid ${getPositionColor(trackStat.position)}`
                                      : '1px solid rgba(255,255,255,0.1)'
                                  }}
                                >
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '8px'
                                  }}>
                                    <div style={{ color: '#fff', fontWeight: 'bold' }}>
                                      {track}
                                    </div>
                                    <div style={{
                                      backgroundColor: getPositionColor(trackStat.position),
                                      color: trackStat.position <= 3 ? '#000' : '#fff',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '0.8em',
                                      fontWeight: 'bold'
                                    }}>
                                      P{trackStat.position}
                                    </div>
                                  </div>

                                  <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '5px',
                                    fontSize: '0.8em'
                                  }}>
                                    <div>
                                      <span style={{ color: '#888' }}>Best Time: </span>
                                      <span style={{ color: '#4CAF50' }}>{formatLapTime(trackStat.bestLapTime)}</span>
                                    </div>
                                    <div>
                                      <span style={{ color: '#888' }}>Points: </span>
                                      <span style={{ color: '#FFD700' }}>+{trackStat.points}</span>
                                    </div>
                                    <div>
                                      <span style={{ color: '#888' }}>Races: </span>
                                      <span style={{ color: '#4ECDC4' }}>{trackStat.totalRaces}</span>
                                    </div>
                                    <div>
                                      <span style={{ color: '#888' }}>Fox: </span>
                                      <span style={{ color: '#fff' }}>{trackStat.bestFoxName}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Efficiency Stats */}
                        <div style={{
                          marginTop: '15px',
                          padding: '12px',
                          backgroundColor: 'rgba(255,255,255,0.03)',
                          borderRadius: '8px'
                        }}>
                          <h4 style={{
                            color: '#36bffa',
                            margin: '0 0 10px 0',
                            fontSize: '1em'
                          }}>
                            Efficiency Stats
                          </h4>
                          <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '20px',
                            fontSize: '0.85em'
                          }}>
                            <div>
                              <span style={{ color: '#888' }}>Points per Track: </span>
                              <span style={{ color: '#FFD700', fontWeight: 'bold' }}>
                                {tracksRaced > 0 ? (driver.totalPoints / tracksRaced).toFixed(1) : '0'}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: '#888' }}>Points Efficiency: </span>
                              <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                                {pointsPercentage}%
                              </span>
                              <span style={{ color: '#666', fontSize: '0.8em' }}> of max possible</span>
                            </div>
                            <div>
                              <span style={{ color: '#888' }}>Win Rate: </span>
                              <span style={{ color: '#FFD700', fontWeight: 'bold' }}>
                                {tracksRaced > 0 ? ((driver.totalWins / tracksRaced) * 100).toFixed(0) : '0'}%
                              </span>
                            </div>
                            <div>
                              <span style={{ color: '#888' }}>Podium Rate: </span>
                              <span style={{ color: '#C0C0C0', fontWeight: 'bold' }}>
                                {tracksRaced > 0 ? ((driver.totalPodiums / tracksRaced) * 100).toFixed(0) : '0'}%
                              </span>
                            </div>
                            <div>
                              <span style={{ color: '#888' }}>Points per Race: </span>
                              <span style={{ color: '#36bffa', fontWeight: 'bold' }}>
                                {driver.totalRaces > 0 ? (driver.totalPoints / driver.totalRaces).toFixed(2) : '0'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* All Foxes Used */}
                        {driver.foxNames.length > 1 && (
                          <div style={{
                            marginTop: '15px',
                            padding: '12px',
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            borderRadius: '8px'
                          }}>
                            <h4 style={{
                              color: '#36bffa',
                              margin: '0 0 10px 0',
                              fontSize: '1em'
                            }}>
                              Foxes Used ({driver.foxNames.length})
                            </h4>
                            <div style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '8px'
                            }}>
                              {driver.foxNames.map((foxName, foxIdx) => (
                                <span
                                  key={`fox-${foxIdx}`}
                                  style={{
                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                    padding: '4px 10px',
                                    borderRadius: '4px',
                                    fontSize: '0.85em',
                                    color: foxName === driver.primaryFoxName ? '#FFD700' : '#888'
                                  }}
                                >
                                  {foxName}
                                  {foxName === driver.primaryFoxName && ' (Primary)'}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Show More Button */}
              {driverChampionship.length > championshipDisplayCount && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginTop: '15px'
                }}>
                  <ShowMoreActivityButton onClick={showMoreChampionship} />
                </div>
              )}
            </div>
          ) : !isLoading && !fetchError ? (
            <div style={{ textAlign: 'center', color: '#888', padding: '20px' }}>
              <p>No championship data yet.</p>
              <p style={{ fontSize: '0.9em', marginTop: '10px' }}>Race on any track to earn championship points!</p>
            </div>
          ) : null}

          {/* Championship Summary Stats */}
          {driverChampionship && driverChampionship.length > 0 && !isLoading && (
            <div style={{
              marginTop: '25px',
              padding: '15px',
              backgroundColor: 'rgba(255, 215, 0, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 215, 0, 0.3)'
            }}>
              <h4 style={{
                color: '#FFD700',
                margin: '0 0 15px 0',
                textAlign: 'center',
                fontSize: '1.1em'
              }}>
                Championship Overview
              </h4>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '20px',
                fontSize: '0.9em'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#FFD700', fontSize: '1.8em', fontWeight: 'bold' }}>
                    {driverChampionship.length}
                  </div>
                  <div style={{ color: '#888' }}>
                    Total Foxes
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#36bffa', fontSize: '1.8em', fontWeight: 'bold' }}>
                    {driverChampionship.reduce((sum, d) => sum + d.totalRaces, 0)}
                  </div>
                  <div style={{ color: '#888' }}>Total Races</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#4CAF50', fontSize: '1.8em', fontWeight: 'bold' }}>
                    {driverChampionship.reduce((sum, d) => sum + d.totalPoints, 0)}
                  </div>
                  <div style={{ color: '#888' }}>Total Points Awarded</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#C0C0C0', fontSize: '1.8em', fontWeight: 'bold' }}>
                    {trackNamesForTabs.length}
                  </div>
                  <div style={{ color: '#888' }}>Active Tracks</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#FFD700', fontSize: '1.8em', fontWeight: 'bold' }}>
                    {trackNamesForTabs.length * 25}
                  </div>
                  <div style={{ color: '#888' }}>Max Possible Points</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

    </>
  );
});

export default PixelRacingStats;
