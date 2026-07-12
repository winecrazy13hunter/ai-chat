'use client';

import { cn } from '@/lib/utils';
import type { UIMessage } from 'ai';

interface Props {
  message: UIMessage;
  isStreaming?: boolean;
}

type Segment =
  | { type: 'text'; content: string }
  | { type: 'code'; lang: string; content: string };

function parseContent(text: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'code', lang: match[1] ?? '', content: match[2] ?? '' });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ type: 'text', content: text }];
}

// Render **bold** inline markdown
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*\n]+\*\*)/g);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// Render block-level markdown: headings, lists, blockquotes, tables, hr, inline bold
function renderTextSegment(content: string) {
  const lines = content.split('\n');
  const result: React.ReactNode[] = [];
  let pendingListItems: string[] = [];
  let pendingQuoteLines: string[] = [];
  let pendingTableRows: string[] = [];

  const flushList = () => {
    if (pendingListItems.length === 0) return;
    const items = [...pendingListItems];
    pendingListItems = [];
    result.push(
      <ul key={result.length} className="my-1 ml-4 list-disc space-y-0.5">
        {items.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
  };

  const flushQuote = () => {
    if (pendingQuoteLines.length === 0) return;
    const qlines = [...pendingQuoteLines];
    pendingQuoteLines = [];
    result.push(
      <blockquote
        key={result.length}
        className="my-1.5 border-l-2 border-zinc-400 pl-3 text-zinc-500 dark:border-zinc-600 dark:text-zinc-400"
      >
        {qlines.map((l, i) => (
          <span key={i} className="block leading-relaxed">
            {renderInline(l)}
          </span>
        ))}
      </blockquote>,
    );
  };

  const flushTable = () => {
    if (pendingTableRows.length === 0) return;
    const rows = [...pendingTableRows];
    pendingTableRows = [];

    const parseRow = (row: string) =>
      row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

    // Separator row contains only - : and spaces in each cell
    const isSepRow = (row: string) => parseRow(row).every((c) => /^:?-+:?$/.test(c));

    const hasSep = rows.length >= 2 && isSepRow(rows[1]);
    const headers = hasSep ? parseRow(rows[0]) : null;
    const bodyRows = rows.slice(hasSep ? 2 : 0).map(parseRow);

    result.push(
      <div key={result.length} className="my-2 overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          {headers && (
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className="border border-zinc-300 bg-zinc-200 px-3 py-1.5 text-left font-semibold dark:border-zinc-600 dark:bg-zinc-700"
                  >
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {bodyRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 1 ? 'bg-zinc-50 dark:bg-zinc-800/50' : ''}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border border-zinc-300 px-3 py-1.5 dark:border-zinc-600">
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
  };

  const headingClass: Record<number, string> = {
    1: 'text-base font-bold mt-3 mb-1',
    2: 'text-sm font-semibold mt-2.5 mb-0.5',
    3: 'text-xs font-semibold uppercase tracking-wide mt-2 mb-0.5 text-zinc-500 dark:text-zinc-400',
  };

  lines.forEach((line) => {
    const headingMatch = line.match(/^(#{1,3}) (.+)/);
    const listMatch    = line.match(/^[-*] (.+)/);
    const quoteMatch   = line.match(/^> ?(.*)/);
    const isHr         = /^---+$/.test(line);
    const isTableRow   = line.trim().startsWith('|');

    if (headingMatch) {
      flushList(); flushQuote(); flushTable();
      const level = headingMatch[1].length as 1 | 2 | 3;
      result.push(
        <span key={result.length} className={`block leading-snug ${headingClass[level]}`}>
          {renderInline(headingMatch[2])}
        </span>,
      );
    } else if (isTableRow) {
      flushList(); flushQuote();
      pendingTableRows.push(line.trim());
    } else if (listMatch) {
      flushQuote(); flushTable();
      pendingListItems.push(listMatch[1]);
    } else if (quoteMatch) {
      flushList(); flushTable();
      pendingQuoteLines.push(quoteMatch[1]);
    } else if (isHr) {
      flushList(); flushQuote(); flushTable();
      result.push(<hr key={result.length} className="my-2 border-zinc-300 dark:border-zinc-700" />);
    } else {
      flushList(); flushQuote(); flushTable();
      if (line === '') {
        if (result.length > 0) result.push(<br key={result.length} />);
      } else {
        result.push(
          <span key={result.length} className="block leading-relaxed">
            {renderInline(line)}
          </span>,
        );
      }
    }
  });
  flushList();
  flushQuote();
  flushTable();

  return <>{result}</>;
}

function getText(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === 'text')
    .map((p) => (p as { type: 'text'; text: string }).text)
    .join('');
}

export function Message({ message, isStreaming }: Props) {
  const isUser = message.role === 'user';
  const text = getText(message);
  const segments = parseContent(text);

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-4 py-3 text-sm',
          isUser
            ? 'bg-zinc-700 text-zinc-50 dark:bg-zinc-600'
            : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100',
        )}
      >
        {segments.map((seg, i) =>
          seg.type === 'code' ? (
            <pre
              key={i}
              className="my-2 overflow-x-auto rounded bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-100 dark:bg-zinc-950"
            >
              <code>{seg.content}</code>
            </pre>
          ) : isUser ? (
            // User messages: preserve whitespace as-is (no markdown)
            <span key={i} className="whitespace-pre-wrap leading-relaxed">
              {seg.content}
            </span>
          ) : (
            // Assistant messages: render inline markdown
            <div key={i}>{renderTextSegment(seg.content)}</div>
          ),
        )}
        {isStreaming && (
          <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse rounded-sm bg-current align-middle" />
        )}
      </div>
    </div>
  );
}
