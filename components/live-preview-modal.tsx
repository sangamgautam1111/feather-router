"use client";

import { useState, useMemo } from "react";
import type { CanvasFile } from "@/lib/canvas";
import { bundleWebWorkspace } from "@/lib/live-renderer";

interface LivePreviewModalProps {
  files: CanvasFile[];
  onClose: () => void;
}

export function LivePreviewModal({ files, onClose }: LivePreviewModalProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  /* Secretly package & stitch files into self-contained HTML document */
  const previewDoc = useMemo(() => bundleWebWorkspace(files), [files]);

  function reloadPreview() {
    setRefreshKey((prev) => prev + 1);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative flex flex-col overflow-hidden rounded-2xl border border-cyan-400/30 bg-[#080c18] shadow-2xl shadow-cyan-500/20 transition-all duration-200 ${
          isMaximized ? "h-full w-full max-w-none" : "h-[85vh] w-full max-w-5xl"
        }`}
      >
        {/* ── Window Header & Simulated Browser Bar ─────── */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#060a14] px-4 py-3">
          {/* Left: Window Controls & Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={onClose}
                className="h-3 w-3 rounded-full bg-rose-500 transition-opacity hover:opacity-80"
                title="Close preview"
              />
              <button
                onClick={() => setIsMaximized((prev) => !prev)}
                className="h-3 w-3 rounded-full bg-amber-500 transition-opacity hover:opacity-80"
                title="Adjust / Toggle Maximize"
              />
              <button
                onClick={reloadPreview}
                className="h-3 w-3 rounded-full bg-emerald-500 transition-opacity hover:opacity-80"
                title="Refresh preview"
              />
            </div>
            <span className="font-semibold text-xs text-slate-300">Live Application Preview</span>
          </div>

          {/* Center: Browser URL Bar */}
          <div className="hidden min-w-[280px] max-w-md items-center gap-2 rounded-lg border border-white/[0.06] bg-[#04060d] px-3 py-1 text-xs text-slate-400 sm:flex">
            <svg className="h-3.5 w-3.5 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="truncate font-mono text-[11px] text-cyan-200">feather-router://live-preview</span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={reloadPreview}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              title="Refresh frame"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => setIsMaximized((prev) => !prev)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              title={isMaximized ? "Restore size" : "Maximize window"}
            >
              {isMaximized ? "🗗" : "🗖"}
            </button>

            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 transition-colors hover:bg-rose-500/20 hover:text-rose-300"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Sandboxed Live Execution Frame ───────────── */}
        <div className="relative flex-1 overflow-hidden bg-white">
          <iframe
            key={refreshKey}
            srcDoc={previewDoc}
            sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
            className="h-full w-full border-none"
            title="Live App Preview"
          />
        </div>
      </div>
    </div>
  );
}
