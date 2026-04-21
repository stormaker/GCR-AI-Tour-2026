"use client";

import { useEffect, useState } from "react";
import { marked } from "marked";

export default function Home() {
  const [html, setHtml] = useState<string>("<p>报告加载中...</p>");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    try {
      setLoading(true);
      const res = await fetch("/api/report");
      if (res.ok) {
        const data = await res.json();
        const rawHtml = marked.parse(data.content, { gfm: true }) as string;
        setHtml(rawHtml);
      } else {
        setHtml("<p>报告尚未生成，请点击刷新按钮生成。</p>");
      }
    } catch {
      setHtml("<p>加载失败，请稍后重试。</p>");
    } finally {
      setLoading(false);
    }
  }

  async function generateReport() {
    try {
      setGenerating(true);
      const res = await fetch("/api/generate", { method: "POST" });
      if (res.ok) {
        await loadReport();
      } else {
        setHtml("<p>报告生成失败，请稍后重试。</p>");
      }
    } catch {
      setHtml("<p>生成失败，请稍后重试。</p>");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-[#e7e4de] bg-[#f6f5f2]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[980px] items-center justify-between px-4 py-3">
          <div className="text-sm font-semibold uppercase tracking-wider text-[#1b1a19]">
            Tech Insight
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-[#6b6760]">
              AI 技术洞察日报
            </div>
            <button
              onClick={generateReport}
              disabled={generating}
              className="rounded-lg bg-[#3d4a57] px-3 py-1.5 text-xs text-white hover:bg-[#2a343c] disabled:opacity-50"
            >
              {generating ? "生成中..." : "刷新报告"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[980px] px-4 py-6">
        {loading && (
          <div className="mb-4 rounded-xl border border-[#e7e4de] bg-white px-4 py-3 text-sm text-[#6b6760]">
            正在加载报告...
          </div>
        )}
        <article
          className="markdown-body rounded-2xl border border-[#e7e4de] bg-white px-6 py-8 shadow-sm"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>

      <footer className="mt-auto border-t border-[#e7e4de] bg-white/70">
        <div className="mx-auto max-w-[980px] px-4 py-4 text-xs text-[#6b6760]">
          Tech Insight - AI 技术洞察日报
        </div>
      </footer>
    </>
  );
}
