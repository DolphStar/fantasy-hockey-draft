import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { isPlayerInjuredByName } from '../services/injuryService';
import { useInjuries } from '../queries/useInjuries';
import { toast } from 'sonner';
import { GlassCard } from './ui/GlassCard';
import { cn } from '../lib/utils';
import MyPlayerCard from './roster/MyPlayerCard';

interface DraftedPlayer {
  id: string;
  playerId: string;
  name: string;
  position: string;
  positionName: string;
  nhlTeam: string;
  jerseyNumber: number;
  round: number;
  pickNumber: number;
  draftedBy: string;
  draftedByTeam: string;
  rosterSlot: 'active' | 'reserve';
  pendingSlot?: 'active' | 'reserve' | null; // For pending swaps
}

interface TeamScore {
  id: string;
  teamName: string;
  totalPoints: number;
}

export default function PlayerList() {
  useAuth();
  const { league, myTeam } = useLeague();
  const [players, setPlayers] = useState<DraftedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'points' | 'name' | 'position' | 'games'>('position');
  const [filterBy, setFilterBy] = useState<'all' | 'F' | 'D' | 'G'>('all');
  const [gameIdsToday, setGameIdsToday] = useState<Set<string>>(new Set());

  // Swap State
  const [swapMode, setSwapMode] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const { data: injuries = [] } = useInjuries();

  // Helper to get next Saturday at 5 AM
  const getNextSaturday = () => {
    const d = new Date();
    const today = d.getDay(); // 0 = Sunday, 6 = Saturday
    const daysUntilSaturday = (6 - today + 7) % 7;

    // If today is Saturday and it's already past 5 AM, move to next Saturday
    if (today === 6 && d.getHours() >= 5) {
      d.setDate(d.getDate() + 7);
    } else if (daysUntilSaturday === 0) {
      // Today is Saturday but before 5 AM, so use today
      d.setDate(d.getDate());
    } else {
      // Add days until next Saturday
      d.setDate(d.getDate() + daysUntilSaturday);
    }

    d.setHours(5, 0, 0, 0);
    return d;
  };

  // Helper to get ordinal suffix
  const getOrdinalSuffix = (i: number) => {
    const j = i % 10,
      k = i % 100;
    if (j === 1 && k !== 11) {
      return "st";
    }
    if (j === 2 && k !== 12) {
      return "nd";
    }
    if (j === 3 && k !== 13) {
      return "rd";
    }
    return "th";
  };

  // Handle Swap Logic
  const handleSwap = async (player: DraftedPlayer) => {
    if (!swapMode) {
      // Enter Swap Mode
      setSwapMode(true);
      setSelectedPlayerId(player.id);
      toast.info(`Select a player to swap with ${player.name}`);
    } else {
      // Execute Swap or Cancel
      if (player.id === selectedPlayerId) {
        setSwapMode(false);
        setSelectedPlayerId(null);
        toast.info('Swap cancelled');
        return;
      }

      const player1 = players.find(p => p.id === selectedPlayerId);
      const player2 = player;

      if (!player1) return;

      // Validate Swap
      const forwardPositions = ['C', 'L', 'R'];
      const isP1Forward = forwardPositions.includes(player1.position);
      const isP2Forward = forwardPositions.includes(player2.position);

      let isValidSwap = false;
      if (isP1Forward && isP2Forward) isValidSwap = true;
      else if (player1.position === player2.position) isValidSwap = true;

      if (!isValidSwap) {
        toast.error(`Cannot swap ${player1.position} with ${player2.position}`);
        return;
      }

      // Execute Swap
      try {
        const player1CurrentSlot = player1.rosterSlot || 'active';
        const player2CurrentSlot = player2.rosterSlot || 'active';

        // If slots are different, we swap them
        if (player1CurrentSlot !== player2CurrentSlot) {
          const p1Ref = doc(db, 'draftedPlayers', player1.id);
          const p2Ref = doc(db, 'draftedPlayers', player2.id);

          await updateDoc(p1Ref, { pendingSlot: player2CurrentSlot });
          await updateDoc(p2Ref, { pendingSlot: player1CurrentSlot });

          toast.success('Swap requested!');
        } else {
          // Same slot (reordering) - Not supported by backend yet
          toast.info('Swapping players in the same slot has no effect yet.');
        }

        setSwapMode(false);
        setSelectedPlayerId(null);
      } catch (error) {
        console.error('Error swapping:', error);
        toast.error('Failed to swap players');
      }
    }
  };

  // Handle Cancel Swap
  const handleCancelSwap = async (player: DraftedPlayer) => {
    if (window.confirm(`Are you sure you want to cancel the pending swap for ${player.name}?`)) {
      try {
        const playerRef = doc(db, 'draftedPlayers', player.id);
        // We set pendingSlot to null to remove the pending status
        await updateDoc(playerRef, { pendingSlot: null });
        toast.success('Swap cancelled successfully');
      } catch (error) {
        console.error('Error cancelling swap:', error);
        toast.error('Failed to cancel swap');
      }
    }
  };

  // Count active roster by position
  const countActiveRoster = () => {
    const active = players.filter(p => (p.rosterSlot || 'active') === 'active');
    const forwards = active.filter(p => ['C', 'L', 'R'].includes(p.position)).length;
    const defense = active.filter(p => p.position === 'D').length;
    const goalies = active.filter(p => p.position === 'G').length;
    return { forwards, defense, goalies, total: active.length };
  };

  // Real-time listener for drafted players
  useEffect(() => {
    if (!myTeam) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'draftedPlayers'),
      where('draftedByTeam', '==', myTeam.teamName),
      orderBy('pickNumber', 'asc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const playersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DraftedPlayer));

      setPlayers(playersData);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to players:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [myTeam]);

  // Fetch player fantasy points (aggregated from daily scores)
  const [playerPoints, setPlayerPoints] = useState<Record<number, number>>({});
  const [playerStats, setPlayerStats] = useState<Record<number, { goals: number; assists: number; gamesPlayed: number; avgPoints: number }>>({});
  const [playerHistory, setPlayerHistory] = useState<Record<number, { points: number }[]>>({});
  const [dailyTeamTotals, setDailyTeamTotals] = useState<{ date: string; points: number }[]>([]);
  const [lastGamePoints, setLastGamePoints] = useState<number>(0);
  const [trend, setTrend] = useState<'up' | 'down' | 'neutral'>('neutral');

  useEffect(() => {
    if (!league || !myTeam) return;

    const fetchPlayerPoints = async () => {
      try {
        const scoresQuery = query(
          collection(db, `leagues/${league.id}/playerDailyScores`)
        );

        const snapshot = await import('firebase/firestore').then(mod => mod.getDocs(scoresQuery));

        const pointsMap: Record<number, number> = {};
        const statsMap: Record<number, { goals: number; assists: number; gamesPlayed: number; avgPoints: number }> = {};
        const historyMap: Record<number, { date: string; points: number }[]> = {};
        const dailyTotalsMap: Record<string, number> = {};

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const playerId = data.playerId;
          const points = data.points || 0;
          const date = data.date;
          const teamName = data.teamName;

          // Aggregate total points per player
          if (pointsMap[playerId]) {
            pointsMap[playerId] += points;
            statsMap[playerId].goals += (data.goals || 0);
            statsMap[playerId].assists += (data.assists || 0);
            statsMap[playerId].gamesPlayed += 1;
          } else {
            pointsMap[playerId] = points;
            statsMap[playerId] = {
              goals: data.goals || 0,
              assists: data.assists || 0,
              gamesPlayed: 1,
              avgPoints: 0
            };
          }

          // Collect history per player
          if (!historyMap[playerId]) historyMap[playerId] = [];
          historyMap[playerId].push({ date, points });

          // Aggregate daily totals for MY team
          if (teamName === myTeam.teamName) {
            if (dailyTotalsMap[date]) {
              dailyTotalsMap[date] += points;
            } else {
              dailyTotalsMap[date] = points;
            }
          }
        });

        // Calculate average points per game
        Object.keys(statsMap).forEach(pid => {
          const playerId = Number(pid);
          const games = statsMap[playerId].gamesPlayed;
          statsMap[playerId].avgPoints = games > 0 ? pointsMap[playerId] / games : 0;
        });

        setPlayerPoints(pointsMap);
        setPlayerStats(statsMap);

        // Process history (sort by date, take last 5)
        const processedHistory: Record<number, { points: number }[]> = {};
        Object.keys(historyMap).forEach(pid => {
          const sorted = historyMap[Number(pid)].sort((a, b) => a.date.localeCompare(b.date));
          processedHistory[Number(pid)] = sorted.slice(-5).map(h => ({ points: h.points }));
        });
        setPlayerHistory(processedHistory);

        // Process daily totals for sparkline
        const sortedDates = Object.keys(dailyTotalsMap).sort();
        const totalsArray = sortedDates.map(date => ({
          date,
          points: dailyTotalsMap[date]
        }));

        setDailyTeamTotals(totalsArray);

        // Calculate trend
        if (totalsArray.length > 0) {
          const last = totalsArray[totalsArray.length - 1].points;
          setLastGamePoints(last);

          if (totalsArray.length > 1) {
            const prev = totalsArray[totalsArray.length - 2].points;
            if (last > prev) setTrend('up');
            else if (last < prev) setTrend('down');
            else setTrend('neutral');
          } else {
            setTrend('neutral');
          }
        }

      } catch (error) {
        console.error('Error fetching player points:', error);
      }
    };

    fetchPlayerPoints();
  }, [league, myTeam]);

  // Fetch team rank and total points
  const [teamStats, setTeamStats] = useState<{ rank: number; totalPoints: number } | null>(null);

  useEffect(() => {
    if (!league || !myTeam) return;

    const fetchTeamStats = async () => {
      try {
        const scoresQuery = query(
          collection(db, `leagues/${league.id}/teamScores`),
          orderBy('totalPoints', 'desc')
        );

        const snapshot = await import('firebase/firestore').then(mod => mod.getDocs(scoresQuery));
        const teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as TeamScore));

        const myTeamIndex = teams.findIndex(t => t.teamName === myTeam.teamName);

        if (myTeamIndex !== -1) {
          setTeamStats({
            rank: myTeamIndex + 1,
            totalPoints: teams[myTeamIndex].totalPoints || 0
          });
        } else {
          setTeamStats({ rank: teams.length + 1, totalPoints: 0 });
        }
      } catch (error) {
        console.error('Error fetching team stats:', error);
      }
    };

    fetchTeamStats();
  }, [league, myTeam]);

  // Fetch today's games
  useEffect(() => {
    if (!league || !myTeam) return;

    const today = new Date().toISOString().split('T')[0];
    const liveStatsRef = collection(db, `leagues/${league.id}/liveStats`);
    const q = query(liveStatsRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const playingToday = new Set<string>();
      snapshot.docs.forEach((doc) => {
        if (doc.id.startsWith(today)) {
          const data = doc.data();
          playingToday.add(String(data.playerId));
        }
      });
      setGameIdsToday(playingToday);
    });

    return () => unsubscribe();
  }, [league, myTeam]);

  // Helper to generate sparkline path
  const getSparklinePath = (data: { points: number }[], width: number, height: number) => {
    if (data.length < 2) return "";

    const maxPoints = Math.max(...data.map(d => d.points));
    const minPoints = Math.min(...data.map(d => d.points));
    const range = maxPoints - minPoints || 1;

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const normalizedY = (d.points - minPoints) / range;
      const y = height - (normalizedY * height);
      return `${x},${y}`;
    });

    return `M ${points.join(" L ")}`;
  };

  const getSparklineArea = (data: { points: number }[], width: number, height: number) => {
    const linePath = getSparklinePath(data, width, height);
    if (!linePath) return "";
    return `${linePath} L ${width},${height} L 0,${height} Z`;
  };

  // Filter and Sort Logic
  const getFilteredAndSortedPlayers = (rosterSlot: 'active' | 'reserve') => {
    let filtered = players.filter(p => (p.rosterSlot || 'active') === rosterSlot);

    if (filterBy !== 'all') {
      filtered = filtered.filter(p => {
        if (filterBy === 'F') return ['C', 'L', 'R'].includes(p.position);
        if (filterBy === 'D') return p.position === 'D';
        if (filterBy === 'G') return p.position === 'G';
        return true;
      });
    }

    return filtered.sort((a, b) => {
      if (sortBy === 'points') {
        const pointsA = playerPoints[Number(a.playerId)] || 0;
        const pointsB = playerPoints[Number(b.playerId)] || 0;
        return pointsB - pointsA;
      }

      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }

      if (sortBy === 'games') {
        const aPlaying = gameIdsToday.has(a.playerId) ? 1 : 0;
        const bPlaying = gameIdsToday.has(b.playerId) ? 1 : 0;
        if (aPlaying !== bPlaying) return bPlaying - aPlaying;
      }

      const getPositionOrder = (pos: string) => {
        if (['C', 'L', 'R'].includes(pos)) return 1;
        if (pos === 'D') return 2;
        if (pos === 'G') return 3;
        return 4;
      };

      const orderDiff = getPositionOrder(a.position) - getPositionOrder(b.position);
      if (orderDiff !== 0) return orderDiff;

      return a.pickNumber - b.pickNumber;
    });
  };

  const activePlayers = getFilteredAndSortedPlayers('active');
  const reservePlayers = getFilteredAndSortedPlayers('reserve');
  const rosterCounts = countActiveRoster();
  const nextSaturday = getNextSaturday();

  if (!league || !myTeam) {
    return (
      <div className="max-w-[1600px] mx-auto p-6">
        <h2 className="text-3xl font-bold mb-6 text-white">My Players</h2>
        <GlassCard className="p-8 text-center">
          <p className="text-gray-400 text-lg">No league found. Create or join a league to see your roster.</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto p-6">
      {/* Header Section */}
      <div className="flex flex-col items-center justify-center mb-8 relative">
        <h2 className="text-4xl font-black text-white uppercase tracking-widest mb-2 text-center drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
          {myTeam.teamName}'s Roster
        </h2>

        {/* Performance Dashboard */}
        {teamStats && (
          <div className="w-full max-w-3xl mx-auto mb-8">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-900/50 border border-white/10 backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.6)]">

              {/* Background Sparkline */}
              <div className="absolute inset-0 opacity-20 pointer-events-none">
                {dailyTeamTotals.length > 1 && (
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox={`0 0 1000 100`}>
                    <defs>
                      <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={getSparklineArea(dailyTeamTotals, 1000, 100)} fill="url(#sparkGradient)" />
                    <path d={getSparklinePath(dailyTeamTotals, 1000, 100)} fill="none" stroke="#22d3ee" strokeWidth="2" />
                  </svg>
                )}
              </div>

              <div className="relative z-10 px-10 py-6 flex items-center justify-between">
                {/* Total Points */}
                <div className="flex flex-col items-center flex-1 border-r border-white/10">
                  <span className="text-xs text-cyan-200/70 uppercase tracking-[0.2em] font-bold mb-1">Season Points</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-white drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
                      {teamStats.totalPoints.toLocaleString()}
                    </span>
                    {lastGamePoints > 0 && (
                      <div className={cn(
                        "flex items-center text-sm font-bold px-2 py-0.5 rounded-full",
                        trend === 'up' ? "text-green-400 bg-green-500/10" :
                          trend === 'down' ? "text-red-400 bg-red-500/10" : "text-gray-400 bg-gray-500/10"
                      )}>
                        <span>{trend === 'up' ? '▲' : trend === 'down' ? '▼' : '•'}</span>
                        <span className="ml-1">{lastGamePoints.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1 font-medium">
                    {dailyTeamTotals.length > 0 ? 'Last Game Points' : 'No games played yet'}
                  </span>
                </div>

                {/* Rank */}
                <div className="flex flex-col items-center flex-1">
                  <span className="text-xs text-green-200/70 uppercase tracking-[0.2em] font-bold mb-1">League Rank</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-white drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]">
                      {teamStats.rank}<sup className="text-2xl align-top opacity-60">{getOrdinalSuffix(teamStats.rank)}</sup>
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1 font-medium">
                    {teamStats.rank === 1 ? 'League Leader 👑' : `Top ${Math.round((teamStats.rank / 12) * 100)}% of League`}
                  </span>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-green-500 opacity-50"></div>
            </div>
          </div>
        )}
      </div>



      {/* Active Roster */}
      <GlassCard className="p-6 mb-6 bg-gray-900/40 border-gray-700/30 backdrop-blur-md">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="bg-green-500/20 text-green-400 p-2 rounded-lg shadow-[0_0_15px_rgba(74,222,128,0.2)]">🏒</span>
              Active Roster
              <span className="text-gray-500 text-lg font-normal">({activePlayers.length})</span>
            </h3>
            {league?.rosterSettings && (
              <div className="flex gap-2 text-xs bg-gray-800/50 p-1.5 rounded-lg border border-gray-700/50">
                <div className={cn("px-2 py-0.5 rounded flex items-center gap-1.5", rosterCounts.forwards >= league.rosterSettings.forwards ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-gray-400')}>
                  <span className="font-bold">F</span> {rosterCounts.forwards}/{league.rosterSettings.forwards}
                </div>
                <div className={cn("px-2 py-0.5 rounded flex items-center gap-1.5", rosterCounts.defense >= league.rosterSettings.defensemen ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'text-gray-400')}>
                  <span className="font-bold">D</span> {rosterCounts.defense}/{league.rosterSettings.defensemen}
                </div>
                <div className={cn("px-2 py-0.5 rounded flex items-center gap-1.5", rosterCounts.goalies >= league.rosterSettings.goalies ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'text-gray-400')}>
                  <span className="font-bold">G</span> {rosterCounts.goalies}/{league.rosterSettings.goalies}
                </div>
              </div>
            )}
          </div>

          {/* Compact Filter & Sort Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter */}
            <div className="flex bg-slate-800/50 rounded-lg p-1 border border-white/5">
              {(['all', 'F', 'D', 'G'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setFilterBy(filter)}
                  className={cn(
                    "px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all",
                    filterBy === filter
                      ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  {filter === 'all' ? 'All' : filter}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex bg-slate-800/50 rounded-lg p-1 border border-white/5">
              {[
                { id: 'points', label: 'Pts' },
                { id: 'name', label: 'Name' },
                { id: 'position', label: 'Pos' },
                { id: 'games', label: 'Gms' }
              ].map((sort) => (
                <button
                  key={sort.id}
                  onClick={() => setSortBy(sort.id as 'points' | 'name' | 'position' | 'games')}
                  className={cn(
                    "px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all",
                    sortBy === sort.id
                      ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  {sort.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10 animate-pulse">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-gray-800/50 rounded-xl"></div>
            ))}
          </div>
        ) : activePlayers.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-700/50 rounded-xl">
            <p className="text-gray-400">No active roster players yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
            {activePlayers.map((player) => (
              <MyPlayerCard
                key={player.id}
                player={player}
                fantasyPoints={playerPoints[Number(player.playerId)] || 0}
                stats={playerStats[Number(player.playerId)]}
                history={playerHistory[Number(player.playerId)]}
                injury={isPlayerInjuredByName(player.name, injuries) || undefined}
                onSwap={handleSwap}
                onCancelSwap={handleCancelSwap}
                isSelected={selectedPlayerId === player.id}
              />
            ))}
          </div>
        )}
      </GlassCard>

      {/* Reserve Roster */}
      <GlassCard className="p-6 bg-gray-900/40 border-gray-700/30 backdrop-blur-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="bg-yellow-500/20 text-yellow-400 p-2 rounded-lg">💼</span>
            Reserve Roster
            <span className="text-gray-500 text-lg font-normal">({reservePlayers.length})</span>
          </h3>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10 animate-pulse">
            {[1, 2].map(i => (
              <div key={i} className="h-48 bg-gray-800/50 rounded-xl"></div>
            ))}
          </div>
        ) : players.length === 0 ? (
          <p className="text-gray-400">
            No players drafted yet. Go to the "NHL Rosters" tab and click "Draft Player" on any player!
          </p>
        ) : reservePlayers.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-700/50 rounded-xl">
            <p className="text-gray-400">No reserve players. All players are on active roster.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
            {reservePlayers.map((player) => (
              <MyPlayerCard
                key={player.id}
                player={player}
                fantasyPoints={playerPoints[Number(player.playerId)] || 0}
                stats={playerStats[Number(player.playerId)]}
                history={playerHistory[Number(player.playerId)]}
                injury={isPlayerInjuredByName(player.name, injuries) || undefined}
                onSwap={handleSwap}
                onCancelSwap={handleCancelSwap}
                isSelected={selectedPlayerId === player.id}
              />
            ))}
          </div>
        )}
      </GlassCard>

      {/* Roster Lock Info - Moved to bottom */}
      <div className="mt-4 max-w-4xl mx-auto">
        <div className="bg-blue-900/20 border border-blue-500/20 p-3 rounded-xl backdrop-blur-sm">
          <p className="text-blue-300/80 text-xs text-center flex items-center justify-center gap-2">
            <span>📅 Next Roster Lock: {nextSaturday.toLocaleString()}</span>
            <span className="w-1 h-1 rounded-full bg-blue-500/50"></span>
            <span>Pending swaps will apply then</span>
          </p>
        </div>
      </div>
    </div>
  );
}
