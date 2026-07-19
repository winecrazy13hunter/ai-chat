'use client';

import { useRef, useState } from 'react';
import { Paperclip, Send, Square, X } from 'lucide-react';
import type { FileUIPart } from 'ai';
import { Button } from '@/components/ui/button';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
  processImageFile,
} from '@/lib/image';

interface Props {
  onSend: (text: string, files: FileUIPart[]) => void;
  onStop: () => void;
  isStreaming: boolean;
}

interface Attachment {
  id: string;
  mediaType: string;
  url: string;
  name: string;
}

export function MessageInput({ onSend, onStop, isStreaming }: Props) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setAttachError(null);

    const images = files.filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type));
    if (images.length === 0) {
      setAttachError('対応形式は JPEG / PNG / WebP / GIF のみです。');
      return;
    }

    const withinSize: File[] = [];
    for (const f of images) {
      if (f.size > MAX_IMAGE_BYTES) {
        setAttachError(`「${f.name}」は5MBを超えているため添付できません。`);
        continue;
      }
      withinSize.push(f);
    }

    const room = MAX_IMAGES_PER_MESSAGE - attachments.length;
    if (withinSize.length > room) {
      setAttachError(`画像は1回の送信につき最大${MAX_IMAGES_PER_MESSAGE}枚までです。`);
    }
    const toAdd = withinSize.slice(0, Math.max(room, 0));
    if (toAdd.length === 0) return;

    try {
      const processed = await Promise.all(
        toAdd.map(async (f) => {
          const { mediaType, url } = await processImageFile(f);
          return { id: crypto.randomUUID(), mediaType, url, name: f.name };
        }),
      );
      setAttachments((prev) => [...prev, ...processed]);
    } catch {
      setAttachError('画像の読み込みに失敗しました。');
    }
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || isStreaming) return;

    const files: FileUIPart[] = attachments.map((a) => ({
      type: 'file',
      mediaType: a.mediaType,
      url: a.url,
      filename: a.name,
    }));
    onSend(trimmed, files);

    setValue('');
    setAttachments([]);
    setAttachError(null);
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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void processFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData?.items ?? [])
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length > 0) {
      e.preventDefault();
      void processFiles(files);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    void processFiles(Array.from(e.dataTransfer.files));
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div
      className={`border-t bg-white p-4 transition-colors dark:bg-zinc-950 ${
        isDragging
          ? 'border-zinc-500 bg-zinc-50 dark:border-zinc-400 dark:bg-zinc-900'
          : 'border-zinc-200 dark:border-zinc-800'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="group relative size-16 shrink-0 overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => removeAttachment(a.id)}
                className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label={`${a.name} を削除`}
                title="削除"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {attachError && (
        <p className="mb-2 text-xs text-red-500 dark:text-red-400">{attachError}</p>
      )}

      <div className="flex items-end gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || attachments.length >= MAX_IMAGES_PER_MESSAGE}
          className="shrink-0"
          title="画像を添付"
          aria-label="画像を添付"
        >
          <Paperclip className="size-4" />
        </Button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
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
            disabled={!value.trim() && attachments.length === 0}
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
