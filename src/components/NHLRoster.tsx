import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { VirtuosoGrid } from 'react-virtuoso';
import { toast } from 'sonner';
import { 
  getPlayerFullName,
  getAllPlayers,
  getTeamRoster,
  NHL_TEAMS,
  getLastSeasonStats,
  type RosterPerson,
  type TeamAbbrev,
  type StatsMap
} from '../utils/nhlApi';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { useDraft } from '../context/DraftContext';
import { useLeague } from '../context/LeagueContext';
import { isPlayerInjuredByName, getInjuryIcon, getInjuryColor } from '../services/injuryService';
import { useInjuries } from '../queries/useInjuries';
import { useTeamRoster } from '../queries/useTeamRoster';

export default function NHLRoster() {
  const [draftedPlayerIds, setDraftedPlayerIds] = useState<Set<number>>(new Set());
  const [draftingPlayerId, setDraftingPlayerId] = useState<number | null>(null);
  const [myTeamPositions, setMyTeamPositions] = useState({ 
    active: { F: 0, D: 0, G: 0 },
    reserve: 0,
    total: 0 
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ANA'); // Default to Anaheim Ducks
  const [pickupTeam, setPickupTeam] = useState<string>(''); // Admin: which team to pick up for
  const [lastSeasonStats, setLastSeasonStats] = useState<StatsMap>({}); // Last season stats
  
  // League context for showing user's team
  const { myTeam, league, isAdmin } = useLeague();
  
  // Draft context
  const { draftState, currentPick, isMyTurn, advancePick } = useDraft();
  
  // React Query hooks - automatic caching and refetching!
  const { data: injuries = [] } = useInjuries();
  
  // Conditionally use different queries based on team filter
  const isFetchingAllTeams = teamFilter === 'ALL';
  
  // Only fetch single team when not fetching all teams
  const { data: singleTeamData, isLoading: singleTeamLoading, error: singleTeamError } = useTeamRoster(
    !isFetchingAllTeams ? (teamFilter as TeamAbbrev) : null
  );
  
  // Only fetch all teams when "ALL" is selected (enabled flag prevents unnecessary fetching)
  const { data: allTeamsData, isLoading: allTeamsLoading, error: allTeamsError } = useQuery({
    queryKey: ['rosters', 'all'],
    queryFn: async () => {
      console.log('🏒 Loading all NHL teams in parallel...');
      const startTime = Date.now();
      
      const teamPromises = (Object.keys(NHL_TEAMS) as TeamAbbrev[]).map(async (abbrev) => {
        try {
          const rosterData = await getTeamRoster(abbrev);
          const teamPlayers = getAllPlayers(rosterData);
          return teamPlayers.map(player => {
            (player as any).teamAbbrev = abbrev;
            return player;
          });
        } catch (err) {
          console.warn(`Failed to load ${abbrev}:`, err);
          return [];
        }
      });
      
      const results = await Promise.all(teamPromises);
      const allPlayers = results.flat();
      
      const loadTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Loaded ${allPlayers.length} players from ${Object.keys(NHL_TEAMS).length} teams in ${loadTime}s`);
      
      return allPlayers;
    },
    enabled: isFetchingAllTeams, // Only run this query when ALL teams is selected
    staleTime: 15 * 60 * 1000,
  });
  
  // Extract roster based on which query is active
  const roster: RosterPerson[] = isFetchingAllTeams 
    ? (allTeamsData || [])
    : singleTeamData 
      ? getAllPlayers(singleTeamData).map(player => {
          (player as any).teamAbbrev = teamFilter;
          return player;
        })
      : [];
  
  const loading = isFetchingAllTeams ? allTeamsLoading : singleTeamLoading;
  const error = isFetchingAllTeams 
    ? (allTeamsError ? (allTeamsError as Error).message : null)
    : (singleTeamError ? (singleTeamError as Error).message : null);

  // Admin: Pick up free agent for a team
  const pickUpFreeAgent = async (rosterPlayer: any) => {
    if (!isAdmin) {
      toast.error('Admin only', {
        description: 'Only the league admin can pick up free agents.'
      });
      return;
    }

    if (!pickupTeam) {
      toast.warning('Select a team', {
        description: 'Please choose which team to pick up this player for.'
      });
      return;
    }

    try {
      setDraftingPlayerId(rosterPlayer.person.id);
      
      // Check if already drafted
      if (draftedPlayerIds.has(rosterPlayer.person.id)) {
        toast.error('Player already drafted!', {
          description: `${getPlayerFullName(rosterPlayer)} has already been selected.`
        });
        setDraftingPlayerId(null);
        return;
      }

      const confirmed = window.confirm(
        `Pick up "${getPlayerFullName(rosterPlayer)}" for team "${pickupTeam}"?\n\nThis will add them to the active roster.`
      );

      if (!confirmed) {
        setDraftingPlayerId(null);
        return;
      }
      
      // Add to active roster by default
      await addDoc(collection(db, 'draftedPlayers'), {
        playerId: rosterPlayer.person.id,
        name: getPlayerFullName(rosterPlayer),
        position: rosterPlayer.position.code,
        positionName: rosterPlayer.position.name,
        jerseyNumber: rosterPlayer.jerseyNumber,
        nhlTeam: (rosterPlayer as any).teamAbbrev || 'UNK',
        draftedByTeam: pickupTeam,
        pickNumber: 0, // Free agent pickup
        round: 0, // Free agent pickup
        leagueId: league?.id,
        draftedAt: new Date().toISOString(),
        rosterSlot: 'active'
      });

      // Update local state
      setDraftedPlayerIds(prev => new Set(prev).add(rosterPlayer.person.id));
      
      console.log(`Admin picked up: ${getPlayerFullName(rosterPlayer)} for ${pickupTeam}`);
      toast.success(`Picked up ${getPlayerFullName(rosterPlayer)}!`, {
        description: `Added to ${pickupTeam}'s active roster as a free agent.`
      });
    } catch (error) {
      console.error('Error picking up player:', error);
      toast.error('Failed to pick up player', {
        description: 'Something went wrong. Please try again.'
      });
    } finally {
      setDraftingPlayerId(null);
    }
  };

  // Note: React Query now handles all data fetching and caching!
  // No more manual fetch functions needed.

  // Fetch last season stats on mount
  useEffect(() => {
    const loadStats = async () => {
      try {
        console.log('📊 Loading last season stats...');
        const stats = await getLastSeasonStats();
        setLastSeasonStats(stats);
      } catch (err) {
        console.error('Failed to load last season stats:', err);
      }
    };
    loadStats();
  }, []);

  // Set up real-time listener for drafted players
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'draftedPlayers'), (snapshot) => {
      const draftedIds = new Set<number>();
      let activeForwards = 0, activeDefense = 0, activeGoalies = 0;
      let reserveCount = 0, myTotal = 0;
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        draftedIds.add(data.playerId);
        
        // Count positions for my team
        if (myTeam && data.draftedByTeam === myTeam.teamName) {
          myTotal++;
          const pos = data.position;
          const slot = data.rosterSlot || 'active';
          
          if (slot === 'reserve') {
            reserveCount++;
          } else {
            // Active roster
            if (['C', 'L', 'R'].includes(pos)) {
              activeForwards++;
            } else if (pos === 'D') {
              activeDefense++;
            } else if (pos === 'G') {
              activeGoalies++;
            }
          }
        }
      });
      
      setDraftedPlayerIds(draftedIds);
      setMyTeamPositions({ 
        active: { F: activeForwards, D: activeDefense, G: activeGoalies },
        reserve: reserveCount,
        total: myTotal 
      });
    });
    
    return () => unsubscribe();
  }, [myTeam]);

  // Check if we can draft a player to active roster
  const canDraftToActive = (position: string): boolean => {
    if (!league?.rosterSettings) return true;
    
    const { F, D, G } = myTeamPositions.active;
    const { forwards, defensemen, goalies } = league.rosterSettings;
    
    if (['C', 'L', 'R'].includes(position)) {
      return F < forwards;
    } else if (position === 'D') {
      return D < defensemen;
    } else if (position === 'G') {
      return G < goalies;
    }
    
    return false;
  };
  
  // Check if we can add to reserves (max 5)
  const canDraftToReserve = (): boolean => {
    return myTeamPositions.reserve < 5;
  };

  // Draft a player to Firebase
  const onDraftPlayer = async (rosterPlayer: RosterPerson, forceReserve: boolean = false) => {
    if (!isMyTurn) {
      toast.error("It's not your turn!", {
        description: "Wait for your pick to come around."
      });
      return;
    }

    if (!currentPick) {
      toast.error('Draft is complete!', {
        description: "All picks have been made."
      });
      return;
    }

    try {
      setDraftingPlayerId(rosterPlayer.person.id);
      
      // Check if already drafted
      if (draftedPlayerIds.has(rosterPlayer.person.id)) {
        toast.error('Player already drafted!', {
          description: `${getPlayerFullName(rosterPlayer)} has already been selected.`
        });
        setDraftingPlayerId(null);
        return;
      }
      
      // Determine roster slot
      let rosterSlot: 'active' | 'reserve' = 'active';
      const canAddToActive = canDraftToActive(rosterPlayer.position.code);
      const canAddToReserves = canDraftToReserve();
      
      if (forceReserve) {
        // User confirmed adding to reserves
        if (!canAddToReserves) {
          toast.error('Reserve roster full!', {
            description: 'You have 5/5 reserves. Cannot draft more players.'
          });
          setDraftingPlayerId(null);
          return;
        }
        rosterSlot = 'reserve';
      } else if (!canAddToActive) {
        // Active position is full - AUTO-ADD to reserves (no popup!)
        if (canAddToReserves) {
          rosterSlot = 'reserve';
          // Show info toast that we're adding to reserves
          toast.info('Adding to reserves', {
            description: `Active ${rosterPlayer.position.name} roster is full. Adding to bench.`
          });
        } else {
          toast.error('Roster full!', {
            description: `Active ${rosterPlayer.position.name} roster and reserves (5/5) are both full!`
          });
          setDraftingPlayerId(null);
          return;
        }
      }

      // Save to Firebase with team assignment and pick info
      await addDoc(collection(db, 'draftedPlayers'), {
        playerId: rosterPlayer.person.id,
        name: getPlayerFullName(rosterPlayer),
        position: rosterPlayer.position.code,
        positionName: rosterPlayer.position.name,
        jerseyNumber: rosterPlayer.jerseyNumber,
        nhlTeam: (rosterPlayer as any).teamAbbrev || 'UNK',
        draftedByTeam: currentPick.team,
        pickNumber: currentPick.pick,
        round: currentPick.round,
        leagueId: league?.id,
        draftedAt: new Date().toISOString(),
        rosterSlot: rosterSlot // 'active' or 'reserve'
      });

      // Update local state
      setDraftedPlayerIds(prev => new Set(prev).add(rosterPlayer.person.id));
      
      // Advance to next pick
      await advancePick();
      
      // Show success toast
      toast.success(`Drafted ${getPlayerFullName(rosterPlayer)}!`, {
        description: `${rosterPlayer.position.code} • ${(rosterPlayer as any).teamAbbrev} • Pick #${currentPick.pick} → ${rosterSlot === 'reserve' ? 'Reserves' : 'Active Roster'}`
      });
      
      console.log(`${currentPick.team} drafted: ${getPlayerFullName(rosterPlayer)} (Pick #${currentPick.pick})`);
    } catch (error) {
      console.error('Error drafting player:', error);
      toast.error('Failed to draft player', {
        description: 'Something went wrong. Please try again.'
      });
    } finally {
      setDraftingPlayerId(null);
    }
  };

  // React Query automatically handles data fetching and caching based on teamFilter
  // No manual useEffects needed!

  const getPositionBadgeColor = (positionCode: string) => {
    switch (positionCode) {
      case 'C':
      case 'L':
      case 'R':
        return 'bg-blue-600';
      case 'D':
        return 'bg-green-600';
      case 'G':
        return 'bg-purple-600';
      default:
        return 'bg-gray-600';
    }
  };

  // Filter roster based on search, position, and team
  const filteredRoster = roster.filter(player => {
    const playerName = getPlayerFullName(player).toLowerCase();
    const matchesSearch = searchQuery === '' || playerName.includes(searchQuery.toLowerCase());
    
    const matchesPosition = positionFilter === 'ALL' || 
      (positionFilter === 'F' && ['C', 'L', 'R'].includes(player.position.code)) ||
      (positionFilter === player.position.code);
    
    const matchesTeam = teamFilter === 'ALL' || (player as any).teamAbbrev === teamFilter;
    
    return matchesSearch && matchesPosition && matchesTeam;
  });

  // Use virtualization for large lists (>100 players)
  const useVirtualization = filteredRoster.length > 100;

  // Render a single player card with headshot and team logo
  const renderPlayerCard = (rosterPlayer: RosterPerson) => {
    const isDrafted = draftedPlayerIds.has(rosterPlayer.person.id);
    const isDrafting = draftingPlayerId === rosterPlayer.person.id;
    const teamAbbrev = (rosterPlayer as any).teamAbbrev || 'UNK';
    const injury = isPlayerInjuredByName(getPlayerFullName(rosterPlayer), injuries);
    
    // Check if player is a superstar (100+ points)
    const playerStats = lastSeasonStats[rosterPlayer.person.id];
    const isSuperstar = playerStats && playerStats.points >= 100;
    
    // NHL headshot URL (with fallback)
    const headshotUrl = `https://assets.nhle.com/mugs/nhl/20242025/${teamAbbrev}/${rosterPlayer.person.id}.png`;
    const fallbackHeadshot = "https://assets.nhle.com/mugs/nhl/default-skater.png";
    const teamLogoUrl = `https://assets.nhle.com/logos/nhl/svg/${teamAbbrev}_dark.svg`;

    return (
      <div
        key={rosterPlayer.person.id}
        className={`relative rounded-xl p-4 transition-all shadow-sm hover:shadow-xl hover:shadow-black/40 hover:-translate-y-0.5 ${
          isDrafted 
            ? isSuperstar
              ? 'bg-gray-900 opacity-60 border-2 border-amber-500/40'  // Drafted superstar - hint of gold
              : 'bg-gray-900 opacity-60 border-2 border-gray-600'      // Regular drafted player
            : isSuperstar
            ? 'bg-gradient-to-br from-gray-800 to-amber-900/20 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)] hover:shadow-[0_0_25px_rgba(245,158,11,0.2)]'  // Gold tier (100+)
            : playerStats && playerStats.points >= 80
            ? 'bg-gray-800 border border-gray-400/40 shadow-[0_0_10px_rgba(192,192,192,0.05)] hover:border-gray-400/60'  // Silver tier (80-99)
            : 'bg-gray-700 hover:bg-gray-650 border border-gray-700'  // Standard
        }`}
      >
        {/* Injury Badge - Top Right Corner (Abbreviated) */}
        {injury && (
          <div 
            className="absolute top-3 right-3 z-10 cursor-help"
            title={`${injury.status}: ${injury.injuryType} - ${injury.description}`}
          >
            <span className={`${getInjuryColor(injury.status)} text-white text-xs px-2 py-1 rounded font-bold flex items-center gap-1 shadow-lg whitespace-nowrap`}>
              {getInjuryIcon(injury.status)} {
                injury.status === 'Injured Reserve' ? 'IR' :
                injury.status === 'Day To Day' ? 'DTD' :
                injury.status === 'Out' ? 'OUT' :
                injury.status.toUpperCase().substring(0, 3)
              }
            </span>
          </div>
        )}
        
        <div className="flex flex-col gap-3">
          {/* Player Photo & Info */}
          <div className="flex gap-3 items-start">
            {/* Avatar with Team Logo Badge */}
            <div className="relative flex-shrink-0">
              <img 
                src={headshotUrl}
                alt={getPlayerFullName(rosterPlayer)}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.src = fallbackHeadshot;
                }}
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-600 bg-gray-800"
              />
              {/* Team Logo Badge */}
              <div className="absolute -bottom-1 -right-1 w-8 h-8">
                <img 
                  src={teamLogoUrl} 
                  alt={teamAbbrev}
                  className="w-full h-full drop-shadow-lg"
                />
              </div>
            </div>

            {/* Player Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-white font-semibold text-lg">
                  #{rosterPlayer.jerseyNumber}
                </span>
                <span
                  className={`${getPositionBadgeColor(rosterPlayer.position.code)} text-white text-xs px-2 py-1 rounded font-bold`}
                >
                  {rosterPlayer.position.code}
                </span>
                <span className="bg-gray-600 text-white text-xs px-2 py-1 rounded font-bold">
                  {teamAbbrev}
                </span>
                {isDrafted && (
                  <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-bold">
                    DRAFTED
                  </span>
                )}
              </div>
              <p className="text-white font-medium text-lg mb-1 truncate">
                {getPlayerFullName(rosterPlayer)}
              </p>
              <p className="text-gray-400 text-sm mb-2">
                {rosterPlayer.position.name}
              </p>
              
              {/* Last Season Stats - Pro Design */}
              <div className="mt-3 mb-4 flex items-center justify-between px-1">
                {playerStats ? (
                  rosterPlayer.position.code === 'G' ? (
                    // --- GOALIE DESIGN ---
                    <>
                      <div className="flex flex-col">
                        <span className="text-2xl font-black text-emerald-400 leading-none">
                          {playerStats.wins || 0}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-emerald-500/80 tracking-widest">
                          Wins
                        </span>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                        <span className="text-xs font-mono text-emerald-300">
                          {(playerStats.savePct || 0).toFixed(3)} <span className="opacity-50">SV%</span>
                        </span>
                      </div>
                    </>
                  ) : (
                    // --- SKATER DESIGN ---
                    <>
                      <div className="flex flex-col">
                        {/* Color-coded points based on production level */}
                        <span className={`text-2xl font-black leading-none ${
                          playerStats.points >= 100 ? 'text-yellow-300' :     // Elite (100+)
                          playerStats.points >= 80 ? 'text-amber-400' :       // Star (80-99)
                          playerStats.points >= 60 ? 'text-blue-400' :        // Good (60-79)
                          playerStats.points >= 40 ? 'text-green-400' :       // Solid (40-59)
                          playerStats.points >= 20 ? 'text-gray-300' :        // Role player (20-39)
                          'text-gray-400'                                       // Depth (<20)
                        }`}>
                          {playerStats.points}
                        </span>
                        <span className={`text-[10px] uppercase font-bold tracking-widest ${
                          playerStats.points >= 100 ? 'text-yellow-500/80' :
                          playerStats.points >= 80 ? 'text-amber-500/80' :
                          playerStats.points >= 60 ? 'text-blue-500/80' :
                          playerStats.points >= 40 ? 'text-green-500/80' :
                          'text-gray-500/80'
                        }`}>
                          Points
                        </span>
                      </div>
                      {/* Better contrast pills */}
                      <div className="flex gap-1.5 text-xs font-medium">
                        <span className="bg-white/10 border border-gray-600 px-2 py-1 rounded">
                          <span className="text-white font-bold">{playerStats.goals}</span> <span className="text-gray-300">G</span>
                        </span>
                        <span className="bg-white/10 border border-gray-600 px-2 py-1 rounded">
                          <span className="text-white font-bold">{playerStats.assists}</span> <span className="text-gray-300">A</span>
                        </span>
                      </div>
                    </>
                  )
                ) : (
                  // --- NO STATS DESIGN - Large dash placeholder ---
                  <div className="flex flex-col items-start justify-center">
                    <span className="text-3xl font-black text-gray-600 leading-none">
                      —
                    </span>
                    <span className="text-[10px] uppercase font-bold text-gray-600/80 tracking-widest">
                      No Data
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Draft Button (during draft) */}
          {draftState && !draftState.isComplete && (
            <button
              onClick={() => onDraftPlayer(rosterPlayer)}
              disabled={isDrafted || isDrafting || !isMyTurn}
              className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                isDrafted
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : isDrafting
                  ? 'bg-yellow-600 text-white cursor-wait'
                  : !isMyTurn
                  ? 'border border-transparent text-gray-500 bg-transparent cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isDrafting 
                ? 'Drafting...' 
                : isDrafted 
                ? 'Already Drafted' 
                : !isMyTurn 
                ? 'Not Your Turn' 
                : 'Draft Player'}
            </button>
          )}

          {/* Admin: Pick Up Button (during season / free agency) */}
          {isAdmin && !isDrafted && (
            <button
              onClick={() => pickUpFreeAgent(rosterPlayer)}
              disabled={isDrafting}
              className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                isDrafting
                  ? 'bg-yellow-600 text-white cursor-wait'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {isDrafting ? 'Picking Up...' : '👑 Pick Up (Admin)'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-6 text-white">NHL Team Roster</h2>

      {/* Draft Status Banner */}
      {draftState && currentPick && (
        <div className={`p-4 rounded-lg mb-6 ${
          isMyTurn ? 'bg-green-900 border-2 border-green-500' : 'bg-gray-800 border-2 border-gray-600'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-400">
                Pick {currentPick.pick} of {draftState.totalPicks} • Round {currentPick.round}
                {myTeam && <span className="ml-2">• You are: <span className="text-blue-400">{myTeam.teamName}</span></span>}
              </p>
              <p className="text-xl font-bold text-white mt-1">
                {isMyTurn ? (
                  <span className="text-green-400">🏒 YOUR TURN! Draft a player below</span>
                ) : (
                  <span>Waiting for <span className="text-yellow-400">{currentPick.team}</span></span>
                )}
              </p>
              {myTeam && league?.rosterSettings && (
                <div className="mt-2 flex gap-4 text-sm">
                  <span className={myTeamPositions.active.F >= league.rosterSettings.forwards ? 'text-green-400' : 'text-gray-400'}>
                    F: {myTeamPositions.active.F}/{league.rosterSettings.forwards}
                  </span>
                  <span className={myTeamPositions.active.D >= league.rosterSettings.defensemen ? 'text-green-400' : 'text-gray-400'}>
                    D: {myTeamPositions.active.D}/{league.rosterSettings.defensemen}
                  </span>
                  <span className={myTeamPositions.active.G >= league.rosterSettings.goalies ? 'text-green-400' : 'text-gray-400'}>
                    G: {myTeamPositions.active.G}/{league.rosterSettings.goalies}
                  </span>
                  <span className="text-purple-400">
                    Reserves: {myTeamPositions.reserve}/5
                  </span>
                  <span className="text-gray-500">
                    ({myTeamPositions.total} total)
                  </span>
                </div>
              )}
            </div>
            {isMyTurn && (
              <div className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold animate-pulse">
                ON THE CLOCK
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin: Team Selector for Free Agent Pickups */}
      {isAdmin && (
        <div className="bg-purple-900/30 border border-purple-500/30 p-4 rounded-lg mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex-1">
              <p className="text-purple-200 font-semibold mb-1">
                👑 Admin Mode: Pick Up Free Agents
              </p>
              <p className="text-gray-400 text-sm">
                Select a team below, then click "Pick Up" on any undrafted player to add them to that team's roster.
              </p>
            </div>
            <div className="md:w-64">
              <label className="block text-white font-semibold mb-2 text-sm">Pick up for team:</label>
              <select
                value={pickupTeam}
                onChange={(e) => setPickupTeam(e.target.value)}
                className="w-full px-4 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none"
              >
                <option value="">-- Select Team --</option>
                {league?.teams.map((team) => (
                  <option key={team.teamName} value={team.teamName}>
                    {team.teamName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <label className="block text-white font-semibold mb-2">🔍 Search Players:</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name..."
              className="w-full px-4 py-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Position Filter */}
          <div className="md:w-48">
            <label className="block text-white font-semibold mb-2">Position:</label>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="w-full px-4 py-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="ALL">All Positions</option>
              <option value="F">Forwards (C/L/R)</option>
              <option value="C">Center (C)</option>
              <option value="L">Left Wing (L)</option>
              <option value="R">Right Wing (R)</option>
              <option value="D">Defense (D)</option>
              <option value="G">Goalie (G)</option>
            </select>
          </div>

          {/* Team Filter */}
          <div className="md:w-48">
            <label className="block text-white font-semibold mb-2">NHL Team:</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full px-4 py-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="ALL">All Teams</option>
              {Object.entries(NHL_TEAMS).map(([abbrev, name]) => (
                <option key={abbrev} value={abbrev}>
                  {abbrev} - {name}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Button */}
          {(searchQuery || positionFilter !== 'ALL' || teamFilter !== 'ALL') && (
            <div className="md:w-auto md:self-end">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setPositionFilter('ALL');
                  setTeamFilter('ALL');
                }}
                className="w-full md:w-auto px-4 py-3 rounded bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Results Count */}
        {!loading && roster.length > 0 && (
          <div className="mt-4 text-gray-400 text-sm">
            Showing {filteredRoster.length} of {roster.length} players
            {searchQuery && <span className="ml-1">matching "{searchQuery}"</span>}
            {positionFilter !== 'ALL' && <span className="ml-1">• Position: {positionFilter === 'F' ? 'Forwards' : positionFilter}</span>}
            {teamFilter !== 'ALL' && <span className="ml-1">• Team: {teamFilter}</span>}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center">
          <p className="text-gray-400 text-lg">Loading roster...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/50 border border-red-600 p-6 rounded-lg shadow-lg mb-8">
          <p className="text-red-200 font-semibold">⚠️ {error}</p>
        </div>
      )}

      {/* Roster Grid */}
      {!loading && !error && roster.length > 0 && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          {filteredRoster.length > 0 ? (
            <>
              <h3 className="text-xl font-semibold mb-6 text-white">
                {teamFilter !== 'ALL' ? `${NHL_TEAMS[teamFilter as TeamAbbrev]} - ` : 'All NHL Players - '}
                {filteredRoster.length} Player{filteredRoster.length !== 1 ? 's' : ''}
                {useVirtualization && <span className="ml-2 text-green-400 text-sm">⚡ Virtualized</span>}
              </h3>
              
              {/* Virtualized grid for large rosters (>100 players) */}
              {useVirtualization ? (
                <VirtuosoGrid
                  style={{ height: '800px' }}
                  totalCount={filteredRoster.length}
                  listClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                  itemContent={(index) => renderPlayerCard(filteredRoster[index])}
                />
              ) : (
                // Regular grid for small lists (<100 players)
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRoster.map((rosterPlayer) => renderPlayerCard(rosterPlayer))}
                </div>
              )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">No players found matching your search.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setPositionFilter('ALL');
              setTeamFilter('ALL');
            }}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
          >
            Clear Filters
          </button>
        </div>
      )}
        </div>
      )}
    </div>
  );
}
