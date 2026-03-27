/**
 * SaveRouteDialog.tsx - ルート保存ダイアログ
 *
 * 「保存」ボタンをクリックすると、ルート名を入力するダイアログを表示する。
 * 名前を入力して「保存」を押すと、onSave コールバックが呼ばれる。
 *
 * ─── UI の動き ─────────────────────────────────────────────────
 *
 *  [保存] ボタン → ダイアログ表示 → 名前入力 → [保存] → コールバック
 *                                            → [キャンセル] → 閉じる
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface SaveRouteDialogProps {
  /** 保存時に呼ばれるコールバック（ルート名を引数として渡す） */
  onSave: (name: string) => void;
  /** ボタンを無効化するか（ウェイポイントが足りない場合など） */
  disabled: boolean;
}

export default function SaveRouteDialog({ onSave, disabled }: SaveRouteDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName]     = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ダイアログが開いたら入力欄にフォーカス
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  /** ダイアログを開く（デフォルト名を日時にする） */
  const handleOpen = () => {
    const now = new Date();
    const defaultName = `ルート ${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    setName(defaultName);
    setIsOpen(true);
  };

  /** 保存実行 */
  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setIsOpen(false);
    setName('');
  };

  /** キャンセル */
  const handleCancel = () => {
    setIsOpen(false);
    setName('');
  };

  /** Enter キーで保存 */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  return (
    <>
      {/* 保存ボタン */}
      <button
        onClick={handleOpen}
        disabled={disabled}
        className="px-4 py-2 min-h-[44px] rounded-lg bg-green-600 text-white font-medium
                   hover:bg-green-500 active:bg-green-700
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors duration-150"
      >
        保存
      </button>

      {/* モーダルオーバーレイ — createPortal で body 直下に描画 */}
      {/* 親の z-index stacking context から脱出するために portal を使う */}
      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
          onClick={handleCancel}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4">ルートを保存</h2>

            <label className="block text-sm text-gray-600 mb-1">ルート名</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800
                         focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="例: 荒川サイクリングロード"
            />

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 font-medium
                           hover:bg-gray-300 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium
                           hover:bg-green-500 disabled:opacity-40 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
