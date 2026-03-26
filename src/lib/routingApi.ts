/**
 * routingApi.ts - 道路に沿ったルート計算 API
 *
 * OSRM (Open Source Routing Machine) の公開デモサーバーを使って、
 * 2点間の自転車ルート（道路に沿った経路）を取得する。
 * フォールバックとして直線ルートも返す。
 *
 * OSRM は自転車プロファイル ("bike") で車専用道路を自動的に除外する。
 */

/**
 * OSRM プロキシエンドポイント
 * 直接 OSRM に接続せず /api/route 経由でアクセスする。
 * サーバー切り替え時は src/app/api/route/route.ts の OSRM_BASE を変えるだけ。
 */
const OSRM_BASE_URL = '/api/route';

/** ルーティング結果の型 */
export interface RoutingResult {
  /** ルートの座標列 [lat, lng][] */
  geometry: [number, number][];
  /** ルートの実距離（km） */
  distance: number;
}

/**
 * OSRM のレスポンスに含まれるエンコード済み Polyline をデコードする
 *
 * Google Encoded Polyline Algorithm Format の仕様:
 * - 座標はデルタ符号化（前の点からの差分のみ格納）
 * - 各デルタは可変長 VLQ 形式 + ジグザグ符号化で格納される
 * - ランニング合計 (lat/lng) に各デルタを加算して絶対座標を復元する
 *
 * ⚠️ よくある実装ミス:
 *   raw bits を直接 lat/lng 変数に += すると、lat/lng が「デコード済みの絶対値」に
 *   なった後の2点目以降でビット列を誤った値に加算してしまい座標が狂う。
 *   必ず「一時変数で VLQ ビットを集積 → zigzag デコード → delta を running total に加算」の順で行う。
 *
 * @param encoded - エンコード済みポリライン文字列
 * @param precision - 座標の精度（OSRM は 5 桁 = 1e5）
 * @returns [lat, lng] の配列
 */
function decodePolyline(encoded: string, precision = 5): [number, number][] {
  const factor = Math.pow(10, precision);
  const result: [number, number][] = [];
  let index = 0;
  // ランニング合計（スケールされた整数値。最終的に factor で割って実座標にする）
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    // ---------- 緯度デルタをデコード ----------
    // step1: VLQ で表現されたビット列を一時変数に集積する
    let shift = 0;
    let value = 0; // ← 一時変数（lat 本体とは別）
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      value |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    // step2: ジグザグ符号をデコードしてデルタ（符号付き整数）を得る
    const deltaLat = value & 1 ? ~(value >> 1) : value >> 1;
    // step3: ランニング合計にデルタを加算
    lat += deltaLat;

    // ---------- 経度デルタをデコード ----------
    shift = 0;
    value = 0; // ← リセット（緯度と同じ手順）
    do {
      byte = encoded.charCodeAt(index++) - 63;
      value |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = value & 1 ? ~(value >> 1) : value >> 1;
    lng += deltaLng;

    // スケールを戻して実座標として追加
    result.push([lat / factor, lng / factor]);
  }

  return result;
}

/**
 * OSRM で2点間の自転車ルートを取得する
 *
 * @param from - 出発地点 { lat, lng }
 * @param to - 到着地点 { lat, lng }
 * @returns ルーティング結果（座標列と距離）
 */
export async function fetchRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<RoutingResult> {
  // OSRM は "lng,lat" の順番で座標を受け取る
  const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  // ── パラメータ解説 ────────────────────────────────────────────
  // coordinates        : プロキシ API が OSRM パスに埋め込む座標
  // overview=full      : 全区間の座標列を返す（simplified だと省略される）
  // geometries=polyline: Google Encoded Polyline 形式で返す
  // alternatives=false : 代替ルートを返さない（最適1本のみ）
  // steps=false        : ターンバイターン案内不要（レスポンス軽量化）
  // radiuses=50;50     : 各地点から半径50m以内の道路にスナップ（精度向上）
  const params = new URLSearchParams({
    coordinates,
    overview: 'full',
    geometries: 'polyline',
    alternatives: 'false',
    steps: 'false',
    radiuses: '50;50',
    // U ターンを許可（一方通行の迂回ルートが長くなりすぎるのを防ぐ）
    continue_straight: 'false',
    // 一方通行の方向に関係なく最寄りの道路にスナップする
    // （自転車は一方通行を逆走できることが多い）
    snapping: 'any',
  });
  const url = `${OSRM_BASE_URL}?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error(`OSRM: ルートが見つかりません (code: ${data.code})`);
    }

    const route = data.routes[0];
    const geometry = decodePolyline(route.geometry);
    // OSRM の distance はメートル単位なので km に変換
    const distance = route.distance / 1000;

    return { geometry, distance };
  } catch (error) {
    console.warn('OSRM ルーティングに失敗しました。直線ルートを使用します。', error);
    // フォールバック: 直線ルートを返す
    return createFallbackRoute(from, to);
  }
}

/**
 * フォールバック用の直線ルートを生成する（Haversine で距離を概算）
 */
function createFallbackRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): RoutingResult {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return {
    geometry: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    distance,
  };
}
