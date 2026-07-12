'use client';

import { cn } from '@/lib/utils';
import type { Session } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Music, Plus, Trash2 } from 'lucide-react';

interface Props {
  sessions: Session[];
  activeSessionId: string | null;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  return isToday
    ? d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
}: Props) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 px-4 py-3">
        <Music className="size-4 text-zinc-500" />
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Guitar TAB Bot
        </span>
      </div>

      <Separator />

      <div className="p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={onNewSession}
        >
          <Plus className="size-4" />
          新しい会話
        </Button>
      </div>

      <Separator />

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-zinc-400 dark:text-zinc-600">
            会話履歴がありません
          </p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                'group flex items-center gap-1 rounded-md transition-colors',
                session.id === activeSessionId
                  ? 'bg-zinc-200 dark:bg-zinc-700'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800',
              )}
            >
              <button
                className="flex min-w-0 flex-1 flex-col items-start px-2 py-2 text-left"
                onClick={() => onSelectSession(session.id)}
              >
                <span
                  className={cn(
                    'w-full truncate text-xs font-medium',
                    session.id === activeSessionId
                      ? 'text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-600 dark:text-zinc-400',
                  )}
                >
                  {session.title}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
                  {formatDate(session.updatedAt)}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
                className="mr-1 shrink-0 rounded p-1 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                aria-label={`${session.title} を削除`}
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
