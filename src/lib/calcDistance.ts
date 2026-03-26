/**
 * calcDistance.ts - 2点間の距離を計算するユーティリティ
 *
 * Haversine（ハーバーサイン）公式を使って、
 * 地球上の2点（緯度・経度）間の距離をキロメートル単位で計算する。
 */

/** 地球の半径（km） */
const EARTH_RADIUS_KM = 6371;

/**
 * 度数法をラジアンに変換する
 * @param degrees - 角度（度数法）
 * @returns ラジアン
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Haversine 公式で2点間の距離を計算する
 *
 * @param lat1 - 地点1の緯度
 * @param lng1 - 地点1の経度
 * @param lat2 - 地点2の緯度
 * @param lng2 - 地点2の経度
 * @returns 2点間の距離（km）
 */
export function calcDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * ウェイポイント配列からルート全体の合計距離を計算する
 *
 * @param waypoints - ウェイポイントの配列（{lat, lng} を含むオブジェクト）
 * @returns 合計距離（km）
 */
export function calcTotalDistance(
  waypoints: { lat: number; lng: number }[]
): number {
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    total += calcDistance(
      waypoints[i - 1].lat,
      waypoints[i - 1].lng,
      waypoints[i].lat,
      waypoints[i].lng
    );
  }
  return total;
}
