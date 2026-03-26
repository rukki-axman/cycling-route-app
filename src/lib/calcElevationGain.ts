/**
 * calcElevationGain.ts - 獲得標高を計算するユーティリティ
 *
 * ウェイポイントの標高データをもとに、
 * ルート全体で「上った高さの合計」（獲得標高）を計算する。
 * 下りは含めず、上りだけを合計する。
 */

import { Waypoint } from '@/types/route';

/**
 * ウェイポイント配列から獲得標高（上りの合計）を計算する
 *
 * 例: 標高が [100, 150, 120, 200] の場合
 *   - 100→150: +50m（上り）
 *   - 150→120: -30m（下り → カウントしない）
 *   - 120→200: +80m（上り）
 *   - 獲得標高 = 50 + 80 = 130m
 *
 * @param waypoints - 標高データを含むウェイポイントの配列
 * @returns 獲得標高（m）
 */
export function calcElevationGain(waypoints: Waypoint[]): number {
  let gain = 0;

  for (let i = 1; i < waypoints.length; i++) {
    const prevElevation = waypoints[i - 1].elevation;
    const currElevation = waypoints[i].elevation;

    // 標高データが両方そろっている場合のみ計算する
    if (prevElevation !== undefined && currElevation !== undefined) {
      const diff = currElevation - prevElevation;
      // 上り（正の差分）だけを合計する
      if (diff > 0) {
        gain += diff;
      }
    }
  }

  return gain;
}
