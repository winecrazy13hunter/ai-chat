import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from 'ai';
import type { UIMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { GUITAR_TAB_SYSTEM_PROMPT } from '@/lib/prompts';

// In-memory rate limiter (per IP, resets per window)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;         // requests per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_CONTEXT_MESSAGES = 20;   // last N messages sent to Claude

function checkRateLimit(ip: string): boolean {
  const now = Date.now();

  // Evict expired entries to prevent unbounded Map growth
  if (rateLimitMap.size > 500) {
    for (const [key, val] of rateLimitMap) {
      if (val.resetAt < now) rateLimitMap.delete(key);
    }
  }

  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith('sk-ant-ここに')) {
    return Response.json(
      { error: 'APIキーが設定されていません。.env.local を確認してください。' },
      { status: 401 },
    );
  }

  // Rate limiting by IP
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: 'リクエストが多すぎます。しばらく待ってから再試行してください。' },
      { status: 429 },
    );
  }

  let messages: UIMessage[];
  try {
    const body = await req.json();
    messages = body.messages ?? [];
  } catch {
    return Response.json({ error: 'リクエストの形式が不正です。' }, { status: 400 });
  }

  try {
    // Limit context to recent messages to control token usage
    const contextMessages = messages.slice(-MAX_CONTEXT_MESSAGES);

    const result = streamText({
      model: anthropic('claude-sonnet-4-6'),
      system: GUITAR_TAB_SYSTEM_PROMPT,
      messages: await convertToModelMessages(contextMessages),
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);

    if (msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many requests')) {
      return Response.json(
        { error: 'リクエストが多すぎます。しばらく待ってから再試行してください。' },
        { status: 429 },
      );
    }

    if (msg.includes('401') || msg.toLowerCase().includes('authentication') || msg.toLowerCase().includes('api_key')) {
      return Response.json(
        { error: 'APIキーが無効です。設定を確認してください。' },
        { status: 401 },
      );
    }

    console.error('[/api/chat]', error);
    return Response.json(
      { error: 'サーバーエラーが発生しました。しばらく待ってから再試行してください。' },
      { status: 500 },
    );
  }
}
