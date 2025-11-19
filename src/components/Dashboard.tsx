import { useMemo } from 'react';
import { useDraft } from '../context/DraftContext';
import { useLeague } from '../context/LeagueContext';
import { useAuth } from '../context/AuthContext';
import { useDraftedPlayers } from '../hooks/useDraftedPlayers';
import { GlassCard } from './ui/GlassCard';
import { Badge } from './ui/Badge';
import { GradientButton } from './ui/GradientButton';

export default function Dashboard({ setActiveTab }: { setActiveTab: (tab: any) => void }) {
    const { draftState } = useDraft();
    const { league } = useLeague();
    const { user } = useAuth();
    const { myRosterStats, recentActivity } = useDraftedPlayers();

    const myTeam = useMemo(() => {
        if (!league || !user) return null;
        return league.teams.find(t => t.ownerUid === user.uid);
    }, [league, user]);

    const nextPick = useMemo(() => {
        if (!draftState || !myTeam) return null;
        return draftState.draftOrder.find(p => p.team === myTeam.teamName && p.pick >= draftState.currentPickNumber);
    }, [draftState, myTeam]);

    const picksUntilMyTurn = nextPick && draftState ? nextPick.pick - draftState.currentPickNumber : null;

    if (!league || !draftState) return <div className="text-white">Loading...</div>;

    return (
        <div className="max-w-6xl mx-auto px-6 space-y-6">
            {/* Welcome & Status Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Welcome Card */}
                <GlassCard className="col-span-1 md:col-span-2 p-6 flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="text-9xl">🏒</span>
                    </div>
                    <div>
                        <h2 className="text-3xl font-heading font-bold text-white mb-2">
                            Welcome back, {user?.displayName?.split(' ')[0] || 'GM'}!
                        </h2>
                        <p className="text-slate-400 mb-6">
                            {myTeam ? `Managing ${myTeam.teamName}` : 'You are not assigned to a team yet.'}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <GradientButton onClick={() => setActiveTab('roster')}>
                            Browse Players
                        </GradientButton>
                        <GradientButton variant="outline" onClick={() => setActiveTab('draftBoard')}>
                            View Draft Board
                        </GradientButton>
                    </div>
                </GlassCard>

                {/* Next Pick Card */}
                <GlassCard className="p-6 flex flex-col items-center justify-center text-center border-t-4 border-t-amber-500">
                    <h3 className="text-slate-400 font-bold uppercase tracking-wider text-sm mb-2">Next Pick</h3>
                    {picksUntilMyTurn === 0 ? (
                        <div className="animate-pulse">
                            <div className="text-5xl font-black text-amber-400 mb-1">NOW</div>
                            <Badge variant="warning">It's Your Turn!</Badge>
                        </div>
                    ) : picksUntilMyTurn !== null ? (
                        <>
                            <div className="text-6xl font-black text-white mb-1">{picksUntilMyTurn}</div>
                            <p className="text-slate-400 text-sm">picks away</p>
                            <div className="mt-4 text-xs text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full">
                                Round {nextPick?.round} • Pick #{nextPick?.pick}
                            </div>
                        </>
                    ) : (
                        <div className="text-slate-500">Draft Complete</div>
                    )}
                </GlassCard>
            </div>

            {/* Quick Stats & Activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Team Balance */}
                <GlassCard className="p-6">
                    <h3 className="text-xl font-heading font-bold text-white mb-4 flex items-center gap-2">
                        <span>📊</span> Roster Balance
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700/50">
                            <div className="text-3xl font-bold text-blue-400">{myRosterStats.F}</div>
                            <div className="text-xs text-slate-500 font-bold uppercase">Forwards</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700/50">
                            <div className="text-3xl font-bold text-green-400">{myRosterStats.D}</div>
                            <div className="text-xs text-slate-500 font-bold uppercase">Defense</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700/50">
                            <div className="text-3xl font-bold text-purple-400">{myRosterStats.G}</div>
                            <div className="text-xs text-slate-500 font-bold uppercase">Goalies</div>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-700/50 text-center flex justify-between text-sm">
                        <span className="text-slate-400">Reserves: <span className="text-white font-bold">{myRosterStats.reserve}/5</span></span>
                        <span className="text-slate-400">Target: <span className="text-white font-bold">9F / 5D / 2G</span></span>
                    </div>
                </GlassCard>

                {/* Recent Activity */}
                <GlassCard className="p-6">
                    <h3 className="text-xl font-heading font-bold text-white mb-4 flex items-center gap-2">
                        <span>📢</span> Recent Activity
                    </h3>
                    <div className="space-y-3">
                        {recentActivity.length === 0 ? (
                            <div className="text-slate-500 text-sm text-center py-4">No draft picks yet</div>
                        ) : (
                            recentActivity.map((pick) => (
                                <div key={pick.id} className="flex items-center gap-3 text-sm p-2 rounded hover:bg-slate-800/50 transition-colors">
                                    <div className={`w-2 h-2 rounded-full ${pick.draftedByTeam === myTeam?.teamName ? 'bg-green-500' : 'bg-slate-500'
                                        }`}></div>
                                    <div>
                                        <span className="text-blue-300 font-bold">{pick.draftedByTeam}</span>
                                        <span className="text-slate-400"> drafted </span>
                                        <span className="text-white font-semibold">{pick.name}</span>
                                    </div>
                                    <span className="ml-auto text-slate-500 text-xs">#{pick.pickNumber}</span>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="mt-4 text-center">
                        <button
                            onClick={() => setActiveTab('chat')}
                            className="text-blue-400 hover:text-blue-300 text-sm font-semibold transition-colors"
                        >
                            View League Chat →
                        </button>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
