/**
 * elevationApi.ts - 標高 API 呼び出しユーティリティ
 *
 * 指定した緯度・経度の標高を外部 API から取得する。
 * 第一候補: Open Elevation API
 * フォールバック: Open-Meteo Elevation API
 *
 * API が不安定な場合に備えて、リトライ処理（最大3回、指数バックオフ）を実装している。
 */

/** 標高 API のエンドポイント */
const OPEN_ELEVATION_URL = 'https://api.open-elevation.com/api/v1/lookup';
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/elevation';

/**
 * 指定したミリ秒だけ待機する（リトライ時のバックオフ用）
 * @param ms - 待機時間（ミリ秒）
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Open Elevation API から標高を取得する（バッチリクエスト対応）
 *
 * @param locations - 緯度・経度のペアの配列
 * @returns 標高の配列（m）。取得失敗時は null を返す
 */
async function fetchFromOpenElevation(
  locations: { lat: number; lng: number }[]
): Promise<(number | null)[]> {
  const body = {
    locations: locations.map((loc) => ({
      latitude: loc.lat,
      longitude: loc.lng,
    })),
  };

  const response = await fetch(OPEN_ELEVATION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Open Elevation API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results.map(
    (result: { elevation: number }) => result.elevation
  );
}

/**
 * Open-Meteo Elevation API から標高を取得する（フォールバック）
 *
 * @param locations - 緯度・経度のペアの配列
 * @returns 標高の配列（m）
 */
async function fetchFromOpenMeteo(
  locations: { lat: number; lng: number }[]
): Promise<(number | null)[]> {
  // Open-Meteo はカンマ区切りで複数座標を送信できる
  const latitudes = locations.map((loc) => loc.lat).join(',');
  const longitudes = locations.map((loc) => loc.lng).join(',');

  const url = `${OPEN_METEO_URL}?latitude=${latitudes}&longitude=${longitudes}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status}`);
  }

  const data = await response.json();
  // Open-Meteo は elevation を配列で返す
  const elevations: number[] = data.elevation;
  return elevations;
}

/**
 * 標高を取得する（リトライ付き）
 *
 * まず Open Elevation API を試し、失敗した場合は Open-Meteo API にフォールバックする。
 * 各 API で最大3回のリトライを行う（指数バックオフ: 1秒, 2秒, 4秒）。
 *
 * @param locations - 緯度・経度のペアの配列
 * @returns 標高の配列（m）。取得できなかった地点は null
 */
export async function fetchElevations(
  locations: { lat: number; lng: number }[]
): Promise<(number | null)[]> {
  if (locations.length === 0) return [];

  const MAX_RETRIES = 3;

  // 第一候補: Open Elevation API
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fetchFromOpenElevation(locations);
    } catch (error) {
      console.warn(
        `Open Elevation API 試行 ${attempt + 1}/${MAX_RETRIES} 失敗:`,
        error
      );
      if (attempt < MAX_RETRIES - 1) {
        // 指数バックオフで待機（1秒, 2秒, 4秒）
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }

  // フォールバック: Open-Meteo Elevation API
  console.warn('Open Elevation API に接続できません。Open-Meteo にフォールバックします。');
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fetchFromOpenMeteo(locations);
    } catch (error) {
      console.warn(
        `Open-Meteo API 試行 ${attempt + 1}/${MAX_RETRIES} 失敗:`,
        error
      );
      if (attempt < MAX_RETRIES - 1) {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }

  // 両方失敗した場合は null の配列を返す
  console.error('標高データの取得に失敗しました。');
  return locations.map(() => null);
}
