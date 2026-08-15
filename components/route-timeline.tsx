import type { RouteDecision } from "@/lib/types";

interface RouteTimelineProps {
  decisions: RouteDecision[];
  compact?: boolean;
}

const stageSymbols = { plan: "01", build: "02", review: "03" };

export function RouteTimeline({ decisions, compact = false }: RouteTimelineProps) {
  return (
    <ol className={compact ? "mt-3 space-y-3" : "space-y-4"}>
      {decisions.map((decision, index) => (
        <li key={decision.stage} className="relative flex gap-3">
          {index < decisions.length - 1 ? <span aria-hidden="true" className="absolute left-3 top-7 h-[calc(100%+0.35rem)] border-l border-dashed border-white/15" /> : null}
          <span className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[9px] font-bold ${decision.status === "failed" ? "border-rose-300/30 bg-rose-300/10 text-rose-200" : decision.status === "complete" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"}`}>
            {stageSymbols[decision.stage]}
          </span>
          <div className="min-w-0 pt-0.5">
            <div className="flex items-center gap-2"><span className="text-xs font-semibold text-slate-100">{decision.label}</span><span className="truncate text-[11px] text-cyan-200">{decision.model}</span>{decision.selectedScore ? <span className="text-[10px] font-medium text-slate-500">{decision.selectedScore}/100</span> : null}</div>
            {!compact ? <><p className="mt-1 text-xs leading-5 text-slate-400">{decision.reason}</p>{decision.qualityGate ? <p className="mt-1 text-[10px] leading-4 text-slate-500">{decision.qualityGate}{decision.latencyMs ? ` · ${decision.latencyMs}ms` : ""}</p> : null}</> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
