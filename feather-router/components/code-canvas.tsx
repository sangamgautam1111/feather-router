"use client";

import { useMemo, useState } from "react";

import { RouteTimeline } from "@/components/route-timeline";
import { RoutingDecisionPanel } from "@/components/routing-decision-panel";
import { RuntimeGuide } from "@/components/runtime-guide";
import { StaticPreview } from "@/components/static-preview";
import { filesForCanvas } from "@/lib/canvas";
import { resolveRuntimeTarget } from "@/lib/project-runtime";
import type { AgentStage, RouteDecision, RouteMode, RouteResponse } from "@/lib/types";

interface CodeCanvasProps {
  task: string;
  mode: RouteMode;
  result: RouteResponse | null;
  isRouting: boolean;
  error: string | null;
  onClose: () => void;
}

const stageDetails: Array<{ stage: AgentStage; label: string }> = [
  { stage: "plan", label: "Architecture" },
  { stage: "build", label: "Implementation" },
  { stage: "review", label: "Review" },
];

function pendingDecisions(mode: RouteMode): RouteDecision[] {
  return stageDetails
    .filter((detail) => mode !== "fast" || detail.stage !== "review")
    .map((detail) => ({
      ...detail,
      model: "Selecting model",
      reason: "The router is matching this stage to a model profile.",
      status: "running",
    }));
}

function linesFor(content: string) {
  return Array.from({ length: Math.max(content.split("\n").length, 1) }, (_, index) => index + 1);
}

export function CodeCanvas({ task, mode, result, isRouting, error, onClose }: CodeCanvasProps) {
  const files = useMemo(() => filesForCanvas(result), [result]);
  const runtime = useMemo(() => resolveRuntimeTarget(task, files), [files, task]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const activeFile = files.find((file) => file.name === selectedFile) ?? files[0];
  const decisions = result?.decisions ?? pendingDecisions(mode);
  const hasResult = Boolean(result && !isRouting);
  const hasFailedStage = result?.decisions.some((decision) => decision.status === "failed") ?? false;
  const isComplete = hasResult && !hasFailedStage;

  return (
    <section className="flex flex-1 py-8 sm:py-12">
      <div className="grid min-h-[680px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#070a14]/90 shadow-2xl shadow-black/40 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="flex flex-col border-b border-white/10 bg-[#050811]/70 p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.17em] text-slate-400">Agent run</span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${error || hasFailedStage ? "bg-rose-300/10 text-rose-200" : isComplete ? "bg-emerald-300/10 text-emerald-200" : "bg-cyan-300/10 text-cyan-100"}`}>{error ? "Attention" : hasFailedStage ? "Partial" : isComplete ? "Complete" : "Routing"}</span>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Task</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{task}</p>
          </div>

          <div className="mt-6"><RouteTimeline decisions={decisions} compact /></div>

          <div className="mt-auto pt-8">
            <button className="w-full rounded-lg border border-white/10 px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:border-cyan-300/30 hover:text-white" onClick={onClose} type="button">New task</button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Code canvas</p>
              <p className="mt-1 text-sm text-slate-500">{hasResult ? `${files.length} generated artifacts${hasFailedStage ? " · partial run" : ""}` : "The router is building your implementation."}</p>
            </div>
            <span className="text-xs font-medium capitalize text-slate-400">{mode} mode</span>
          </div>

          {error ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="max-w-md rounded-xl border border-rose-300/20 bg-rose-300/10 p-5">
                <h2 className="font-serif text-2xl text-rose-50">The run needs attention</h2>
                <p className="mt-2 text-sm leading-6 text-rose-100">{error}</p>
                <button className="mt-5 rounded-lg border border-rose-200/30 px-3 py-2 text-sm font-medium text-rose-50 transition hover:bg-rose-50/10" onClick={onClose} type="button">Return to prompt</button>
              </div>
            </div>
          ) : !hasResult ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="max-w-sm text-center">
                <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-cyan-200/20 border-t-cyan-200" />
                <h2 className="mt-6 font-serif text-3xl text-white">Building your workspace</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">The router is assigning architecture, implementation, and review to the best available model profiles.</p>
              </div>
            </div>
          ) : (
            <>
              <RuntimeGuide runtime={runtime} isPreviewOpen={isPreviewOpen} onPreviewToggle={() => setIsPreviewOpen((open) => !open)} />
              <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 pt-3">
                {files.map((file) => (
                  <button
                    key={file.name}
                    className={`shrink-0 rounded-t-lg border border-b-0 px-3 py-2 text-xs transition ${activeFile?.name === file.name ? "border-white/10 bg-[#0d1220] text-cyan-100" : "border-transparent text-slate-500 hover:text-slate-200"}`}
                    onClick={() => setSelectedFile(file.name)}
                    type="button"
                  >
                    {file.name}
                  </button>
                ))}
              </div>
              {isPreviewOpen && runtime.staticPreview ? (
                <StaticPreview document={runtime.staticPreview} />
              ) : activeFile ? (
                <div className="min-h-0 flex-1 overflow-auto bg-[#0a0e1a] p-5">
                  <div className="mb-4 flex items-center justify-between gap-3 text-xs text-slate-500"><span>{activeFile.language}</span><span>{activeFile.source}</span></div>
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 font-mono text-[13px] leading-6">
                    <ol aria-hidden="true" className="select-none text-right text-slate-600">{linesFor(activeFile.content).map((line) => <li key={line}>{line}</li>)}</ol>
                    <pre className="min-w-0 whitespace-pre-wrap break-words text-slate-200">{activeFile.content}</pre>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <RoutingDecisionPanel decisions={decisions} isRouting={isRouting} />
      </div>
    </section>
  );
}
