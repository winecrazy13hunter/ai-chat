'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { Menu, X } from 'lucide-react';
import { ChatSidebar } from '@/components/ChatSidebar';
import { ChatWindow } from '@/components/ChatWindow';
import { MessageInput } from '@/components/MessageInput';
import { Button } from '@/components/ui/button';
import {
  createSession,
  deleteSession,
  getMessages,
  getSessions,
  saveMessages,
  updateSessionTitle,
} from '@/lib/session';
import type { Session, StoredMessage } from '@/lib/types';

function toStoredMessages(msgs: UIMessage[]): StoredMessage[] {
  return msgs
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      parts: m.parts
        .filter((p) => p.type === 'text')
        .map((p) => ({ type: 'text' as const, text: (p as { type: 'text'; text: string }).text })),
      createdAt: new Date().toISOString(),
    }));
}

function getFirstUserText(msgs: UIMessage[]): string {
  const msg = msgs.find((m) => m.role === 'user');
  if (!msg) return '';
  return msg.parts
    .filter((p) => p.type === 'text')
    .map((p) => (p as { type: 'text'; text: string }).text)
    .join('');
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);
  // Ref keeps activeSessionId accessible in effects without re-triggering them
  const activeIdRef = useRef<string | null>(null);
  // True when a save is needed but couldn't run because the session wasn't ready yet
  const pendingSaveRef = useRef(false);

  const { messages, sendMessage, stop, status, setMessages, error } = useChat();

  useEffect(() => {
    activeIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Reset error banner dismiss when a new error arrives
  useEffect(() => {
    if (error) setErrorDismissed(false);
  }, [error]);

  // Initialize: load sessions from DB on first render and restore the latest session
  useEffect(() => {
    const init = async () => {
      try {
        const loaded = await getSessions();
        if (loaded.length === 0) {
          const session = await createSession();
          setSessions([session]);
          setActiveSessionId(session.id);
        } else {
          setSessions(loaded);
          setActiveSessionId(loaded[0].id);
          const msgs = await getMessages(loaded[0].id);
          if (msgs.length > 0) {
            setMessages(msgs as unknown as UIMessage[]);
          }
        }
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'セッションの読み込みに失敗しました。');
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save messages and generate session title when a response finishes
  useEffect(() => {
    const id = activeIdRef.current;
    if (!id) {
      // Session not yet ready; mark as pending so we save once the ID is available
      if (messages.length > 0 && (status === 'ready' || status === 'error')) {
        pendingSaveRef.current = true;
      }
      return;
    }
    if (messages.length === 0 || (status !== 'ready' && status !== 'error')) return;

    pendingSaveRef.current = false;
    const save = async () => {
      try {
        await saveMessages(id, toStoredMessages(messages));
        setApiError(null);
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'メッセージの保存に失敗しました。');
        return;
      }

      // Update session title from first user message (non-critical: ignore failure)
      try {
        const allSessions = await getSessions();
        const current = allSessions.find((s) => s.id === id);
        if (current?.title === '新しい会話') {
          const text = getFirstUserText(messages);
          if (text) {
            const title = text.length > 28 ? `${text.slice(0, 28)}…` : text;
            await updateSessionTitle(id, title);
          }
        }
        setSessions(await getSessions());
      } catch {
        // non-critical
      }
    };
    void save();
  }, [messages, status]);

  // Flush a pending save once the session ID becomes available (handles the race condition
  // where the user sends a message before the session is fully created on first load)
  useEffect(() => {
    const id = activeIdRef.current; // Already updated by the prior effect in this render cycle
    if (!id || !pendingSaveRef.current) return;
    if (messages.length === 0 || (status !== 'ready' && status !== 'error')) return;

    pendingSaveRef.current = false;
    const save = async () => {
      try {
        await saveMessages(id, toStoredMessages(messages));
        setApiError(null);
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'メッセージの保存に失敗しました。');
        return;
      }
      try {
        const allSessions = await getSessions();
        const current = allSessions.find((s) => s.id === id);
        if (current?.title === '新しい会話') {
          const text = getFirstUserText(messages);
          if (text) {
            const title = text.length > 28 ? `${text.slice(0, 28)}…` : text;
            await updateSessionTitle(id, title);
          }
        }
        setSessions(await getSessions());
      } catch {
        // non-critical
      }
    };
    void save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  const handleNewSession = useCallback(async () => {
    try {
      const session = await createSession();
      setSessions(await getSessions());
      setActiveSessionId(session.id);
      setMessages([]);
      setSidebarOpen(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'セッション作成に失敗しました。');
    }
  }, [setMessages]);

  const handleSelectSession = useCallback(
    async (id: string) => {
      if (id === activeIdRef.current) {
        setSidebarOpen(false);
        return;
      }
      stop();
      setActiveSessionId(id);
      try {
        setMessages((await getMessages(id)) as unknown as UIMessage[]);
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'メッセージの読み込みに失敗しました。');
      }
      setSidebarOpen(false);
    },
    [setMessages, stop],
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      if (id === activeIdRef.current) stop();
      try {
        await deleteSession(id);
        const remaining = await getSessions();
        setSessions(remaining);

        if (id !== activeIdRef.current) return;

        if (remaining.length > 0) {
          const next = remaining[0];
          setActiveSessionId(next.id);
          setMessages((await getMessages(next.id)) as unknown as UIMessage[]);
        } else {
          const session = await createSession();
          setSessions([session]);
          setActiveSessionId(session.id);
          setMessages([]);
        }
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'セッション削除に失敗しました。');
      }
    },
    [setMessages, stop],
  );

  const isStreaming = status === 'submitted' || status === 'streaming';

  return (
    <div className="flex h-full overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar: slide in on mobile, static on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-30 transition-transform duration-200 md:static md:translate-x-0 md:transition-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <ChatSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewSession={handleNewSession}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
        />
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile header (hidden on md+) */}
        <header className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800 md:hidden">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="メニュー"
          >
            {sidebarOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Guitar TAB Bot
          </span>
        </header>

        {/* API error banner */}
        {error && !errorDismissed && (
          <div className="flex shrink-0 items-center justify-between border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
            <span>
              エラー:{' '}
              {(() => {
                try {
                  const parsed = JSON.parse(error.message) as { error?: string };
                  return parsed.error ?? error.message;
                } catch {
                  return error.message;
                }
              })()}
            </span>
            <button
              onClick={() => setErrorDismissed(true)}
              className="ml-2 shrink-0 rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-900/40"
              aria-label="エラーを閉じる"
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        {/* Session / API error banner */}
        {apiError && (
          <div className="flex shrink-0 items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-400">
            <span>{apiError}</span>
            <button
              onClick={() => setApiError(null)}
              className="ml-2 shrink-0 rounded p-0.5 hover:bg-amber-100 dark:hover:bg-amber-900/40"
              aria-label="エラーを閉じる"
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        <ChatWindow messages={messages} status={status} />
        <MessageInput
          onSend={(text) => sendMessage({ text })}
          onStop={stop}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
}
