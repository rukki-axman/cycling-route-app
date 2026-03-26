/**
 * sw.js - Service Worker
 *
 * アプリシェル（HTML/CSS/JS）をキャッシュし、
 * オフラインでも起動できるようにする。
 * 地図タイル（外部URL）はキャッシュしない（容量節約のため）。
 */

const CACHE_NAME = 'cycling-route-v1';

// キャッシュするアプリシェルのファイル一覧
const APP_SHELL = [
  '/',
  '/manifest.json',
];

// ── インストール時：アプリシェルをキャッシュ ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  // 新しい SW をすぐに有効化（待機をスキップ）
  self.skipWaiting();
});

// ── アクティベート時：古いキャッシュを削除 ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── フェッチ時：Cache First 戦略（アプリシェルのみ）──
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 外部 URL（地図タイル・OSRM など）はキャッシュしない → ネットワークに流す
  if (url.origin !== self.location.origin) {
    return;
  }

  // Next.js の HMR / API ルートはキャッシュしない
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/')) {
    return;
  }

  // アプリシェル：キャッシュがあればキャッシュを返す、なければネットワーク
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
