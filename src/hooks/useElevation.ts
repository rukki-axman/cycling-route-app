/**
 * useElevation.ts - 標高取得フック
 *
 * ウェイポイントが変更されるたびに、標高が未取得のポイントの標高を
 * API から取得してセットする。
 * 中間ポイントの挿入にも対応するため、elevation が undefined のものを対象にする。
 */

'use client';

import { useEffect, useRef } from 'react';
import { Waypoint } from '@/types/route';
import { fetchElevations } from '@/lib/elevationApi';

/**
 * ウェイポイントの標高を自動取得するカスタムフック
 *
 * @param waypoints - 現在のウェイポイント配列
 * @param updateWaypointElevation - 標高をセットするコールバック関数
 */
export function useElevation(
  waypoints: Waypoint[],
  updateWaypointElevation: (index: number, elevation: number) => void
) {
  const prevSnapshotRef = useRef<string>('');

  useEffect(() => {
    // 標高が未取得のウェイポイントを探す
    const missingIndices: number[] = [];
    const missingLocations: { lat: number; lng: number }[] = [];

    waypoints.forEach((wp, i) => {
      if (wp.elevation === undefined) {
        missingIndices.push(i);
        missingLocations.push({ lat: wp.lat, lng: wp.lng });
      }
    });

    // 未取得のものがなければ何もしない
    if (missingLocations.length === 0) return;

    // 同じリクエストの重複を防ぐ（スナップショットで比較）
    const snapshot = missingIndices
      .map((i) => `${waypoints[i].lat},${waypoints[i].lng}`)
      .join('|');
    if (snapshot === prevSnapshotRef.current) return;
    prevSnapshotRef.current = snapshot;

    const fetchMissing = async () => {
      const elevations = await fetchElevations(missingLocations);

      elevations.forEach((elevation, i) => {
        if (elevation !== null) {
          updateWaypointElevation(missingIndices[i], elevation);
        }
      });
    };

    fetchMissing();
  }, [waypoints, updateWaypointElevation]);
}
