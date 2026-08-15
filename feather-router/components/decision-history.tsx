"use client";

import { useState } from "react";
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

/* ── Sub-component: single stage card ──────────────────── */

function StageCard({ decision, index }: { decision: RouteDecision; index: number }) {
  const badge = STATUS_BADGE[decision.status] ?? STATUS_BADGE.ready;

  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#080c16]/60 p-3">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-cyan-300/80">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="text-[13px] font-semibold text-slate-200">{decision.label}</span>
        <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}>
          {badge.text}
        </span>
      </div>

      {/* Selected model & score */}
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Selected model</p>
          <p className="text-sm font-medium text-slate-200">{shortModelName(decision.model)}</p>
        </div>
        {decision.selectedScore != null && (
          <div className="text-right">
            <span className="text-2xl font-bold tabular-nums text-slate-200">{decision.selectedScore}</span>
            <span className="text-xs text-slate-500">/100</span>
          </div>
        )}
      </div>

      {/* Reason */}
      {decision.reason && <p className="mb-2 text-[11px] leading-relaxed text-slate-500">{decision.reason}</p>}

      {/* Candidates */}
      {decision.candidates && decision.candidates.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Compared candidates · {decision.candidatesEvaluated ?? decision.candidates.length} ranked
          </p>
          {decision.candidates.map((candidate, j) => (
            <div
              key={j}
              className={`flex items-center justify-between rounded px-2 py-1 text-[12px] ${
                candidate.model === decision.model ? "bg-cyan-400/[0.06] text-cyan-200" : "text-slate-400"
              }`}
            >
              <span className="truncate">{shortModelName(candidate.model)}</span>
              <span className="shrink-0 tabular-nums font-medium">{candidate.score}</span>
            </div>
          ))}
        </div>
      )}

      {/* Quality gate & latency */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {decision.qualityGate && <span>Quality gate: {decision.qualityGate}</span>}
        {decision.latencyMs != null && <span className="ml-auto tabular-nums">{decision.latencyMs}ms</span>}
      </div>
    </div>
  );
}

/* ── Main component ────────────────────────────────────── */

interface DecisionHistoryProps {
  runs: RunEntry[];
}

export function DecisionHistory({ runs }: DecisionHistoryProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  function toggleRun(id: string) {
    setExpandedRunId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex h-full flex-col overflow-hidden" role="log" aria-label="Routing decision history">
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.06] px-5 pb-4 pt-5">
        <h3 className="text-sm font-semibold text-slate-200">Previous Decisions from Router</h3>
      </div>

      {/* Decision list */}
      <div className="ide-scrollbar flex-1 overflow-y-auto">
        {runs.length === 0 && (
          <p className="px-5 pt-6 text-xs text-slate-500">No routing decisions yet. Submit a task to begin.</p>
        )}

        {runs
          .slice()
          .reverse()
          .map((run) => {
            const isExpanded = expandedRunId === run.id;
            return (
              <div key={run.id} className="border-b border-white/[0.04]">
                <button
                  className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
                  onClick={() => toggleRun(run.id)}
                  aria-expanded={isExpanded}
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-400/60" aria-hidden="true" />
                  <p className="min-w-0 flex-1 truncate text-[13px] text-slate-300">{run.prompt}</p>
                  <span className="shrink-0 pt-0.5 text-[11px] text-slate-600">{relativeTime(run.timestamp)}</span>
                </button>

                {isExpanded && (
                  <div className="space-y-3 bg-white/[0.01] px-5 pb-4 pt-1">
                    {run.result.decisions.map((decision, i) => (
                      <StageCard key={i} decision={decision} index={i} />
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
