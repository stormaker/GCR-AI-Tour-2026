import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { put, list } from "@vercel/blob";

const RSS_LIST = JSON.parse(
  readFileSync(join(process.cwd(), "public", "rss_list.json"), "utf-8")
);

const KIMI_API_KEY = process.env.KIMI_API_KEY || "";
const KIMI_BASE_URL = process.env.KIMI_BASE_URL || "https://api.kimi.com/coding";
const KIMI_MODEL = process.env.KIMI_MODEL || "kimi-coding";

interface Article {
  platform: string;
  title: string;
  url: string;
  publishedAt?: string;
  summary?: string;
  company?: string;
  signalLevel?: string;
}

async function fetchRSS(source: any): Promise<Article[]> {
  try {
    const res = await fetch(source.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const text = await res.text();

    const items: Article[] = [];
    const itemMatches = text.match(/<item>[\s\S]*?<\/item>/g) || [];

    for (const itemXml of itemMatches.slice(0, 10)) {
      const title = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || "";
      const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1]?.trim() || "";
      const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || "";
      const description = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]?.trim() || "";

      if (title && link) {
        items.push({
          platform: source.platform,
          title,
          url: link,
          publishedAt: pubDate,
          summary: description.slice(0, 200),
          company: source.company,
          signalLevel: source.signal_level,
        });
      }
    }

    return items;
  } catch {
    return [];
  }
}

async function fetchSitemap(source: any): Promise<Article[]> {
  try {
    const res = await fetch(source.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/xml",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const text = await res.text();

    const items: Article[] = [];
    const urlMatches = text.match(/<url>[\s\S]*?<\/url>/g) || [];

    for (const urlXml of urlMatches.slice(0, 15)) {
      const loc = urlXml.match(/<loc>(.*?)<\/loc>/)?.[1]?.trim() || "";
      const lastmod = urlXml.match(/<lastmod>(.*?)<\/lastmod>/)?.[1]?.trim() || "";

      if (loc && loc.includes("/news/")) {
        const slug = loc.split("/news/").pop() || "";
        const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

        items.push({
          platform: source.platform,
          title,
          url: loc,
          publishedAt: lastmod,
          company: source.company,
          signalLevel: source.signal_level,
        });
      }
    }

    return items;
  } catch {
    return [];
  }
}

async function fetchHTML(source: any): Promise<Article[]> {
  try {
    const res = await fetch(source.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const text = await res.text();

    const items: Article[] = [];
    const seen = new Set<string>();

    const articleRegex = /<article[^>]*>[\s\S]*?<\/article>|<div[^>]*class="[^"]*(?:blog|post|card)[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
    const cards = text.match(articleRegex) || [];

    for (const card of cards) {
      const headingMatch = card.match(/<h[2-5][^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/h[2-5]>/i);
      const title = headingMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || "";

      const linkMatch = card.match(/<a[^>]+href="(\/blog\/[^"]+)"[^>]*>/i);
      const href = linkMatch?.[1] || "";

      if (title.length > 10 && href && !seen.has(href)) {
        seen.add(href);
        const url = href.startsWith("http") ? href : `https://claude.com${href}`;

        const dateMatch = card.match(/<time[^>]*>(.*?)<\/time>/i) ||
                         card.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/i);
        const dateStr = dateMatch?.[1] || dateMatch?.[0] || "";

        items.push({
          platform: source.platform,
          title,
          url,
          publishedAt: dateStr,
          company: source.company,
          signalLevel: source.signal_level,
        });
      }
    }

    return items;
  } catch {
    return [];
  }
}

async function callKimi(prompt: string): Promise<string> {
  const res = await fetch(`${KIMI_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: [
        { role: "system", content: "你是 Tech Insight Agent，专门分析技术趋势并生成中文洞察报告。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    throw new Error(`Kimi API error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

function generateFallbackReport(articles: Article[]): string {
  const now = new Date().toISOString().split("T")[0];
  const trends = articles.filter((a) => a.signalLevel === "S" || a.signalLevel === "A");
  const singles = articles.filter((a) => a.signalLevel === "B");

  let md = `# Tech Insight 日报 | ${now}\n\n`;
  md += `> 数据窗口：过去 24 小时\n> 信号来源：${RSS_LIST.length} 个信源，采集 ${articles.length} 条文章\n> 生成时间：${new Date().toISOString()}\n\n---\n\n`;

  md += `## 📋 24h 摘要\n\n`;
  md += `本期共识别 **${trends.length + singles.length} 个热点**，其中跨源趋势 ${trends.length} 个，高信号单条更新 ${singles.length} 个。\n\n`;

  md += `| 排名 | 热度 | 标题 | 分类 |\n`;
  md += `|------|------|------|------|\n`;

  const all = [...trends, ...singles].slice(0, 12);
  all.forEach((a, i) => {
    const score = a.signalLevel === "S" ? 95 : a.signalLevel === "A" ? 80 : 65;
    const cat = a.signalLevel === "S" || a.signalLevel === "A" ? "trend" : "single";
    md += `| ${i + 1} | ⭐${score} | ${a.title.slice(0, 50)} | ${cat} |\n`;
  });

  md += `\n---\n\n`;
  md += `## 🔥 Cross-source Trends（跨源趋势）\n\n`;

  trends.slice(0, 8).forEach((a, i) => {
    md += `### H${String(i + 1).padStart(2, "0")} · ${a.title}\n`;
    md += `**热度：${a.signalLevel === "S" ? 95 : 80} | 来源：${a.platform}**\n\n`;
    md += `**发生了什么**\n${a.summary || "相关技术更新/讨论。"}\n\n`;
    md += `**为什么重要**\n这是一条${a.signalLevel === "S" ? "重要" : ""}技术信号，可能影响工程决策或研究方向。\n\n`;
    md += `> 🔗 [${a.title}](${a.url})\n\n`;
  });

  md += `\n---\n\n`;
  md += `*本报告由 Tech Insight 自动生成*\n`;

  return md;
}

export async function POST(req: NextRequest) {
  try {
    const allArticles: Article[] = [];

    for (const source of RSS_LIST) {
      let articles: Article[] = [];
      const sourceType = source.source?.toLowerCase() || "rss";

      if (sourceType === "sitemap") {
        articles = await fetchSitemap(source);
      } else if (sourceType === "html") {
        articles = await fetchHTML(source);
      } else {
        articles = await fetchRSS(source);
      }

      allArticles.push(...articles);
    }

    const scored = allArticles.map((a) => ({
      ...a,
      score: (a.signalLevel === "S" ? 30 : a.signalLevel === "A" ? 20 : 10) +
             (a.company ? 5 : 0),
    }));

    scored.sort((a, b) => b.score - a.score);
    const topArticles = scored.slice(0, 50);

    let report = "";
    if (KIMI_API_KEY) {
      const prompt = `基于以下技术文章列表，生成一份 Tech Insight 日报（Markdown 格式，中文为主）：

${topArticles.map((a, i) => `${i + 1}. [${a.platform}] ${a.title} (${a.url}) ${a.company ? `- ${a.company}` : ""}`).join("\n")}

要求：
1. 标题格式：# Tech Insight 日报 | YYYY-MM-DD
2. 包含 24h 摘要表格（排名、热度、标题、分类）
3. Cross-source Trends 部分（多来源共振话题）
4. High-signal Singles 部分（单源高价值更新）
5. Company Radar 部分（公司动态汇总）
6. 每个热点包含：发生了什么、为什么重要、影响谁、行动建议
7. 使用 Markdown 表格和列表
8. 添加参考链接`;

      try {
        report = await callKimi(prompt);
      } catch {
        report = generateFallbackReport(topArticles);
      }
    } else {
      report = generateFallbackReport(topArticles);
    }

    // 使用 Vercel Blob 存储报告
    const { url } = await put("report.md", report, {
      access: "public",
      contentType: "text/markdown",
    });

    return NextResponse.json({
      success: true,
      articles: topArticles.length,
      reportLength: report.length,
      blobUrl: url,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
