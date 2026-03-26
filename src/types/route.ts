/**
 * route.ts - ルート関連の型定義
 *
 * サイクリングルートアプリで使用するデータの型を定義するファイル。
 * ウェイポイント（地図上の地点）、ルートセグメント、統計情報、
 * 保存ルートの型を管理する。
 */

/** ウェイポイント（地図上にユーザーが追加する地点） */
export interface Waypoint {
  /** 緯度 */
  lat: number;
  /** 経度 */
  lng: number;
  /** 標高（メートル）。Elevation API から取得後にセットされる */
  elevation?: number;
}

/**
 * ルートセグメント（隣接するウェイポイント間の経路データ）
 *
 * segments[i] は waypoints[i] → waypoints[i+1] の経路を表す。
 * OSRM から取得した道路に沿ったジオメトリと距離を保持する。
 */
export interface RouteSegment {
  /** ルートの座標列 [lat, lng][] — 道路に沿った詳細な座標 */
  geometry: [number, number][];
  /** このセグメントの距離（km） */
  distance: number;
}

/** ルート全体の統計情報 */
export interface RouteStats {
  /** ルートの合計距離（km） */
  totalDistance: number;
  /** 獲得標高（m）— 上りの合計 */
  elevationGain: number;
  /** ウェイポイントの数 */
  waypointCount: number;
}

/**
 * 保存されたルート
 *
 * 将来 Supabase 等の DB に保存する際は、このインターフェースの
 * フィールドがそのままテーブルのカラムに対応する設計。
 *
 * id はクライアント側で生成する（後で UUID や DB の自動採番に差し替え可能）。
 */
export interface SavedRoute {
  /** 一意な識別子 */
  id: string;
  /** ユーザーが付けたルート名 */
  name: string;
  /** ウェイポイント（ピン）の座標一覧 */
  waypoints: Waypoint[];
  /** セグメント（道路に沿った経路データ）の一覧 */
  segments: RouteSegment[];
  /** 合計距離（km） */
  totalDistance: number;
  /** 獲得標高（m） */
  elevationGain: number;
  /** 周回コースかどうか */
  isLoop: boolean;
  /** 作成日時（ISO 8601 文字列） */
  createdAt: string;
  /** 更新日時（ISO 8601 文字列） */
  updatedAt: string;
}
