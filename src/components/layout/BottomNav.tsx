import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface BottomNavProps {
  onOpenChat: () => void;
  unread: number;
}

const tabs = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/players', label: 'Players', icon: '🏒' },
  { to: '/scores', label: 'Scores', icon: '🏆' },
];

export default function BottomNav({ onOpenChat, unread }: BottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const moreActive = pathname.startsWith('/draft') || pathname.startsWith('/league');

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [moreOpen]);

  useEffect(() => setMoreOpen(false), [pathname]);

  const itemCls = (active: boolean) =>
    cn('flex-1 flex flex-col items-center justify-center gap-0.5 h-14 py-2 text-[10px] font-bold',
       active ? 'text-primary' : 'text-slate-500');

  return (
    <>
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div className="fixed inset-0 bg-black/50 z-40 md:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="More navigation"
              className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-50 md:hidden bg-gradient-to-br from-[#101729] to-[#0d1322] border-t border-slate-800 rounded-t-2xl p-3"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            >
              {[{ to: '/draft', label: '📋 Draft Board' }, { to: '/league', label: '⚙️ League Settings' }].map((l) => (
                <NavLink key={l.to} to={l.to} onClick={() => setMoreOpen(false)}
                  className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-200 hover:bg-slate-800">
                  {l.label}
                </NavLink>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0d1424]/95 backdrop-blur border-t border-slate-800 flex pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} onClick={() => setMoreOpen(false)}
            className={({ isActive }) => itemCls(isActive)}>
            <span className="text-lg">{t.icon}</span>{t.label}
          </NavLink>
        ))}
        <button type="button" onClick={() => { setMoreOpen(false); onOpenChat(); }} className={cn(itemCls(false), 'relative')}>
          <span className="text-lg">💬</span>Chat
          {unread > 0 && (
            <span className="absolute top-1 right-[22%] bg-live text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
        <button type="button" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} className={itemCls(moreActive)}>
          <span className="text-lg">⋯</span>More
        </button>
      </nav>
    </>
  );
}
