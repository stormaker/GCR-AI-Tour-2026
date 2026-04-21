import { readFileSync } from "fs";
import { join } from "path";
import { marked } from "marked";

export default function Home() {
  let html = "";
  try {
    const mdPath = join(process.cwd(), "public", "report.md");
    const markdown = readFileSync(mdPath, "utf-8");
    html = marked.parse(markdown, { gfm: true }) as string;
  } catch {
    html = "<p>报告加载中...</p>";
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-[#e7e4de] bg-[#f6f5f2]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[980px] items-center justify-between px-4 py-3">
          <div className="text-sm font-semibold uppercase tracking-wider text-[#1b1a19]">
            Tech Insight
          </div>
          <div className="text-xs text-[#6b6760]">
            AI 技术洞察日报
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[980px] px-4 py-6">
        <article
          className="markdown-body rounded-2xl border border-[#e7e4de] bg-white px-6 py-8 shadow-sm"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>

      <footer className="mt-auto border-t border-[#e7e4de] bg-white/70">
        <div className="mx-auto max-w-[980px] px-4 py-4 text-xs text-[#6b6760]">
          静态渲染：Markdown → HTML（服务端渲染）
        </div>
      </footer>
    </>
  );
}
