import { MongoClient } from 'mongodb';
import type { StoredMessage } from './types';

// グローバル型拡張: ホットリロード時に接続が増殖しないよう開発環境でキャッシュ
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

function createClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI が環境変数に設定されていません');
  return new MongoClient(uri).connect();
}

if (process.env.NODE_ENV === 'development') {
  // 開発環境: グローバル変数でキャッシュしてホットリロード時の接続増殖を防ぐ
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = createClientPromise();
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = createClientPromise();
}

export async function getDb() {
  const client = await clientPromise;
  return client.db('guitar-tab-bot');
}

// MongoDB ドキュメント型 (_id は UUID 文字列)
export interface SessionDoc {
  _id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
}
