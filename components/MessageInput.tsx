'use client';

import { useRef, useState } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
}

export function MessageInput({ onSend, onStop, isStreaming }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  return (
    <div className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="曲名やアーティスト名を入力… (Enter で送信 / Shift+Enter で改行)"
          rows={1}
          className="min-h-[40px] w-full resize-none rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
        {isStreaming ? (
          <Button size="icon" variant="outline" onClick={onStop} className="shrink-0" title="停止">
            <Square className="size-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="shrink-0"
            title="送信"
          >
            <Send className="size-4" />
          </Button>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-zinc-400 dark:text-zinc-600">
        AIが生成するTAB譜は参考情報です。著作権にご注意ください。
      </p>
    </div>
  );
}
