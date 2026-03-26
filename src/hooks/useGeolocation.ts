/**
 * useGeolocation.ts - 現在地取得フック（リアルタイム追跡対応版）
 *
 * 2つのモードを持つ:
 *   1. 初期取得モード（getCurrentPosition）: アプリ起動時に地図の中心を決める
 *   2. リアルタイム追跡モード（watchPosition）: ナビ中に現在地を継続的に更新する
 *
 * ─── 使い方 ──────────────────────────────────────────────────────
 *   const { center, isLoading, position, startTracking, stopTracking, isTracking } = useGeolocation();
 *
 *   center      - 地図の初期中心座標（起動時に一度だけ取得）
 *   isLoading   - 初期位置を取得中かどうか
 *   position    - リアルタイムの現在地 { lat, lng, accuracy, heading, speed }
 *   isTracking  - watchPosition が動いているかどうか
 *   startTracking() - ナビ開始時に呼ぶ
 *   stopTracking()  - ナビ終了時に呼ぶ
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/** デフォルト座標（東京駅付近） */
const DEFAULT_CENTER: [number, number] = [35.6812, 139.7671];

/** リアルタイム位置情報の型 */
export interface GeoPosition {
  lat: number;
  lng: number;
  /** 精度（メートル）: 小さいほど正確 */
  accuracy: number;
  /** 進行方向（度）: 0=北, 90=東。取得できない場合は null */
  heading: number | null;
  /** 速度（m/s）。取得できない場合は null */
  speed: number | null;
  /** 取得時刻 */
  timestamp: number;
}

export function useGeolocation() {
  // 地図の初期中心（起動時に一度だけ取得）
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  // ローディングを廃止: デフォルト位置で即座に地図を表示し、
  // 位置情報が取れたら後から地図の中心を更新する
  const [isLoading] = useState(false);

  // リアルタイム追跡
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  /** 最後に state を更新した時刻（スロットリング用） */
  const lastUpdateRef = useRef<number>(0);

  // ── 初期位置取得（バックグラウンドで非同期に行う） ──
  // 地図は DEFAULT_CENTER で即座に表示し、位置情報が取れたら中心を更新する。
  // HTTP 環境（iPhone LAN アクセス等）では位置情報が取れないが、地図は表示される。
  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        // 失敗しても何もしない（デフォルト位置のまま）
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 300000,
      }
    );
  }, []);

  // ── リアルタイム追跡開始 ──
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      alert('このデバイスは位置情報に対応していません。');
      return;
    }
    if (watchIdRef.current !== null) return; // すでに追跡中

    setIsTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        // ── バッテリー最適化：速度に応じたスロットリング ──
        // 停止中・低速: 5秒間隔（描画負荷を下げる）
        // 走行中（>10km/h）: 1秒間隔（正確にルートを追従）
        const speed = pos.coords.speed ?? 0;
        const interval = speed > 2.8 ? 1000 : 5000; // 2.8 m/s ≒ 10 km/h
        const now = Date.now();
        if (now - lastUpdateRef.current < interval) return;
        lastUpdateRef.current = now;

        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        });
      },
      (error) => {
        console.warn('リアルタイム位置情報エラー:', error.message);
      },
      {
        enableHighAccuracy: true,  // ナビ中は高精度モード
        timeout: 10000,
        maximumAge: 0, // キャッシュ禁止（常に最新の位置）
      }
    );
  }, []);

  // ── リアルタイム追跡停止 ──
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setPosition(null);
  }, []);

  // コンポーネントアンマウント時に追跡を止める
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { center, isLoading, position, isTracking, startTracking, stopTracking };
}
