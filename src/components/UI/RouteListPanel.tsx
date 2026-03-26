/**
 * RouteListPanel.tsx - 保存ルート一覧パネル
 *
 * 画面左端に表示される折りたたみ可能なパネル。
 * 保存したルートの一覧を表示し、ホバーでプレビュー、クリックで選択できる。
 *
 * ─── PC（デスクトップ）の動作 ─────────────────────────────────
 *   ・左端に縦長のパネル（折りたたみ可能）
 *   ・ルート名にマウスを乗せる → 地図上にプレビュー表示
 *   ・マウスを外す → プレビュー消去
 *   ・クリック → 選択状態（地図に表示し続ける）
 *   ・もう一度クリック → 選択解除
 *
 * ─── モバイル（スマホ）の動作 ──────────────────────────────────
 *   ・画面下部にドラムローラー風の縦スクロール UI
 *   ・CSS scroll-snap で中央に「ピタッと止まる」
 *   ・中央に来たルートが自動的にプレビュー/選択される
 *   ・「誕生日ピッカー」のような操作感
 *
 * ─── ルート名の編集 ───────────────────────────────────────────
 *   ・名前をダブルクリック → インライン編集モード
 *   ・Enter or フォーカス外す → 名前変更確定
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SavedRoute } from '@/types/route';

interface RouteListPanelProps {
  /** 保存済みルートの一覧 */
  routes: SavedRoute[];
  /** 現在選択中のルートID */
  selectedId: string | null;
  /** ルート選択（クリック） */
  onSelect: (id: string) => void;
  /** プレビュー開始（ホバー） */
  onPreviewStart: (id: string) => void;
  /** プレビュー終了 */
  onPreviewEnd: () => void;
  /** ルート名変更 */
  onRename: (id: string, newName: string) => void;
  /** ルート削除 */
  onDelete: (id: string) => void;
}

export default function RouteListPanel({
  routes,
  selectedId,
  onSelect,
  onPreviewStart,
  onPreviewEnd,
  onRename,
  onDelete,
}: RouteListPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (routes.length === 0) return null;

  return (
    <>
      {/* ─── PC 用：左サイドパネル ─── */}
      <div className="hidden sm:block absolute top-0 left-0 z-[1000] h-full pointer-events-none">
        <div className="h-full flex items-stretch pointer-events-auto">
          {/* パネル本体 */}
          {isOpen && (
            <div className="w-64 bg-white/95 backdrop-blur-sm shadow-lg overflow-y-auto">
              <div className="p-3 border-b border-gray-200">
                <h2 className="text-sm font-bold text-gray-700">保存ルート</h2>
              </div>
              <div className="p-2 flex flex-col gap-1">
                {routes.map((route) => (
                  <DesktopRouteItem
                    key={route.id}
                    route={route}
                    isSelected={route.id === selectedId}
                    onSelect={() => onSelect(route.id)}
                    onPreviewStart={() => onPreviewStart(route.id)}
                    onPreviewEnd={onPreviewEnd}
                    onRename={(newName) => onRename(route.id, newName)}
                    onDelete={() => onDelete(route.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 開閉トグルボタン */}
          <button
            onClick={() => setIsOpen((prev) => !prev)}
            className="self-center bg-white/95 backdrop-blur-sm shadow-md
                       px-1.5 py-4 rounded-r-lg border-l-0
                       text-gray-600 hover:text-gray-900 hover:bg-gray-100
                       transition-colors"
            aria-label={isOpen ? 'パネルを閉じる' : 'パネルを開く'}
          >
            {isOpen ? '\u276E' : '\u276F'}
          </button>
        </div>
      </div>

      {/* ─── モバイル用：ドラムローラー ─── */}
      {/* bottom-28: 下部コントロールバー（約7rem）の真上に配置 */}
      <div className="sm:hidden absolute bottom-28 left-0 right-0 z-[999]">
        <MobileRoutePicker
          routes={routes}
          selectedId={selectedId}
          onSelect={onSelect}
          onPreviewStart={onPreviewStart}
          onPreviewEnd={onPreviewEnd}
        />
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
//  PC 用：個別ルートアイテム
// ══════════════════════════════════════════════════════════════════

function DesktopRouteItem({
  route,
  isSelected,
  onSelect,
  onPreviewStart,
  onPreviewEnd,
  onRename,
  onDelete,
}: {
  route: SavedRoute;
  isSelected: boolean;
  onSelect: () => void;
  onPreviewStart: () => void;
  onPreviewEnd: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName]   = useState(route.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus();
  }, [isEditing]);

  /** 名前変更を確定する */
  const commitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== route.name) {
      onRename(trimmed);
    } else {
      setEditName(route.name);  // 空文字なら元に戻す
    }
    setIsEditing(false);
  };

  return (
    <div
      className={`rounded-lg p-2 cursor-pointer transition-colors
        ${isSelected
          ? 'bg-blue-100 border border-blue-400'
          : 'hover:bg-gray-100 border border-transparent'}`}
      onClick={onSelect}
      onMouseEnter={onPreviewStart}
      onMouseLeave={onPreviewEnd}
    >
      {/* ルート名（ダブルクリックで編集） */}
      {isEditing ? (
        <input
          ref={inputRef}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') { setEditName(route.name); setIsEditing(false); }
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-full px-1 py-0.5 text-sm border border-blue-400 rounded
                     focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      ) : (
        <p
          className="text-sm font-medium text-gray-800 truncate"
          onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          title="ダブルクリックで名前を編集"
        >
          {route.name}
        </p>
      )}

      {/* 距離 + ループバッジ */}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-gray-500">
          {route.totalDistance.toFixed(1)} km
        </span>
        {route.elevationGain > 0 && (
          <span className="text-xs text-gray-500">
            ↑{Math.round(route.elevationGain)}m
          </span>
        )}
        {route.isLoop && (
          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
            周回
          </span>
        )}
      </div>

      {/* 削除ボタン */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="text-xs text-red-400 hover:text-red-600 mt-1 transition-colors"
      >
        削除
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  モバイル用：ドラムローラー風スクロールピッカー
//
//  CSS scroll-snap-type: y mandatory で、アイテムが
//  中央に「ピタッ」と止まるスクロール体験を実現する。
//  中央に来たアイテムを IntersectionObserver で検知して
//  プレビュー → クリックで選択、という流れ。
// ══════════════════════════════════════════════════════════════════

function MobileRoutePicker({
  routes,
  selectedId,
  onSelect,
  onPreviewStart,
  onPreviewEnd,
}: {
  routes: SavedRoute[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPreviewStart: (id: string) => void;
  onPreviewEnd: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [centeredId, setCenteredId] = useState<string | null>(null);

  // IntersectionObserver で中央に来たアイテムを検出する
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 最も表示割合が高い（＝中央に近い）アイテムを探す
        let bestEntry: IntersectionObserverEntry | null = null;
        entries.forEach((entry) => {
          if (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio) {
            bestEntry = entry;
          }
        });
        if (bestEntry && (bestEntry as IntersectionObserverEntry).isIntersecting) {
          const id = (bestEntry as IntersectionObserverEntry).target.getAttribute('data-route-id');
          if (id) {
            setCenteredId(id);
            onPreviewStart(id);
          }
        }
      },
      {
        root: container,
        rootMargin: '-40% 0px -40% 0px',  // 中央 20% の領域だけを判定対象に
        threshold: [0, 0.5, 1],
      }
    );

    const items = container.querySelectorAll('[data-route-id]');
    items.forEach((item) => observer.observe(item));

    return () => {
      observer.disconnect();
      onPreviewEnd();
    };
  }, [routes, onPreviewStart, onPreviewEnd]);

  return (
    <div className="mx-4">
      <div
        ref={containerRef}
        className="h-24 overflow-y-auto rounded-xl bg-black/70 backdrop-blur-sm
                   snap-y snap-mandatory"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {/* 上下のスペーサー（中央揃えのため） */}
        <div className="h-8 snap-start" />

        {routes.map((route) => (
          <div
            key={route.id}
            data-route-id={route.id}
            className={`snap-center px-4 py-2 mx-2 my-1 rounded-lg cursor-pointer
              transition-all duration-150
              ${centeredId === route.id || selectedId === route.id
                ? 'bg-white/20 scale-105'
                : 'opacity-50'}`}
            style={{ scrollSnapAlign: 'center' }}
            onClick={() => onSelect(route.id)}
          >
            <p className="text-white text-sm font-medium truncate">{route.name}</p>
            <p className="text-gray-300 text-xs">
              {route.totalDistance.toFixed(1)} km
              {route.isLoop ? ' ・ 周回' : ''}
            </p>
          </div>
        ))}

        <div className="h-8 snap-end" />
      </div>
    </div>
  );
}
