import { createContext, useContext, useState, useRef, useEffect, type ReactNode } from 'react';

interface SoundContextType {
    playSound: (soundName: 'draft-pick' | 'your-turn' | 'notification') => void;
    isMuted: boolean;
    toggleMute: () => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export function SoundProvider({ children }: { children: ReactNode }) {
    const [isMuted, setIsMuted] = useState(false);

    // Audio refs
    const draftPickAudio = useRef<HTMLAudioElement | null>(null);
    const yourTurnAudio = useRef<HTMLAudioElement | null>(null);
    const notificationAudio = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Initialize audio objects with some placeholder or real URLs
        // Using generic sound effects from a CDN for now
        draftPickAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'); // "Pop" sound
        yourTurnAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1992/1992-preview.mp3'); // "Success chime"
        notificationAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // "Notification"

        // Preload
        draftPickAudio.current.load();
        yourTurnAudio.current.load();
        notificationAudio.current.load();
    }, []);

    const playSound = (soundName: 'draft-pick' | 'your-turn' | 'notification') => {
        if (isMuted) return;

        let audioToPlay: HTMLAudioElement | null = null;

        switch (soundName) {
            case 'draft-pick':
                audioToPlay = draftPickAudio.current;
                break;
            case 'your-turn':
                audioToPlay = yourTurnAudio.current;
                break;
            case 'notification':
                audioToPlay = notificationAudio.current;
                break;
        }

        if (audioToPlay) {
            audioToPlay.currentTime = 0;
            audioToPlay.play().catch(e => console.warn("Audio play failed:", e));
        }
    };

    const toggleMute = () => setIsMuted(prev => !prev);

    return (
        <SoundContext.Provider value={{ playSound, isMuted, toggleMute }}>
            {children}
        </SoundContext.Provider>
    );
}

export function useSound() {
    const context = useContext(SoundContext);
    if (context === undefined) {
        throw new Error('useSound must be used within a SoundProvider');
    }
    return context;
}
