/**
 * RoutePolyline.tsx - ルート線の描画コンポーネント
 *
 * ウェイポイント同士を Polyline（線）で結んで、
 * ルートを地図上に視覚的に表示する。
 */

'use client';

import { Polyline } from 'react-leaflet';
import { Waypoint } from '@/types/route';

interface RoutePolylineProps {
  /** ウェイポイントの配列 */
  waypoints: Waypoint[];
}

/**
 * ウェイポイントを線で結ぶコンポーネント
 *
 * ウェイポイントが2つ以上ある場合に青い線を描画する。
 */
export default function RoutePolyline({ waypoints }: RoutePolylineProps) {
  // ウェイポイントが2つ未満なら線を描画しない
  if (waypoints.length < 2) return null;

  // Leaflet の Polyline は [緯度, 経度] の配列を受け取る
  const positions: [number, number][] = waypoints.map((wp) => [wp.lat, wp.lng]);

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: '#3b82f6', // 青色（Tailwind の blue-500）
        weight: 4,        // 線の太さ
        opacity: 0.8,     // 透明度
      }}
    />
  );
}
