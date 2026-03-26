/**
 * useNavigation.ts - ルートナビゲーション管理フック
 *
 * 保存ルートを読み込んで「ナビゲーションモード」に入り、
 * GPS の現在地とルートを照合しながら走行進捗を管理する。
 *
 * ─── 状態の流れ ────────────────────────────────────────────────
 *   startNavigation(route) → isNavigating = true
 *     ↓
 *   GPS 位置が更新されるたびに:
 *     1. ルート上の最近傍点を計算
 *     2. 走行済み距離・残り距離を更新
 *     3. ルートから外れていたら isOffRoute = true
 *     ↓
 *   stopNavigation() → isNavigating = false
 *
 * ─── 逸脱検知 ────────────────────────────────────────────────
 *   現在地からルート上の全点までの距離を計算し、
 *   最も近い点が OFF_ROUTE_THRESHOLD_M（100m）より遠ければ逸脱とみなす。
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { SavedRoute, RouteSegment } from '@/types/route';
import { GeoPosition } from './useGeolocation';

/** ルート逸脱とみなす距離（メートル） */
const OFF_ROUTE_THRESHOLD_M = 100;

/** ナビゲーションの状態 */
export interface NavigationState {
  /** ナビ中かどうか */
  isNavigating: boolean;
  /** 現在ナビ中のルート */
  activeRoute: SavedRoute | null;
  /** 走行済み距離（km） */
  distanceTravelled: number;
  /** 残り距離（km） */
  distanceRemaining: number;
  /** ルートから逸脱しているか */
  isOffRoute: boolean;
  /** 現在地からルートまでの最短距離（m） */
  distanceToRoute: number;
}

/** Haversine 距離計算（メートル単位） */
function haversineM(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * ルートの全座標点から現在地までの最短距離（メートル）と
 * 最近傍点のインデックスを返す
 */
function findNearestPointOnRoute(
  lat: number,
  lng: number,
  segments: RouteSegment[]
): { minDistance: number; nearestSegIdx: number; nearestPtIdx: number } {
  let minDistance = Infinity;
  let nearestSegIdx = 0;
  let nearestPtIdx = 0;

  segments.forEach((seg, segIdx) => {
    seg.geometry.forEach((pt, ptIdx) => {
      const d = haversineM(lat, lng, pt[0], pt[1]);
      if (d < minDistance) {
        minDistance = d;
        nearestSegIdx = segIdx;
        nearestPtIdx = ptIdx;
      }
    });
  });

  return { minDistance, nearestSegIdx, nearestPtIdx };
}

/**
 * ルートの総距離のうち、最近傍点までに走行した距離（km）を概算する
 */
function calcDistanceTravelled(
  nearestSegIdx: number,
  nearestPtIdx: number,
  segments: RouteSegment[]
): number {
  let dist = 0;
  for (let s = 0; s <= nearestSegIdx; s++) {
    const seg = segments[s];
    const endPt = s < nearestSegIdx ? seg.geometry.length - 1 : nearestPtIdx;
    for (let p = 0; p < endPt; p++) {
      dist += haversineM(
        seg.geometry[p][0], seg.geometry[p][1],
        seg.geometry[p + 1][0], seg.geometry[p + 1][1]
      ) / 1000;
    }
  }
  return dist;
}

export function useNavigation() {
  const [state, setState] = useState<NavigationState>({
    isNavigating: false,
    activeRoute: null,
    distanceTravelled: 0,
    distanceRemaining: 0,
    isOffRoute: false,
    distanceToRoute: 0,
  });

  // ルートの参照（GPS 更新コールバック内でアクセスするため ref で保持）
  const activeRouteRef = useRef<SavedRoute | null>(null);

  /** ナビ開始 */
  const startNavigation = useCallback((route: SavedRoute) => {
    activeRouteRef.current = route;
    setState({
      isNavigating: true,
      activeRoute: route,
      distanceTravelled: 0,
      distanceRemaining: route.totalDistance,
      isOffRoute: false,
      distanceToRoute: 0,
    });
  }, []);

  /** ナビ終了 */
  const stopNavigation = useCallback(() => {
    activeRouteRef.current = null;
    setState({
      isNavigating: false,
      activeRoute: null,
      distanceTravelled: 0,
      distanceRemaining: 0,
      isOffRoute: false,
      distanceToRoute: 0,
    });
  }, []);

  /**
   * GPS 位置が更新されたときに呼ぶ
   * ルート進捗と逸脱検知を更新する
   */
  const updatePosition = useCallback((geoPos: GeoPosition) => {
    const route = activeRouteRef.current;
    if (!route || route.segments.length === 0) return;

    const { minDistance, nearestSegIdx, nearestPtIdx } = findNearestPointOnRoute(
      geoPos.lat,
      geoPos.lng,
      route.segments
    );

    const distanceTravelled = calcDistanceTravelled(
      nearestSegIdx,
      nearestPtIdx,
      route.segments
    );
    const distanceRemaining = Math.max(0, route.totalDistance - distanceTravelled);
    const isOffRoute = minDistance > OFF_ROUTE_THRESHOLD_M;

    setState((prev) => ({
      ...prev,
      distanceTravelled,
      distanceRemaining,
      isOffRoute,
      distanceToRoute: minDistance,
    }));
  }, []);

  return {
    ...state,
    startNavigation,
    stopNavigation,
    updatePosition,
  };
}
