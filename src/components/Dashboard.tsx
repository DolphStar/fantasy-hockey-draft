import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Flame, HeartPulse, Radio, Trophy } from 'lucide-react';
import { useLeague } from '../context/LeagueContext';
import { useAuth } from '../context/AuthContext';
import { GlassCard } from './ui/GlassCard';
import { GradientButton } from './ui/GradientButton';
import { CardHeader } from './ui/CardHeader';
import { StatNumber } from './ui/StatNumber';
import { Icon } from './ui/Icon';
import { Skeleton, SkeletonRow } from './ui/Skeleton';
import { useCountUp } from '../hooks/useCountUp';
import LiveStats from './LiveStats';
import { useDraftedPlayers } from '../hooks/useDraftedPlayers';
import { useInjuries } from '../queries/useInjuries';
import { useTeamTrend } from '../queries/useTeamTrend';
import { useTodaySchedule } from '../queries/useTodaySchedule';
import { useHotPickups } from '../queries/useHotPickups';
import { getHockeyDay } from '../utils/dateUtils';
import { getUpcomingMatchups } from '../utils/nhlSchedule';
import type { LivePlayerStats } from '../utils/liveStats';
import { getInjuryColor, type InjuryReport } from '../services/injuryService';
import { subscribeLiveStatsByDate } from '../services/liveStatsService';
import { subscribeLeagueTeamScores } from '../services/teamScoreService';
import type { TeamScore } from '../types/scores';

const MAX_TREND_DAYS = 7;

const ordinal = (n: number) => {
    const rem10 = n % 10;
    const rem100 = n % 100;
    if (rem10 === 1 && rem100 !== 11) return `${n}st`;
    if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
    if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
    return `${n}th`;
};

const rankMedalClass = (rank: number) => {
    if (rank === 1) return 'bg-rank text-slate-950';
    if (rank === 2) return 'bg-slate-300 text-slate-950';
    return 'bg-amber-600 text-slate-950';
};

export default function Dashboard() {
    const navigate = useNavigate();
    const { league } = useLeague();
    const { user } = useAuth();
    const { draftedPlayers, draftedPlayerIds } = useDraftedPlayers();
    const { data: injuries = [] } = useInjuries();

    const [liveStats, setLiveStats] = useState<LivePlayerStats[]>([]);
    const [teamScores, setTeamScores] = useState<TeamScore[]>([]);

    const myTeam = useMemo(() => {
        if (!league || !user) return null;
        return league.teams.find(t => t.ownerUid === user.uid) || null;
    }, [league, user]);

    const goToRoster = useCallback(() => navigate('/players/browse'), [navigate]);
    const goToInjuries = useCallback(() => navigate('/players/injuries'), [navigate]);
    const goToPlayerCard = useCallback((playerName: string) => {
        navigate(`/players/browse?search=${encodeURIComponent(playerName)}`);
    }, [navigate]);

    const activeRoster = useMemo(() => {
        if (!myTeam) return [];
        return draftedPlayers.filter(p => p.draftedByTeam === myTeam.teamName && p.rosterSlot !== 'reserve');
    }, [draftedPlayers, myTeam]);

    // React Query: team trend
    const { data: trend = [] } = useTeamTrend(league?.id, myTeam?.teamName, league?.teams.length ?? 0, MAX_TREND_DAYS);

    // React Query: today's schedule → matchups
    const allowedGameTypes = useMemo(
        () => (league?.allowedGameTypes && league.allowedGameTypes.length > 0 ? league.allowedGameTypes : [2]), // Default: regular season only
        [league],
    );
    const { data: schedule, isLoading: scheduleLoading } = useTodaySchedule(allowedGameTypes);
    const matchups = useMemo(() => {
        if (!schedule || activeRoster.length === 0) return [];
        const roster = activeRoster.map(player => ({
            playerId: player.playerId,
            name: player.name,
            nhlTeam: player.nhlTeam,
        }));
        return getUpcomingMatchups(roster, schedule);
    }, [schedule, activeRoster]);

    // React Query: hot pickups
    const { data: hotPickupsData, isLoading: pickupsLoading } = useHotPickups(league?.id, draftedPlayerIds);
    const hotPickups = hotPickupsData?.items ?? [];
    const hotPickupsLabel = hotPickupsData?.label ?? 'Season Leaders';

    useEffect(() => {
        if (!league || !myTeam || activeRoster.length === 0) {
            setLiveStats([]);
            return;
        }

        const today = getHockeyDay();
        const ids = new Set(activeRoster.map((player) => Number(player.playerId)));

        return subscribeLiveStatsByDate(league.id, today, (entries) => {
            setLiveStats(entries);
        }, ids);
    }, [league, myTeam, activeRoster]);

    const [scoresLoaded, setScoresLoaded] = useState(false);

    useEffect(() => {
        if (!league) {
            setTeamScores([]);
            return;
        }

        return subscribeLeagueTeamScores(league.id, (scores) => {
            setTeamScores(scores);
            setScoresLoaded(true);
        });
    }, [league?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const teamPoints = useMemo(
        () => teamScores.find(score => score.teamName === myTeam?.teamName)?.totalPoints ?? 0,
        [teamScores, myTeam],
    );
    const animatedPoints = useCountUp(teamPoints, 1);
    const leagueAveragePoints = useMemo(() => {
        if (teamScores.length === 0) return 0;
        const total = teamScores.reduce((sum, score) => sum + score.totalPoints, 0);
        return Number((total / teamScores.length).toFixed(1));
    }, [teamScores]);
    const myRank = useMemo(() => {
        const index = teamScores.findIndex(score => score.teamName === myTeam?.teamName);
        return index === -1 ? null : index + 1;
    }, [teamScores, myTeam]);
    const topThree = teamScores.slice(0, 3);
    const standingsDelta = useMemo(() => {
        if (!myRank || teamScores.length < 2) return null;
        if (myRank === 1) {
            return { up: true, text: `you lead by ${(teamPoints - teamScores[1].totalPoints).toFixed(1)}` };
        }
        return { up: false, text: `${(teamScores[0].totalPoints - teamPoints).toFixed(1)} behind 1st` };
    }, [myRank, teamScores, teamPoints]);

    const myPlayerNameSet = useMemo(() => new Set(activeRoster.map(player => player.name.toLowerCase())), [activeRoster]);

    const myInjuryReports = useMemo(() => {
        return injuries.filter(injury => myPlayerNameSet.has(injury.playerName.toLowerCase()));
    }, [injuries, myPlayerNameSet]);

    const formatStatusLabel = (status: string) => {
        const normalized = status.toLowerCase();
        if (normalized.includes('injured reserve') || normalized === 'ir') return 'IR';
        if (normalized.includes('day-to-day') || normalized.includes('day to day')) return 'DTD';
        if (normalized.includes('questionable')) return 'Q';
        if (normalized.includes('doubtful')) return 'D';
        if (normalized.includes('susp')) return 'SUS';
        return status.toUpperCase();
    };

    const handleInjuryCardClick = useCallback((injury: InjuryReport) => {
        if (typeof window !== 'undefined') {
            const focusValue = injury.playerId ? String(injury.playerId) : injury.playerName;
            window.sessionStorage.setItem('focusedInjuryPlayerId', focusValue);
        }
        goToInjuries();
    }, [goToInjuries]);

    const heroState = (() => {
        if (liveStats.length > 0) {
            return {
                label: 'Live Games',
                accent: 'bg-red-500',
                message: `${liveStats.length} player${liveStats.length === 1 ? '' : 's'} on the ice right now`,
            };
        }
        if (matchups.length > 0) {
            return {
                label: 'Game Day',
                accent: 'bg-blue-500',
                message: `${matchups.length} player${matchups.length === 1 ? '' : 's'} playing tonight`,
            };
        }
        return {
            label: 'Off Day',
            accent: 'bg-slate-600',
            message: 'No games today. Reset lines & scout free agents.',
        };
    })();

    const formatGameTime = (startTimeUTC: string) =>
        new Date(startTimeUTC).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (!league) {
        return (
            <div className="max-w-6xl mx-auto px-6">
                <Skeleton className="h-40 w-full rounded-xl" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-6 space-y-6">
            {/* Hero: status + season points */}
            <GlassCard className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                            <span className={`inline-flex w-2 h-2 rounded-full ${heroState.accent} ${heroState.accent === 'bg-red-500' ? 'animate-live-pulse motion-reduce:animate-none' : ''}`} />
                            {heroState.label}
                        </p>
                        <h2 className="text-3xl font-heading font-bold text-white mt-1">
                            {myTeam ? myTeam.teamName : 'Welcome back, GM'}
                        </h2>
                        <p className="text-slate-300 text-lg mt-2">{heroState.message}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <GradientButton onClick={goToRoster}>Set Lines</GradientButton>
                            <GradientButton variant="outline" onClick={() => navigate('/scores')}>
                                View Schedule
                            </GradientButton>
                        </div>
                    </div>
                    <div className="bg-slate-900/70 rounded-card p-5 min-w-[240px] text-right">
                        <StatNumber label="Season Points" value={animatedPoints} size="xl" className="tabular-nums" />
                        <p className="text-xs text-slate-500 mt-1">League Avg {leagueAveragePoints.toFixed(1)}</p>
                        {myRank && (
                            <span className="inline-flex items-center gap-1 mt-2 bg-rank/15 text-rank text-xs font-bold px-2.5 py-1 rounded-full shadow-glow-gold">
                                {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🏒'} {ordinal(myRank)} place
                            </span>
                        )}
                        <div className="mt-3 text-sm text-slate-400">
                            Today&apos;s Total:{' '}
                            <span className="text-white font-semibold">
                                {liveStats.reduce((sum, stat) => sum + stat.points, 0).toFixed(1)} pts
                            </span>
                        </div>
                    </div>
                </div>
            </GlassCard>

            {/* Tonight's Games / Standings / Hot Pickups */}
            <div className="grid gap-4 md:grid-cols-3 items-start">
                <GlassCard>
                    <CardHeader icon={<Icon as={Radio} size="sm" className="text-live" />} title="Tonight's Games" />
                    {scheduleLoading ? (
                        <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
                    ) : (schedule ?? []).length === 0 ? (
                        <p className="px-4 py-6 text-sm text-slate-500 text-center">No games today — off day.</p>
                    ) : (
                        (schedule ?? []).map((game) => {
                            const isLive = game.gameState === 'LIVE' || game.gameState === 'CRIT';
                            const isFuture = game.gameState === 'FUT' || game.gameState === 'PRE';
                            return (
                                <div key={game.id} className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-800/60 last:border-b-0 text-sm">
                                    <span className="font-semibold text-white">
                                        {game.awayTeam.abbrev} @ {game.homeTeam.abbrev}
                                    </span>
                                    <span className="font-extrabold text-white">
                                        {isFuture ? '– – –' : `${game.awayTeam.score ?? 0} – ${game.homeTeam.score ?? 0}`}
                                    </span>
                                    {isLive ? (
                                        <span className="text-live text-[10px] font-extrabold tracking-wider whitespace-nowrap">
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-live shadow-[0_0_6px_#ef4444] mr-1 align-middle animate-live-pulse motion-reduce:animate-none" />
                                            LIVE
                                        </span>
                                    ) : (
                                        <span className="text-slate-500 text-[10px] font-bold tracking-wider whitespace-nowrap">
                                            {isFuture ? formatGameTime(game.startTimeUTC) : 'FINAL'}
                                        </span>
                                    )}
                                </div>
                            );
                        })
                    )}
                </GlassCard>

                <GlassCard>
                    <CardHeader
                        icon={<Icon as={Trophy} size="sm" className="text-rank" />}
                        title="Standings"
                        action={<Link to="/scores" className="text-xs font-semibold text-blue-400 hover:text-blue-300">Full table →</Link>}
                    />
                    {!scoresLoaded ? (
                        <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
                    ) : topThree.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-slate-500 text-center">No scores yet.</p>
                    ) : (
                        <>
                            {topThree.map((team, index) => (
                                <div key={team.teamName} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60">
                                    <span className="flex items-center gap-2.5">
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${rankMedalClass(index + 1)}`}>
                                            {index + 1}
                                        </span>
                                        <span className="text-sm font-semibold text-white">{team.teamName}</span>
                                    </span>
                                    <span className="text-sm font-extrabold text-points">{team.totalPoints.toFixed(1)}</span>
                                </div>
                            ))}
                            <div className="flex items-center justify-between px-4 py-2.5 text-[11px]">
                                <span className="text-slate-500">
                                    {teamScores.length > 3 ? `+ ${teamScores.length - 3} more teams` : `${teamScores.length} teams`}
                                </span>
                                {standingsDelta && (
                                    <span className={`font-bold ${standingsDelta.up ? 'text-points' : 'text-slate-400'}`}>
                                        {standingsDelta.up ? '▲' : '▼'} {standingsDelta.text}
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </GlassCard>

                <GlassCard>
                    <CardHeader
                        icon={<Icon as={Flame} size="sm" className="text-orange-400" />}
                        title="Hot Pickups"
                        action={<button type="button" onClick={goToRoster} className="text-xs font-semibold text-blue-400 hover:text-blue-300">Player hub →</button>}
                    />
                    {pickupsLoading ? (
                        <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
                    ) : hotPickups.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-slate-500 text-center">No trending free agents right now.</p>
                    ) : (
                        <>
                            <p className="px-4 pt-2 text-[10px] uppercase tracking-wider text-slate-500">{hotPickupsLabel}</p>
                            {hotPickups.slice(0, 3).map((pickup) => (
                                <button
                                    key={pickup.id}
                                    type="button"
                                    onClick={() => goToPlayerCard(pickup.name)}
                                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-800/60 last:border-b-0 text-left hover:bg-slate-900/40 transition-colors"
                                >
                                    <span className="flex items-center gap-2.5 min-w-0">
                                        {pickup.headshot ? (
                                            <img
                                                src={pickup.headshot}
                                                alt={pickup.name}
                                                className="w-7 h-7 rounded-full object-cover bg-slate-800 border border-slate-700"
                                                onError={(e) => {
                                                    e.currentTarget.src = 'https://assets.nhle.com/mugs/nhl/default-skater.png';
                                                }}
                                            />
                                        ) : (
                                            <span className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs">🏒</span>
                                        )}
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold text-white truncate">{pickup.name}</span>
                                            <span className="block text-[11px] text-slate-500">
                                                {pickup.position} · {pickup.team} · {pickup.percentRostered}% rostered
                                            </span>
                                        </span>
                                    </span>
                                    <span className="text-sm font-bold text-points whitespace-nowrap">+{pickup.points}</span>
                                </button>
                            ))}
                        </>
                    )}
                </GlassCard>
            </div>

            {/* Team Health & Trends */}
            <GlassCard className="p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h3 className="text-xl font-heading font-semibold text-white flex items-center gap-2">
                        <Icon as={HeartPulse} size="md" className="text-pink-400" /> Team Health & Trends
                    </h3>
                    <button onClick={goToInjuries} className="text-sm text-pink-400 hover:text-pink-300">Manage IR →</button>
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                    {myInjuryReports.length === 0 ? (
                        <div className="col-span-3 text-center text-slate-500 text-sm py-6 border border-dashed border-slate-700 rounded-xl">
                            Everyone&apos;s healthy. 🙌
                        </div>
                    ) : (
                        myInjuryReports.slice(0, 3).map((injury) => (
                            <button
                                key={injury.playerId}
                                onClick={() => handleInjuryCardClick(injury)}
                                className="rounded-xl border border-slate-800 p-3 bg-slate-900/40 text-left hover:border-blue-400/70 hover:bg-slate-900/60 transition-colors cursor-pointer"
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1 ${getInjuryColor(injury.status)} text-white text-[10px] px-2.5 py-0.5 rounded-full font-semibold tracking-wide uppercase`}>🩹 {formatStatusLabel(injury.status)}</span>
                                    <p className="text-white font-medium text-sm">{injury.playerName}</p>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">{injury.teamAbbrev} • {injury.injuryType}</p>
                                <p
                                    className="text-xs text-slate-500 mt-2 line-clamp-2"
                                    title={injury.description}
                                >
                                    {injury.description}
                                </p>
                            </button>
                        ))
                    )}
                </div>

                <div className="mt-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">7-day trend</p>
                    {trend.length === 0 ? (
                        <div className="text-slate-500 text-sm">Not enough games yet.</div>
                    ) : (
                        <div className="drop-shadow-[0_0_6px_rgba(34,211,238,0.35)]">
                            <ResponsiveContainer width="100%" height={64} minWidth={0} debounce={50}>
                                <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                                    <defs>
                                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                                            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" hide />
                                    <Tooltip
                                        contentStyle={{ background: '#0d1322', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                                        labelStyle={{ color: '#94a3b8' }}
                                        formatter={(value: number) => [`${value.toFixed(1)} pts`, 'My team']}
                                        labelFormatter={(label: string) => {
                                            // Parse date as local time to avoid timezone shift
                                            const [year, month, day] = String(label).split('-').map(Number);
                                            return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                                        }}
                                    />
                                    <Area type="monotone" dataKey="myTeam" stroke="#22d3ee" strokeWidth={2} fill="url(#trendFill)" dot={false} activeDot={{ r: 3.5 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </GlassCard>

            {/* Your matchups in detail (live boxes, game history) */}
            <LiveStats />
        </div>
    );
}
