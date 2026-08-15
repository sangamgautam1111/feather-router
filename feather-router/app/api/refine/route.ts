import { NextResponse } from "next/server";

import { runCodingAgent } from "@/lib/router";
import type { RouteMode } from "@/lib/types";

export const runtime = "nodejs";

const validModes = new Set<RouteMode>(["fast", "balanced", "quality"]);

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { task?: unknown; mode?: unknown; existingCode?: unknown };
    const task = typeof payload.task === "string" ? payload.task.trim() : "";
    const mode =
      typeof payload.mode === "string" && validModes.has(payload.mode as RouteMode)
        ? (payload.mode as RouteMode)
        : "balanced";
    const existingCode = typeof payload.existingCode === "string" ? payload.existingCode : undefined;

    if (task.length < 8) return NextResponse.json({ error: "Describe what you want to refine in more detail." }, { status: 400 });
    if (task.length > 6000) return NextResponse.json({ error: "Keep the refinement under 6,000 characters." }, { status: 400 });

    return NextResponse.json(await runCodingAgent({ task, mode, existingCode }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The refinement could not complete.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
