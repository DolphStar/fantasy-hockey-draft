import { auth } from '../firebase';

/** POST to an /api route with the caller's Firebase ID token. */
export async function authedPost(path: string, body: Record<string, unknown>) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('You must be signed in');
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `Request failed (${res.status})`);
  return data;
}
