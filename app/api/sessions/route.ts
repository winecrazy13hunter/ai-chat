import { cookies } from 'next/headers';
import { getDb, type SessionDoc } from '@/lib/mongodb';
import type { Session } from '@/lib/types';

function toSession(doc: Omit<SessionDoc, 'messages'>): Session {
  return { id: doc._id, title: doc.title, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
}

// GET /api/sessions — ユーザーのセッション一覧を最新順で返す（最大50件）
export async function GET() {
  const userId = (await cookies()).get('userId')?.value;
  if (!userId) return Response.json([]);

  const db = await getDb();
  const docs = await db
    .collection<SessionDoc>('sessions')
    .find({ userId }, { projection: { messages: 0 } })
    .sort({ updatedAt: -1 })
    .limit(50)
    .toArray();

  return Response.json(docs.map(toSession));
}

// POST /api/sessions — 新規セッションを作成して返す
export async function POST() {
  const userId = (await cookies()).get('userId')?.value;
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date().toISOString();
  const doc: SessionDoc = {
    _id: crypto.randomUUID(),
    userId,
    title: '新しい会話',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };

  const db = await getDb();
  await db.collection<SessionDoc>('sessions').insertOne(doc);

  return Response.json(toSession(doc), { status: 201 });
}
