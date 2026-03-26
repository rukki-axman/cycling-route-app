/**
 * InfoPanel.tsx - ルート情報表示パネル
 *
 * ルートの統計情報（総距離・獲得標高・ウェイポイント数）を
 * 画面下部のオーバーレイパネルとして表示する。
 */

'use client';

import { RouteStats } from '@/types/route';

interface InfoPanelProps {
  /** ルートの統計情報 */
  stats: RouteStats;
}

/**
 * ルート情報を表示するパネルコンポーネント
 *
 * 総距離（km）、獲得標高（m）、ウェイポイント数を横並びで表示する。
 * モバイルでもタップしやすいサイズで表示する。
 */
export default function InfoPanel({ stats }: InfoPanelProps) {
  return (
    <div className="flex gap-4 sm:gap-6">
      {/* 総距離 */}
      <div className="text-center">
        <p className="text-xs text-gray-400 uppercase tracking-wide">距離</p>
        <p className="text-xl sm:text-2xl font-bold text-white">
          {stats.totalDistance.toFixed(1)}
          <span className="text-sm font-normal text-gray-300 ml-1">km</span>
        </p>
      </div>

      {/* 獲得標高 */}
      <div className="text-center">
        <p className="text-xs text-gray-400 uppercase tracking-wide">獲得標高</p>
        <p className="text-xl sm:text-2xl font-bold text-white">
          {Math.round(stats.elevationGain)}
          <span className="text-sm font-normal text-gray-300 ml-1">m</span>
        </p>
      </div>

      {/* ウェイポイント数 */}
      <div className="text-center">
        <p className="text-xs text-gray-400 uppercase tracking-wide">地点数</p>
        <p className="text-xl sm:text-2xl font-bold text-white">
          {stats.waypointCount}
        </p>
      </div>
    </div>
  );
}
