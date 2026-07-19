import { cookies } from 'next/headers';
import { getDb, type SessionDoc } from '@/lib/mongodb';
import type { StoredMessage } from '@/lib/types';

const MAX_MESSAGES_PER_SESSION = 200;
// MongoDBのドキュメントサイズ上限（16MB）を大きく下回るよう安全マージンを確保
const MAX_MESSAGES_PAYLOAD_BYTES = 12 * 1024 * 1024;

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/sessions/[id]/messages — セッションのメッセージ履歴を返す
export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  const userId = (await cookies()).get('userId')?.value;
  if (!userId) return Response.json([]);

  const db = await getDb();
  const doc = await db
    .collection<SessionDoc>('sessions')
    .findOne({ _id: id, userId }, { projection: { messages: 1 } });

  return Response.json(doc?.messages ?? []);
}

// PUT /api/sessions/[id]/messages — メッセージ履歴を上書き保存し updatedAt を更新する
export async function PUT(req: Request, { params }: RouteContext) {
  const { id } = await params;
  const userId = (await cookies()).get('userId')?.value;
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let messages: StoredMessage[];
  try {
    messages = (await req.json()) as StoredMessage[];
    if (!Array.isArray(messages)) throw new Error();
  } catch {
    return Response.json({ error: 'messages は配列で指定してください' }, { status: 400 });
  }

  const trimmed = messages.slice(-MAX_MESSAGES_PER_SESSION);
  if (Buffer.byteLength(JSON.stringify(trimmed), 'utf8') > MAX_MESSAGES_PAYLOAD_BYTES) {
    return Response.json(
      { error: '会話履歴のサイズが上限を超えています。添付画像の枚数を減らしてください。' },
      { status: 413 },
    );
  }

  const db = await getDb();
  await db.collection<SessionDoc>('sessions').updateOne(
    { _id: id, userId },
    {
      $set: {
        messages: trimmed,
        updatedAt: new Date().toISOString(),
      },
    },
  );

  return Response.json({ ok: true });
}
