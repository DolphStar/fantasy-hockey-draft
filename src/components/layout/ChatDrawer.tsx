import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';
import LeagueChat from '../LeagueChat';
import { Icon } from '../ui/Icon';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatDrawer({ isOpen, onClose }: ChatDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="League chat"
            className="fixed top-0 right-0 bottom-0 z-[60] w-full sm:w-[420px] bg-gradient-to-br from-[#101729] to-[#0d1322] border-l border-slate-800 shadow-2xl flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Icon as={MessageCircle} size="sm" className="text-blue-400" /> League Chat
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close chat"
                className="text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800"
              >
                <Icon as={X} size="sm" />
              </button>
            </div>
            <div className="flex-1 min-h-0 p-3">
              <LeagueChat variant="embedded" hideHeader />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
