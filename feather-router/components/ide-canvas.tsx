"use client";

import { useState, useMemo, useCallback, useEffect } from "react";

import { FileExplorer } from "@/components/file-explorer";
import { DecisionHistory } from "@/components/decision-history";
import { RefinementInput } from "@/components/refinement-input";
import type { CanvasFile } from "@/lib/canvas";
import { styleForFile, basename } from "@/lib/file-utils";
import { tokenizeLine, TOKEN_PALETTE } from "@/lib/tokenizer";
import type { RouteMode, RunEntry } from "@/lib/types";

/* ── Constants ─────────────────────────────────────────── */

/** Maximum number of tabs to auto-open on first generation. */
const INITIAL_TAB_LIMIT = 4;
/** Maximum number of new tabs to surface after a refinement. */
const REFINEMENT_TAB_LIMIT = 2;

/* ── Custom hook: tab & active-file management ─────────── */

/**
 * Encapsulates the tab bar and active-file state, reconciling
 * both whenever the file list changes — either from the initial
 * generation (empty → populated) or from a refinement (files
 * added / replaced).
 *
 * All state transitions happen inside a single `useEffect` to
 * avoid render-during-render warnings that `setTimeout` hacks
 * would introduce.
 */
function useFileTabs(files: CanvasFile[]) {
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);

  useEffect(() => {
    const available = new Set(files.map((f) => f.name));

    setOpenTabs((prev) => {
      const retained = prev.filter((tab) => available.has(tab));

      // First generation: nothing open yet → show initial batch.
      if (retained.length === 0 && files.length > 0) {
        return files.slice(0, INITIAL_TAB_LIMIT).map((f) => f.name);
      }

      // Refinement: surface any newly created files as tabs.
      const known = new Set(prev);
      const fresh = files.filter((f) => !known.has(f.name)).slice(0, REFINEMENT_TAB_LIMIT);

      return retained.length !== prev.length || fresh.length > 0
        ? [...retained, ...fresh.map((f) => f.name)]
        : prev;
    });

    setActiveFileName((prev) => {
      if (prev && available.has(prev)) return prev;
      return files[0]?.name ?? null;
    });
  }, [files]);

  const selectFile = useCallback((name: string) => {
    setActiveFileName(name);
    setOpenTabs((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }, []);

  const closeTab = useCallback((name: string) => {
    setOpenTabs((prev) => {
      const remaining = prev.filter((t) => t !== name);
      // If the closed tab was active, fall back to the first remaining tab.
      setActiveFileName((current) => (current === name ? remaining[0] ?? null : current));
      return remaining;
    });
  }, []);

  const activeFileData = useMemo(
    () => files.find((f) => f.name === activeFileName) ?? null,
    [files, activeFileName],
  );

  return { activeFileName, activeFileData, openTabs, selectFile, closeTab, setActiveFileName } as const;
}

/* ── Sub-components ────────────────────────────────────── */

function FileTypeIcon({ filename }: { filename: string }) {
  const { label, colorClass } = styleForFile(filename);
  return <span className={`text-[10px] font-bold ${colorClass}`}>{label}</span>;
}

function Breadcrumb({ path }: { path: string }) {
  const segments = path.split("/");
  return (
    <div className="shrink-0 border-b border-white/[0.03] bg-[#080c16]/60 px-4 py-1.5">
      <nav className="text-[11px] text-slate-600" aria-label="File path">
        {segments.map((segment, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-1 text-slate-700" aria-hidden="true">›</span>}
            <span className={i === segments.length - 1 ? "text-slate-400" : ""}>{segment}</span>
          </span>
        ))}
      </nav>
    </div>
  );
}

function EmptyState({
  isRouting,
  error,
  onClose,
}: {
  isRouting: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        {isRouting ? (
          <>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-400" />
            <p className="text-sm text-slate-400">Routing your task through the agent pipeline…</p>
            <p className="mt-1 text-xs text-slate-600">Selecting optimal models for each stage</p>
          </>
        ) : error ? (
          <>
            <p className="text-sm text-rose-300">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-slate-400 hover:bg-white/[0.06]"
            >
              ← Start over
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-500">Select a file to view its contents</p>
        )}
      </div>
    </div>
  );
}

function CodeView({ content }: { content: string }) {
  const lines = content.split("\n");
  const gutterWidth = `${Math.max(String(lines.length).length, 2) * 0.65 + 2.5}rem`;

  return (
    <pre
      className="py-3 text-[13px] leading-[1.7]"
      style={{ fontFamily: "var(--font-geist-mono), 'Fira Code', monospace" }}
    >
      {lines.map((line, i) => (
        <div key={i} className="group flex hover:bg-white/[0.015]">
          <span
            className="inline-block shrink-0 select-none pr-5 text-right text-slate-600/50"
            style={{ width: gutterWidth }}
          >
            {i + 1}
          </span>
          <code className="flex-1 whitespace-pre-wrap break-all pr-4">
            {tokenizeLine(line).map((token, j) => (
              <span key={j} style={{ color: TOKEN_PALETTE[token.kind] }}>
                {token.text}
              </span>
            ))}
          </code>
        </div>
      ))}
    </pre>
  );
}

function RoutingSpinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ── IDE Canvas (main export) ──────────────────────────── */

interface IdeCanvasProps {
  runs: RunEntry[];
  files: CanvasFile[];
  isRouting: boolean;
  mode: RouteMode;
  error: string | null;
  onRefine: (prompt: string) => void;
  onClose: () => void;
}

export function IdeCanvas({ runs, files, isRouting, mode, error, onRefine, onClose }: IdeCanvasProps) {
  const { activeFileName, activeFileData, openTabs, selectFile, closeTab, setActiveFileName } = useFileTabs(files);

  return (
    <section className="flex flex-1 flex-col py-4 sm:py-6" aria-label="Code workspace">
      {/* ── Top bar ──────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-slate-200"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 4L6 8l4 4" />
            </svg>
            Back
          </button>
          <span className="font-serif text-lg tracking-tight text-white">FeatherRouter</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-medium capitalize tracking-wide text-slate-400">
            {mode} mode
          </span>
          {isRouting && (
            <span className="flex items-center gap-1.5 text-xs text-cyan-300">
              <RoutingSpinner />
              Routing…
            </span>
          )}
        </div>
      </div>

      {/* ── IDE grid ─────────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border border-white/[0.06] bg-[#080c16]/95 shadow-2xl shadow-black/50 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        {/* Left: File Explorer */}
        <aside className="hidden border-r border-white/[0.04] bg-[#060a14]/90 lg:block">
          <FileExplorer files={files} activeFile={activeFileName} onFileSelect={selectFile} />
        </aside>

        {/* Center: Editor */}
        <div className="flex min-h-0 flex-col">
          {/* Tab bar */}
          <div className="ide-scrollbar flex shrink-0 items-center gap-0 overflow-x-auto border-b border-white/[0.04] bg-[#070b15]/80">
            {openTabs.map((tabPath) => {
              const isActive = tabPath === activeFileName;
              const name = basename(tabPath);
              return (
                <button
                  key={tabPath}
                  className={`group flex shrink-0 items-center gap-2 border-r border-white/[0.03] px-4 py-2.5 text-[13px] transition-colors ${
                    isActive
                      ? "border-b-2 border-b-cyan-400/60 bg-[#0c1120]/80 text-slate-200"
                      : "text-slate-500 hover:bg-white/[0.02] hover:text-slate-400"
                  }`}
                  onClick={() => setActiveFileName(tabPath)}
                  title={tabPath}
                >
                  <FileTypeIcon filename={name} />
                  <span className="max-w-[140px] truncate">{name}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="ml-1 flex h-4 w-4 items-center justify-center rounded text-[11px] opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); closeTab(tabPath); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); closeTab(tabPath); } }}
                    aria-label={`Close ${name}`}
                  >
                    ×
                  </span>
                </button>
              );
            })}
            <span className="ml-auto shrink-0 px-3 text-[11px] text-slate-600">
              {files.length} file{files.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Breadcrumb */}
          {activeFileName && <Breadcrumb path={activeFileName} />}

          {/* Code area */}
          <div className="ide-scrollbar flex-1 overflow-auto bg-[#0b0f1a]">
            {!activeFileData && files.length === 0 ? (
              <EmptyState isRouting={isRouting} error={error} onClose={onClose} />
            ) : activeFileData ? (
              <CodeView content={activeFileData.content} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-slate-500">Select a file to view its contents</p>
              </div>
            )}
          </div>

          {/* Inline error banner */}
          {error && files.length > 0 && (
            <div role="alert" className="shrink-0 border-t border-rose-400/10 bg-rose-950/30 px-4 py-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Refinement input */}
          <RefinementInput onSubmit={onRefine} isRouting={isRouting} />
        </div>

        {/* Right: Decision History (desktop) */}
        <aside className="hidden border-l border-white/[0.04] bg-[#060a14]/85 xl:block">
          <DecisionHistory runs={runs} />
        </aside>
      </div>

      {/* Decision History (mobile / tablet fallback) */}
      <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.06] bg-[#080c16]/95 xl:hidden">
        <DecisionHistory runs={runs} />
      </div>
    </section>
  );
}
