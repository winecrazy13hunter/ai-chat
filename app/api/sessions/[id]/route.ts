import { cookies } from 'next/headers';
import { getDb, type SessionDoc } from '@/lib/mongodb';

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/sessions/[id] — セッションのタイトルを更新する
export async function PATCH(req: Request, { params }: RouteContext) {
  const { id } = await params;
  const userId = (await cookies()).get('userId')?.value;
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let title: string;
  try {
    const body = (await req.json()) as { title?: unknown };
    if (typeof body.title !== 'string') throw new Error();
    title = body.title;
  } catch {
    return Response.json({ error: 'title は文字列で指定してください' }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection<SessionDoc>('sessions').updateOne(
    { _id: id, userId },
    { $set: { title, updatedAt: new Date().toISOString() } },
  );

  if (result.matchedCount === 0) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }
  return Response.json({ ok: true });
}

// DELETE /api/sessions/[id] — セッションとメッセージをまとめて削除する
export async function DELETE(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  const userId = (await cookies()).get('userId')?.value;
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  await db.collection<SessionDoc>('sessions').deleteOne({ _id: id, userId });

  return new Response(null, { status: 204 });
}
