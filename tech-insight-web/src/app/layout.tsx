import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tech Insight - AI 技术洞察日报",
  description: "每日 AI 技术趋势、产品发布与研究动态",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f6f5f2] font-sans">
        {children}
      </body>
    </html>
  );
}
