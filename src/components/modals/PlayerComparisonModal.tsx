import { motion, AnimatePresence } from 'framer-motion';
import { useComparison } from '../../context/ComparisonContext';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';

export default function PlayerComparisonModal() {
    const { isOpen, closeComparison, selectedPlayers, removePlayerFromCompare } = useComparison();

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="w-full max-w-4xl"
                    >
                        <GlassCard className="p-6 relative max-h-[90vh] overflow-y-auto">
                            <button
                                onClick={closeComparison}
                                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                            >
                                ✕
                            </button>

                            <h2 className="text-2xl font-heading font-bold text-white mb-6 text-center">
                                Player Comparison
                            </h2>

                            {selectedPlayers.length === 0 ? (
                                <div className="text-center text-slate-400 py-12">
                                    Select players to compare
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {selectedPlayers.map((player) => (
                                        <div key={player.id} className="relative">
                                            <button
                                                onClick={() => removePlayerFromCompare(player.id)}
                                                className="absolute top-0 right-0 text-red-400 hover:text-red-300 text-xs"
                                            >
                                                Remove
                                            </button>

                                            {/* Header */}
                                            <div className="flex items-center gap-4 mb-6">
                                                <img
                                                    src={player.headshot}
                                                    alt={player.name}
                                                    className="w-20 h-20 rounded-full border-2 border-slate-600"
                                                />
                                                <div>
                                                    <h3 className="text-xl font-bold text-white">{player.name}</h3>
                                                    <div className="flex gap-2 mt-1">
                                                        <Badge variant="outline">{player.positionCode}</Badge>
                                                        <Badge variant="default">{player.teamAbbrev}</Badge>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Stats Grid */}
                                            <div className="space-y-3">
                                                {player.positionCode === 'G' ? (
                                                    <>
                                                        <StatRow label="Wins" value={player.stats?.wins} />
                                                        <StatRow label="GAA" value={player.stats?.goalsAgainstAverage?.toFixed(2)} />
                                                        <StatRow label="Save %" value={player.stats?.savePercentage?.toFixed(3)} />
                                                        <StatRow label="Shutouts" value={player.stats?.shutouts} />
                                                    </>
                                                ) : (
                                                    <>
                                                        <StatRow label="Goals" value={player.stats?.goals} />
                                                        <StatRow label="Assists" value={player.stats?.assists} />
                                                        <StatRow label="Points" value={player.stats?.points} />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {selectedPlayers.length < 2 && (
                                <div className="mt-8 text-center p-4 border-2 border-dashed border-slate-700 rounded-xl text-slate-500">
                                    Select another player to compare
                                </div>
                            )}
                        </GlassCard>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

function StatRow({ label, value }: { label: string, value: string | number | undefined }) {
    return (
        <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
            <span className="text-slate-400 text-sm uppercase font-bold tracking-wider">{label}</span>
            <span className="text-white font-mono font-bold text-lg">{value ?? '-'}</span>
        </div>
    );
}
