import { createContext, useContext, useState, type ReactNode } from 'react';

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
    addPlayerToCompare: (player: ComparisonPlayer) => void;
    removePlayerFromCompare: (playerId: number) => void;
    clearComparison: () => void;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export function ComparisonProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedPlayers, setSelectedPlayers] = useState<ComparisonPlayer[]>([]);

    const openComparison = () => setIsOpen(true);
    const closeComparison = () => setIsOpen(false);

    const addPlayerToCompare = (player: ComparisonPlayer) => {
        // Check if player is already selected
        if (selectedPlayers.some(p => p.id === player.id)) return;

        if (selectedPlayers.length >= 2) {
            // If already 2, replace the second one
            setSelectedPlayers([selectedPlayers[0], player]);
        } else {
            setSelectedPlayers([...selectedPlayers, player]);
        }

        // Auto-open if we have 2 players (or even 1 to show the "select another" state)
        setIsOpen(true);
    };

    const removePlayerFromCompare = (playerId: number) => {
        setSelectedPlayers(selectedPlayers.filter(p => p.id !== playerId));
    };

    const clearComparison = () => {
        setSelectedPlayers([]);
        setIsOpen(false);
    };

    return (
        <ComparisonContext.Provider value={{
            isOpen,
            openComparison,
            closeComparison,
            selectedPlayers,
            addPlayerToCompare,
            removePlayerFromCompare,
            clearComparison
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
