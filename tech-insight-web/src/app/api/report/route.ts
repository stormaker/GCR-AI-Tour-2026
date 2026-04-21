import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

export async function GET() {
  try {
    const { blobs } = await list({ prefix: "report.md" });

    if (blobs.length === 0) {
      return NextResponse.json(
        { error: "报告尚未生成" },
        { status: 404 }
      );
    }

    const latest = blobs.sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )[0];

    const res = await fetch(latest.url);
    const content = await res.text();

    return NextResponse.json({ content, url: latest.url });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
