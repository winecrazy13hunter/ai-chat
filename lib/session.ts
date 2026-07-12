import type { Session, StoredMessage } from './types';

const MAX_MESSAGES_PER_SESSION = 200;

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let msg = `APIエラー (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res;
}

export async function getSessions(): Promise<Session[]> {
  const res = await apiFetch('/api/sessions');
  return res.json() as Promise<Session[]>;
}

export async function createSession(): Promise<Session> {
  const res = await apiFetch('/api/sessions', { method: 'POST' });
  return res.json() as Promise<Session>;
}

export async function deleteSession(id: string): Promise<void> {
  await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' });
}

export async function updateSessionTitle(id: string, title: string): Promise<void> {
  await apiFetch(`/api/sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
}

export async function getMessages(sessionId: string): Promise<StoredMessage[]> {
  const res = await apiFetch(`/api/sessions/${sessionId}/messages`);
  return res.json() as Promise<StoredMessage[]>;
}

export async function saveMessages(sessionId: string, messages: StoredMessage[]): Promise<void> {
  await apiFetch(`/api/sessions/${sessionId}/messages`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages.slice(-MAX_MESSAGES_PER_SESSION)),
  });
}
