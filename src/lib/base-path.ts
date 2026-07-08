// GitHub Pages のプロジェクトページ（/portfolios 配下）でも静的アセットを
// 正しく参照できるよう、ビルド時に焼き込まれる basePath。
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
