import type { RouteMode } from "@/lib/types";

interface TaskComposerProps {
  task: string;
  mode: RouteMode;
  isRouting: boolean;
  onTaskChange: (task: string) => void;
  onModeChange: (mode: RouteMode) => void;
  onRoute: () => void;
}

const modes: Array<{ value: RouteMode; label: string; description: string }> = [
  { value: "fast", label: "Fast", description: "Fewer stages" },
  { value: "balanced", label: "Balanced", description: "Plan, build, review" },
  { value: "quality", label: "Quality", description: "More thorough prompts" },
];

export function TaskComposer({ task, mode, isRouting, onTaskChange, onModeChange, onRoute }: TaskComposerProps) {
  return (
    <div className="rounded-2xl border border-cyan-200/20 bg-slate-950/75 p-3 shadow-[0_0_70px_rgba(14,165,233,0.1)] backdrop-blur-xl">
      <label className="sr-only" htmlFor="coding-task">Describe a coding task</label>
      <textarea
        id="coding-task"
        className="min-h-32 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-4 text-base leading-6 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:bg-cyan-300/[0.035]"
        maxLength={6000}
        onChange={(event) => onTaskChange(event.target.value)}
        placeholder="Describe the feature, bug, or refactor you need..."
        value={task}
      />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" aria-label="Routing mode">
          {modes.map((option) => (
            <button
              key={option.value}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition ${mode === option.value ? "bg-cyan-300 text-slate-950 shadow-[0_0_22px_rgba(103,232,249,0.35)]" : "text-slate-400 hover:bg-white/[0.07] hover:text-white"}`}
              onClick={() => onModeChange(option.value)}
              title={option.description}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 px-5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isRouting}
          onClick={onRoute}
          type="button"
        >
          {isRouting ? "Routing agent…" : "Route task"}
          <span aria-hidden="true" className="text-lg leading-none">→</span>
        </button>
      </div>
    </div>
  );
}
