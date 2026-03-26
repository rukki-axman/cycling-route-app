/**
 * layout.tsx - ルートレイアウト
 *
 * アプリ全体のレイアウトを定義する。
 * - html / body を h-full にして地図を全画面表示
 * - PWA 用 manifest・Apple メタタグを設定
 * - Service Worker を登録（スマホホーム画面インストール対応）
 * - iPhone ノッチ対応（viewport-fit=cover + safe-area-inset）
 */

import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "サイクリングルートマップ",
  description: "サイクリスト向けルート作成・ナビゲーションアプリ",
  // PWA インストール用
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ルートマップ",
  },
};

// viewport は Next.js 13+ で Metadata とは別に export する
export const viewport: Viewport = {
  // iPhone ノッチ・Dynamic Island 対応：画面の端まで描画する
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  // ピンチズーム禁止にしない（地図操作のため必要）
  userScalable: true,
  themeColor: "#3b82f6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <head>
        {/* Apple タッチアイコン（ホーム画面に追加した時のアイコン） */}
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
      </head>
      <body className="h-full">
        {children}
        {/* Service Worker 登録（PWA キャッシュ） */}
        <Script src="/register-sw.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
