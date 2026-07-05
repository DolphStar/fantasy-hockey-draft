import { useEffect, useState } from 'react';

const COLORS = ['#facc15', '#3b82f6', '#4ade80', '#f8fafc'];
const PIECE_COUNT = 40;

/** One-time falling-confetti burst per storageKey. No deps, CSS-driven. */
export function ConfettiBurst({ storageKey }: { storageKey: string }) {
    const [pieces, setPieces] = useState<Array<{ left: number; delay: number; color: string; drift: number }>>([]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const key = `confetti-${storageKey}`;
        if (window.localStorage.getItem(key)) return;
        window.localStorage.setItem(key, '1');
        setPieces(Array.from({ length: PIECE_COUNT }, () => ({
            left: Math.random() * 100,
            delay: Math.random() * 0.8,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            drift: Math.random() * 40 - 20,
        })));
        const timer = setTimeout(() => setPieces([]), 4000);
        return () => clearTimeout(timer);
    }, [storageKey]);

    if (pieces.length === 0) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-[70] overflow-hidden" aria-hidden>
            {pieces.map((p, i) => (
                <span
                    key={i}
                    className="absolute w-2 h-3 rounded-[1px] animate-confetti-fall motion-reduce:hidden"
                    style={{
                        left: `${p.left}%`,
                        top: '-3%',
                        backgroundColor: p.color,
                        animationDelay: `${p.delay}s`,
                        ['--confetti-drift' as string]: `${p.drift}px`,
                    }}
                />
            ))}
        </div>
    );
}
