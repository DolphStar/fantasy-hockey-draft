import { createContext, useContext, useState, type ReactNode } from 'react';
import { isComparisonReady, nextComparisonSelection } from '../utils/comparison';

export interface ComparisonPlayer {
    id: number;
    name: string;
    headshot: string;
    positionCode: string;
    teamAbbrev: string;
    stats: any;
}

interface ComparisonContextType {
    isOpen: boolean;
    openComparison: () => void;
    closeComparison: () => void;
    selectedPlayers: ComparisonPlayer[];
    /** Adds the player, or removes them if they were already picked. */
    togglePlayerToCompare: (player: ComparisonPlayer) => void;
    removePlayerFromCompare: (playerId: number) => void;
    clearComparison: () => void;
    isComparing: (playerId: number) => boolean;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export function ComparisonProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedPlayers, setSelectedPlayers] = useState<ComparisonPlayer[]>([]);

    const openComparison = () => setIsOpen(true);
    const closeComparison = () => setIsOpen(false);

    const togglePlayerToCompare = (player: ComparisonPlayer) => {
        const next = nextComparisonSelection(selectedPlayers, player);
        setSelectedPlayers(next);
        // A comparison of one is not a comparison — the tray carries the
        // "pick another player" state until there are two.
        setIsOpen(isComparisonReady(next));
    };

    const removePlayerFromCompare = (playerId: number) => {
        const next = selectedPlayers.filter(p => p.id !== playerId);
        setSelectedPlayers(next);
        if (!isComparisonReady(next)) setIsOpen(false);
    };

    const clearComparison = () => {
        setSelectedPlayers([]);
        setIsOpen(false);
    };

    const isComparing = (playerId: number) => selectedPlayers.some(p => p.id === playerId);

    return (
        <ComparisonContext.Provider value={{
            isOpen,
            openComparison,
            closeComparison,
            selectedPlayers,
            togglePlayerToCompare,
            removePlayerFromCompare,
            clearComparison,
            isComparing
        }}>
            {children}
        </ComparisonContext.Provider>
    );
}

export function useComparison() {
    const context = useContext(ComparisonContext);
    if (context === undefined) {
        throw new Error('useComparison must be used within a ComparisonProvider');
    }
    return context;
}
