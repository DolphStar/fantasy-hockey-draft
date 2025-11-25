import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';

import { useInjuries } from '../queries/useInjuries';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { isPlayerInjuredByName } from '../services/injuryService';
import { GlassCard } from './ui/GlassCard';
// Removed unused icon imports
import MyPlayerCard from './roster/MyPlayerCard';
import PlayerListRow from './roster/PlayerListRow';

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
  pendingSlot?: 'active' | 'reserve' | null;
}

interface TeamScore {
  id: string;
  teamName: string;
  totalPoints: number;
}

export default function PlayerList() {
  useAuth();
  const { league, myTeam } = useLeague();
  // draftState removed as unused
  const [players, setPlayers] = useState<DraftedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'points' | 'name' | 'position' | 'games'>('position');
  const [filterBy, setFilterBy] = useState<'all' | 'F' | 'D' | 'G'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [gameIdsToday, setGameIdsToday] = useState<Set<string>>(new Set());

  const [swapMode, setSwapMode] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const { data: injuries = [] } = useInjuries();

  const getNextSaturday = () => {
    const d = new Date();
    const today = d.getDay();
    const daysUntilSaturday = (6 - today + 7) % 7;
    if (today === 6 && d.getHours() >= 5) {
      d.setDate(d.getDate() + 7);
    } else if (daysUntilSaturday === 0) {
      d.setDate(d.getDate());
    } else {
      d.setDate(d.getDate() + daysUntilSaturday);
    }
    d.setHours(5, 0, 0, 0);
    return d;
  };

  const getOrdinalSuffix = (i: number) => {
    const j = i % 10,
      k = i % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };

  const handleSwap = async (player: DraftedPlayer) => {
    if (!swapMode) {
      setSwapMode(true);
      setSelectedPlayerId(player.id);
      toast.info(`Select a player to swap with ${player.name}`);
    } else {
      if (player.id === selectedPlayerId) {
        setSwapMode(false);
        setSelectedPlayerId(null);
        toast.info('Swap cancelled');
        return;
      }
      const player1 = players.find(p => p.id === selectedPlayerId);
      const player2 = player;
      if (!player1) return;
      const forwardPositions = ['C', 'L', 'R'];
      const isP1Forward = forwardPositions.includes(player1.position);
      const isP2Forward = forwardPositions.includes(player2.position);
      const isValidSwap = (isP1Forward && isP2Forward) || player1.position === player2.position;
      if (!isValidSwap) {
        toast.error(`Cannot swap ${player1.position} with ${player2.position}`);
        return;
      }
      try {
        const p1Slot = player1.rosterSlot || 'active';
        const p2Slot = player2.rosterSlot || 'active';
        if (p1Slot !== p2Slot) {
          const p1Ref = doc(db, 'draftedPlayers', player1.id);
          const p2Ref = doc(db, 'draftedPlayers', player2.id);
          await updateDoc(p1Ref, { pendingSlot: p2Slot });
          await updateDoc(p2Ref, { pendingSlot: p1Slot });
          toast.success('Swap requested!');
        } else {
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

  const handleCancelSwap = async (player: DraftedPlayer) => {
    if (window.confirm(`Are you sure you want to cancel the pending swap for ${player.name}?`)) {
      try {
        const playerRef = doc(db, 'draftedPlayers', player.id);
        await updateDoc(playerRef, { pendingSlot: null });
        toast.success('Swap cancelled successfully');
      } catch (error) {
        console.error('Error cancelling swap:', error);
        toast.error('Failed to cancel swap');
      }
    }
  };

  const countActiveRoster = () => {
    const active = players.filter(p => (p.rosterSlot || 'active') === 'active');
    const forwards = active.filter(p => ['C', 'L', 'R'].includes(p.position)).length;
    const defense = active.filter(p => p.position === 'D').length;
    const goalies = active.filter(p => p.position === 'G').length;
    return { forwards, defense, goalies, total: active.length };
  };

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
    const unsubscribe = onSnapshot(q, snapshot => {
      const playersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DraftedPlayer));
      setPlayers(playersData);
      setLoading(false);
    }, error => {
      console.error('Error listening to players:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [myTeam]);

  const [playerPoints, setPlayerPoints] = useState<Record<number, number>>({});
  const [playerStats, setPlayerStats] = useState<Record<number, { goals: number; assists: number; gamesPlayed: number; avgPoints: number }>>({});
  const [playerHistory, setPlayerHistory] = useState<Record<number, { points: number }[]>>({});
  const [dailyTeamTotals, setDailyTeamTotals] = useState<{ date: string; points: number }[]>([]);
  const [lastGamePoints, setLastGamePoints] = useState(0);
  const [trend, setTrend] = useState<'up' | 'down' | 'neutral'>('neutral');

  useEffect(() => {
    if (!league || !myTeam) return;
    const fetchPlayerPoints = async () => {
      try {
        const scoresQuery = query(
          collection(db, `leagues/${league.id}/playerDailyScores`)
        );
        const snapshot = await getDocs(scoresQuery);
        const pointsMap: Record<number, number> = {};
        const statsMap: Record<number, { goals: number; assists: number; gamesPlayed: number; avgPoints: number }> = {};
        const historyMap: Record<number, { date: string; points: number }[]> = {};
        const dailyTotalsMap: Record<string, number> = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const playerId = data.playerId as number;
          const points = data.points || 0;
          const date = data.date as string;
          const teamName = data.teamName as string;
          if (pointsMap[playerId]) {
            pointsMap[playerId] += points;
            statsMap[playerId].goals += (data.stats?.goals || 0);
            statsMap[playerId].assists += (data.stats?.assists || 0);
            statsMap[playerId].gamesPlayed += 1;
          } else {
            pointsMap[playerId] = points;
            statsMap[playerId] = {
              goals: data.stats?.goals || 0,
              assists: data.stats?.assists || 0,
              gamesPlayed: 1,
              avgPoints: 0,
            };
          }
          if (!historyMap[playerId]) historyMap[playerId] = [];
          historyMap[playerId].push({ date, points });
          if (teamName === myTeam.teamName) {
            dailyTotalsMap[date] = (dailyTotalsMap[date] ?? 0) + points;
          }
        });
        Object.keys(statsMap).forEach(pid => {
          const id = Number(pid);
          const games = statsMap[id].gamesPlayed;
          statsMap[id].avgPoints = games > 0 ? pointsMap[id] / games : 0;
        });
        setPlayerPoints(pointsMap);
        setPlayerStats(statsMap);
        const processedHistory: Record<number, { points: number }[]> = {};
        Object.keys(historyMap).forEach(pid => {
          const sorted = historyMap[Number(pid)].sort((a, b) => a.date.localeCompare(b.date));
          processedHistory[Number(pid)] = sorted.slice(-5).map(h => ({ points: h.points }));
        });
        setPlayerHistory(processedHistory);
        const sortedDates = Object.keys(dailyTotalsMap).sort();
        const totalsArray = sortedDates.map(date => ({ date, points: dailyTotalsMap[date] }));
        setDailyTeamTotals(totalsArray);
        if (totalsArray.length > 0) {
          const last = totalsArray[totalsArray.length - 1].points;
          setLastGamePoints(last);
          if (totalsArray.length > 1) {
            const prev = totalsArray[totalsArray.length - 2].points;
            setTrend(last > prev ? 'up' : last < prev ? 'down' : 'neutral');
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

  const [teamStats, setTeamStats] = useState<{ rank: number; totalPoints: number } | null>(null);

  useEffect(() => {
    if (!league || !myTeam) return;
    const fetchTeamStats = async () => {
      try {
        const scoresQuery = query(
          collection(db, `leagues/${league.id}/teamScores`),
          orderBy('totalPoints', 'desc')
        );
        const snapshot = await getDocs(scoresQuery);
        const teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as TeamScore));
        const myTeamIndex = teams.findIndex(t => t.teamName === myTeam.teamName);
        if (myTeamIndex !== -1) {
          setTeamStats({ rank: myTeamIndex + 1, totalPoints: teams[myTeamIndex].totalPoints || 0 });
        } else {
          setTeamStats({ rank: teams.length + 1, totalPoints: 0 });
        }
      } catch (error) {
        console.error('Error fetching team stats:', error);
      }
    };
    fetchTeamStats();
  }, [league, myTeam]);

  useEffect(() => {
    if (!league || !myTeam) return;
    const today = new Date().toISOString().split('T')[0];
    const liveStatsRef = collection(db, `leagues/${league.id}/liveStats`);
    const q = query(liveStatsRef);
    const unsubscribe = onSnapshot(q, snapshot => {
      const playingToday = new Set<string>();
      snapshot.docs.forEach(doc => {
        if (doc.id.startsWith(today)) {
          const data = doc.data();
          playingToday.add(String(data.playerId));
        }
      });
      setGameIdsToday(playingToday);
    });
    return () => unsubscribe();
  }, [league, myTeam]);

  const getSparklinePath = (data: { points: number }[], width: number, height: number) => {
    if (data.length < 2) return '';
    const maxPoints = Math.max(...data.map(d => d.points));
    const minPoints = Math.min(...data.map(d => d.points));
    const range = maxPoints - minPoints || 1;
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const normalizedY = (d.points - minPoints) / range;
      const y = height - normalizedY * height;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  };

  const getSparklineArea = (data: { points: number }[], width: number, height: number) => {
    const linePath = getSparklinePath(data, width, height);
    if (!linePath) return '';
    return `${linePath} L ${width},${height} L 0,${height} Z`;
  };

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
    <div className="max-w-[1600px] mx-auto">
      {/* Hero Dashboard Header - Combined Title & Stats */}
      <div className="w-full mb-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-900/50 border border-white/10 backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.6)]">
          {/* Background sparkline */}
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
          
          {/* Content: Flex row - stacks on mobile */}
          <div className="relative z-10 px-8 py-6 flex flex-col md:flex-row items-center gap-6">
            {/* Left Side: Avatar + Team Name */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-3xl font-light text-white shadow-lg">
                {myTeam.teamName[0].toUpperCase()}
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase">
                  {myTeam.teamName}'s Roster
                </h1>
                <p className="text-blue-100/80 text-xs uppercase tracking-[0.3em] drop-shadow-[0_0_6px_rgba(59,130,246,0.4)]">Fantasy Hockey Team</p>
              </div>
            </div>
            
            {/* Right Side: Stats - pushed right on desktop */}
            {teamStats && (
              <div className="flex items-center gap-8 md:ml-auto">
                <div className="flex flex-col items-center px-6 border-r border-white/10">
                  <span className="text-xs text-cyan-200/70 uppercase tracking-[0.15em] font-bold mb-1">Season Points</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
                      {teamStats.totalPoints.toLocaleString()}
                    </span>
                    {lastGamePoints > 0 && (
                      <div className={cn(
                        "flex items-center text-xs font-bold px-2 py-0.5 rounded-full",
                        trend === 'up' ? "text-green-400 bg-green-500/10" :
                          trend === 'down' ? "text-red-400 bg-red-500/10" : "text-gray-400 bg-gray-500/10"
                      )}>
                        <span>{trend === 'up' ? '▲' : trend === 'down' ? '▼' : '•'}</span>
                        <span className="ml-1">{lastGamePoints.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center px-6">
                  <span className="text-xs text-emerald-200/70 uppercase tracking-[0.15em] font-bold mb-1">League Rank</span>
                  <span className="text-4xl font-black text-white drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]">
                    {teamStats.rank}<sup className="text-xl align-top opacity-60">{getOrdinalSuffix(teamStats.rank)}</sup>
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500 opacity-50" />
        </div>
      </div>

      {/* Active Roster */}
      <GlassCard className="p-6 mb-6 bg-gray-900/40 border-gray-700/30 backdrop-blur-md">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-6 gap-4">
          {/* Color-Coded Filter Navigation - Synced with card badge colors */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setFilterBy('all')} 
              className={cn(
                "px-4 py-2 rounded-full text-sm font-semibold transition-all border",
                filterBy === 'all' 
                  ? "bg-white text-slate-900 border-white shadow-lg" 
                  : "text-gray-300 border-gray-500/50 hover:text-white hover:border-gray-400"
              )}
            >
              All <span className="ml-1 opacity-70">{activePlayers.length + reservePlayers.length}</span>
            </button>
            <button 
              onClick={() => setFilterBy('F')} 
              className={cn(
                "px-4 py-2 rounded-full text-sm font-semibold transition-all border",
                filterBy === 'F' 
                  ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30" 
                  : "text-blue-300 border-blue-500/40 hover:bg-blue-600/10 hover:border-blue-500/60"
              )}
            >
              Forwards <span className="ml-1 opacity-70">{rosterCounts.forwards}</span>
            </button>
            <button 
              onClick={() => setFilterBy('D')} 
              className={cn(
                "px-4 py-2 rounded-full text-sm font-semibold transition-all border",
                filterBy === 'D' 
                  ? "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/30" 
                  : "text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/10 hover:border-emerald-500/60"
              )}
            >
              Defense <span className="ml-1 opacity-70">{rosterCounts.defense}</span>
            </button>
            <button 
              onClick={() => setFilterBy('G')} 
              className={cn(
                "px-4 py-2 rounded-full text-sm font-semibold transition-all border",
                filterBy === 'G' 
                  ? "bg-amber-400 text-slate-900 border-amber-300 shadow-lg shadow-amber-400/30" 
                  : "text-amber-300 border-amber-400/40 hover:bg-amber-400/10 hover:border-amber-400/60"
              )}
            >
              Goalies <span className="ml-1 opacity-70">{rosterCounts.goalies}</span>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-300 text-sm">
              <span className="text-gray-400 text-xs font-medium">Sort by:</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="bg-slate-800/80 border border-slate-600/50 rounded-lg px-3 py-1.5 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-slate-700/80 transition-colors cursor-pointer">
                <option value="position">Position</option>
                <option value="points">Points</option>
                <option value="name">Name</option>
                <option value="games">Playing Today</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-gray-300 text-sm">
              <span className="text-gray-400 text-xs font-medium">View:</span>
              <div className="flex bg-slate-800/50 rounded-lg p-1 border border-slate-600/50">
                <button onClick={() => setViewMode('grid')} className={cn("px-3 py-1 rounded-md text-xs font-semibold transition-all", viewMode === 'grid' ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white hover:bg-slate-700")}>Grid</button>
                <button onClick={() => setViewMode('list')} className={cn("px-3 py-1 rounded-md text-xs font-semibold transition-all", viewMode === 'list' ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white hover:bg-slate-700")}>List</button>
              </div>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10 animate-pulse">
            {[1, 2, 3, 4].map(i => (<div key={i} className="h-48 bg-gray-800/50 rounded-xl" />))}
          </div>
        ) : activePlayers.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-700/50 rounded-xl"><p className="text-gray-400">No active players. Move players from reserve to active roster.</p></div>
        ) : (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
              {activePlayers.map(player => (
                <div key={`${player.id}-${sortBy}`} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <MyPlayerCard player={player} fantasyPoints={playerPoints[Number(player.playerId)]} stats={playerStats[Number(player.playerId)]} history={playerHistory[Number(player.playerId)]} injury={isPlayerInjuredByName(player.name, injuries) || undefined} isPlayingToday={gameIdsToday.has(player.playerId)} onSwap={handleSwap} onCancelSwap={handleCancelSwap} isSelected={selectedPlayerId === player.id} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {activePlayers.map(player => (
                <PlayerListRow key={player.id} player={player} fantasyPoints={playerPoints[Number(player.playerId)]} stats={playerStats[Number(player.playerId)]} injury={isPlayerInjuredByName(player.name, injuries) || undefined} onSwap={handleSwap} onCancelSwap={handleCancelSwap} isSelected={selectedPlayerId === player.id} />
              ))}
            </div>
          )
        )}
      </GlassCard>

      {/* Reserve Roster */}
      <GlassCard className="p-6 mb-6 bg-gray-900/40 border-gray-700/30 backdrop-blur-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="bg-yellow-500/20 text-yellow-400 p-2 rounded-lg">💼</span>
            Reserve Roster
            <span className="text-gray-500 text-lg font-normal">({reservePlayers.length})</span>
          </h3>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10 animate-pulse">
            {[1, 2].map(i => (<div key={i} className="h-48 bg-gray-800/50 rounded-xl" />))}
          </div>
        ) : players.length === 0 ? (
          <p className="text-gray-400">No players drafted yet. Go to the \"NHL Rosters\" tab and click \"Draft Player\" on any player!</p>
        ) : reservePlayers.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-700/50 rounded-xl"><p className="text-gray-400">No reserve players. All players are on active roster.</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
            {reservePlayers.map(player => (
              <MyPlayerCard key={player.id} player={player} fantasyPoints={playerPoints[Number(player.playerId)] || 0} stats={playerStats[Number(player.playerId)]} history={playerHistory[Number(player.playerId)]} injury={isPlayerInjuredByName(player.name, injuries) || undefined} isPlayingToday={gameIdsToday.has(player.playerId)} onSwap={handleSwap} onCancelSwap={handleCancelSwap} isSelected={selectedPlayerId === player.id} />
            ))}
          </div>
        )}
      </GlassCard>

      {/* Roster Lock Info */}
      <div className="mt-4 max-w-4xl mx-auto">
        <div className="bg-blue-900/20 border border-blue-500/20 p-3 rounded-xl backdrop-blur-sm">
          <p className="text-blue-300/80 text-xs text-center flex items-center justify-center gap-2">
            <span>📅 Next Roster Lock: {nextSaturday.toLocaleString()}</span>
            <span className="w-1 h-1 rounded-full bg-blue-500/50" />
            <span>Pending swaps will apply then</span>
          </p>
        </div>
      </div>
    </div>
  );
}
