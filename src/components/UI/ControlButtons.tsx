/**
 * ControlButtons.tsx - 操作ボタンコンポーネント
 *
 * 「戻る」「リセット」「周回」「保存」ボタンを表示する。
 * ウェイポイントがない場合や条件に応じてボタンを無効化する。
 */

'use client';

import SaveRouteDialog from './SaveRouteDialog';

interface ControlButtonsProps {
  onUndo: () => void;
  onReset: () => void;
  onCloseLoop: () => void;
  onSave: (name: string) => void;
  waypointCount: number;
  isLoop: boolean;
}

export default function ControlButtons({
  onUndo,
  onReset,
  onCloseLoop,
  onSave,
  waypointCount,
  isLoop,
}: ControlButtonsProps) {
  const isDisabled = waypointCount === 0;
  // 周回ボタンは 3ピン以上 かつ まだループでない場合のみ有効
  const canCloseLoop = waypointCount >= 3 && !isLoop;
  // 保存ボタンは 2ピン以上で有効
  const canSave = waypointCount >= 2;

  return (
    <div className="flex gap-2 flex-wrap justify-center">
      <button
        onClick={onUndo}
        disabled={isDisabled}
        className="px-4 py-2 min-h-[44px] rounded-lg bg-gray-600 text-white font-medium
                   hover:bg-gray-500 active:bg-gray-700
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors duration-150"
      >
        戻る
      </button>

      <button
        onClick={onReset}
        disabled={isDisabled}
        className="px-4 py-2 min-h-[44px] rounded-lg bg-red-600 text-white font-medium
                   hover:bg-red-500 active:bg-red-700
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors duration-150"
      >
        リセット
      </button>

      {/* 周回コースにするボタン */}
      <button
        onClick={onCloseLoop}
        disabled={!canCloseLoop}
        className="px-4 py-2 min-h-[44px] rounded-lg bg-amber-600 text-white font-medium
                   hover:bg-amber-500 active:bg-amber-700
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors duration-150"
        title="スタート地点に戻るルートを追加"
      >
        周回
      </button>

      {/* 保存ダイアログ（ボタン + モーダル） */}
      <SaveRouteDialog onSave={onSave} disabled={!canSave} />
    </div>
  );
}
