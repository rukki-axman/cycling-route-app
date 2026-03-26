/**
 * AddWaypointButton.tsx - 中間地点追加ボタン（モバイル用）
 *
 * モバイルでルートをドラッグしづらい問題を解決するため、
 * 地図をタップして中間地点を直接追加するボタンを提供。
 *
 * 使い方：
 *   1. ボタンを押す → "中間地点追加モード"に入る
 *   2. 地図上の好きな場所をタップ → ドラッグ可能な中間地点が追加される
 *   3. モード外に出るには、ボタンをもう一度押すか、キャンセルボタンを押す
 */

'use client';

import { useState } from 'react';

interface AddWaypointButtonProps {
  /** ボタンが押された時のコールバック（モード開始） */
  onActivate: () => void;
  /** モード中止のコールバック */
  onCancel: () => void;
  /** モード中かどうか */
  isActive: boolean;
  /** ウェイポイント数（ボタンの無効化判定用） */
  waypointCount: number;
}

export default function AddWaypointButton({
  onActivate,
  onCancel,
  isActive,
  waypointCount,
}: AddWaypointButtonProps) {
  // 2地点以上必要（1地点だけでは中間地点追加の意味がない）
  const isDisabled = waypointCount < 2;

  if (isActive) {
    // モード中：キャンセルボタンを表示
    return (
      <div className="fixed bottom-4 left-4 right-4 z-[1001] sm:hidden">
        <div className="bg-blue-600/95 backdrop-blur-sm rounded-xl p-4 shadow-lg">
          <p className="text-white text-sm font-bold text-center mb-3">
            中間地点追加モード
          </p>
          <p className="text-blue-100 text-xs text-center mb-3">
            地図上をタップして中間地点を追加してください
          </p>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 rounded-lg bg-red-600 text-white font-medium
                       hover:bg-red-500 active:bg-red-700 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onActivate}
      disabled={isDisabled}
      className="hidden sm:hidden md:hidden lg:hidden xl:hidden
                 fixed bottom-4 left-4 z-[1000]
                 px-4 py-2 rounded-lg bg-green-600 text-white font-medium text-sm
                 hover:bg-green-500 active:bg-green-700
                 disabled:opacity-40 disabled:cursor-not-allowed
                 transition-colors duration-150
                 sm:block"
      title={isDisabled ? '2地点以上で利用可能' : '中間地点を追加'}
    >
      + 中間地点
    </button>
  );
}
