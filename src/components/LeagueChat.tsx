import { useEffect, useRef, useState } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, limit, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLeague } from '../context/LeagueContext';
import { useAuth } from '../context/AuthContext';

interface ChatMessage {
  id: string;
  text: string;
  userId: string;
  userName: string;
  teamName?: string | null;
  createdAt: string; // ISO string
}

interface LeagueChatProps {
  /**
   * Layout variant:
   * - 'full' (default): full-page chat view used on the Chat tab
   * - 'embedded': compact panel used alongside the draft board
   */
  variant?: 'full' | 'embedded';
}

export default function LeagueChat({ variant = 'full' }: LeagueChatProps) {
  const { league, isAdmin } = useLeague();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Subscribe to chat messages for this league
  useEffect(() => {
    if (!league) return;

    const messagesRef = collection(db, `leagues/${league.id}/chatMessages`);
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(200));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ChatMessage[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<ChatMessage, 'id'>),
      }));
      setMessages(items);
    });

    return () => unsubscribe();
  }, [league]);

  // Watch for chat ban status for current user
  useEffect(() => {
    if (!league || !user) return;

    const banRef = doc(db, `leagues/${league.id}/chatBans`, user.uid);
    const unsubscribe = onSnapshot(banRef, (snapshot) => {
      setIsBanned(snapshot.exists());
    });

    return () => unsubscribe();
  }, [league, user]);

  if (!league) {
    return (
      <div className={
        variant === 'embedded'
          ? 'flex flex-col h-full bg-gray-900/80 rounded-lg border border-gray-700 p-3'
          : 'max-w-4xl mx-auto p-6'
      }>
        <h2 className={
          variant === 'embedded'
            ? 'text-sm font-semibold mb-2 text-white'
            : 'text-3xl font-bold mb-4 text-white'
        }>
          
          League Chat
        </h2>
        <p className="text-gray-400 text-sm">No league loaded. Join or create a league to use chat.</p>
      </div>
    );
  }

  const handleSend = async () => {
    if (!user || !newMessage.trim() || sending) return;

    if (isBanned) {
      alert('You have been muted in this league chat by the admin.');
      return;
    }

    try {
      setSending(true);
      const messagesRef = collection(db, `leagues/${league.id}/chatMessages`);
      const now = new Date().toISOString();

      await addDoc(messagesRef, {
        text: newMessage.trim(),
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        teamName: league.teams.find(t => t.ownerUid === user.uid)?.teamName || null,
        createdAt: now,
      });

      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!league || !isAdmin) return;

    const confirmDelete = window.confirm('Delete this message for everyone?');
    if (!confirmDelete) return;

    try {
      const messageRef = doc(db, `leagues/${league.id}/chatMessages`, messageId);
      await deleteDoc(messageRef);
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message. Please try again.');
    }
  };

  const handleBanUser = async (targetUserId: string, displayName: string) => {
    if (!league || !isAdmin) return;

    const confirmBan = window.confirm(`Ban ${displayName} from league chat?`);
    if (!confirmBan) return;

    try {
      const banRef = doc(db, `leagues/${league.id}/chatBans`, targetUserId);
      await setDoc(banRef, {
        userId: targetUserId,
        bannedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to ban user:', error);
      alert('Failed to ban user from chat. Please try again.');
    }
  };

  const containerClass =
    variant === 'embedded'
      ? 'flex flex-col h-full bg-gray-900/80 rounded-lg border border-gray-700 p-3'
      : 'max-w-4xl mx-auto p-6 flex flex-col h-[70vh]';

  return (
    <div className={containerClass}>
      <h2
        className={
          variant === 'embedded'
            ? 'text-sm font-semibold mb-2 text-white flex items-center gap-2'
            : 'text-3xl font-bold mb-4 text-white'
        }
      >
        <span>💬</span>
        <span>{variant === 'embedded' ? 'League Chat' : 'League Chat'}</span>
      </h2>
      {variant === 'full' && (
        <p className="text-gray-400 text-sm mb-4">
          Chat with everyone in <span className="font-semibold text-blue-300">{league.leagueName}</span>.
          Messages are visible to all league members.
        </p>
      )}

      {isBanned && (
        <div className="bg-red-900/40 border border-red-600 text-red-100 text-sm px-4 py-2 rounded mb-3">
          You have been muted in this league chat by the admin. You can still read messages but cannot send new ones.
        </div>
      )}

      {/* Messages list */}
      <div className="flex-1 bg-gray-800 rounded-lg p-3 overflow-y-auto border border-gray-700">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-sm">No messages yet. Start the conversation!</p>
        ) : (
          <div className="space-y-3">
            {messages.map(msg => {
              const isMe = msg.userId === user?.uid;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-md ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-gray-700 text-gray-100 rounded-bl-none'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-xs">
                        {msg.teamName || msg.userName}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] opacity-80">{formatTime(msg.createdAt)}</span>
                        {isAdmin && !isMe && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="text-[10px] text-gray-300 hover:text-red-300 px-1 py-0.5 rounded"
                              title="Delete message"
                            >
                              🗑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBanUser(msg.userId, msg.teamName || msg.userName)}
                              className="text-[10px] text-gray-300 hover:text-yellow-300 px-1 py-0.5 rounded"
                              title="Ban user from chat"
                            >
                              🚫
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mt-4">
        <label className="block text-gray-300 text-sm mb-1">Message</label>
        <div className="flex gap-2 items-end">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Type a message and press Enter to send..."
            className="flex-1 resize-none px-3 py-2 rounded bg-gray-800 text-white border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
            disabled={isBanned}
          />
          <button
            onClick={handleSend}
            disabled={sending || !newMessage.trim() || isBanned}
            className={`px-4 py-2 rounded font-semibold text-sm transition-colors ${
              sending || !newMessage.trim() || isBanned
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">Press Enter to send, Shift+Enter for a new line.</p>
      </div>
    </div>
  );
}
