"use client";

import { useState, useCallback } from "react";

import { IdeCanvas } from "@/components/ide-canvas";
import { TaskComposer } from "@/components/task-composer";
import { filesForCanvas, type CanvasFile } from "@/lib/canvas";
import type { RouteMode, RouteResponse, RunEntry } from "@/lib/types";

const STARTER_TASK = "Build a responsive calculator web app with dark mode and smooth animations";

function mergeCanvasFiles(existing: CanvasFile[], incoming: CanvasFile[]): CanvasFile[] {
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
  const [image, setImage] = useState<string | undefined>(undefined);
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
    if (trimmed.length < 5 && !image) {
      setError("Describe the coding task or attach an image.");
      return;
    }

    setIsRouting(true);
    setError(null);
    setIsIdeOpen(true);

    const taskPrompt = trimmed || "Build application from attached image wireframe";

    try {
      const response = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: taskPrompt, mode, image }),
      });
      const result = await parseOrThrow(response, "The coding agent could not complete this run.");
      const generatedFiles = filesForCanvas(result);

      const runEntry = toRunEntry(taskPrompt, mode, result);
      runEntry.image = image;

      setRuns([runEntry]);
      setFiles(generatedFiles);
    } catch (err) {
      setError(formatErrorMessage(err, "The coding agent could not complete this run."));
    } finally {
      setIsRouting(false);
    }
  }

  /* ── Iterative refinement ─────────────────────────────── */

  const refineTask = useCallback(
    async (prompt: string, refinementImage?: string) => {
      setIsRouting(true);
      setError(null);

      const activeImage = refinementImage || image;

      try {
        const response = await fetch("/api/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: prompt,
            mode,
            existingCode: packCodeContext(files),
            image: activeImage,
          }),
        });

        const result = await parseOrThrow(response, "The agent could not refine your workspace.");
        const updatedFiles = filesForCanvas(result);
        const mergedFiles = mergeCanvasFiles(files, updatedFiles);

        const runEntry = toRunEntry(prompt, mode, result);
        runEntry.image = activeImage;

        setRuns((prevRuns) => [...prevRuns, runEntry]);
        setFiles(mergedFiles);
      } catch (err) {
        setError(formatErrorMessage(err, "The agent could not refine your workspace."));
      } finally {
        setIsRouting(false);
      }
    },
    [files, image, mode],
  );

  function closeIde() {
    setIsIdeOpen(false);
    setError(null);
  }

  return (
    <main className="min-h-screen bg-[#030712] text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-white/[0.04] py-4">
          <div className="flex items-center gap-3">
            <span className="font-serif text-xl tracking-tight text-white">FeatherRouter</span>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
              Impact Forge Hackathon
            </span>
          </div>
          <a
            className="text-xs text-slate-400 hover:text-white transition"
            href="https://featherless.ai"
            target="_blank"
            rel="noreferrer"
          >
            Powered by Featherless API →
          </a>
        </header>

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
                  image={image}
                  isRouting={isRouting}
                  onTaskChange={setTask}
                  onImageChange={setImage}
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
