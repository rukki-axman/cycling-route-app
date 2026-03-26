/**
 * useRoute.ts - ルート状態管理フック
 *
 * ウェイポイントの追加・削除・リセット・中間ポイント挿入・ピン移動と、
 * セグメント（道路に沿った経路データ）の管理、
 * 周回コース（ループ）の管理、
 * 統計情報を管理するカスタムフック。
 *
 * ─── 設計の核心：Ref によるステート同期 ──────────────────────────
 *
 *  waypointsRef / segmentsRef / isLoopRef
 *    React の setState は非同期なので、非同期関数（API 呼び出し）の中で
 *    「今のステート」を読もうとすると古い値を参照してしまう。
 *    そのため、常に最新値が入っている Ref を「サブ写し」として持つ。
 *
 *  historyRef（アンドゥスタック）
 *    操作前の状態スナップショットを積み重ねるリスト（スタック）。
 *    "戻る" を押すたびに一番上のスナップショットを取り出して復元する。
 *    これにより addWaypoint・insertWaypoint・moveWaypoint・closeLoop の
 *    どの操作に対しても正しく巻き戻せる。
 *
 * ─── セグメントの概念 ─────────────────────────────────────────────
 *   通常ルート:
 *     waypoints:  [A]       [B]       [C]
 *     segments:       [seg0]     [seg1]
 *     segments.length = waypoints.length - 1
 *
 *   周回コース（ループ）:
 *     waypoints:  [A]       [B]       [C]
 *     segments:       [seg0]     [seg1]     [seg2(C→A)]
 *     segments.length = waypoints.length  ← 閉じるセグメントが1本多い
 *
 * ─── 周回コースの検出 ─────────────────────────────────────────────
 *   ユーザーがスタート地点から 50m 以内にゴールを置こうとすると、
 *   自動的にスタートに「スナップ」して周回コースになる。
 */

'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { Waypoint, RouteSegment, RouteStats } from '@/types/route';
import { calcElevationGain } from '@/lib/calcElevationGain';
import { calcDistance } from '@/lib/calcDistance';
import { fetchRoute } from '@/lib/routingApi';

/** 周回コース自動検出の距離しきい値（km）。50m = 0.05km */
const LOOP_THRESHOLD_KM = 0.05;

/** アンドゥスタックの1エントリ（操作前のスナップショット） */
interface HistoryEntry {
  waypoints: Waypoint[];
  segments: RouteSegment[];
  isLoop: boolean;
}

export function useRoute() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [isRouting, setIsRouting] = useState(false);
  const [isLoop, setIsLoop] = useState(false);

  // ── Ref（最新値への同期アクセス用） ──────────────────────────────
  const waypointsRef = useRef<Waypoint[]>([]);
  const segmentsRef  = useRef<RouteSegment[]>([]);
  const isLoopRef    = useRef(false);

  // ── アンドゥスタック ─────────────────────────────────────────────
  const historyRef = useRef<HistoryEntry[]>([]);

  // ── リクエストキャンセル管理 ─────────────────────────────────────
  const abortRef = useRef(0);

  // ────────────────────────────────────────────────────────────────
  // ヘルパー群
  // ────────────────────────────────────────────────────────────────
  const updateWaypoints = useCallback((next: Waypoint[]) => {
    waypointsRef.current = next;
    setWaypoints(next);
  }, []);

  const updateSegments = useCallback((next: RouteSegment[]) => {
    segmentsRef.current = next;
    setSegments(next);
  }, []);

  const updateIsLoop = useCallback((next: boolean) => {
    isLoopRef.current = next;
    setIsLoop(next);
  }, []);

  /** 操作前の状態をスタックに保存する（isLoop も含む） */
  const saveHistory = useCallback(() => {
    historyRef.current = [
      ...historyRef.current,
      {
        waypoints: [...waypointsRef.current],
        segments:  [...segmentsRef.current],
        isLoop:    isLoopRef.current,
      },
    ];
  }, []);

  /** 2点間のルートを OSRM に問い合わせてセグメントを返す */
  const computeSegment = useCallback(
    async (from: Waypoint, to: Waypoint): Promise<RouteSegment> => {
      const result = await fetchRoute(from, to);
      return { geometry: result.geometry, distance: result.distance };
    },
    []
  );

  // ────────────────────────────────────────────────────────────────
  // 周回コースを閉じる
  //
  // 最後のウェイポイントから最初のウェイポイントへの
  // 閉じるセグメントを追加し、isLoop = true にする。
  // ────────────────────────────────────────────────────────────────
  const closeLoop = useCallback(
    async () => {
      const current = waypointsRef.current;
      if (current.length < 3 || isLoopRef.current) return;

      saveHistory();

      const first = current[0];
      const last  = current[current.length - 1];

      updateIsLoop(true);

      const requestId = ++abortRef.current;
      setIsRouting(true);
      try {
        const seg = await computeSegment(last, first);
        if (abortRef.current !== requestId) return;
        updateSegments([...segmentsRef.current, seg]);
      } finally {
        if (abortRef.current === requestId) setIsRouting(false);
      }
    },
    [computeSegment, updateSegments, updateIsLoop, saveHistory]
  );

  // ────────────────────────────────────────────────────────────────
  // 地図クリック → ウェイポイントを末尾に追加
  //
  // ※ 周回コース中は新しいピンを置けない
  // ※ 3点以上のとき、スタートから 50m 以内をクリックすると
  //   自動で周回コースを閉じる
  // ────────────────────────────────────────────────────────────────
  const addWaypoint = useCallback(
    async (lat: number, lng: number) => {
      // 周回コース中はクリックでの追加を無効にする
      if (isLoopRef.current) return;

      const prev = waypointsRef.current;

      // 3点以上あるとき、スタート付近をクリック → 周回コースを閉じる
      if (prev.length >= 3) {
        const distToStart = calcDistance(lat, lng, prev[0].lat, prev[0].lng);
        if (distToStart < LOOP_THRESHOLD_KM) {
          closeLoop();
          return;
        }
      }

      saveHistory();

      const newWp: Waypoint = { lat, lng };
      updateWaypoints([...prev, newWp]);

      if (prev.length >= 1) {
        const fromWp = prev[prev.length - 1];
        const requestId = ++abortRef.current;
        setIsRouting(true);
        try {
          const seg = await computeSegment(fromWp, newWp);
          if (abortRef.current !== requestId) return;
          updateSegments([...segmentsRef.current, seg]);
        } finally {
          if (abortRef.current === requestId) setIsRouting(false);
        }
      }
    },
    [computeSegment, updateWaypoints, updateSegments, saveHistory, closeLoop]
  );

  // ────────────────────────────────────────────────────────────────
  // "戻る" ボタン → アンドゥスタックの最上位を復元
  // ────────────────────────────────────────────────────────────────
  const undoWaypoint = useCallback(() => {
    if (historyRef.current.length === 0) return;
    abortRef.current++;

    const previous = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);

    updateWaypoints(previous.waypoints);
    updateSegments(previous.segments);
    updateIsLoop(previous.isLoop);
    setIsRouting(false);
  }, [updateWaypoints, updateSegments, updateIsLoop]);

  // ────────────────────────────────────────────────────────────────
  // リセット → 全消去＋スタックもクリア
  // ────────────────────────────────────────────────────────────────
  const resetWaypoints = useCallback(() => {
    abortRef.current++;
    historyRef.current = [];
    updateWaypoints([]);
    updateSegments([]);
    updateIsLoop(false);
    setIsRouting(false);
  }, [updateWaypoints, updateSegments, updateIsLoop]);

  // ────────────────────────────────────────────────────────────────
  // 標高を特定インデックスのウェイポイントにセット（バックグラウンド更新）
  // ────────────────────────────────────────────────────────────────
  const updateWaypointElevation = useCallback(
    (index: number, elevation: number) => {
      const updated = waypointsRef.current.map((wp, i) =>
        i === index ? { ...wp, elevation } : wp
      );
      updateWaypoints(updated);
    },
    [updateWaypoints]
  );

  // ────────────────────────────────────────────────────────────────
  // ルートのドラッグ → 中間ポイントを挿入
  // ────────────────────────────────────────────────────────────────
  const insertWaypoint = useCallback(
    async (segmentIndex: number, lat: number, lng: number) => {
      saveHistory();

      const newWp: Waypoint = { lat, lng };
      const current = waypointsRef.current;

      // ループの閉じるセグメント上に挿入する場合の処理
      // ループ時: segments[last] は 最後のWP → 最初のWP
      // この場合、末尾に新しいWPを追加する
      const isClosingSegment = isLoopRef.current && segmentIndex === current.length - 1;

      let wpBefore: Waypoint;
      let wpAfter: Waypoint;

      if (isClosingSegment) {
        wpBefore = current[current.length - 1];
        wpAfter  = current[0];
        // 末尾に追加（ループの最後のWPとスタートの間）
        updateWaypoints([...current, newWp]);
      } else {
        wpBefore = current[segmentIndex];
        wpAfter  = current[segmentIndex + 1];
        if (!wpBefore || !wpAfter) return;
        const newWaypoints = [...current];
        newWaypoints.splice(segmentIndex + 1, 0, newWp);
        updateWaypoints(newWaypoints);
      }

      const requestId = ++abortRef.current;
      setIsRouting(true);
      try {
        const [seg1, seg2] = await Promise.all([
          computeSegment(wpBefore, newWp),
          computeSegment(newWp,    wpAfter),
        ]);
        if (abortRef.current !== requestId) return;

        const newSegs = [...segmentsRef.current];
        newSegs.splice(segmentIndex, 1, seg1, seg2);
        updateSegments(newSegs);
      } finally {
        if (abortRef.current === requestId) setIsRouting(false);
      }
    },
    [computeSegment, updateWaypoints, updateSegments, saveHistory]
  );

  // ────────────────────────────────────────────────────────────────
  // ピンのドラッグ移動 → 前後のセグメントを再計算
  //
  // ループの場合は閉じるセグメントも再計算対象になることがある。
  // 例: ループ [A,B,C] + segments=[A→B, B→C, C→A]
  //   - A を移動 → seg[2](C→A'), seg[0](A'→B) を再計算
  //   - C を移動 → seg[1](B→C'), seg[2](C'→A) を再計算
  // ────────────────────────────────────────────────────────────────
  const moveWaypoint = useCallback(
    async (index: number, lat: number, lng: number) => {
      saveHistory();

      const current = waypointsRef.current;
      const movedWp: Waypoint = { lat, lng };

      updateWaypoints(current.map((wp, i) => i === index ? movedWp : wp));

      const toRecompute: { segIdx: number; from: Waypoint; to: Waypoint }[] = [];

      if (index > 0) {
        toRecompute.push({ segIdx: index - 1, from: current[index - 1], to: movedWp });
      }
      if (index < current.length - 1) {
        toRecompute.push({ segIdx: index, from: movedWp, to: current[index + 1] });
      }

      // ループの場合、最初or最後のピンを動かしたら閉じるセグメントも再計算
      if (isLoopRef.current) {
        const closingSegIdx = current.length - 1; // 閉じるセグメントのインデックス
        if (index === 0) {
          // スタートを移動 → 閉じるセグメント（最後→スタート'）を再計算
          toRecompute.push({ segIdx: closingSegIdx, from: current[current.length - 1], to: movedWp });
        } else if (index === current.length - 1) {
          // 最後を移動 → 閉じるセグメント（最後'→スタート）を再計算
          toRecompute.push({ segIdx: closingSegIdx, from: movedWp, to: current[0] });
        }
      }

      if (toRecompute.length === 0) return;

      const requestId = ++abortRef.current;
      setIsRouting(true);
      try {
        const results = await Promise.all(
          toRecompute.map(({ from, to }) => computeSegment(from, to))
        );
        if (abortRef.current !== requestId) return;

        const newSegs = [...segmentsRef.current];
        toRecompute.forEach(({ segIdx }, i) => {
          newSegs[segIdx] = results[i];
        });
        updateSegments(newSegs);
      } finally {
        if (abortRef.current === requestId) setIsRouting(false);
      }
    },
    [computeSegment, updateWaypoints, updateSegments, saveHistory]
  );

  // ────────────────────────────────────────────────────────────────
  // 統計情報（距離・獲得標高・地点数）
  // ────────────────────────────────────────────────────────────────
  const stats: RouteStats = useMemo(() => ({
    totalDistance: segments.reduce((sum, s) => sum + s.distance, 0),
    elevationGain: calcElevationGain(waypoints),
    waypointCount: waypoints.length,
  }), [waypoints, segments]);

  return {
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
  };
}
