"use client";

import { useState, useEffect } from "react";
import type { RunEntry, RouteDecision } from "@/lib/types";

/* ── Helpers ───────────────────────────────────────────── */

function relativeTime(iso: string): string {
  const elapsed = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (elapsed < 10) return "just now";
  if (elapsed < 60) return `${elapsed}s ago`;
  const minutes = Math.floor(elapsed / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

/** Strip the org/provider prefix from a model identifier. */
function shortModelName(id: string): string {
  return id.split("/").pop() ?? id;
}

const STATUS_BADGE: Record<string, { text: string; className: string }> = {
  complete: { text: "Validated",  className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" },
  failed:   { text: "Failed",    className: "border-rose-400/20 bg-rose-400/10 text-rose-300" },
  running:  { text: "Running",   className: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300" },
  ready:    { text: "Queued",    className: "border-slate-400/20 bg-slate-400/10 text-slate-300" },
};

/* ── Sub-component: single stage evaluation card ───────── */

function StageEvaluationCard({ decision, index }: { decision: RouteDecision; index: number }) {
  const badge = STATUS_BADGE[decision.status] ?? STATUS_BADGE.ready;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#090d19]/80 p-3.5 shadow-inner">
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-cyan-400/10 text-[10px] font-bold text-cyan-300">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-[13px] font-semibold text-slate-200">{decision.label}</span>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badge.className}`}>
          {badge.text}
        </span>
      </div>

      {/* Selected model & evaluation score */}
      <div className="mb-2.5 flex items-baseline justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Selected model</p>
          <p className="text-sm font-semibold text-slate-100">{shortModelName(decision.model)}</p>
        </div>
        {decision.selectedScore != null && (
          <div className="text-right">
            <span className="text-2xl font-extrabold tabular-nums text-cyan-300">{decision.selectedScore}</span>
            <span className="text-xs text-slate-500">/100</span>
          </div>
        )}
      </div>

      {/* Selection Reason */}
      {decision.reason && (
        <div className="mb-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-0.5">Why it was selected</p>
          <p className="text-[12px] leading-relaxed text-slate-400">{decision.reason}</p>
        </div>
      )}

      {/* Compared Candidates */}
      {decision.candidates && decision.candidates.length > 0 && (
        <div className="mt-2.5 space-y-1 rounded-lg border border-white/[0.04] bg-black/20 p-2">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Evaluated candidates
            </span>
            <span className="text-[10px] text-slate-500">{decision.candidatesEvaluated ?? decision.candidates.length} ranked</span>
          </div>
          {decision.candidates.map((candidate, j) => {
            const isWinner = candidate.model === decision.model;
            return (
              <div
                key={j}
                className={`flex items-center justify-between rounded px-2 py-1 text-[12px] transition-colors ${
                  isWinner ? "bg-cyan-400/10 font-medium text-cyan-200" : "text-slate-400 hover:text-slate-300"
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isWinner && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />}
                  <span className="truncate">{shortModelName(candidate.model)}</span>
                </div>
                <span className="shrink-0 tabular-nums font-semibold">{candidate.score}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Quality gate & latency */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.04] pt-2 text-[11px] text-slate-500">
        {decision.qualityGate && (
          <span className="truncate" title={decision.qualityGate}>
            Gate: <span className="text-slate-400">{decision.qualityGate}</span>
          </span>
        )}
        {decision.latencyMs != null && (
          <span className="shrink-0 tabular-nums text-slate-400 font-mono">{decision.latencyMs}ms</span>
        )}
      </div>
    </div>
  );
}

/* ── Main Decision History Sidebar Component ───────────── */

interface DecisionHistoryProps {
  runs: RunEntry[];
}

export function DecisionHistory({ runs }: DecisionHistoryProps) {
  /* Default to expanding the most recent run ID */
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  // Auto-expand latest run when a new run arrives
  useEffect(() => {
    if (runs.length > 0) {
      const latestRun = runs[runs.length - 1];
      if (latestRun) setExpandedRunId(latestRun.id);
    }
  }, [runs]);

  function toggleRun(id: string) {
    setExpandedRunId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex h-full flex-col overflow-hidden" role="log" aria-label="Routing decision history">
      {/* Sidebar Header */}
      <div className="shrink-0 border-b border-white/[0.06] bg-[#070b15]/60 px-5 pb-4 pt-5">
        <h3 className="text-sm font-semibold text-slate-200">Previous Decisions from Router</h3>
        <p className="mt-0.5 text-xs text-slate-500">Inspect model evaluations and score breakdowns</p>
      </div>

      {/* Runs List */}
      <div className="ide-scrollbar flex-1 overflow-y-auto">
        {runs.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-500">
            No routing decisions recorded yet. Submit a coding task to view real-time model evaluation analytics.
          </div>
        )}

        {runs
          .slice()
          .reverse()
          .map((run) => {
            const isExpanded = expandedRunId === run.id;
            return (
              <div key={run.id} className="border-b border-white/[0.04] transition-colors">
                {/* Task Summary & View Button */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-cyan-400 shrink-0" aria-hidden="true" />
                      <span className="text-[11px] font-medium text-slate-400">{relativeTime(run.timestamp)}</span>
                    </div>
                    <span className="rounded bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium capitalize text-slate-400">
                      {run.mode} mode
                    </span>
                  </div>

                  <p className="text-[13px] font-medium leading-relaxed text-slate-200 break-words mb-3">
                    {run.prompt}
                  </p>

                  <button
                    onClick={() => toggleRun(run.id)}
                    aria-expanded={isExpanded}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                      isExpanded
                        ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200 shadow-sm"
                        : "border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-cyan-400/30 hover:bg-white/[0.05] hover:text-cyan-200"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      {isExpanded ? "Hide Router Evaluation" : "View Router Evaluation"}
                    </span>
                    <svg
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                </div>

                {/* Expanded Router Evaluations Drawer */}
                {isExpanded && (
                  <div className="space-y-3 border-t border-white/[0.04] bg-[#050812]/90 p-4">
                    <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                        Pipeline Stages ({run.result.decisions.length})
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{run.result.runId}</span>
                    </div>

                    {run.result.decisions.map((decision, i) => (
                      <StageEvaluationCard key={i} decision={decision} index={i} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
