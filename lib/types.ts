export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// AI SDK v7 UIMessage uses `parts` for content.
// We store only text parts (sufficient for this app).
export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{ type: 'text'; text: string }>;
  createdAt: string;
}
