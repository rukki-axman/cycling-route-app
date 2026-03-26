/**
 * MapClickHandler.tsx - 地図のクリックイベント処理コンポーネント
 *
 * react-leaflet の useMapEvents を使って地図のクリックを検知し、
 * クリックした位置にウェイポイントを追加する。
 * このコンポーネント自体は何も描画しない（イベントリスナー専用）。
 */

'use client';

import { useMapEvents } from 'react-leaflet';

interface MapClickHandlerProps {
  /** クリック位置にウェイポイントを追加するコールバック */
  onMapClick: (lat: number, lng: number) => void;
}

/**
 * 地図のクリックイベントを処理するコンポーネント
 *
 * MapContainer の内部に配置することで、地図上のクリックを検知する。
 */
export default function MapClickHandler({ onMapClick }: MapClickHandlerProps) {
  useMapEvents({
    click(e) {
      // クリックした地点の緯度・経度を取得してコールバックを呼ぶ
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });

  // このコンポーネントは UI を描画しない
  return null;
}
