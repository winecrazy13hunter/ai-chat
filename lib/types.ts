export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// AI SDK v7 UIMessage uses `parts` for content.
// We store text parts and image file parts (base64 data URL, already resized/compressed
// client-side in lib/image.ts to stay well under MongoDB's 16MB document limit).
export type StoredMessagePart =
  | { type: 'text'; text: string }
  | { type: 'file'; mediaType: string; url: string; filename?: string };

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: StoredMessagePart[];
  createdAt: string;
}
