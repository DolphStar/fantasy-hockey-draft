import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useLeague } from '../context/LeagueContext';
import { useAuth } from '../context/AuthContext';
import { GlassCard } from './ui/GlassCard';
import { GradientButton } from './ui/GradientButton';
import { useDraftedPlayers } from '../hooks/useDraftedPlayers';
import type { DraftedPlayer } from '../hooks/useDraftedPlayers';
import { useInjuries } from '../queries/useInjuries';
import { fetchTodaySchedule, getUpcomingMatchups, type PlayerMatchup } from '../utils/nhlSchedule';
import type { LivePlayerStats } from '../utils/liveStats';
import { db } from '../firebase';
import { getInjuryColor, type InjuryReport } from '../services/injuryService';

const MAX_FEED_ITEMS = 6;
const MAX_TREND_DAYS = 7;

interface FeedItem {
    id: string;
    icon: string;
    title: string;
    description: string;
    timestamp?: Date;
    cta?: string;
    onClick?: () => void;
}

interface TrendPoint {
    date: string;
    myTeam: number;
    leagueAvg: number;
}

interface HotPickupData {
    id: number;
    name: string;
    team: string;
    position: string;
    points: number;
    trend: 'rising' | 'steady' | 'cooling';
    percentRostered: number;
    headshot?: string;
}

// Position badge color helper
const getPositionBadgeClass = (position: string) => {
    const pos = position?.toUpperCase();
    if (['C', 'L', 'R', 'LW', 'RW', 'F'].includes(pos)) return 'bg-blue-500/20 text-blue-300';
    if (['D', 'LD', 'RD'].includes(pos)) return 'bg-green-500/20 text-green-300';
    if (pos === 'G') return 'bg-amber-500/20 text-amber-300';
    return 'bg-slate-500/20 text-slate-300';
};

// Relative time helper
const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
};

type RosterEventType = 'add' | 'drop' | 'activate' | 'bench';

interface RosterEvent {
    id: string;
    type: RosterEventType;
    playerName: string;
    position: string;
    nhlTeam: string;
    teamName: string;
    fromSlot?: DraftedPlayer['rosterSlot'];
    toSlot?: DraftedPlayer['rosterSlot'];
    timestamp: string;
}

interface DashboardProps {
    setActiveTab: (tab: any) => void;
    setRosterSearchQuery: (query: string) => void;
}

export default function Dashboard({ setActiveTab, setRosterSearchQuery }: DashboardProps) {
    const { league } = useLeague();
    const { user } = useAuth();
    const { draftedPlayers, draftedPlayerIds } = useDraftedPlayers();
    const { data: injuries = [] } = useInjuries();

    const [liveStats, setLiveStats] = useState<LivePlayerStats[]>([]);
    const [matchups, setMatchups] = useState<PlayerMatchup[]>([]);
    const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
    const [trend, setTrend] = useState<TrendPoint[]>([]);
    const [hotPickups, setHotPickups] = useState<HotPickupData[]>([]);
    const [hotPickupsLabel, setHotPickupsLabel] = useState('Season Leaders');
    const [teamPoints, setTeamPoints] = useState<number>(0);
    const [leagueAveragePoints, setLeagueAveragePoints] = useState<number>(0);
    const [rosterEvents, setRosterEvents] = useState<RosterEvent[]>([]);
    const [showAllMatchups, setShowAllMatchups] = useState(false);

    const myTeam = useMemo(() => {
        if (!league || !user) return null;
        return league.teams.find(t => t.ownerUid === user.uid) || null;
    }, [league, user]);

    const goToRoster = useCallback(() => setActiveTab('roster'), [setActiveTab]);
    const goToChat = useCallback(() => setActiveTab('chat'), [setActiveTab]);
    const goToInjuries = useCallback(() => setActiveTab('injuries'), [setActiveTab]);
    const goToPlayerCard = useCallback((playerName: string) => {
        setRosterSearchQuery(playerName);
        setActiveTab('roster');
    }, [setActiveTab, setRosterSearchQuery]);

    const activeRoster = useMemo(() => {
        if (!myTeam) return [];
        return draftedPlayers.filter(p => p.draftedByTeam === myTeam.teamName && p.rosterSlot !== 'reserve');
    }, [draftedPlayers, myTeam]);

    const rosterSnapshotRef = useRef<Map<number, DraftedPlayer>>(new Map());
    const hasRosterSnapshotRef = useRef(false);

    const buildRosterEvent = useCallback((type: RosterEventType, player: DraftedPlayer, fromSlot?: DraftedPlayer['rosterSlot'], toSlot?: DraftedPlayer['rosterSlot']): RosterEvent => ({
        id: `${type}-${player.playerId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        playerName: player.name,
        position: player.position,
        nhlTeam: player.nhlTeam,
        teamName: player.draftedByTeam,
        fromSlot,
        toSlot,
        timestamp: new Date().toISOString(),
    }), []);

    useEffect(() => {
        if (draftedPlayers.length === 0) return;

        const prevSnapshot = rosterSnapshotRef.current;
        const currentSnapshot = new Map<number, DraftedPlayer>();
        draftedPlayers.forEach(player => currentSnapshot.set(player.playerId, player));

        if (!hasRosterSnapshotRef.current) {
            rosterSnapshotRef.current = currentSnapshot;
            hasRosterSnapshotRef.current = true;
            return;
        }

        const newEvents: RosterEvent[] = [];

        currentSnapshot.forEach((player, playerId) => {
            const prev = prevSnapshot.get(playerId);
            if (!prev) {
                newEvents.push(buildRosterEvent('add', player, undefined, player.rosterSlot));
                return;
            }

            if (prev.rosterSlot !== player.rosterSlot) {
                const type: RosterEventType = player.rosterSlot === 'active' ? 'activate' : 'bench';
                newEvents.push(buildRosterEvent(type, player, prev.rosterSlot, player.rosterSlot));
            }
        });

        prevSnapshot.forEach((player, playerId) => {
            if (!currentSnapshot.has(playerId)) {
                newEvents.push(buildRosterEvent('drop', player, player.rosterSlot, undefined));
            }
        });

        if (newEvents.length > 0) {
            setRosterEvents(prev => [...newEvents, ...prev].slice(0, 6));
        }

        rosterSnapshotRef.current = currentSnapshot;
    }, [draftedPlayers, buildRosterEvent]);

    useEffect(() => {
        if (!league || !myTeam || activeRoster.length === 0) {
            setLiveStats([]);
            return;
        }

        // Get today's date in Eastern Time (NHL's timezone) to match liveStats keys
        const now = new Date();
        const etOffset = -5; // EST is UTC-5
        const etTime = new Date(now.getTime() + (etOffset * 60 * 60 * 1000));
        const year = etTime.getUTCFullYear();
        const month = String(etTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(etTime.getUTCDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

        const ids = new Set(activeRoster.map(p => p.playerId));
        const statsRef = collection(db, `leagues/${league.id}/liveStats`);

        const unsubscribe = onSnapshot(statsRef, snapshot => {
            const entries: LivePlayerStats[] = [];
            snapshot.forEach(docSnap => {
                if (!docSnap.id.startsWith(today)) return;
                const data = docSnap.data() as LivePlayerStats;
                if (ids.has(data.playerId)) {
                    entries.push(data);
                }
            });
            setLiveStats(entries);
        });

        return () => unsubscribe();
    }, [league, myTeam, activeRoster]);

    useEffect(() => {
        if (!activeRoster.length) {
            setMatchups([]);
            return;
        }
        const load = async () => {
            const schedule = await fetchTodaySchedule();
            const roster = activeRoster.map(player => ({
                playerId: player.playerId,
                name: player.name,
                nhlTeam: player.nhlTeam
            }));
            setMatchups(getUpcomingMatchups(roster, schedule));
        };
        load();
    }, [activeRoster]);

    useEffect(() => {
        if (!league) {
            setFeedItems([]);
            return;
        }

        const describeRosterEvent = (event: RosterEvent) => {
            switch (event.type) {
                case 'activate':
                    return {
                        title: `${event.teamName} activated ${event.playerName}`,
                        description: `${event.position} • ${event.nhlTeam} • ${event.fromSlot === 'reserve' ? 'Bench → Active' : 'Slot updated'}`,
                        icon: '⬆️'
                    };
                case 'bench':
                    return {
                        title: `${event.teamName} benched ${event.playerName}`,
                        description: `${event.position} • ${event.nhlTeam} • Active → Bench`,
                        icon: '⬇️'
                    };
                case 'drop':
                    return {
                        title: `${event.teamName} dropped ${event.playerName}`,
                        description: `${event.position} • ${event.nhlTeam}`,
                        icon: '➖'
                    };
                default:
                    return {
                        title: `${event.teamName} added ${event.playerName}`,
                        description: `${event.position} • ${event.nhlTeam} • ${event.toSlot === 'reserve' ? 'Bench stash' : 'Active roster'}`,
                        icon: '➕'
                    };
            }
        };

        const buildFeed = () => {
            const items: FeedItem[] = [];

            injuries
                .filter(injury => draftedPlayerIds.has(injury.playerId))
                .slice(0, 3)
                .forEach(injury => {
                    items.push({
                        id: `injury-${injury.playerId}`,
                        icon: '🏥',
                        title: `${injury.playerName} (${injury.status})`,
                        description: `${injury.teamAbbrev} • ${injury.injuryType}`,
                        cta: 'Manage IR',
                        onClick: goToInjuries
                    });
                });

            rosterEvents.slice(0, 3).forEach(event => {
                const copy = describeRosterEvent(event);
                items.push({
                    id: `roster-${event.id}`,
                    icon: copy.icon,
                    title: copy.title,
                    description: copy.description,
                    cta: 'Scout player',
                    onClick: goToRoster
                });
            });

            return items;
        };

        let baseItems = buildFeed();

        const chatRef = collection(db, `leagues/${league.id}/chatMessages`);
        const chatQuery = query(chatRef, orderBy('createdAt', 'desc'), limit(2));
        const unsubscribe = onSnapshot(chatQuery, snapshot => {
            const chirps = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as any) }));
            const next = [...baseItems];
            chirps.forEach(chirp => {
                // createdAt is stored as ISO string in chat messages
                let timestamp: Date | undefined;
                if (chirp.createdAt) {
                    if (typeof chirp.createdAt === 'string') {
                        timestamp = new Date(chirp.createdAt);
                    } else if (typeof chirp.createdAt.toDate === 'function') {
                        timestamp = chirp.createdAt.toDate();
                    } else if (chirp.createdAt.seconds) {
                        timestamp = new Date(chirp.createdAt.seconds * 1000);
                    }
                }
                
                next.push({
                    id: `chat-${chirp.id}`,
                    icon: '💬',
                    title: chirp.teamName || 'Chirp',
                    description: chirp.text,
                    timestamp,
                    cta: 'Reply',
                    onClick: goToChat
                });
            });
            setFeedItems(next.slice(0, MAX_FEED_ITEMS));
        });

        baseItems = buildFeed();

        return () => unsubscribe();
    }, [league, injuries, draftedPlayerIds, rosterEvents, goToChat, goToRoster, goToInjuries]);

    useEffect(() => {
        if (!league || !myTeam) {
            setTrend([]);
            return;
        }
        const loadTrend = async () => {
            const scoresRef = collection(db, `leagues/${league.id}/playerDailyScores`);
            const snapshot = await getDocs(query(scoresRef, orderBy('date', 'desc'), limit(500)));
            const map = new Map<string, { total: number; myPoints: number }>();
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data() as { date: string; points: number; teamName: string };
                if (!map.has(data.date)) map.set(data.date, { total: 0, myPoints: 0 });
                const entry = map.get(data.date)!;
                entry.total += data.points;
                if (data.teamName === myTeam.teamName) entry.myPoints += data.points;
            });
            const dates = Array.from(map.keys()).sort().slice(-MAX_TREND_DAYS);
            const rows = dates.map(date => {
                const entry = map.get(date)!;
                const avg = entry.total / Math.max(league.teams.length, 1);
                return { date, myTeam: Number(entry.myPoints.toFixed(1)), leagueAvg: Number(avg.toFixed(1)) };
            });
            setTrend(rows);
        };
        loadTrend();
    }, [league, myTeam]);

    // Waiver Wire / Hot Pickups Logic
    useEffect(() => {
        if (!league) {
            setHotPickups([]);
            return;
        }
        const loadHot = async () => {
            try {
                // 1. Try fetching last 7 days from Firestore "nhl_daily_stats"
                const today = new Date();
                const sevenDaysAgo = new Date(today);
                sevenDaysAgo.setDate(today.getDate() - 7);
                const dateStr = sevenDaysAgo.toISOString().split('T')[0];

                const statsRef = collection(db, 'nhl_daily_stats');
                const q = query(statsRef, where('date', '>=', dateStr));
                const snapshot = await getDocs(q);

                console.log(`🔥 Hot Pickups: Querying nhl_daily_stats >= ${dateStr}`);
                console.log(`🔥 Hot Pickups: Found ${snapshot.docs.length} documents`);
                snapshot.docs.forEach(d => console.log(`  - ${d.id}: ${Object.keys(d.data().players || {}).length} players`));

                const playerTotals = new Map<number, any>();
                let hasFirestoreData = false;

                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.players) {
                        hasFirestoreData = true;
                        Object.values(data.players).forEach((p: any) => {
                            // Skip drafted players
                            if (draftedPlayerIds.has(p.id)) return;

                            if (!playerTotals.has(p.id)) {
                                playerTotals.set(p.id, {
                                    id: p.id,
                                    name: p.name,
                                    team: p.team,
                                    position: p.pos,
                                    points: 0,
                                    games: 0
                                });
                            }
                            const entry = playerTotals.get(p.id);
                            entry.points += p.fp || 0;
                            entry.games += 1;
                        });
                    }
                });

                if (hasFirestoreData) {
                    const freeAgents = Array.from(playerTotals.values())
                        .filter(p => p.points > 0)
                        .map(p => ({
                            id: p.id,
                            name: p.name,
                            team: p.team,
                            position: p.position,
                            points: Number(p.points.toFixed(1)),
                            trend: p.points >= 15 ? 'rising' as const : p.points >= 8 ? 'steady' as const : 'cooling' as const,
                            percentRostered: Math.round(Math.random() * 40 + 10),
                            headshot: `https://assets.nhle.com/mugs/nhl/20242025/${p.team}/${p.id}.png`,
                        }))
                        .sort((a, b) => b.points - a.points)
                        .slice(0, 6);
                    
                    setHotPickups(freeAgents);
                    setHotPickupsLabel('Last 7 Days');
                    return;
                }

                // 2. Fallback to Season Leaders API if Firestore is empty
                console.log('No weekly stats in Firestore, falling back to season API...');
                const response = await fetch('/api/current-season-stats');
                console.log('Season API Response Status:', response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('Season API Data Players:', data.players?.length || 0);
                    
                    if (data.players) {
                        const seasonAgents = data.players
                            .filter((p: any) => !draftedPlayerIds.has(p.playerId))
                            .slice(0, 6)
                            .map((p: any) => ({
                                id: p.playerId,
                                name: p.name,
                                team: p.team,
                                position: p.position,
                                points: p.points,
                                trend: p.points >= 25 ? 'rising' as const : 'steady' as const,
                                percentRostered: Math.round(Math.random() * 40 + 10),
                                headshot: `https://assets.nhle.com/mugs/nhl/20242025/${p.team}/${p.playerId}.png`,
                            }));
                        
                        console.log('Filtered Season Agents:', seasonAgents.length);
                        setHotPickups(seasonAgents);
                        setHotPickupsLabel('Season Leaders');
                    }
                } else {
                    console.error('Season API failed with status:', response.status);
                }
                
            } catch (error) {
                console.error('Error loading hot pickups:', error);
                setHotPickups([]);
            }
        };
        loadHot();
    }, [league, draftedPlayerIds]);

    useEffect(() => {
        if (!league || !myTeam) {
            setTeamPoints(0);
            setLeagueAveragePoints(0);
            return;
        }

        const teamDocRef = doc(db, `leagues/${league.id}/teamScores`, myTeam.teamName);
        const teamsRef = collection(db, `leagues/${league.id}/teamScores`);

        const unsubTeam = onSnapshot(teamDocRef, (snapshot) => {
            const data = snapshot.data();
            setTeamPoints(data?.totalPoints ?? 0);
        });

        const unsubLeague = onSnapshot(teamsRef, (snapshot) => {
            if (snapshot.empty) {
                setLeagueAveragePoints(0);
                return;
            }
            const totals = snapshot.docs.map(docSnap => (docSnap.data()?.totalPoints ?? 0));
            const avg = totals.reduce((sum, val) => sum + val, 0) / totals.length;
            setLeagueAveragePoints(Number(avg.toFixed(1)));
        });

        return () => {
            unsubTeam();
            unsubLeague();
        };
    }, [league, myTeam]);

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

    const isLiveMode = liveStats.length > 0;
    const matchupDisplayList = isLiveMode
        ? liveStats
        : showAllMatchups
            ? matchups
            : matchups.slice(0, 4);

    useEffect(() => {
        if (matchups.length <= 4) {
            setShowAllMatchups(false);
        }
    }, [matchups.length]);

    const renderTeamBadge = (abbrev: string) => (
        <span className="inline-flex items-center gap-1">
            <span className="font-semibold">{abbrev}</span>
            <img
                src={`https://assets.nhle.com/logos/nhl/svg/${abbrev}_dark.svg`}
                alt={`${abbrev} logo`}
                className="w-5 h-5"
                onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    target.style.display = 'none';
                }}
            />
        </span>
    );

    if (!league) {
        return <div className="text-white">Loading league data…</div>;
    }

    return (
        <div className="max-w-6xl mx-auto px-6 space-y-6">
            {/* Matchup Command Center */}
            <GlassCard className="p-6 space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                            <span className={`inline-flex w-2 h-2 rounded-full ${heroState.accent}`} />
                            {heroState.label}
                        </p>
                        <h2 className="text-3xl font-heading font-bold text-white mt-1">
                            {myTeam ? myTeam.teamName : 'Welcome back, GM'}
                        </h2>
                        <p className="text-slate-300 text-lg mt-2">{heroState.message}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <GradientButton onClick={goToRoster}>Set Lines</GradientButton>
                            <GradientButton variant="outline" onClick={() => setActiveTab('standings')}>
                                View Schedule
                            </GradientButton>
                        </div>
                    </div>
                    <div className="bg-slate-900/70 rounded-2xl p-5 min-w-[240px] text-right">
                        <p className="text-xs uppercase text-slate-400">Season Points</p>
                        <div className="text-4xl font-black text-green-400">{teamPoints.toFixed(1)}</div>
                        <p className="text-xs text-slate-500 mt-1">League Avg {leagueAveragePoints.toFixed(1)}</p>
                        <div className="mt-4 text-sm text-slate-400">
                            Today&apos;s Total:{' '}
                            <span className="text-white font-semibold">
                                {liveStats.reduce((sum, stat) => sum + stat.points, 0).toFixed(1)} pts
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    {matchupDisplayList.map((item) => (
                        <div
                            key={isLiveMode ? `live-${(item as LivePlayerStats).playerId}` : `${(item as PlayerMatchup).playerId}-${(item as PlayerMatchup).gameId}`}
                            className="bg-slate-900/40 rounded-xl p-4 border border-slate-800 flex items-center justify-between"
                        >
                            <div>
                                <p className="text-white font-semibold">
                                    {isLiveMode ? (item as LivePlayerStats).playerName : (item as PlayerMatchup).playerName}
                                </p>
                                {isLiveMode ? (
                                    <p className="text-xs text-slate-400">
                                        {(item as LivePlayerStats).nhlTeam} • {(item as LivePlayerStats).goals || 0}G / {(item as LivePlayerStats).assists || 0}A
                                    </p>
                                ) : (
                                    <div className="text-xs text-slate-400 space-y-1">
                                        <div className="flex items-center gap-2">
                                            {renderTeamBadge((item as PlayerMatchup).teamAbbrev)}
                                            <span className="text-slate-500">vs</span>
                                            {renderTeamBadge((item as PlayerMatchup).opponent)}
                                        </div>
                                        <p>{(item as PlayerMatchup).gameTime}</p>
                                    </div>
                                )}
                            </div>
                            <div className="text-right">
                                {isLiveMode ? (
                                    (item as LivePlayerStats).points > 0 ? (
                                        <span className="text-green-400 font-bold text-xl">
                                            +{(item as LivePlayerStats).points.toFixed(1)}
                                        </span>
                                    ) : (
                                        <span className="text-slate-600 font-medium text-lg">
                                            0.0
                                        </span>
                                    )
                                ) : (
                                    <span className="text-slate-300 text-xs uppercase">
                                        {(item as PlayerMatchup).gameState === 'FUT' ? 'Scheduled' : (item as PlayerMatchup).gameState}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {!isLiveMode && matchups.length > 4 && (
                    <div className="flex justify-end">
                        <button
                            onClick={() => setShowAllMatchups(prev => !prev)}
                            className="text-xs font-semibold text-blue-400 hover:text-blue-300 mt-3"
                        >
                            {showAllMatchups ? 'Show fewer matchups' : `View all ${matchups.length} matchups`}
                        </button>
                    </div>
                )}
            </GlassCard>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* League Feed */}
                <GlassCard className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-heading font-semibold text-white">📣 League Feed</h3>
                        <button onClick={goToChat} className="text-sm text-blue-400 hover:text-blue-300">Open Chat →</button>
                    </div>
                    <div className="space-y-3">
                        {feedItems.length === 0 ? (
                            <p className="text-slate-500 text-sm">No news yet. Make the first move.</p>
                        ) : (
                            feedItems.map(item => (
                                <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                                    <div className="text-2xl leading-none">{item.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-white font-medium truncate">
                                                {item.title}
                                            </p>
                                            {item.timestamp && (
                                                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                                    {getRelativeTime(item.timestamp)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-slate-400 text-xs truncate">{item.description}</p>
                                    </div>
                                    {item.cta && (
                                        <button
                                            onClick={item.onClick}
                                            className="text-xs font-semibold text-blue-400 hover:text-blue-300 whitespace-nowrap"
                                        >
                                            {item.cta}
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </GlassCard>

                {/* Team Health & Trends */}
                <GlassCard className="p-6 space-y-4 lg:col-span-2">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h3 className="text-xl font-heading font-semibold text-white">🩺 Team Health & Trends</h3>
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
                        <div className="grid grid-cols-7 gap-2">
                            {trend.length === 0 ? (
                                <div className="col-span-7 text-slate-500 text-sm">Not enough games yet.</div>
                            ) : (
                                trend.map(point => {
                                    // Parse date as local time to avoid timezone shift
                                    const [year, month, day] = point.date.split('-').map(Number);
                                    const localDate = new Date(year, month - 1, day);
                                    return (
                                        <div key={point.date} className="bg-slate-900/50 rounded-lg p-2 text-center">
                                            <p className="text-[10px] uppercase text-slate-500">{localDate.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                                            <div className="mt-1 text-white font-semibold">{point.myTeam.toFixed(1)}</div>
                                            <p className="text-[10px] text-slate-500">Avg {point.leagueAvg.toFixed(1)}</p>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </GlassCard>
            </div>

            {/* Waiver Wire / Hot Pickups */}
            <GlassCard className="p-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h3 className="text-xl font-heading font-semibold text-white">🔥 Waiver Wire / Hot Pickups</h3>
                    <button onClick={goToRoster} className="text-sm text-blue-400 hover:text-blue-300">Open Player Hub →</button>
                </div>
                {hotPickups.length === 0 ? (
                    <p className="text-slate-500 text-sm mt-4">No trending free agents at the moment.</p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
                        {hotPickups.map(pickup => (
                            <div key={pickup.id} className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-950/80 p-4 flex flex-col shadow-lg shadow-black/20 hover:border-slate-600/70 hover:shadow-xl hover:shadow-black/30 transition-all duration-200">
                                <div className="flex items-center gap-3">
                                    {/* Player Headshot */}
                                    <div className="relative">
                                        {pickup.headshot ? (
                                            <img 
                                                src={pickup.headshot} 
                                                alt={pickup.name}
                                                className="w-12 h-12 rounded-full object-cover bg-slate-800 border border-slate-700"
                                                onError={(e) => {
                                                    e.currentTarget.src = 'https://assets.nhle.com/mugs/nhl/default-skater.png';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 text-lg border border-slate-700">
                                                🏒
                                            </div>
                                        )}
                                        {/* Team Logo overlay */}
                                        <img 
                                            src={`https://assets.nhle.com/logos/nhl/svg/${pickup.team}_dark.svg`}
                                            alt={pickup.team}
                                            className="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-900 rounded-full p-0.5 border border-slate-700"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-semibold truncate">{pickup.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getPositionBadgeClass(pickup.position)}`}>
                                                {pickup.position}
                                            </span>
                                            <span className="text-xs text-slate-400">{pickup.team}</span>
                                        </div>
                                    </div>
                                    {/* Trend Badge with glow for rising */}
                                    <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                                        pickup.trend === 'rising' 
                                            ? 'bg-amber-500/20 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.3)]' 
                                            : pickup.trend === 'steady' 
                                                ? 'bg-blue-500/20 text-blue-200' 
                                                : 'bg-slate-600/30 text-slate-300'
                                    }`}>
                                        {pickup.trend === 'rising' ? '🔥 Hot' : pickup.trend === 'steady' ? 'Steady' : 'Cooling'}
                                    </span>
                                </div>
                                <div className="mt-4 flex items-center justify-between text-sm">
                                    <div>
                                        <p className="text-slate-400 text-xs">{hotPickupsLabel}</p>
                                        <p className="text-2xl font-black text-green-400">{pickup.points}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-slate-400 text-xs">Rostered</p>
                                        <p className="text-white font-semibold">{pickup.percentRostered}%</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => goToPlayerCard(pickup.name)}
                                    className="mt-4 text-sm font-semibold text-left text-blue-400 hover:text-blue-300"
                                >
                                    View player card →
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>
        </div>
    );
}
