import { NextResponse } from "next/server";

import { runCodingAgent } from "@/lib/router";
import type { RouteMode } from "@/lib/types";

export const runtime = "nodejs";

const validModes = new Set<RouteMode>(["fast", "balanced", "quality"]);

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { task?: unknown; mode?: unknown };
    const task = typeof payload.task === "string" ? payload.task.trim() : "";
    const mode = typeof payload.mode === "string" && validModes.has(payload.mode as RouteMode)
      ? (payload.mode as RouteMode)
      : "balanced";

    if (task.length < 12) return NextResponse.json({ error: "Describe the coding task in at least 12 characters." }, { status: 400 });
    if (task.length > 6000) return NextResponse.json({ error: "Keep the coding task under 6,000 characters." }, { status: 400 });

    return NextResponse.json(await runCodingAgent({ task, mode }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The coding agent could not complete this request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
