import { Clock, Zap } from 'lucide-react';
import { Icon } from '../ui/Icon';
import { cn } from '../../lib/utils';

interface DraftStatusProps {
    draftState: any;
    currentPick: any;
    isMyTurn: boolean;
    myTeam: any;
    league: any;
    myTeamPositions: {
        active: { F: number; D: number; G: number };
        reserve: number;
        total: number;
    };
}

export default function DraftStatus({
    draftState,
    currentPick,
    isMyTurn,
    myTeam,
    league,
    myTeamPositions
}: DraftStatusProps) {
    if (!draftState || !currentPick) return null;

    const totalPicks = Number(draftState.totalPicks) || 0;
    const progress = totalPicks > 0
        ? Math.min(100, Math.max(0, ((currentPick.pick - 1) / totalPicks) * 100))
        : 0;

    const rosterNeeds = myTeam && league?.rosterSettings
        ? [
            { label: 'F', have: myTeamPositions.active.F, need: league.rosterSettings.forwards },
            { label: 'D', have: myTeamPositions.active.D, need: league.rosterSettings.defensemen },
            { label: 'G', have: myTeamPositions.active.G, need: league.rosterSettings.goalies },
        ]
        : [];

    return (
        <div
            className={cn(
                'relative overflow-hidden rounded-xl border backdrop-blur-md mb-6 transition-colors duration-300',
                isMyTurn
                    ? 'border-emerald-400/45 bg-gradient-to-br from-emerald-500/10 via-slate-900/70 to-[#0d1322]/85 shadow-[0_8px_32px_rgba(0,0,0,.45),0_0_30px_rgba(16,185,129,.18),inset_0_1px_0_rgba(148,180,255,.14)]'
                    : 'border-blue-400/20 bg-gradient-to-br from-slate-800/55 to-[#0d1322]/85 shadow-glass'
            )}
        >
            {/* Status rail */}
            <div
                className={cn(
                    'absolute inset-y-0 left-0 w-1',
                    isMyTurn
                        ? 'bg-gradient-to-b from-emerald-300 to-emerald-600'
                        : 'bg-gradient-to-b from-slate-600 to-slate-800'
                )}
            />

            {/* Soft glow behind the status side */}
            {isMyTurn && (
                <div className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
            )}

            <div className="relative flex flex-wrap items-center justify-between gap-4 py-4 pl-6 pr-5">
                <div className="min-w-0">
                    {/* Pick meta */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <span className="tabular-nums">
                            Pick {currentPick.pick} <span className="text-slate-600">of</span> {draftState.totalPicks}
                        </span>
                        <span className="text-slate-700">•</span>
                        <span>Round {currentPick.round}</span>
                        {myTeam && (
                            <>
                                <span className="text-slate-700">•</span>
                                <span className="normal-case tracking-normal text-slate-400">{myTeam.teamName}</span>
                            </>
                        )}
                    </div>

                    {/* Headline */}
                    <h2 className="mt-2 flex items-center gap-2.5 font-heading text-xl font-bold text-white">
                        <span
                            className={cn(
                                'grid h-8 w-8 shrink-0 place-items-center rounded-lg border',
                                isMyTurn
                                    ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                                    : 'border-slate-600/50 bg-slate-800/70 text-slate-400'
                            )}
                        >
                            <Icon as={isMyTurn ? Zap : Clock} size="sm" glow={isMyTurn} />
                        </span>
                        {isMyTurn ? (
                            <span>
                                Your turn — <span className="text-points">draft a player below</span>
                            </span>
                        ) : (
                            <span className="text-slate-300">
                                Waiting on <span className="text-white">{currentPick.team}</span>
                            </span>
                        )}
                    </h2>

                    {/* Roster needs */}
                    {rosterNeeds.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            {rosterNeeds.map(({ label, have, need }) => {
                                const filled = have >= need;
                                return (
                                    <span
                                        key={label}
                                        className={cn(
                                            'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold tabular-nums',
                                            filled
                                                ? 'border-emerald-400/25 bg-emerald-500/10 text-points'
                                                : 'border-amber-400/25 bg-amber-500/10 text-amber-300'
                                        )}
                                    >
                                        {label}
                                        <span className="opacity-80">{have}/{need}</span>
                                    </span>
                                );
                            })}
                            <span className="inline-flex items-center gap-1 rounded-md border border-white/5 bg-slate-800/60 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-400">
                                RES
                                <span className="opacity-80">{myTeamPositions.reserve}/5</span>
                            </span>
                            <span className="text-[11px] font-medium tabular-nums text-slate-600">
                                {myTeamPositions.total} total
                            </span>
                        </div>
                    )}
                </div>

                {/* Status pill */}
                <div
                    className={cn(
                        'flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.15em]',
                        isMyTurn
                            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                            : 'border-slate-600/40 bg-slate-800/60 text-slate-400'
                    )}
                >
                    <span
                        className={cn(
                            'h-2 w-2 rounded-full',
                            isMyTurn
                                ? 'bg-emerald-400 animate-live-pulse motion-reduce:animate-none'
                                : 'bg-slate-500'
                        )}
                    />
                    {isMyTurn ? 'On the clock' : 'Picking'}
                </div>
            </div>

            {/* Draft progress */}
            <div className="relative h-[3px] w-full bg-slate-800/70">
                <div
                    className={cn(
                        'h-full transition-[width] duration-500',
                        isMyTurn
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                            : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                    )}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}
