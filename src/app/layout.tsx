import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "マイ資産ポートフォリオ",
  description: "資産管理・理論株価分析・銘柄提案のパーソナル資産管理アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 px-8 py-7">{children}</main>
        </div>
      </body>
    </html>
  );
}
