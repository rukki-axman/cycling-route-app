/**
 * useWakeLock.ts - 画面スリープ防止フック
 *
 * ナビゲーション中にスマホの画面が消えてしまわないようにする。
 *
 * ─── 仕組み ────────────────────────────────────────────────────
 *   navigator.wakeLock.request('screen') を呼ぶと、
 *   ブラウザが OS に「画面を消さないで」とリクエストする。
 *
 *   ただし:
 *   - iOS 16.4 以上の Safari のみ対応（古い iPhone は非対応）
 *   - バッテリーが少ない時は OS が無視する場合がある
 *   - タブが非アクティブになると自動的に解除される（visibility change で再取得）
 *
 * ─── 使い方 ────────────────────────────────────────────────────
 *   const { isActive, request, release } = useWakeLock();
 *
 *   ナビ開始時: request()
 *   ナビ終了時: release()
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export function useWakeLock() {
  const [isActive, setIsActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  /** Wake Lock を取得する（対応していなければ何もしない） */
  const request = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      // 対応していないブラウザ（古い Android Chrome、iOS 16.3 以下など）
      console.info('Wake Lock 非対応のブラウザです。');
      return;
    }
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);
      wakeLockRef.current.addEventListener('release', () => {
        // OS やブラウザに強制解除された時
        setIsActive(false);
        wakeLockRef.current = null;
      });
    } catch (err) {
      console.warn('Wake Lock 取得失敗（バッテリー不足など）:', err);
    }
  }, []);

  /** Wake Lock を解放する */
  const release = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setIsActive(false);
    }
  }, []);

  // タブが非アクティブ → アクティブに戻った時に Wake Lock を再取得
  // （ブラウザの仕様で、タブが隠れると自動的に解除されるため）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActive && !wakeLockRef.current) {
        request();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive, request]);

  // アンマウント時に解放
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
      }
    };
  }, []);

  return { isActive, request, release };
}
