import { useMemo } from 'react';
import { useDraftedPlayers } from '../hooks/useDraftedPlayers';
import { useInjuries } from '../queries/useInjuries';
import { isPlayerInjuredByName, getInjuryIcon, getInjuryColor } from '../services/injuryService';
import { GlassCard } from './ui/GlassCard';
import { Badge } from './ui/Badge';

export default function TeamHealthTrends() {
    const { draftedPlayers } = useDraftedPlayers();
    const { data: allInjuries = [], isLoading } = useInjuries();

    const myInjuries = useMemo(() => {
        if (!draftedPlayers || draftedPlayers.length === 0) return [];

        return draftedPlayers
            .map((player) => {
                const injury = isPlayerInjuredByName(player.name, allInjuries);
                return injury ? { ...injury, player } : null;
            })
            .filter(Boolean);
    }, [draftedPlayers, allInjuries]);

    const injuredCount = myInjuries.length;

    if (!isLoading && injuredCount === 0) {
        return (
            <GlassCard className="p-6 border-t-4 border-t-green-500">
                <h3 className="text-xl font-heading font-bold text-white mb-4 flex items-center gap-2">
                    <span>💚</span> Team Health
                </h3>
                <div className="text-center py-6">
                    <div className="text-6xl mb-3">✅</div>
                    <div className="text-2xl font-bold text-green-400 mb-1">All Healthy!</div>
                    <p className="text-slate-400 text-sm">
                        {draftedPlayers?.length || 0} players ready to go
                    </p>
                </div>
            </GlassCard>
        );
    }

    if (isLoading) {
        return (
            <GlassCard className="p-6 border-t-4 border-t-slate-600">
                <h3 className="text-xl font-heading font-bold text-white mb-4 flex items-center gap-2">
                    <span>🏥</span> Team Health
                </h3>
                <div className="text-center py-6 text-slate-400">
                    <div className="animate-spin text-4xl mb-2">⏳</div>
                    <p className="text-sm">Checking injury reports...</p>
                </div>
            </GlassCard>
        );
    }

    return (
        <GlassCard className="p-6 border-t-4 border-t-red-500">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-heading font-bold text-white flex items-center gap-2">
                    <span>🏥</span> Team Health
                </h3>
                <Badge variant="danger" className="text-lg px-3 py-1">
                    {injuredCount} Injured
                </Badge>
            </div>

            <div className="space-y-3">
                {myInjuries.map((injury: any, index: number) => {
                    if (!injury) return null;

                    const statusColor = getInjuryColor(injury.status);
                    const statusIcon = getInjuryIcon(injury.status);

                    return (
                        <div
                            key={index}
                            className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 hover:border-red-500/50 transition-colors"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-white font-semibold">{injury.player?.name}</span>
                                        <Badge variant={injury.player?.position === 'G' ? 'warning' : injury.player?.position === 'D' ? 'success' : 'info'}>
                                            {injury.player?.position}
                                        </Badge>
                                    </div>
                                    <div className="text-xs text-slate-400">{injury.player?.nhlTeam}</div>
                                </div>
                                <div className={`${statusColor} text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1`}>
                                    {statusIcon} {injury.status.toUpperCase()}
                                </div>
                            </div>

                            <div className="space-y-1 text-sm">
                                {injury.injuryType && (
                                    <div className="flex items-start gap-2">
                                        <span className="text-slate-500 min-w-[4rem]">Type:</span>
                                        <span className="text-white font-medium">{injury.injuryType}</span>
                                    </div>
                                )}
                                {injury.description && (
                                    <div className="flex items-start gap-2">
                                        <span className="text-slate-500 min-w-[4rem]">Details:</span>
                                        <span className="text-slate-300 text-xs">{injury.description}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 pt-4 border-t border-red-900/30">
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-red-400">{injuredCount}</div>
                        <div className="text-xs text-slate-500 uppercase">On IR</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-green-400">{(draftedPlayers?.length || 0) - injuredCount}</div>
                        <div className="text-xs text-slate-500 uppercase">Healthy</div>
                    </div>
                </div>
            </div>
        </GlassCard>
    );
}
