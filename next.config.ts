import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // HTTP でも位置情報・カメラアクセスを許可する
  // （開発環境 localhost / LAN での動作のため）
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(self), camera=(self), microphone=(self)',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
