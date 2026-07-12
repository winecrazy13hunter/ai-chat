'use client';

import { useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';
import { Music2 } from 'lucide-react';
import { Message } from '@/components/Message';

interface Props {
  messages: UIMessage[];
  status: string;
}

export function ChatWindow({ messages, status }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isStreaming = status === 'streaming' || status === 'submitted';

  // Auto-scroll only when already near the bottom (preserves user scroll position)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <Music2 className="size-10 text-zinc-300 dark:text-zinc-700" />
        <div>
          <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            ギターTAB譜アシスタント
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
            曲名やアーティスト名を入力するとTAB譜を提供します
          </p>
        </div>
        <div className="mt-2 grid gap-2 text-xs text-zinc-400 dark:text-zinc-600">
          <p className="rounded border border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
            例: 「スモーク・オン・ザ・ウォーターのリフを教えて」
          </p>
          <p className="rounded border border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
            例: 「千本桜のイントロTAB譜をください」
          </p>
        </div>
      </div>
    );
  }

  return (
    // min-h-0 is required for flex-1 children to scroll correctly in a flex column
    <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-4 p-4">
        {messages.map((msg, i) => (
          <Message
            key={msg.id}
            message={msg}
            isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
          />
        ))}
      </div>
    </div>
  );
}
