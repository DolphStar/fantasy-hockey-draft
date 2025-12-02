import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { useDraft } from '../context/DraftContext';
import { useLeague } from '../context/LeagueContext';
import { GlassCard } from './ui/GlassCard';
import { Badge } from './ui/Badge';
import { cn } from '../lib/utils';

interface DraftedPlayer {
  id: string;
  playerId: number;
  name: string;
  position: string;
  nhlTeam: string;
  draftedByTeam: string;
  pickNumber: number;
  round: number;
  headshotUrl?: string;
}

const addAlpha = (hex: string, alpha: number) => {
  const sanitized = hex.replace('#', '');
  const bigint = parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function DraftBoardGrid() {
  const { draftState } = useDraft();
  const { league } = useLeague();
  const [draftedPlayers, setDraftedPlayers] = useState<DraftedPlayer[]>([]);
  const [animatingPick, setAnimatingPick] = useState<number | null>(null);

  // Listen to drafted players in real-time
  // IMPORTANT: Empty dependency array - runs once on mount
  // Using ref to track previous players for animation detection
  const prevPlayersRef = useRef<DraftedPlayer[]>([]);
  
  useEffect(() => {
    const q = query(
      collection(db, 'draftedPlayers'),
      orderBy('pickNumber', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const players: DraftedPlayer[] = [];
      snapshot.forEach((doc) => {
        players.push({ id: doc.id, ...doc.data() } as DraftedPlayer);
      });

      // Detect newly drafted players for animation using ref (not state)
      const newPlayers = players.filter(
        p => !prevPlayersRef.current.find((dp: DraftedPlayer) => dp.pickNumber === p.pickNumber)
      );
      if (newPlayers.length > 0) {
        const latestPick = newPlayers[newPlayers.length - 1];
        setAnimatingPick(latestPick.pickNumber);
        setTimeout(() => setAnimatingPick(null), 1000);
      }

      prevPlayersRef.current = players;
      setDraftedPlayers(players);
    });

    return () => unsubscribe();
  }, []); // ← FIXED: Empty array - listener runs once, onSnapshot handles updates

  if (!league || !draftState) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin-slow text-4xl">🏒</div>
      </div>
    );
  }

  const teams = league.teams;
  const totalRounds = league.draftRounds;

  // Create a map of pick number -> drafted player
  const pickMap = new Map<number, DraftedPlayer>();
  draftedPlayers.forEach(player => {
    pickMap.set(player.pickNumber, player);
  });

  // Generate grid data: [round][teamIndex] = pickNumber
  const draftGrid: number[][] = [];
  for (let round = 1; round <= totalRounds; round++) {
    const roundPicks: number[] = [];
    const isSnakeRound = round % 2 === 0;

    for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
      const actualTeamIdx = isSnakeRound ? teams.length - 1 - teamIdx : teamIdx;
      const pickNumber = (round - 1) * teams.length + actualTeamIdx + 1;
      roundPicks.push(pickNumber);
    }

    draftGrid.push(roundPicks);
  }

  // Vibrant accent palette
  const teamAccents = [
    '#22c55e', // emerald
    '#3b82f6', // blue
    '#f97316', // orange
    '#ec4899', // pink
    '#a855f7', // violet
    '#0ea5e9', // sky
    '#facc15', // amber
    '#14b8a6', // teal
  ];

  const mobilePicks = draftState.draftOrder.map((pick) => {
    const team = teams.find((t) => t.teamName === pick.team) || teams[0];
    const player = pickMap.get(pick.pick);
    const isCurrentPick = pick.pick === draftState.currentPickNumber;
    const isPastPick = pick.pick < draftState.currentPickNumber;

    return {
      pickNumber: pick.pick,
      round: pick.round,
      team,
      player,
      isCurrentPick,
      isPastPick,
    };
  });

  return (
    <GlassCard className="p-0 overflow-hidden border-slate-700/50">
      {/* Header */}
      <div className="bg-slate-800/80 backdrop-blur-md border-b border-slate-700 p-4 flex justify-between items-center sticky top-0 z-40">
        <h2 className="text-2xl font-heading font-bold text-white flex items-center gap-3">
          <span className="text-3xl">📋</span>
          Draft Board
        </h2>
        <Badge variant="info" className="text-sm px-3 py-1">
          Pick {draftState.currentPickNumber} of {draftState.totalPicks}
        </Badge>
      </div>

      {/* Mobile: vertical list of picks */}
      <div className="md:hidden p-3 space-y-2 max-h-[80vh] overflow-y-auto">
        {mobilePicks.map(({ pickNumber, round, team, player, isCurrentPick, isPastPick }) => {
          return (
            <motion.div
              key={pickNumber}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex items-center justify-between gap-3 p-3 rounded-lg border transition-all",
                isCurrentPick
                  ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                  : isPastPick
                    ? 'bg-slate-800/50 border-slate-700/50'
                    : 'bg-slate-900/30 border-slate-800/50'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px]">R{round}</Badge>
                  <span className="text-xs text-slate-400">Pick #{pickNumber}</span>
                </div>
                <p className="text-white font-bold truncate">
                  {player ? player.name : isCurrentPick ? 'On The Clock...' : 'Pending'}
                </p>
                <p className="text-slate-400 text-xs truncate">
                  {player ? `${player.position} • ${player.nhlTeam}` : team.teamName}
                </p>
              </div>
              {isCurrentPick && (
                <div className="animate-pulse text-amber-400 text-xl">⏳</div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Scrollable Grid Container */}
      <div className="hidden md:block overflow-auto custom-scrollbar" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <table className="w-full border-collapse">
          {/* Sticky Header Row */}
          <thead className="sticky top-0 z-30">
            <tr>
              <th className="sticky left-0 bg-slate-900 border-b border-r border-slate-700 p-3 text-left text-white font-bold z-40 min-w-[80px] shadow-lg">
                Rnd
              </th>
              {teams.map((team, idx) => {
                const accent = teamAccents[idx % teamAccents.length];
                return (
                  <th
                    key={team.teamName}
                    className="bg-slate-900 border-b border-r border-slate-700 p-3 text-center text-white font-bold min-w-[200px] border-t-4 relative overflow-hidden group"
                    style={{ borderTopColor: accent }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div
                      className="flex flex-col items-center gap-1 relative z-10"
                      style={{
                        background: `linear-gradient(140deg, ${addAlpha(accent, 0.15)}, ${addAlpha(accent, 0.02)})`,
                        borderRadius: '0.5rem',
                        padding: '0.5rem',
                        border: `1px solid ${addAlpha(accent, 0.2)}`
                      }}
                    >
                      <span className="text-sm font-bold truncate w-full">{team.teamName}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Draft Grid Body */}
          <tbody>
            {draftGrid.map((roundPicks, roundIdx) => {
              const round = roundIdx + 1;
              const isSnakeRound = round % 2 === 0;

              return (
                <tr key={round}>
                  {/* Round Number - Sticky Left Column */}
                  <td className="sticky left-0 bg-slate-900 border-b border-r border-slate-700 p-3 text-center font-bold text-white z-20 shadow-lg">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className="text-lg text-slate-300">{round}</span>
                      {isSnakeRound && <span className="text-xs text-amber-400 font-mono">SNAKE</span>}
                    </div>
                  </td>

                  {/* Draft Picks */}
                  {roundPicks.map((pickNumber, teamIdx) => {
                    const player = pickMap.get(pickNumber);
                    const isCurrentPick = pickNumber === draftState.currentPickNumber;
                    const isPastPick = pickNumber < draftState.currentPickNumber;
                    const team = teams[teamIdx];
                    const accent = teamAccents[teamIdx % teamAccents.length];

                    // Smart tooltip positioning
                    const isFirstColumn = teamIdx === 0;
                    const isLastColumn = teamIdx === teams.length - 1;
                    const tooltipPositionClasses = isFirstColumn
                      ? 'left-0'
                      : isLastColumn
                        ? 'right-0'
                        : 'left-1/2 -translate-x-1/2';

                    const cellStyle: CSSProperties = {};
                    if (!isCurrentPick) {
                      cellStyle.boxShadow = `inset 0 0 20px ${addAlpha(accent, 0.02)}`;
                      const intensity = player ? 0.15 : isPastPick ? 0.08 : 0.02;
                      cellStyle.background = `linear-gradient(135deg, ${addAlpha(accent, intensity)}, rgba(15,23,42,0.4))`;
                    }

                    return (
                      <td
                        key={pickNumber}
                        className={cn(
                          "border-b border-r border-slate-700/50 p-2 transition-all min-h-[140px] relative",
                          isCurrentPick
                            ? 'bg-amber-500/10 border-amber-500/50 border-2 animate-pulse z-10'
                            : 'hover:bg-white/5'
                        )}
                        style={cellStyle}
                      >
                        <AnimatePresence>
                          {player ? (
                            <motion.div
                              initial={animatingPick === pickNumber ? { scale: 0.8, opacity: 0 } : false}
                              animate={{ scale: 1, opacity: 1 }}
                              className="group relative h-full"
                            >
                              <div className="flex flex-col items-center gap-2 p-2 rounded hover:bg-slate-700/50 transition-colors cursor-pointer h-full justify-center">
                                {/* Player Headshot */}
                                <div className="relative flex-shrink-0">
                                  <img
                                    src={player.headshotUrl || `https://assets.nhle.com/mugs/nhl/20242025/${player.nhlTeam}/${player.playerId}.png`}
                                    alt={player.name}
                                    loading="lazy"
                                    onError={(e) => {
                                      e.currentTarget.src = 'https://assets.nhle.com/mugs/nhl/default-skater.png';
                                    }}
                                    className="w-14 h-14 rounded-full border-2 border-slate-600 bg-slate-800 object-cover"
                                  />
                                  {/* Team Logo Badge */}
                                  {player.nhlTeam && (
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-900 rounded-full p-0.5 border border-slate-700">
                                      <img
                                        src={`https://assets.nhle.com/logos/nhl/svg/${player.nhlTeam}_dark.svg`}
                                        alt={player.nhlTeam}
                                        className="w-full h-full object-contain"
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Player Info */}
                                <div className="w-full text-center">
                                  <p className="text-white font-bold text-xs truncate mb-1 leading-tight">
                                    {player.name}
                                  </p>
                                  <div className="flex items-center justify-center gap-1 mb-1 flex-wrap">
                                    <Badge variant="info" className="text-[10px] px-1 py-0 h-4">
                                      {player.position}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-slate-600">
                                      {player.nhlTeam}
                                    </Badge>
                                  </div>
                                  <p className="text-slate-500 text-[10px]">
                                    #{pickNumber}
                                  </p>
                                </div>
                              </div>

                              {/* Hover Tooltip */}
                              <div className={`absolute bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 border border-slate-600 rounded-xl shadow-2xl z-[100] ${tooltipPositionClasses}`}>
                                <div className="flex items-center gap-3 mb-2">
                                  <img
                                    src={player.headshotUrl || `https://assets.nhle.com/mugs/nhl/20242025/${player.nhlTeam}/${player.playerId}.png`}
                                    alt={player.name}
                                    className="w-12 h-12 rounded-full border border-slate-600 bg-slate-800"
                                  />
                                  <div>
                                    <p className="text-white font-bold">{player.name}</p>
                                    <p className="text-slate-400 text-xs">{player.position} • {player.nhlTeam}</p>
                                  </div>
                                </div>
                                <div className="border-t border-slate-700 pt-2 mt-2 space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Drafted by</span>
                                    <span className="text-white font-bold">{player.draftedByTeam}</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Pick</span>
                                    <span className="text-white font-bold">#{pickNumber} (R{player.round})</span>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ) : isCurrentPick ? (
                            // Current Pick Indicator
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex flex-col items-center justify-center py-4 text-center h-full"
                            >
                              <div className="text-3xl mb-2 animate-bounce">👇</div>
                              <p className="text-amber-400 font-bold text-xs mb-1 uppercase tracking-wider">On The Clock</p>
                              <p className="text-white text-xs font-bold bg-slate-800/80 px-2 py-1 rounded">{team.teamName}</p>
                            </motion.div>
                          ) : (
                            // Empty Pick Slot
                            <div className="flex flex-col items-center justify-center py-4 text-center h-full opacity-30 hover:opacity-50 transition-opacity">
                              <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center mb-1">
                                <span className="text-sm text-slate-500 font-bold">#{pickNumber}</span>
                              </div>
                            </div>
                          )}
                        </AnimatePresence>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
