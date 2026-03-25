export interface ChatMessage {
  id: string;
  text: string;
  userId: string;
  userName: string;
  teamName?: string | null;
  createdAt: string;
}
