"use client";

import { useState, useCallback } from "react";

import { IdeCanvas } from "@/components/ide-canvas";
import { TaskComposer } from "@/components/task-composer";
import { filesForCanvas, type CanvasFile } from "@/lib/canvas";
import type { RouteMode, RouteResponse, RunEntry } from "@/lib/types";

/* ── Constants ─────────────────────────────────────────── */

const STARTER_TASK =
  "Add protected dashboard routes to a Next.js application, including a middleware check and a friendly redirect for signed-out users.";

const MIN_TASK_LENGTH = 12;

/* ── Pure helpers ──────────────────────────────────────── */

function mergeFilesByName(existing: CanvasFile[], incoming: CanvasFile[]): CanvasFile[] {
  const merged = new Map<string, CanvasFile>();
  for (const file of existing) merged.set(file.name, file);
  for (const file of incoming) merged.set(file.name, file);
  return Array.from(merged.values());
}

function packCodeContext(files: CanvasFile[]): string {
  return files
    .filter((f) => f.source === "implementation")
    .map((f) => `// file: ${f.name}\n${f.content}`)
    .join("\n\n");
}

function toRunEntry(prompt: string, mode: RouteMode, response: RouteResponse): RunEntry {
  return {
    id: response.runId,
    prompt,
    mode,
    result: response,
    timestamp: new Date().toISOString(),
  };
}

function formatErrorMessage(err: unknown, fallbackMessage: string): string {
  if (err instanceof TypeError && (err.message === "Failed to fetch" || err.message.includes("fetch"))) {
    return "Connection error: Could not reach the FeatherRouter backend. Please check if the server is active and try again.";
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallbackMessage;
}

async function parseOrThrow(response: Response, fallbackMessage: string): Promise<RouteResponse> {
  const payload = (await response.json()) as RouteResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? fallbackMessage);
  return payload;
}

/* ── Page component ────────────────────────────────────── */

export default function Home() {
  const [task, setTask] = useState(STARTER_TASK);
  const [mode, setMode] = useState<RouteMode>("balanced");
  const [error, setError] = useState<string | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [isIdeOpen, setIsIdeOpen] = useState(false);

  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [files, setFiles] = useState<CanvasFile[]>([]);

  /* ── Direct Code Edit Handler ───────────────────────────── */

  const handleFileChange = useCallback((filename: string, newContent: string) => {
    setFiles((prevFiles) =>
      prevFiles.map((file) => (file.name === filename ? { ...file, content: newContent } : file)),
    );
  }, []);

  /* ── Initial task routing ─────────────────────────────── */

  async function routeTask() {
    const trimmed = task.trim();
    if (trimmed.length < MIN_TASK_LENGTH) {
      setError("Describe the coding task in a little more detail.");
      return;
    }

    setIsRouting(true);
    setError(null);
    setIsIdeOpen(true);

    try {
      const response = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: trimmed, mode }),
      });
      const result = await parseOrThrow(response, "The coding agent could not complete this run.");
      const generatedFiles = filesForCanvas(result);

      setRuns([toRunEntry(trimmed, mode, result)]);
      setFiles(generatedFiles);
    } catch (err) {
      setError(formatErrorMessage(err, "The coding agent could not complete this run."));
    } finally {
      setIsRouting(false);
    }
  }

  /* ── Iterative refinement ─────────────────────────────── */

  const refineTask = useCallback(
    async (prompt: string) => {
      setIsRouting(true);
      setError(null);

      try {
        const response = await fetch("/api/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: prompt, mode, existingCode: packCodeContext(files) }),
        });
        const result = await parseOrThrow(response, "The refinement could not complete.");
        const incomingFiles = filesForCanvas(result);

        setRuns((prev) => [...prev, toRunEntry(prompt, mode, result)]);
        setFiles((prev) => mergeFilesByName(prev, incomingFiles));
      } catch (err) {
        setError(formatErrorMessage(err, "The refinement could not complete."));
      } finally {
        setIsRouting(false);
      }
    },
    [files, mode],
  );

  /* ── Reset ────────────────────────────────────────────── */

  function closeIde() {
    setIsIdeOpen(false);
    setRuns([]);
    setFiles([]);
    setError(null);
  }

  /* ── Render ───────────────────────────────────────────── */

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#060813] text-slate-100">
      {/* Background layers */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-[position:68%_center] bg-no-repeat"
        style={{ backgroundImage: "url('/feather-router-hero.jpg')" }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#030610]/95 via-[#030610]/72 to-[#030610]/15" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-[#030610]/20 via-transparent to-[#030610]/55" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-8 pt-4 sm:px-6 lg:px-10">
        {/* Header — only visible on landing page */}
        {!isIdeOpen && (
          <header className="flex items-center justify-between border-b border-white/10 pb-6">
            <a href="#top" aria-label="FeatherRouter home">
              <span className="font-serif text-xl tracking-tight text-white">FeatherRouter</span>
            </a>
            <p className="text-right text-xs font-medium tracking-wide text-slate-400">
              Built for <span className="text-cyan-100">Impact Forge Hackathon 2026</span>
            </p>
          </header>
        )}

        {isIdeOpen ? (
          <IdeCanvas
            runs={runs}
            files={files}
            isRouting={isRouting}
            mode={mode}
            error={error}
            onFileChange={handleFileChange}
            onRefine={refineTask}
            onClose={closeIde}
          />
        ) : (
          <div id="top" className="flex flex-1 items-center py-20 sm:py-28">
            <div className="max-w-3xl">
              <h1 className="max-w-3xl font-serif text-5xl leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
                The right open model for every step of the build.
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
                FeatherRouter plans, implements, and reviews coding tasks with a model choice you can inspect and trust.
              </p>
              <div className="mt-10 max-w-3xl">
                <TaskComposer
                  task={task}
                  mode={mode}
                  isRouting={isRouting}
                  onTaskChange={setTask}
                  onModeChange={setMode}
                  onRoute={routeTask}
                />
                {error && (
                  <p role="alert" className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
                    {error}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
