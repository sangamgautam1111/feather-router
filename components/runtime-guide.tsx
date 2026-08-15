"use client";

import type { RuntimeTarget } from "@/lib/project-runtime";

interface RuntimeGuideProps {
  runtime: RuntimeTarget;
  isPreviewOpen: boolean;
  onPreviewToggle: () => void;
}

export function RuntimeGuide({ runtime, isPreviewOpen, onPreviewToggle }: RuntimeGuideProps) {
  return (
    <div className="border-b border-white/10 bg-white/[0.015] px-5 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Runtime target</p>
          <p className="mt-1 text-sm font-medium text-slate-200">{runtime.label}</p>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">{runtime.detail}</p>
        </div>
        {runtime.staticPreview ? (
          <button
            className="shrink-0 rounded-lg border border-cyan-200/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-100/50 hover:bg-cyan-300/15"
            onClick={onPreviewToggle}
            type="button"
          >
            {isPreviewOpen ? "View files" : "Open live preview"}
          </button>
        ) : null}
      </div>

      {runtime.startCommand ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          {runtime.setupCommand ? <code className="rounded bg-black/25 px-2 py-1 text-cyan-100">{runtime.setupCommand}</code> : null}
          <span className="text-slate-600">then</span>
          <code className="rounded bg-black/25 px-2 py-1 text-cyan-100">{runtime.startCommand}</code>
        </div>
      ) : null}
    </div>
  );
}
