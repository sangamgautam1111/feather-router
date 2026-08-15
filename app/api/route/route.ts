import { NextResponse } from "next/server";

import { runCodingAgent } from "@/lib/router";
import type { RouteMode } from "@/lib/types";

export const runtime = "nodejs";

const validModes = new Set<RouteMode>(["fast", "balanced", "quality"]);

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { task?: unknown; mode?: unknown; image?: unknown };
    const task = typeof payload.task === "string" ? payload.task.trim() : "";
    const mode = typeof payload.mode === "string" && validModes.has(payload.mode as RouteMode)
      ? (payload.mode as RouteMode)
      : "balanced";
    const image = typeof payload.image === "string" && payload.image.startsWith("data:image/")
      ? payload.image
      : undefined;

    if (task.length < 5 && !image) return NextResponse.json({ error: "Describe the task or attach an image." }, { status: 400 });
    if (task.length > 6000) return NextResponse.json({ error: "Keep the coding task under 6,000 characters." }, { status: 400 });

    return NextResponse.json(await runCodingAgent({ task: task || "Analyze attached image/wireframe and implement the UI/codebase.", mode, image }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The coding agent could not complete this request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
