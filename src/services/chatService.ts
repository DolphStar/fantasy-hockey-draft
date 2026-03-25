import type { User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';

import { db } from '../firebase';
import type { ChatMessage } from '../types/chat';
import type { League } from '../types/league';

function toChatMessages(snapshot: { docs: Array<{ id: string; data(): unknown }> }): ChatMessage[] {
  return snapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...(docSnapshot.data() as Omit<ChatMessage, 'id'>),
  }));
}

export function subscribeLeagueChatMessages(
  leagueId: string,
  onMessages: (messages: ChatMessage[]) => void,
  messageLimit = 200,
) {
  return onSnapshot(
    query(collection(db, `leagues/${leagueId}/chatMessages`), orderBy('createdAt', 'asc'), limit(messageLimit)),
    (snapshot) => onMessages(toChatMessages(snapshot)),
  );
}

export function subscribeRecentLeagueMessages(
  leagueId: string,
  onMessages: (messages: ChatMessage[]) => void,
  messageLimit = 2,
) {
  return onSnapshot(
    query(collection(db, `leagues/${leagueId}/chatMessages`), orderBy('createdAt', 'desc'), limit(messageLimit)),
    (snapshot) => onMessages(toChatMessages(snapshot)),
  );
}

export function subscribeChatBan(
  leagueId: string,
  userId: string,
  onBannedChange: (isBanned: boolean) => void,
) {
  return onSnapshot(doc(db, `leagues/${leagueId}/chatBans`, userId), (snapshot) => {
    onBannedChange(snapshot.exists());
  });
}

export async function sendLeagueChatMessage(
  league: League,
  user: User,
  message: string,
) {
  await addDoc(collection(db, `leagues/${league.id}/chatMessages`), {
    text: message.trim(),
    userId: user.uid,
    userName: user.displayName || user.email || 'User',
    teamName: league.teams.find(team => team.ownerUid === user.uid)?.teamName || null,
    createdAt: new Date().toISOString(),
  });
}

export async function deleteLeagueChatMessage(leagueId: string, messageId: string) {
  await deleteDoc(doc(db, `leagues/${leagueId}/chatMessages`, messageId));
}

export async function banLeagueChatUser(leagueId: string, userId: string) {
  await setDoc(doc(db, `leagues/${leagueId}/chatBans`, userId), {
    userId,
    bannedAt: new Date().toISOString(),
  });
}
