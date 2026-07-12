import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import { Geist_Mono } from 'next/font/google';
import './globals.css';

const notoSansJP = Noto_Sans_JP({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Guitar TAB Bot',
  description: 'AIがギターTAB譜を提供するチャットボット',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${notoSansJP.variable} ${geistMono.variable} h-full dark`}
      suppressHydrationWarning
    >
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
