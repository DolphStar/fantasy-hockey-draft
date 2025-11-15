import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useDraft } from '../context/DraftContext';
import { useLeague } from '../context/LeagueContext';

interface DraftedPlayer {
  id: string;
  playerId: number;
  name: string; // Changed from playerName to match Firebase
  position: string;
  nhlTeam: string; // Changed from team to match Firebase
  draftedByTeam: string;
  pickNumber: number;
  round: number;
  headshotUrl?: string;
}

export default function DraftBoardGrid() {
  const { draftState } = useDraft();
  const { league } = useLeague();
  const [draftedPlayers, setDraftedPlayers] = useState<DraftedPlayer[]>([]);

  // Listen to drafted players in real-time
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
      setDraftedPlayers(players);
    });

    return () => unsubscribe();
  }, []);

  if (!league || !draftState) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-400">Loading draft board...</p>
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

  // Get team colors for visual distinction
  const teamColors = [
    'border-green-500',
    'border-blue-500',
    'border-yellow-500',
    'border-red-500',
    'border-purple-500',
    'border-pink-500',
    'border-orange-500',
    'border-cyan-500',
  ];

  return (
    <div className="bg-gray-900 rounded-lg shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span>🏒</span>
          Draft Board
          <span className="text-sm font-normal text-gray-400">
            Pick {draftState.currentPickNumber} of {draftState.totalPicks}
          </span>
        </h2>
      </div>

      {/* Scrollable Grid Container */}
      <div className="overflow-auto max-h-[800px]">
        <table className="w-full border-collapse">
          {/* Sticky Header Row */}
          <thead className="sticky top-0 bg-gray-800 z-20">
            <tr>
              <th className="sticky left-0 bg-gray-800 border border-gray-700 p-3 text-left text-white font-bold z-30 min-w-[100px]">
                Round
              </th>
              {teams.map((team, idx) => (
                <th
                  key={team.teamName}
                  className={`border border-gray-700 p-3 text-center text-white font-bold min-w-[220px] border-t-4 ${teamColors[idx % teamColors.length]}`}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold truncate">{team.teamName}</span>
                    <span className="text-xs text-gray-400 truncate">{team.ownerEmail}</span>
                  </div>
                </th>
              ))}
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
                  <td className="sticky left-0 bg-gray-800 border border-gray-700 p-3 text-center font-bold text-white z-10">
                    <div className="flex items-center justify-center gap-2">
                      <span>R{round}</span>
                      {isSnakeRound && <span className="text-xs text-yellow-400">⮌</span>}
                    </div>
                  </td>

                  {/* Draft Picks */}
                  {roundPicks.map((pickNumber, teamIdx) => {
                    const player = pickMap.get(pickNumber);
                    const isCurrentPick = pickNumber === draftState.currentPickNumber;
                    const isPastPick = pickNumber < draftState.currentPickNumber;
                    const team = teams[teamIdx];

                    return (
                      <td
                        key={pickNumber}
                        className={`border border-gray-700 p-2 transition-all min-h-[140px] ${
                          isCurrentPick
                            ? 'bg-yellow-500/20 border-yellow-500 border-2 animate-pulse'
                            : isPastPick
                            ? 'bg-gray-800'
                            : 'bg-gray-900'
                        } ${teamColors[teamIdx % teamColors.length].replace('border-', 'border-l-4 border-l-')}`}
                      >
                        {player ? (
                          // Drafted Player Cell
                          <div className="group relative">
                            <div className="flex flex-col items-center gap-2 p-3 rounded hover:bg-gray-700/50 transition-colors cursor-pointer">
                              {/* Player Headshot with Team Logo */}
                              <div className="relative flex-shrink-0">
                                <img
                                  src={player.headshotUrl || `https://assets.nhle.com/mugs/nhl/20242025/${player.nhlTeam}/${player.playerId}.png`}
                                  alt={player.name}
                                  onError={(e) => {
                                    e.currentTarget.src = 'https://assets.nhle.com/mugs/nhl/default-skater.png';
                                  }}
                                  className="w-16 h-16 rounded-full border-2 border-gray-600 bg-gray-800"
                                />
                                {/* Team Logo Badge */}
                                {player.nhlTeam && (
                                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-900 rounded-full p-0.5">
                                    <img
                                      src={`https://assets.nhle.com/logos/nhl/svg/${player.nhlTeam}_dark.svg`}
                                      alt={player.nhlTeam}
                                      className="w-full h-full drop-shadow-lg"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Player Info */}
                              <div className="flex-1 w-full text-center">
                                <p className="text-white font-bold text-sm truncate mb-1">
                                  {player.name}
                                </p>
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded font-bold">
                                    {player.position}
                                  </span>
                                  <span className="bg-gray-700 text-white text-xs px-2 py-0.5 rounded font-bold">
                                    {player.nhlTeam}
                                  </span>
                                </div>
                                <p className="text-gray-500 text-xs">
                                  Pick #{pickNumber}
                                </p>
                              </div>
                            </div>

                            {/* Hover Tooltip */}
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-black border-2 border-gray-600 rounded-lg shadow-2xl z-50">
                              <div className="flex items-center gap-3 mb-2">
                                <img
                                  src={player.headshotUrl || `https://assets.nhle.com/mugs/nhl/20242025/${player.nhlTeam}/${player.playerId}.png`}
                                  alt={player.name}
                                  onError={(e) => {
                                    e.currentTarget.src = 'https://assets.nhle.com/mugs/nhl/default-skater.png';
                                  }}
                                  className="w-16 h-16 rounded-full border-2 border-gray-600"
                                />
                                <div>
                                  <p className="text-white font-bold">{player.name}</p>
                                  <p className="text-gray-400 text-sm">{player.position}</p>
                                  <p className="text-gray-500 text-xs">{player.nhlTeam}</p>
                                </div>
                              </div>
                              <div className="border-t border-gray-700 pt-2 mt-2">
                                <p className="text-gray-400 text-xs">
                                  <span className="font-bold">Drafted by:</span> {player.draftedByTeam}
                                </p>
                                <p className="text-gray-400 text-xs">
                                  <span className="font-bold">Pick:</span> #{pickNumber} (Round {player.round})
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : isCurrentPick ? (
                          // Current Pick Indicator
                          <div className="flex flex-col items-center justify-center py-8 text-center h-full">
                            <div className="text-4xl mb-3 animate-bounce">⏰</div>
                            <p className="text-yellow-400 font-bold text-base mb-2">ON THE CLOCK</p>
                            <p className="text-white text-sm font-semibold">{team.teamName}</p>
                            <p className="text-gray-400 text-xs mt-1">Pick #{pickNumber}</p>
                          </div>
                        ) : (
                          // Empty Pick Slot
                          <div className="flex flex-col items-center justify-center py-8 text-center h-full opacity-50">
                            <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-700 flex items-center justify-center mb-2">
                              <span className="text-2xl text-gray-700">?</span>
                            </div>
                            <p className="text-gray-600 text-xs">Pick #{pickNumber}</p>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="flex items-center gap-6 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500/20 border-2 border-yellow-500 rounded"></div>
            <span>Current Pick</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-800 border border-gray-700 rounded"></div>
            <span>Drafted</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-900 border border-gray-700 rounded"></div>
            <span>Upcoming</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">⮌</span>
            <span>Snake Round (reverse order)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
