/**
 * DraggableRoute.tsx - ドラッグ編集可能なルート描画コンポーネント
 *
 * 各セグメント（ウェイポイント間の経路）を Polyline で描画し、
 * ルート上をドラッグすることで中間ポイントを挿入できる。
 *
 * ─── 2本線問題への対応 ──────────────────────────────────────────
 *
 *  描画レイヤーを「見た目用」と「操作用」の2つに分離:
 *
 *  (A) 見た目用（青い線）
 *      → deduplicateSegmentGeometries() で重複排除してから描画
 *      → 同じ道の往復は1本線に統合される
 *
 *  (B) 操作用（透明な太い当たり判定ライン）
 *      → 元のセグメントをそのまま使用
 *      → ドラッグでの中間ポイント挿入が正しく動く
 *
 * ドラッグの仕組み:
 * 1. ルートの Polyline 上でマウスダウン → ドラッグ開始
 * 2. マウス移動に追従するゴーストマーカーを表示
 * 3. マウスアップ → その位置に中間ポイントを挿入
 * 4. 新しい2つのセグメント（前半・後半）が自動で再計算される
 */

'use client';

import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { Polyline, CircleMarker, useMapEvents } from 'react-leaflet';
import { RouteSegment } from '@/types/route';
import { deduplicateSegmentGeometries } from '@/lib/deduplicateGeometry';

interface DraggableRouteProps {
  /** セグメントの配列（道路に沿った経路データ） */
  segments: RouteSegment[];
  /** 中間ポイント挿入コールバック */
  onInsertWaypoint: (segmentIndex: number, lat: number, lng: number) => void;
}

/**
 * ドラッグ操作の状態
 */
interface DragState {
  /** ドラッグ中のセグメントインデックス */
  segmentIndex: number;
  /** 現在のドラッグ位置（ゴーストマーカー用） */
  lat: number;
  lng: number;
}

/**
 * ドラッグ可能なルートを描画するコンポーネント
 *
 * セグメントごとに Polyline を描画し、ドラッグでの中間ポイント挿入をサポートする。
 */
export default function DraggableRoute({
  segments,
  onInsertWaypoint,
}: DraggableRouteProps) {
  /** 現在のドラッグ状態 */
  const [dragState, setDragState] = useState<DragState | null>(null);
  const isDraggingRef = useRef(false);

  /**
   * マップ上のマウスイベントを監視する
   * ドラッグ中はマウス移動に追従し、マウスアップで中間ポイントを挿入する
   */
  const map = useMapEvents({
    mousemove(e) {
      if (isDraggingRef.current && dragState) {
        setDragState((prev) =>
          prev ? { ...prev, lat: e.latlng.lat, lng: e.latlng.lng } : null
        );
      }
    },
    mouseup(e) {
      if (isDraggingRef.current && dragState) {
        isDraggingRef.current = false;
        // ドラッグ終了 → 中間ポイントを挿入
        onInsertWaypoint(dragState.segmentIndex, e.latlng.lat, e.latlng.lng);
        setDragState(null);
        // ドラッグ中に無効化した地図操作を復元
        map.dragging.enable();
      }
    },
  });

  /**
   * セグメントの Polyline 上でマウスダウンした時のハンドラー（PC 向け）
   */
  const handleSegmentMouseDown = useCallback(
    (segmentIndex: number, lat: number, lng: number) => {
      isDraggingRef.current = true;
      setDragState({ segmentIndex, lat, lng });
      // ドラッグ中は地図のパンを無効化する
      map.dragging.disable();
    },
    [map]
  );

  /**
   * セグメントの Polyline をタップ/クリックした時のハンドラー（モバイル向け）
   * ドラッグ中でなければ、タップ位置に中間地点を即座に挿入する
   */
  const handleSegmentTap = useCallback(
    (segmentIndex: number, lat: number, lng: number) => {
      // ドラッグ終了直後のクリックイベントは無視（重複挿入防止）
      if (isDraggingRef.current) return;
      onInsertWaypoint(segmentIndex, lat, lng);
    },
    [onInsertWaypoint]
  );

  // コンポーネントのアンマウント時にドラッグ状態をクリーンアップ
  useEffect(() => {
    return () => {
      if (isDraggingRef.current) {
        map.dragging.enable();
      }
    };
  }, [map]);

  // ── 重複排除した描画用ジオメトリを計算 ─────────────────────────
  // segments が変わるたびに再計算（useMemo でキャッシュ）
  const dedupedGroups = useMemo(
    () => deduplicateSegmentGeometries(segments),
    [segments]
  );

  return (
    <>
      {/* ─── 見た目用: 重複排除済みの青い線 ─── */}
      {dedupedGroups.map((groups, segIndex) =>
        groups.map((linePoints, groupIndex) => (
          <Polyline
            key={`dedup-${segIndex}-${groupIndex}`}
            positions={linePoints}
            pathOptions={{
              color: '#3b82f6',  // 青色
              weight: 4,
              opacity: 0.8,
            }}
          />
        ))
      )}

      {/* ─── 操作用: 元のセグメントで当たり判定（透明） ─── */}
      {segments.map((segment, index) => (
        <HitDetectionPolyline
          key={`hit-${index}-${segment.geometry.length}`}
          segment={segment}
          segmentIndex={index}
          onMouseDown={handleSegmentMouseDown}
          onTap={handleSegmentTap}
        />
      ))}

      {/* ドラッグ中のゴーストマーカー（新しいポイントのプレビュー） */}
      {dragState && (
        <CircleMarker
          center={[dragState.lat, dragState.lng]}
          radius={8}
          pathOptions={{
            color: '#f59e0b',   // 黄色（Tailwind amber-500）
            fillColor: '#fbbf24',
            fillOpacity: 0.9,
            weight: 2,
          }}
        />
      )}
    </>
  );
}

/**
 * 操作専用の透明な当たり判定 Polyline
 *
 * 見た目の線は DraggableRoute 側で重複排除して描画するので、
 * こちらは「ドラッグ操作を受け付ける」ためだけの透明な太い線。
 * 元のセグメント（重複排除なし）をそのまま使うことで、
 * どのセグメント上でドラッグされたかを正確に判定できる。
 */
function HitDetectionPolyline({
  segment,
  segmentIndex,
  onMouseDown,
  onTap,
}: {
  segment: RouteSegment;
  segmentIndex: number;
  onMouseDown: (segmentIndex: number, lat: number, lng: number) => void;
  onTap: (segmentIndex: number, lat: number, lng: number) => void;
}) {
  return (
    <Polyline
      positions={segment.geometry}
      pathOptions={{
        color: 'transparent',
        weight: 30,    // モバイルの指タップでも当たりやすい太さ
        opacity: 0,
      }}
      eventHandlers={{
        mousedown: (e) => {
          // PC: ドラッグ開始
          e.originalEvent.stopPropagation();
          e.originalEvent.preventDefault();
          onMouseDown(segmentIndex, e.latlng.lat, e.latlng.lng);
        },
        click: (e) => {
          // モバイル: タップで中間地点追加
          // （PC でもクリックで追加可能にする — ドラッグしなかった場合のフォールバック）
          e.originalEvent.stopPropagation();
          e.originalEvent.preventDefault();
          onTap(segmentIndex, e.latlng.lat, e.latlng.lng);
        },
      }}
    />
  );
}
