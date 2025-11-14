import { useEffect, useRef, useState } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
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

export default function LeagueChat() {
  const { league } = useLeague();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
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

  if (!league) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h2 className="text-3xl font-bold mb-6 text-white">League Chat</h2>
        <p className="text-gray-400">No league loaded. Join or create a league to use chat.</p>
      </div>
    );
  }

  const handleSend = async () => {
    if (!user || !newMessage.trim() || sending) return;

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

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col h-[70vh]">
      <h2 className="text-3xl font-bold mb-4 text-white">💬 League Chat</h2>
      <p className="text-gray-400 text-sm mb-4">
        Chat with everyone in <span className="font-semibold text-blue-300">{league.leagueName}</span>.
        Messages are visible to all league members.
      </p>

      {/* Messages list */}
      <div className="flex-1 bg-gray-800 rounded-lg p-4 overflow-y-auto border border-gray-700">
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
                      <span className="text-[10px] opacity-80">{formatTime(msg.createdAt)}</span>
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
          />
          <button
            onClick={handleSend}
            disabled={sending || !newMessage.trim()}
            className={`px-4 py-2 rounded font-semibold text-sm transition-colors ${
              sending || !newMessage.trim()
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
