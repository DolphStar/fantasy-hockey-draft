import { useState, useEffect } from 'react';
import { useLeague } from '../context/LeagueContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { GlassCard } from './ui/GlassCard';
import { Badge } from './ui/Badge';

interface PlayerGame {
    playerId: number;
    playerName: string;
    position: string;
    nhlTeam: string;
    gameState: 'LIVE' | 'FINAL' | ' FUT';
    opponent: string;
    gameTime: string;
    goals: number;
    assists: number;
    points: number;
    fantasyPoints: number;
}

export default function MatchupCommandCenter() {
    const { league, myTeam } = useLeague();
    const [playersPlayingToday, setPlayersPlayingToday] = useState<PlayerGame[]>([]);
    const [totalPointsToday, setTotalPointsToday] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!league || !myTeam) {
            setLoading(false);
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const liveStatsRef = collection(db, `leagues/${league.id}/liveStats`);
        const q = query(liveStatsRef, where('teamName', '==', myTeam.teamName));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const todaysGames: PlayerGame[] = [];
            let totalPoints = 0;

            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                if (doc.id.startsWith(today)) {
                    const fantasyPts = calculateFantasyPoints(data);
                    todaysGames.push({
                        playerId: data.playerId,
                        playerName: data.playerName,
                        position: data.position || 'F',
                        nhlTeam: data.nhlTeam,
                        gameState: data.gameState,
                        opponent: 'vs ???',
                        gameTime: data.gameTime || 'TBD',
                        goals: data.goals || 0,
                        assists: data.assists || 0,
                        points: data.points || 0,
                        fantasyPoints: fantasyPts
                    });
                    totalPoints += fantasyPts;
                }
            });

            setPlayersPlayingToday(todaysGames);
            setTotalPointsToday(totalPoints);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [league, myTeam]);

    const calculateFantasyPoints = (stats: any): number => {
        const { goals = 0, assists = 0, hits = 0, blockedShots = 0, wins = 0, saves = 0, shutouts = 0 } = stats;
        let points = 0;
        points += goals * 1; points += assists * 1;
        points += hits * 0.1;
        points += blockedShots * 0.15;
        points += wins * 1;
        points += saves * 0.04;
        points += shutouts * 2;
        return points;
    };

    const liveGames = playersPlayingToday.filter(p => p.gameState === 'LIVE');
    const completedGames = playersPlayingToday.filter(p => p.gameState === 'FINAL');

    if (!loading && playersPlayingToday.length === 0) {
        return (
            <GlassCard className="p-8 text-center border-t-4 border-t-slate-600">
                <div className="text-6xl mb-4">🏒</div>
                <h3 className="text-2xl font-bold text-white mb-2">No Games Today</h3>
                <p className="text-slate-400">Your players have the day off. Check back tomorrow!</p>
            </GlassCard>
        );
    }

    if (liveGames.length > 0) {
        return (
            <GlassCard className="p-6 border-t-4 border-t-green-500 bg-gradient-to-br from-green-900/20 to-slate-900/50">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                            <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                        </div>
                        <h3 className="text-2xl font-bold text-white">Live Games</h3>
                        <Badge variant="danger">LIVE</Badge>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-slate-400">Total Points Today</div>
                        <div className="text-4xl font-black text-green-400">{totalPointsToday.toFixed(1)}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {liveGames.map((player) => (
                        <div key={player.playerId} className="bg-slate-800/50 rounded-lg p-3 border border-green-500/30 hover:border-green-500/50 transition-colors">
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant={player.position === 'G' ? 'warning' : player.position === 'D' ? 'success' : 'info'}>
                                    {player.position}
                                </Badge>
                                <span className="text-white font-semibold text-sm">{player.playerName}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                                <span>{player.nhlTeam} {player.opponent}</span>
                                <Badge variant="danger" className="text-xs">LIVE</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-slate-400">
                                    {player.goals}G • {player.assists}A = {player.points}Pts
                                </div>
                                <div className="text-lg font-bold text-green-400">+{player.fantasyPoints.toFixed(1)}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {completedGames.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <div className="text-sm text-slate-400 mb-2">Completed Today</div>
                        <div className="flex flex-wrap gap-2">
                            {completedGames.map((player) => (
                                <div key={player.playerId} className="bg-slate-800/30 rounded px-3 py-1 text-xs">
                                    <span className="text-white font-semibold">{player.playerName}</span>
                                    <span className="text-slate-400 ml-2">{player.goals}G {player.assists}A</span>
                                    <span className="text-green-400 ml-2">+{player.fantasyPoints.toFixed(1)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </GlassCard>
        );
    }

    return (
        <GlassCard className="p-6 border-t-4 border-t-blue-500">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-2xl font-bold text-white mb-1">Tonight's Matchups</h3>
                    <p className="text-slate-400 text-sm">{playersPlayingToday.length} players in action</p>
                </div>
                <div className="text-5xl">🏒</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {playersPlayingToday.map((player) => (
                    <div key={player.playerId} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700 hover:border-blue-500/50 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant={player.position === 'G' ? 'warning' : player.position === 'D' ? 'success' : 'info'}>
                                {player.position}
                            </Badge>
                            <span className="text-white font-semibold text-sm">{player.playerName}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">{player.nhlTeam} {player.opponent}</span>
                            <span className="text-blue-400 font-semibold">{player.gameTime}</span>
                        </div>
                    </div>
                ))}
            </div>

            {completedGames.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <div className="text-sm text-slate-400 mb-2 flex items-center justify-between">
                        <span>Already Played Today</span>
                        <span className="text-green-400 font-bold">+{completedGames.reduce((sum, p) => sum + p.fantasyPoints, 0).toFixed(1)} pts</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {completedGames.map((player) => (
                            <div key={player.playerId} className="bg-slate-800/30 rounded px-3 py-1 text-xs">
                                <span className="text-white font-semibold">{player.playerName}</span>
                                <span className="text-slate-400 ml-2">{player.goals}G {player.assists}A</span>
                                <span className="text-green-400 ml-2">+{player.fantasyPoints.toFixed(1)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </GlassCard>
    );
}
