import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Scale, X } from 'lucide-react';
import { useComparison } from '../../context/ComparisonContext';
import { Icon } from '../ui/Icon';
import { cn } from '../../lib/utils';

/**
 * Floating command bar for the compare flow. It holds the "one picked, one to
 * go" state so a single selection never has to open the full comparison.
 */
export default function ComparisonTray() {
    const {
        selectedPlayers,
        isOpen,
        openComparison,
        removePlayerFromCompare,
        clearComparison,
    } = useComparison();

    const show = selectedPlayers.length > 0 && !isOpen;

    useEffect(() => {
        if (!show) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') clearComparison();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]);

    const ready = selectedPlayers.length === 2;

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 24 }}
                    transition={{ duration: 0.2 }}
                    className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-xl px-0"
                >
                    <div className="flex items-center gap-3 rounded-2xl border border-violet-400/40 bg-slate-900/90 px-3 py-3 shadow-[0_8px_40px_rgba(0,0,0,0.6),0_0_24px_rgba(139,92,246,0.25)] backdrop-blur-xl sm:gap-4 sm:pl-5 sm:pr-3">
                        <Icon as={Scale} size="sm" className="hidden shrink-0 text-violet-300 sm:block" glow />

                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            {selectedPlayers.map(player => (
                                <div
                                    key={player.id}
                                    className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 py-1.5 pl-1.5 pr-2"
                                >
                                    <img
                                        src={player.headshot}
                                        alt=""
                                        className="h-8 w-8 shrink-0 rounded-full border border-violet-300/30 bg-slate-800 object-cover"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">
                                        {player.name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removePlayerFromCompare(player.id)}
                                        aria-label={`Remove ${player.name} from comparison`}
                                        className="shrink-0 rounded-md p-0.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                                    >
                                        <Icon as={X} size="sm" />
                                    </button>
                                </div>
                            ))}

                            {!ready && (
                                <div className="flex min-w-0 flex-1 items-center justify-center rounded-xl border border-dashed border-slate-600/70 py-2.5 px-2">
                                    <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Pick another player
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                            {ready && (
                                <button
                                    type="button"
                                    onClick={openComparison}
                                    className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-purple-900/30 transition-colors hover:from-violet-500 hover:to-purple-500"
                                >
                                    Compare
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={clearComparison}
                                className={cn(
                                    'rounded-xl border border-slate-600/60 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-400 hover:text-white'
                                )}
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    <p className="mt-1.5 hidden text-center text-[10px] font-medium uppercase tracking-[0.2em] text-slate-600 sm:block">
                        Esc to cancel
                    </p>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
