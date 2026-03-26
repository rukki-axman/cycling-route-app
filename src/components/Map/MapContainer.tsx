/**
 * MapContainer.tsx - 地図の表示とイベント管理コンポーネント
 *
 * Leaflet を使って地図を全画面表示し、
 * ・ウェイポイントのマーカー（ドラッグ移動可能、S/G アイコン対応）
 * ・道路に沿ったルート（ドラッグ編集で中間ポイント挿入可能）
 * ・保存ルートのプレビュー表示
 * ・ホバー時の地図自動移動（元の位置に復帰可能）
 * を描画する。
 */

'use client';

import { useRef, useEffect, useMemo } from 'react';
import { MapContainer as LeafletMapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Waypoint, RouteSegment, SavedRoute } from '@/types/route';
import { GeoPosition } from '@/hooks/useGeolocation';
import { deduplicateSegmentGeometries } from '@/lib/deduplicateGeometry';
import MapClickHandler from './MapClickHandler';
import DraggableRoute from './DraggableRoute';
import UserLocationMarker from './UserLocationMarker';

// --- Leaflet のデフォルトアイコン問題を修正 ---
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── S/G カスタムアイコン ──────────────────────────────────────────

/**
 * Google マップ風のピン型 SVG アイコンを生成する
 *
 * 形状: 涙滴型（上が丸く、下が尖っている）
 * - 丸い頭の中に S / G の文字を表示
 * - 尖った先端が地図上の正確な位置を示す
 * - iconAnchor を先端に合わせているので位置がずれない
 */
function createPinIcon(label: string, color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">
        <!-- 影（ぼかし） -->
        <defs>
          <filter id="shadow-${label}" x="-20%" y="-10%" width="140%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
          </filter>
        </defs>
        <!-- ピン本体（涙滴型） -->
        <path d="M18 47 C18 47, 3 28, 3 18 C3 9.716 9.716 3 18 3 C26.284 3 33 9.716 33 18 C33 28 18 47 18 47Z"
              fill="${color}" stroke="#fff" stroke-width="2.5"
              filter="url(#shadow-${label})"/>
        <!-- ラベル文字 -->
        <text x="18" y="22" text-anchor="middle" dominant-baseline="central"
              fill="#fff" font-size="16" font-weight="bold" font-family="Arial, sans-serif">
          ${label}
        </text>
      </svg>
    `,
    iconSize:   [36, 48],
    iconAnchor: [18, 47],   // 先端が正確な位置を指す
    popupAnchor: [0, -44],  // ポップアップはピンの上に表示
  });
}

const startIcon = createPinIcon('S', '#22c55e');
const goalIcon  = createPinIcon('G', '#ef4444');

interface MapViewProps {
  center: [number, number];
  waypoints: Waypoint[];
  segments: RouteSegment[];
  isLoop: boolean;
  onMapClick: (lat: number, lng: number) => void;
  onInsertWaypoint: (segmentIndex: number, lat: number, lng: number) => void;
  onMoveWaypoint: (index: number, lat: number, lng: number) => void;
  /** ホバーで一時プレビュー中のルート（マウスを外すと元の位置に戻る） */
  previewRoute?: SavedRoute | null;
  /** クリックで選択されたルート（位置を固定する） */
  selectedRoute?: SavedRoute | null;
  /** GPS リアルタイム位置（ナビ中に現在地マーカーを表示） */
  userPosition?: GeoPosition | null;
  /** ナビゲーション中かどうか（true なら地図が現在地を自動追従） */
  isNavigating?: boolean;
}

function getMarkerIcon(
  index: number,
  total: number,
  isLoop: boolean
): L.Icon | L.DivIcon {
  if (index === 0) return startIcon;
  if (!isLoop && index === total - 1 && total >= 2) return goalIcon;
  return new L.Icon.Default();
}

// ══════════════════════════════════════════════════════════════════
//  MapViewController - ホバー/選択に応じて地図を自動移動する
//
//  ─── なぜこの仕組みが必要か ──────────────────────────────────
//
//  react-leaflet の <MapContainer> は初期表示後に center や zoom を
//  props で変えても地図が動かない（Leaflet の仕様）。
//  地図を動かすには useMap() で取得した map オブジェクトの
//  flyTo() や flyToBounds() を直接呼ぶ必要がある。
//
//  ─── 2種類の移動パターン ─────────────────────────────────────
//
//  (A) ホバー（一時プレビュー）
//      ① 今の地図の中心とズームを Ref に保存する
//      ② ルートの範囲に flyToBounds で移動する
//      ③ マウスを外したら、① で保存した位置に flyTo で戻る
//
//  (B) クリック（選択）
//      ① ルートの範囲に flyToBounds で移動する
//      ② 保存済みの「元の位置」を破棄する（戻らない）
//
//  ─── 切り替わりの安全性 ──────────────────────────────────────
//
//  wasPreviewingRef で「ホバー中かどうか」を追跡し、
//  ・ホバー A → ホバー B : 元の位置は保存し直さず B に移動
//  ・ホバー A → クリック A → マウスを外す : 元の位置に戻らない
//  をそれぞれ正しく処理する。
// ══════════════════════════════════════════════════════════════════

function MapViewController({
  previewRoute,
  selectedRoute,
  center,
}: {
  previewRoute: SavedRoute | null;
  selectedRoute: SavedRoute | null;
  center: [number, number];
}) {
  const map = useMap();

  // ── 位置情報が後から取れた場合に地図の中心を移動する ──
  const hasMoved = useRef(false);
  useEffect(() => {
    if (!hasMoved.current && center[0] !== 35.6812) {
      hasMoved.current = true;
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);

  /** ホバー開始前の地図の状態（中心座標 + ズームレベル） */
  const savedStateRef = useRef<{ center: L.LatLng; zoom: number } | null>(null);

  /** 現在ホバープレビュー中かどうか */
  const wasPreviewingRef = useRef(false);

  // ── ホバープレビュー：保存 → 移動 → 復元 ─────────────────────
  useEffect(() => {
    if (previewRoute) {
      // ホバー開始（まだホバー中でなければ今の位置を保存）
      if (!wasPreviewingRef.current) {
        savedStateRef.current = {
          center: map.getCenter(),
          zoom:   map.getZoom(),
        };
        wasPreviewingRef.current = true;
      }
      // そのルートの範囲へ飛ぶ
      flyToRouteBounds(map, previewRoute);
    } else if (wasPreviewingRef.current) {
      // ホバー解除 → 元の位置に戻る
      wasPreviewingRef.current = false;
      if (savedStateRef.current) {
        map.flyTo(savedStateRef.current.center, savedStateRef.current.zoom, {
          duration: 0.5,
        });
        savedStateRef.current = null;
      }
    }
  }, [previewRoute, map]);

  // ── クリック選択：移動のみ（復元しない） ──────────────────────
  useEffect(() => {
    if (selectedRoute) {
      // 保存済みの「元の位置」を破棄（もう戻らない）
      savedStateRef.current = null;
      wasPreviewingRef.current = false;
      flyToRouteBounds(map, selectedRoute);
    }
  }, [selectedRoute, map]);

  return null;
}

/**
 * SavedRoute のウェイポイント全体を包む範囲に地図を移動する
 */
function flyToRouteBounds(map: L.Map, route: SavedRoute) {
  if (route.waypoints.length === 0) return;
  const bounds = L.latLngBounds(
    route.waypoints.map((wp) => [wp.lat, wp.lng] as L.LatLngTuple)
  );
  map.flyToBounds(bounds, {
    padding:  [50, 50],  // 画面端から 50px の余白
    duration: 0.7,       // アニメーション 0.7秒
    maxZoom:  15,        // ズームしすぎ防止
  });
}

// ══════════════════════════════════════════════════════════════════
//  NavigationFollower - ナビ中に現在地を自動追従する
//
//  ナビゲーションモード中、GPS が更新されるたびに
//  地図の中心を現在地に移動する（アニメーション付き）。
//  ユーザーが手動でスクロールしたら追従を一時停止し、
//  2秒後に自動で追従を再開する。
// ══════════════════════════════════════════════════════════════════

function NavigationFollower({
  position,
  isNavigating,
}: {
  position: GeoPosition | null;
  isNavigating: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!isNavigating || !position) return;
    map.setView([position.lat, position.lng], map.getZoom(), {
      animate: true,
      duration: 0.3,
    });
  }, [isNavigating, position, map]);

  return null;
}

// ══════════════════════════════════════════════════════════════════
//  メインコンポーネント
// ══════════════════════════════════════════════════════════════════

export default function MapView({
  center,
  waypoints,
  segments,
  isLoop,
  onMapClick,
  onInsertWaypoint,
  onMoveWaypoint,
  previewRoute,
  selectedRoute,
  userPosition,
  isNavigating = false,
}: MapViewProps) {
  // 表示用ルート：ホバーが優先、なければ選択中のルート
  const displayRoute = previewRoute ?? selectedRoute ?? null;

  // プレビュー/選択ルートも重複排除して描画
  const displayDeduped = useMemo(
    () => displayRoute ? deduplicateSegmentGeometries(displayRoute.segments) : [],
    [displayRoute]
  );

  return (
    <LeafletMapContainer
      center={center}
      zoom={13}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapClickHandler onMapClick={onMapClick} />

      {/* ─── 地図の自動移動コントローラー ─── */}
      <MapViewController
        previewRoute={previewRoute ?? null}
        selectedRoute={selectedRoute ?? null}
        center={center}
      />

      {/* ─── ナビ中の現在地追従 ─── */}
      <NavigationFollower
        position={userPosition ?? null}
        isNavigating={isNavigating}
      />

      {/* ─── GPS 現在地マーカー（青い点） ─── */}
      {userPosition && <UserLocationMarker position={userPosition} />}

      {/* ─── プレビュー/選択ルート（紫の破線、重複排除済み） ─── */}
      {displayDeduped.map((groups, segIndex) =>
        groups.map((linePoints, groupIndex) => (
          <Polyline
            key={`preview-${segIndex}-${groupIndex}`}
            positions={linePoints}
            pathOptions={{
              color: '#a855f7',
              weight: 5,
              opacity: 0.6,
              dashArray: '10, 6',
            }}
          />
        ))
      )}

      {/* ─── アクティブルート（ドラッグ編集可能） ─── */}
      <DraggableRoute
        segments={segments}
        onInsertWaypoint={onInsertWaypoint}
      />

      {/* ─── ウェイポイントマーカー ─── */}
      {waypoints.map((wp, index) => (
        <Marker
          key={`waypoint-${index}`}
          position={[wp.lat, wp.lng]}
          icon={getMarkerIcon(index, waypoints.length, isLoop)}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const { lat, lng } = (e.target as L.Marker).getLatLng();
              onMoveWaypoint(index, lat, lng);
            },
          }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-bold">
                {index === 0
                  ? 'スタート (S)'
                  : !isLoop && index === waypoints.length - 1 && waypoints.length >= 2
                    ? 'ゴール (G)'
                    : `地点 ${index + 1}`}
              </p>
              <p>緯度: {wp.lat.toFixed(5)}</p>
              <p>経度: {wp.lng.toFixed(5)}</p>
              {wp.elevation !== undefined && (
                <p>標高: {Math.round(wp.elevation)}m</p>
              )}
              <p className="text-gray-400 text-xs mt-1">ドラッグで移動できます</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </LeafletMapContainer>
  );
}
