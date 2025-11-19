import { useEffect, useState } from 'react';
import ReactConfetti from 'react-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { useWindowSize } from 'react-use';

interface DraftCelebrationProps {
    show: boolean;
    playerName?: string;
    onComplete?: () => void;
}

export default function DraftCelebration({ show, playerName, onComplete }: DraftCelebrationProps) {
    const { width, height } = useWindowSize();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (show) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                if (onComplete) onComplete();
            }, 5000); // Show for 5 seconds
            return () => clearTimeout(timer);
        }
    }, [show, onComplete]);

    return (
        <AnimatePresence>
            {isVisible && (
                <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
                    <ReactConfetti
                        width={width}
                        height={height}
                        recycle={false}
                        numberOfPieces={500}
                        gravity={0.2}
                    />

                    {playerName && (
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0, y: 50 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 1.5, opacity: 0 }}
                            transition={{ type: "spring", bounce: 0.5 }}
                            className="bg-gradient-to-r from-amber-500 to-orange-600 p-1 rounded-2xl shadow-2xl"
                        >
                            <div className="bg-black/80 backdrop-blur-md px-12 py-8 rounded-xl border border-amber-500/50 text-center">
                                <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-wider italic">
                                    Drafted!
                                </h2>
                                <div className="text-2xl font-bold text-amber-400">
                                    {playerName}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            )}
        </AnimatePresence>
    );
}
