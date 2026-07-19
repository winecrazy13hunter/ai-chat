// 添付画像の検証・圧縮ユーティリティ（クライアント専用）
//
// Claude のビジョン入力では長辺 1568px 程度まで縮小しても認識精度は落ちない一方、
// トークン消費とMongoDBの保存サイズ（ドキュメント上限16MB）を大きく削減できるため、
// GIF（アニメーション保持のため無加工）以外は JPEG に再エンコードしてから送信・保存する。
const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 0.82;

export { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES_PER_MESSAGE } from './attachment-limits';

export interface ProcessedImage {
  mediaType: string;
  url: string;
}

export async function processImageFile(file: File): Promise<ProcessedImage> {
  if (file.type === 'image/gif') {
    return { mediaType: file.type, url: await readFileAsDataUrl(file) };
  }
  return resizeToJpegDataUrl(file);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = src;
  });
}

async function resizeToJpegDataUrl(file: File): Promise<ProcessedImage> {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { mediaType: file.type, url: dataUrl };

  // JPEGは透過を持たないため、PNG等の透過部分は白背景で塗りつぶす
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  return { mediaType: 'image/jpeg', url: canvas.toDataURL('image/jpeg', JPEG_QUALITY) };
}
