/**
 * UserLocationMarker.tsx - 現在地マーカー
 *
 * リアルタイム GPS 位置を地図上に表示するコンポーネント。
 *
 * ─── 見た目 ────────────────────────────────────────────────────
 *   ・青い点（現在地）
 *   ・周囲に半透明の輪（GPS 精度の円）
 *   ・パルスアニメーション（点滅で「今ここにいる」感を演出）
 *   ・進行方向の三角形（heading が取得できる場合）
 *
 * ─── 仕組み ────────────────────────────────────────────────────
 *   Leaflet の CircleMarker をそのまま使うとアニメーションできないため、
 *   DivIcon（HTML/CSS ベース）でカスタムアイコンを作り、
 *   CSS アニメーションでパルス効果を付ける。
 */

'use client';

import { Marker, Circle } from 'react-leaflet';
import L from 'leaflet';
import { GeoPosition } from '@/hooks/useGeolocation';

interface UserLocationMarkerProps {
  position: GeoPosition;
}

/** CSS アニメーション付きの現在地アイコン（DivIcon） */
function createLocationIcon(heading: number | null): L.DivIcon {
  // 進行方向の三角形 SVG（heading が取れる場合のみ表示）
  const arrowSvg = heading !== null
    ? `<div style="
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 14px solid #1d4ed8;
        transform: translate(-50%, -100%) rotate(${heading}deg);
        transform-origin: center bottom;
        margin-top: -4px;
      "></div>`
    : '';

  return new L.DivIcon({
    html: `
      <div style="position: relative; width: 24px; height: 24px;">
        <!-- パルスアニメーション（外側の輪） -->
        <div style="
          position: absolute;
          top: 50%; left: 50%;
          width: 24px; height: 24px;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.3);
          transform: translate(-50%, -50%);
          animation: location-pulse 2s ease-out infinite;
        "></div>
        <!-- 現在地の青い点 -->
        <div style="
          position: absolute;
          top: 50%; left: 50%;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #3b82f6;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          transform: translate(-50%, -50%);
        "></div>
        ${arrowSvg}
      </div>
      <style>
        @keyframes location-pulse {
          0%   { width: 14px; height: 14px; opacity: 0.8; }
          100% { width: 48px; height: 48px; opacity: 0; }
        }
      </style>
    `,
    className: '', // Leaflet デフォルトのスタイルをリセット
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export default function UserLocationMarker({ position }: UserLocationMarkerProps) {
  const icon = createLocationIcon(position.heading);

  return (
    <>
      {/* GPS 精度の円（半透明の青い円） */}
      {position.accuracy < 200 && (
        <Circle
          center={[position.lat, position.lng]}
          radius={position.accuracy}
          pathOptions={{
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.08,
            weight: 1,
            opacity: 0.4,
          }}
        />
      )}

      {/* 現在地マーカー */}
      <Marker
        position={[position.lat, position.lng]}
        icon={icon}
        zIndexOffset={1000} // ルートピンより前面に表示
        interactive={false}  // クリック無効（ルート追加と干渉しないよう）
      />
    </>
  );
}
