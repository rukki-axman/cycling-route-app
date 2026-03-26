/**
 * routeStorage.ts - ルート保存・読み込みのストレージ層
 *
 * 現在は localStorage を使ったシンプルな実装。
 * 将来 Supabase 等の DB に移行する際は、このファイルの中身を
 * 差し替えるだけで他のコードに影響しない設計（リポジトリパターン）。
 *
 * ────────────────────────────────────────────────────
 * 「リポジトリパターン」とは？
 *   データの保存先（localStorage / DB / API）を呼び出し側から隠す手法。
 *   フック側は「保存して」「全部取得して」「削除して」とだけ依頼し、
 *   保存先がどこかは気にしない。
 *   保存先を変えたいときはこのファイルだけ書き換えればOK。
 * ────────────────────────────────────────────────────
 */

import { SavedRoute, Waypoint, RouteSegment } from '@/types/route';

/** localStorage のキー名 */
const STORAGE_KEY = 'cycling-app-saved-routes';

/**
 * 一意な ID を生成する
 *
 * 現在はタイムスタンプ + ランダム文字列のシンプルな方式。
 * DB 移行時は UUID や DB の自動採番に差し替え可能。
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ══════════════════════════════════════════════════════
//  保存ルートの取得・保存・更新・削除
// ══════════════════════════════════════════════════════

/**
 * 保存済みルートを全件取得する
 */
export function getAllRoutes(): SavedRoute[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedRoute[];
  } catch {
    console.warn('保存ルートの読み込みに失敗しました');
    return [];
  }
}

/**
 * ルートを新規保存する
 *
 * @param params - ルート名、ウェイポイント、セグメント、統計情報、周回フラグ
 * @returns 保存された SavedRoute オブジェクト
 */
export function saveRoute(params: {
  name: string;
  waypoints: Waypoint[];
  segments: RouteSegment[];
  totalDistance: number;
  elevationGain: number;
  isLoop: boolean;
}): SavedRoute {
  const now = new Date().toISOString();
  const route: SavedRoute = {
    id: generateId(),
    name: params.name,
    waypoints: params.waypoints,
    segments: params.segments,
    totalDistance: params.totalDistance,
    elevationGain: params.elevationGain,
    isLoop: params.isLoop,
    createdAt: now,
    updatedAt: now,
  };

  const existing = getAllRoutes();
  existing.push(route);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  return route;
}

/**
 * ルート名を変更する
 */
export function renameRoute(id: string, newName: string): void {
  const routes = getAllRoutes();
  const target = routes.find((r) => r.id === id);
  if (!target) return;
  target.name = newName;
  target.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
}

/**
 * ルートを削除する
 */
export function deleteRoute(id: string): void {
  const routes = getAllRoutes().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
}
