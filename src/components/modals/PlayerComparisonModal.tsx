import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useComparison, type ComparisonPlayer } from '../../context/ComparisonContext';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { Icon } from '../ui/Icon';
import { cn } from '../../lib/utils';

interface StatLine {
    label: string;
    value: number | undefined;
    /** Rendered form — keeps % and decimals out of the winner math. */
    display: string;
    /** GAA is the only stat here where a smaller number is the better one. */
    lowerIsBetter?: boolean;
}

const isGoalie = (player: ComparisonPlayer) => player.positionCode === 'G';

/** True when `value` beats `other` in the direction this stat is scored. */
function wins(value: number | undefined, other: number | undefined, lowerIsBetter = false) {
    if (value === undefined || other === undefined) return false;
    return lowerIsBetter ? value < other : value > other;
}

/** Only the fields `getLastSeasonStats` maps — see nhlApi.test.ts. */
function statLines(player: ComparisonPlayer): StatLine[] {
    const stats = player.stats;
    const num = (value: unknown): number | undefined =>
        typeof value === 'number' && !Number.isNaN(value) ? value : undefined;

    if (isGoalie(player)) {
        const goalieWins = num(stats?.wins);
        const savePct = num(stats?.savePct);
        const gaa = num(stats?.goalsAgainstAverage);
        const shutouts = num(stats?.shutouts);
        return [
            { label: 'Fantasy Pts', value: (goalieWins ?? 0) * 2, display: `${(goalieWins ?? 0) * 2}` },
            { label: 'Wins', value: goalieWins, display: goalieWins?.toString() ?? '—' },
            {
                label: 'Save %',
                value: savePct,
                display: savePct !== undefined ? `${(savePct * 100).toFixed(1)}%` : '—',
            },
            {
                label: 'GAA',
                value: gaa,
                display: gaa !== undefined ? gaa.toFixed(2) : '—',
                lowerIsBetter: true,
            },
            { label: 'Shutouts', value: shutouts, display: shutouts?.toString() ?? '—' },
        ];
    }

    const goals = num(stats?.goals);
    const assists = num(stats?.assists);
    const points = num(stats?.points);
    const perGame = num(stats?.pointsPerGame);
    return [
        { label: 'Fantasy Pts', value: (goals ?? 0) + (assists ?? 0), display: `${(goals ?? 0) + (assists ?? 0)}` },
        { label: 'Goals', value: goals, display: goals?.toString() ?? '—' },
        { label: 'Assists', value: assists, display: assists?.toString() ?? '—' },
        { label: 'Points', value: points, display: points?.toString() ?? '—' },
        { label: 'Pts/Game', value: perGame, display: perGame !== undefined ? perGame.toFixed(2) : '—' },
    ];
}

export default function PlayerComparisonModal() {
    const { isOpen, closeComparison, selectedPlayers, removePlayerFromCompare, clearComparison } = useComparison();

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeComparison();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const [left, right] = selectedPlayers;
    const comparable = Boolean(left && right) && isGoalie(left) === isGoalie(right);
    const rows = left ? statLines(left) : [];
    const rightRows = right ? statLines(right) : [];

    return (
        <AnimatePresence>
            {isOpen && left && right && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                    onClick={closeComparison}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Player comparison"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 12 }}
                        transition={{ duration: 0.18 }}
                        className="w-full max-w-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <GlassCard className="relative max-h-[90vh] overflow-y-auto border-violet-400/25 p-5 sm:p-6">
                            <button
                                onClick={closeComparison}
                                aria-label="Close comparison"
                                className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <Icon as={X} size="sm" />
                            </button>

                            <h2 className="mb-6 text-center font-heading text-xl font-bold text-white sm:text-2xl">
                                Head to Head
                            </h2>

                            {/* Players */}
                            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-4">
                                <PlayerHead player={left} onRemove={() => removePlayerFromCompare(left.id)} />
                                <div className="pt-8 text-center font-heading text-xs font-black uppercase tracking-[0.2em] text-slate-600">
                                    vs
                                </div>
                                <PlayerHead player={right} onRemove={() => removePlayerFromCompare(right.id)} />
                            </div>

                            {/* Stats */}
                            <div className="mt-6 space-y-1.5">
                                {comparable
                                    ? rows.map((row, i) => {
                                        const other = rightRows[i];
                                        const leftWins = wins(row.value, other?.value, row.lowerIsBetter);
                                        const rightWins = wins(other?.value, row.value, row.lowerIsBetter);
                                        return (
                                            <div
                                                key={row.label}
                                                className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-slate-700/30 bg-slate-800/40 px-3 py-2.5 sm:gap-4"
                                            >
                                                <StatValue display={row.display} isWinner={leftWins} align="right" />
                                                <span className="whitespace-nowrap text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-xs">
                                                    {row.label}
                                                </span>
                                                <StatValue display={other?.display ?? '—'} isWinner={rightWins} align="left" />
                                            </div>
                                        );
                                    })
                                    : (
                                        <>
                                            <p className="mb-3 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-center text-xs font-semibold text-amber-300">
                                                Skater and goalie stats are not directly comparable
                                            </p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <SoloStats lines={rows} />
                                                <SoloStats lines={rightRows} />
                                            </div>
                                        </>
                                    )}
                            </div>

                            <div className="mt-6 flex items-center justify-center gap-2">
                                <button
                                    onClick={clearComparison}
                                    className="rounded-xl border border-slate-600/60 px-4 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-400 hover:text-white"
                                >
                                    Clear both
                                </button>
                                <button
                                    onClick={closeComparison}
                                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white border border-blue-400/30 shadow-[0_1px_0_rgba(255,255,255,.18)_inset] transition-colors hover:bg-blue-500"
                                >
                                    Done
                                </button>
                            </div>
                        </GlassCard>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function PlayerHead({ player, onRemove }: { player: ComparisonPlayer; onRemove: () => void }) {
    return (
        <div className="flex flex-col items-center text-center">
            <div className="relative">
                <img
                    src={player.headshot}
                    alt={player.name}
                    className="h-20 w-20 rounded-full border-2 border-slate-600 bg-slate-800 object-cover sm:h-24 sm:w-24"
                />
                <button
                    onClick={onRemove}
                    aria-label={`Remove ${player.name}`}
                    className="absolute -right-1 -top-1 rounded-full border border-slate-600 bg-slate-900 p-1 text-slate-400 transition-colors hover:border-red-400/60 hover:text-red-300"
                >
                    <Icon as={X} size="sm" />
                </button>
            </div>
            <h3 className="mt-2.5 text-sm font-bold leading-tight text-white sm:text-base">{player.name}</h3>
            <div className="mt-1.5 flex gap-1.5">
                <Badge variant="outline">{player.positionCode}</Badge>
                <Badge variant="default">{player.teamAbbrev}</Badge>
            </div>
        </div>
    );
}

function StatValue({ display, isWinner, align }: { display: string; isWinner: boolean; align: 'left' | 'right' }) {
    return (
        <span
            className={cn(
                'font-data text-base font-bold sm:text-lg',
                align === 'right' ? 'text-right' : 'text-left',
                isWinner ? 'text-points drop-shadow-[0_0_10px_rgba(74,222,128,0.35)]' : 'text-slate-300'
            )}
        >
            {display}
        </span>
    );
}

function SoloStats({ lines }: { lines: StatLine[] }) {
    return (
        <div className="space-y-1.5">
            {lines.map(line => (
                <div
                    key={line.label}
                    className="flex items-center justify-between rounded-lg border border-slate-700/30 bg-slate-800/40 px-3 py-2"
                >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{line.label}</span>
                    <span className="font-data text-sm font-bold text-white">{line.display}</span>
                </div>
            ))}
        </div>
    );
}
