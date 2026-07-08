import type { NextConfig } from "next";

// GitHub Pages 向けの静的エクスポート構成
// デプロイ時は NEXT_PUBLIC_BASE_PATH=/portfolios を設定（ローカル開発時は不要）
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true, // GitHub Pages でのRSCプリフェッチ404を防ぐ
  images: { unoptimized: true },
};

export default nextConfig;
