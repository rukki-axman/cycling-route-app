/**
 * register-sw.js - Service Worker 登録スクリプト
 *
 * layout.tsx の <Script> タグから読み込む。
 * ブラウザが Service Worker に対応していない場合は何もしない。
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service Worker 登録失敗:', err);
    });
  });
}
