/**
 * src/app/api/route/route.ts - OSRM プロキシ API
 *
 * クライアントから OSRM に直接アクセスするのではなく、
 * このエンドポイントを経由させる。
 *
 * メリット:
 *   1. 将来、自前 OSRM サーバーに切り替える時にここの URL を変えるだけで済む
 *   2. OSRM サーバーのアドレスをフロントエンドに露出させない
 *   3. 必要であればレート制限・ログ・キャッシュをここに追加できる
 *
 * 使い方:
 *   GET /api/route?coordinates=139.7671,35.6812;139.77,35.69
 *   （残りのパラメータもそのまま転送される）
 */

import { NextRequest, NextResponse } from 'next/server';

/** 実際の OSRM サーバー URL（将来ここを自前サーバーに変更する） */
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/bike';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // coordinates パラメータを取り出す（必須）
  const coordinates = searchParams.get('coordinates');
  if (!coordinates) {
    return NextResponse.json(
      { error: 'coordinates パラメータが必要です' },
      { status: 400 }
    );
  }

  // coordinates 以外のパラメータ（overview, geometries など）をそのまま転送
  const forwardParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== 'coordinates') {
      forwardParams.set(key, value);
    }
  });

  const osrmUrl = `${OSRM_BASE}/${encodeURIComponent(coordinates)}?${forwardParams.toString()}`;

  try {
    const osrmResponse = await fetch(osrmUrl, {
      // Next.js のキャッシュを無効化（ルートは毎回新鮮な結果が必要）
      cache: 'no-store',
    });

    const data = await osrmResponse.json();

    return NextResponse.json(data, {
      status: osrmResponse.status,
      headers: {
        // ブラウザキャッシュも禁止（同じリクエストでも結果が変わりうる）
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('OSRM プロキシエラー:', error);
    return NextResponse.json(
      { error: 'ルーティングサーバーへの接続に失敗しました' },
      { status: 502 }
    );
  }
}
