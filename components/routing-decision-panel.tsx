import type { RouteDecision } from "@/lib/types";

interface RoutingDecisionPanelProps {
  decisions: RouteDecision[];
  isRouting: boolean;
}

function readableModelName(model: string) {
  return model.split("/").at(-1) ?? model;
}

function decisionStatus(decision: RouteDecision, isRouting: boolean) {
  if (decision.status === "failed") return { label: "Needs attention", className: "bg-rose-300/10 text-rose-200" };
  if (decision.status === "complete") return { label: "Validated", className: "bg-emerald-300/10 text-emerald-200" };
  return { label: isRouting ? "Selecting" : "Awaiting output", className: "bg-cyan-300/10 text-cyan-100" };
}

export function RoutingDecisionPanel({ decisions, isRouting }: RoutingDecisionPanelProps) {
  return (
    <aside className="border-t border-white/10 bg-[#060a14]/85 p-5 xl:border-t-0 xl:border-l">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Routing decisions</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Selected models, scored alternatives, and the evidence behind each choice.</p>
        </div>
        <span className="shrink-0 rounded-full bg-cyan-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100">
          {isRouting ? "Live" : "Evidence"}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {decisions.map((decision, index) => {
          const status = decisionStatus(decision, isRouting);
          const candidates = decision.candidates ?? [];

          return (
            <section key={decision.stage} className="rounded-xl border border-white/10 bg-white/[0.025] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-[9px] font-bold text-cyan-100">0{index + 1}</span>
                  <h2 className="text-sm font-semibold text-slate-100">{decision.label}</h2>
                </div>
                <span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] ${status.className}`}>{status.label}</span>
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Selected model</p>
                  <p className="mt-1 truncate text-sm font-medium text-cyan-100" title={decision.model}>{readableModelName(decision.model)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-semibold text-slate-100">{decision.selectedScore ?? "—"}<span className="text-xs font-medium text-slate-500">/100</span></p>
                  <p className="text-[10px] text-slate-500">selection score</p>
                </div>
              </div>

              <div className="mt-3 border-t border-white/8 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Why it was selected</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-300">{decision.reason}</p>
              </div>

              {candidates.length > 0 ? (
                <div className="mt-3 border-t border-white/8 pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Compared candidates</p>
                    <p className="text-[10px] text-slate-500">{decision.candidatesEvaluated ?? candidates.length} ranked</p>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {candidates.map((candidate) => {
                      const isSelected = candidate.model === decision.model;
                      return (
                        <li key={candidate.model} className={`rounded-md px-2 py-1.5 ${isSelected ? "bg-cyan-300/8" : "bg-white/[0.02]"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`truncate text-[11px] ${isSelected ? "text-cyan-100" : "text-slate-400"}`} title={candidate.model}>{readableModelName(candidate.model)}</span>
                            <span className="shrink-0 text-[11px] font-medium text-slate-300">{candidate.score}</span>
                          </div>
                          {isSelected ? <p className="mt-1 truncate text-[10px] text-cyan-200/80">{candidate.signals.slice(0, 2).join(" · ")}</p> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {decision.qualityGate ? (
                <div className="mt-3 flex items-start justify-between gap-3 border-t border-white/8 pt-3 text-[10px] leading-4">
                  <span className="text-slate-500">Quality gate</span>
                  <span className="max-w-[70%] text-right text-slate-400">{decision.qualityGate}{decision.fallbackUsed ? " · fallback used" : ""}{decision.latencyMs ? ` · ${decision.latencyMs}ms` : ""}</span>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
