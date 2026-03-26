/**
 * useSavedRoutes.ts - 保存ルート管理フック
 *
 * localStorage に保存されたルートの取得・追加・削除・名前変更と、
 * 「どのルートが選択されているか」「どのルートをプレビュー中か」を管理する。
 *
 * ─── 3つの表示状態 ──────────────────────────────────────────────
 *
 *  (1) 作成中ルート（useRoute が管理）
 *      → 地図上でピンを置いて作っている最中のルート
 *
 *  (2) 選択中ルート（selectedId）
 *      → 一覧をクリック/タップして選んだルート。地図に常時表示。
 *        選択を解除するまで表示し続ける。
 *
 *  (3) プレビュー中ルート（previewId）
 *      → 一覧にマウスを乗せたとき一時的に表示するルート。
 *        マウスを外すと消える。
 *
 *  将来 DB に移行するとき:
 *    routeStorage.ts の中身を Supabase 呼び出しに差し替えれば、
 *    このフックはそのまま使える。
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { SavedRoute, Waypoint, RouteSegment } from '@/types/route';
import {
  getAllRoutes,
  saveRoute as storageSave,
  renameRoute as storageRename,
  deleteRoute as storageDelete,
} from '@/lib/routeStorage';

export function useSavedRoutes() {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewId, setPreviewId]   = useState<string | null>(null);

  /** 初回マウント時に localStorage から読み込む */
  useEffect(() => {
    setRoutes(getAllRoutes());
  }, []);

  // ── ルート保存 ──────────────────────────────────────────────────
  const save = useCallback(
    (params: {
      name: string;
      waypoints: Waypoint[];
      segments: RouteSegment[];
      totalDistance: number;
      elevationGain: number;
      isLoop: boolean;
    }) => {
      const saved = storageSave(params);
      setRoutes(getAllRoutes());
      return saved;
    },
    []
  );

  // ── ルート名変更 ────────────────────────────────────────────────
  const rename = useCallback((id: string, newName: string) => {
    storageRename(id, newName);
    setRoutes(getAllRoutes());
  }, []);

  // ── ルート削除 ──────────────────────────────────────────────────
  const remove = useCallback(
    (id: string) => {
      storageDelete(id);
      setRoutes(getAllRoutes());
      // 削除されたルートが選択中だったら選択を外す
      if (selectedId === id) setSelectedId(null);
      if (previewId === id)  setPreviewId(null);
    },
    [selectedId, previewId]
  );

  // ── 選択 / プレビュー ──────────────────────────────────────────
  /** クリックで選択（もう一度クリックで選択解除） */
  const select = useCallback(
    (id: string) => {
      setSelectedId((prev) => (prev === id ? null : id));
    },
    []
  );

  /** ホバーでプレビュー開始 */
  const startPreview = useCallback((id: string) => {
    setPreviewId(id);
  }, []);

  /** ホバー解除でプレビュー終了 */
  const endPreview = useCallback(() => {
    setPreviewId(null);
  }, []);

  // ── 派生データ ──────────────────────────────────────────────────
  const selectedRoute  = routes.find((r) => r.id === selectedId) ?? null;
  const previewedRoute = routes.find((r) => r.id === previewId) ?? null;

  return {
    routes,
    selectedId,
    selectedRoute,
    previewedRoute,
    save,
    rename,
    remove,
    select,
    startPreview,
    endPreview,
  };
}
