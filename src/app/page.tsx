/**
 * page.tsx - メインページ
 *
 * サイクリングルートアプリの全コンポーネントを統合するメインページ。
 *
 * ─── 2つのモード ────────────────────────────────────────────
 *
 *  (A) 計画モード（デフォルト）
 *      地図をクリックしてルートを作成・編集する
 *
 *  (B) ナビゲーションモード（保存ルートを選んで「ナビ開始」）
 *      GPS で現在地を追跡し、ルート上の進捗を表示する
 *      逸脱したら警告を表示する
 *
 * ─── 状態の流れ ──────────────────────────────────────────────
 *
 *  useGeolocation()   → 現在地座標（初期 + リアルタイム追跡）
 *  useRoute()         → 作成中のルート（ピン・セグメント・統計）
 *  useElevation()     → 標高の自動取得
 *  useSavedRoutes()   → 保存ルートの一覧・選択・プレビュー
 *  useNavigation()    → ナビ状態管理（進捗・逸脱検知）
 *  useWakeLock()      → ナビ中の画面スリープ防止
 */

'use client';

import { useState, useEffect, useRef, useCallback, Component, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useRoute } from '@/hooks/useRoute';
import { useElevation } from '@/hooks/useElevation';
import { useSavedRoutes } from '@/hooks/useSavedRoutes';
import { useNavigation } from '@/hooks/useNavigation';
import { useWakeLock } from '@/hooks/useWakeLock';
import InfoPanel from '@/components/UI/InfoPanel';
import ControlButtons from '@/components/UI/ControlButtons';
import RouteListPanel from '@/components/UI/RouteListPanel';

/** 地図コンポーネントのエラーをキャッチして表示する */
class MapErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: Error) {
    return { error: err.message };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-red-50 p-4">
          <div className="text-center">
            <p className="text-red-600 font-bold mb-2">地図の読み込みに失敗しました</p>
            <p className="text-red-500 text-xs break-all">{this.state.error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
            >
              リロード
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const MapView = dynamic(
  () => import('@/components/Map/MapContainer').catch((err) => {
    console.error('MapContainer 読み込みエラー:', err);
    // フォールバックコンポーネントを返す
    return {
      default: () => (
        <div className="h-full w-full flex items-center justify-center bg-red-50 p-4">
          <div className="text-center">
            <p className="text-red-600 font-bold mb-2">地図モジュールの読み込みに失敗</p>
            <p className="text-red-500 text-xs">{String(err)}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
            >
              リロード
            </button>
          </div>
        </div>
      ),
    };
  }),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <p className="text-gray-500 text-lg">地図を読み込み中...</p>
      </div>
    ),
});

export default function Home() {
  // モバイルで下部パネルを折りたたむ（地図を広く使える）
  // PC（sm 以上）では常に表示、モバイルは初期状態で閉じる
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  // トグル二重発火を防ぐタイムスタンプガード
  const lastToggleRef = useRef(0);
  const togglePanel = useCallback(() => {
    const now = Date.now();
    if (now - lastToggleRef.current < 400) return; // 400ms 以内の連打を無視
    lastToggleRef.current = now;
    setIsPanelOpen((prev) => !prev);
  }, []);

  const { center, position, startTracking, stopTracking } =
    useGeolocation();

  const {
    waypoints,
    segments,
    stats,
    isRouting,
    isLoop,
    addWaypoint,
    undoWaypoint,
    resetWaypoints,
    updateWaypointElevation,
    insertWaypoint,
    moveWaypoint,
    closeLoop,
  } = useRoute();

  useElevation(waypoints, updateWaypointElevation);

  const {
    routes: savedRoutes,
    selectedId,
    selectedRoute,
    previewedRoute,
    save: saveRoute,
    rename: renameRoute,
    remove: deleteRoute,
    select: selectRoute,
    startPreview,
    endPreview,
  } = useSavedRoutes();

  const {
    isNavigating,
    activeRoute,
    distanceTravelled,
    distanceRemaining,
    isOffRoute,
    distanceToRoute,
    startNavigation,
    stopNavigation,
    updatePosition,
  } = useNavigation();

  const wakeLock = useWakeLock();

  // ── GPS → ナビゲーション進捗更新 ──────────────────────────────
  useEffect(() => {
    if (isNavigating && position) {
      updatePosition(position);
    }
  }, [isNavigating, position, updatePosition]);

  // ── ナビ開始ハンドラー ─────────────────────────────────────────
  const handleStartNavigation = () => {
    if (!selectedRoute) return;
    startNavigation(selectedRoute);
    startTracking();     // GPS リアルタイム追跡を開始
    wakeLock.request();  // 画面スリープを防止
  };

  // ── ナビ終了ハンドラー ─────────────────────────────────────────
  const handleStopNavigation = () => {
    stopNavigation();
    stopTracking();      // GPS 追跡を停止
    wakeLock.release();  // スリープ防止を解除
  };

  // ── 保存ハンドラー ─────────────────────────────────────────────
  const handleSave = (name: string) => {
    saveRoute({
      name,
      waypoints,
      segments,
      totalDistance: stats.totalDistance,
      elevationGain: stats.elevationGain,
      isLoop,
    });
  };

  return (
    <div className="relative h-full w-full">
      {/* 地図（全画面） */}
      <MapErrorBoundary>
        <MapView
          center={center}
          waypoints={waypoints}
          segments={segments}
          isLoop={isLoop}
          onMapClick={addWaypoint}
          onInsertWaypoint={insertWaypoint}
          onMoveWaypoint={moveWaypoint}
          previewRoute={previewedRoute}
          selectedRoute={selectedRoute}
          userPosition={position}
          isNavigating={isNavigating}
        />
      </MapErrorBoundary>

      {/* ルーティング中のインジケーター */}
      {isRouting && (
        <div className="absolute top-4 right-4 z-[1000]
                        bg-blue-600/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md">
          <p className="text-white text-sm flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ルート計算中...
          </p>
        </div>
      )}

      {/* ─── ナビゲーション UI ─── */}
      {isNavigating && activeRoute && (
        <>
          {/* 上部：進捗バー + ルート情報 */}
          <div className="absolute top-0 left-0 right-0 z-[1000]"
               style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
            <div className="bg-gray-900/90 backdrop-blur-sm p-3 shadow-lg">
              {/* ルート名 + 終了ボタン */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-white text-sm font-bold truncate mr-2">
                  {activeRoute.name}
                </p>
                <button
                  onClick={handleStopNavigation}
                  className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-medium
                             hover:bg-red-500 active:bg-red-700 transition-colors flex-shrink-0"
                >
                  ナビ終了
                </button>
              </div>

              {/* 距離情報 */}
              <div className="flex items-center gap-4 text-xs text-gray-300">
                <span>走行 {distanceTravelled.toFixed(1)} km</span>
                <span>残り {distanceRemaining.toFixed(1)} km</span>
                {position?.speed != null && position.speed > 0 && (
                  <span>{(position.speed * 3.6).toFixed(0)} km/h</span>
                )}
              </div>

              {/* 進捗バー */}
              <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${activeRoute.totalDistance > 0
                      ? Math.min(100, (distanceTravelled / activeRoute.totalDistance) * 100)
                      : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* ルート逸脱警告 */}
          {isOffRoute && (
            <div className="absolute top-24 left-4 right-4 z-[1000]
                            bg-red-600/95 backdrop-blur-sm rounded-xl p-3 shadow-lg
                            animate-pulse">
              <p className="text-white text-sm font-bold text-center">
                ルートから外れています（{Math.round(distanceToRoute)}m）
              </p>
              <p className="text-red-200 text-xs text-center mt-1">
                ルートに戻ってください
              </p>
            </div>
          )}
        </>
      )}

      {/* ─── ナビ開始ボタン（ルート選択中・ナビ非実行時） ─── */}
      {selectedRoute && !isNavigating && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
          <button
            onClick={handleStartNavigation}
            className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-lg
                       hover:bg-blue-500 active:bg-blue-700 transition-colors
                       flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 2L14 8L3 14V2Z" fill="currentColor"/>
            </svg>
            ナビ開始
          </button>
        </div>
      )}

      {/* 保存ルート一覧パネル（ナビ中は非表示、PC は常に表示） */}
      {!isNavigating && (
        <RouteListPanel
          routes={savedRoutes}
          selectedId={selectedId}
          onSelect={selectRoute}
          onPreviewStart={startPreview}
          onPreviewEnd={endPreview}
          onRename={renameRoute}
          onDelete={deleteRoute}
        />
      )}

      {/* ─── モバイル：パネル開閉トグルバー ─── */}
      {/* 画面下部に横長のバーを配置。タップしやすいサイズ（h-12, 横幅広め） */}
      {!isNavigating && (
        <div
          className="sm:hidden absolute z-[1001] left-1/2 -translate-x-1/2"
          style={{
            bottom: isPanelOpen ? 'calc(8rem + env(safe-area-inset-bottom, 0px))' : '0px',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              togglePanel();
            }}
            className="w-36 h-10 bg-gray-800/90 backdrop-blur-sm text-white
                       rounded-t-xl flex items-center justify-center gap-2
                       shadow-lg active:bg-gray-600 select-none"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              {isPanelOpen ? (
                <polyline points="6,9 12,15 18,9" />
              ) : (
                <polyline points="6,15 12,9 18,15" />
              )}
            </svg>
            <span className="text-xs font-medium">
              {isPanelOpen ? '閉じる' : 'メニュー'}
            </span>
          </button>
        </div>
      )}

      {/* ─── 下部オーバーレイ：情報パネル + 操作ボタン ─── */}
      {/* PC: 常に表示  モバイル: isPanelOpen で制御 */}
      {!isNavigating && (
        <div className={`absolute bottom-0 left-0 right-0 z-[1000] p-2 sm:p-4
                         sm:block ${isPanelOpen ? 'block' : 'hidden sm:block'}`}
             style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
          <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl p-2 sm:p-4 shadow-lg
                          flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3">
            <InfoPanel stats={stats} />

            <ControlButtons
              onUndo={undoWaypoint}
              onReset={resetWaypoints}
              onCloseLoop={closeLoop}
              onSave={handleSave}
              waypointCount={stats.waypointCount}
              isLoop={isLoop}
            />
          </div>

          {/* 周回コースバッジ */}
          {isLoop && (
            <div className="mt-1 text-center">
              <span className="inline-block bg-green-600/90 text-white text-xs px-3 py-1 rounded-full">
                周回コース
              </span>
            </div>
          )}
        </div>
      )}

      {/* ヒントメッセージ（ナビ中は非表示） */}
      {!isNavigating && stats.waypointCount === 0 && !selectedRoute && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]
                        bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-md">
          <p className="text-gray-700 text-sm">
            地図をクリックしてルートを作成してください
          </p>
        </div>
      )}

      {!isNavigating && segments.length > 0 && stats.waypointCount >= 2 && !isLoop && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]
                        bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-md text-center">
          <p className="text-gray-700 text-sm">
            ルートをドラッグ → 経由地追加 ／ ピンをドラッグ → 位置移動 ／ スタート付近をクリック → 周回
          </p>
        </div>
      )}
    </div>
  );
}
