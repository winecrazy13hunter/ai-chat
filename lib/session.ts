import type { Session, StoredMessage } from './types';

const SESSIONS_KEY = 'guitar-tab-sessions';
const MESSAGES_PREFIX = 'guitar-tab-messages:';
const MAX_SESSIONS = 50;
const MAX_MESSAGES_PER_SESSION = 200;

function isClient(): boolean {
  return typeof window !== 'undefined';
}

export function getSessions(): Session[] {
  if (!isClient()) return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: Session[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      throw new Error('ストレージの空き容量が不足しています。古いセッションを削除してください。');
    }
    throw e;
  }
}

export function pruneOldSessions(sessions: Session[]): Session[] {
  return sessions.slice(0, MAX_SESSIONS);
}

export function createSession(): Session {
  const now = new Date().toISOString();
  const session: Session = {
    id: crypto.randomUUID(),
    title: '新しい会話',
    createdAt: now,
    updatedAt: now,
  };
  const existing = getSessions();
  const combined = [session, ...existing];
  const pruned = pruneOldSessions(combined);

  // Remove message data for sessions dropped by pruning (prevent storage leak)
  if (isClient() && pruned.length < combined.length) {
    const keptIds = new Set(pruned.map((s) => s.id));
    combined.forEach((s) => {
      if (!keptIds.has(s.id)) {
        localStorage.removeItem(`${MESSAGES_PREFIX}${s.id}`);
      }
    });
  }

  saveSessions(pruned);
  return session;
}

export function deleteSession(id: string): void {
  if (!isClient()) return;
  saveSessions(getSessions().filter((s) => s.id !== id));
  localStorage.removeItem(`${MESSAGES_PREFIX}${id}`);
}

export function updateSessionTitle(id: string, title: string): void {
  if (!isClient()) return;
  const now = new Date().toISOString();
  saveSessions(
    getSessions().map((s) => (s.id === id ? { ...s, title, updatedAt: now } : s)),
  );
}

export function getMessages(sessionId: string): StoredMessage[] {
  if (!isClient()) return [];
  try {
    const raw = localStorage.getItem(`${MESSAGES_PREFIX}${sessionId}`);
    return raw ? (JSON.parse(raw) as StoredMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveMessages(sessionId: string, messages: StoredMessage[]): void {
  if (!isClient()) return;
  try {
    localStorage.setItem(
      `${MESSAGES_PREFIX}${sessionId}`,
      JSON.stringify(messages.slice(-MAX_MESSAGES_PER_SESSION)),
    );
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      throw new Error('ストレージの空き容量が不足しています。古いセッションを削除してください。');
    }
    throw e;
  }
  const now = new Date().toISOString();
  saveSessions(
    getSessions().map((s) => (s.id === sessionId ? { ...s, updatedAt: now } : s)),
  );
}
