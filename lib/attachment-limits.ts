// 画像添付の制限値。クライアント（lib/image.ts）とサーバー（API routes）の両方から参照する。
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_MESSAGE = 3;
