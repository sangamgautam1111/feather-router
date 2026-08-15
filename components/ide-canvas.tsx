"use client";

import { useState, useMemo, useCallback, useEffect, useRef, type ChangeEvent, type KeyboardEvent } from "react";

import { FileExplorer } from "@/components/file-explorer";
import { DecisionHistory } from "@/components/decision-history";
import { RefinementInput } from "@/components/refinement-input";
import { DeployModal } from "@/components/deploy-modal";
import { LivePreviewModal } from "@/components/live-preview-modal";
import type { CanvasFile } from "@/lib/canvas";
import { styleForFile, basename, downloadCodebaseZip } from "@/lib/file-utils";
import { tokenizeLine, TOKEN_PALETTE } from "@/lib/tokenizer";
import type { RouteMode, RunEntry } from "@/lib/types";

/* ── Constants ─────────────────────────────────────────── */

const INITIAL_TAB_LIMIT = 4;
const REFINEMENT_TAB_LIMIT = 2;

/**
 * Returns true ONLY if workspace consists strictly of base web files (HTML, CSS, JS, SVG, MD, TXT).
 * For Next.js, React, Vue, Python, or third-party backend stacks, returns false to prioritize Local Test & Deploy guidance.
 */
function isPureBaseWeb(files: CanvasFile[]): boolean {
  if (!files || files.length === 0) return false;
  return files.every((f) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    return ext === "html" || ext === "css" || ext === "js" || ext === "svg" || ext === "md" || ext === "txt";
  });
}

/* ── Custom hook: tab & active-file management ─────────── */

function useFileTabs(files: CanvasFile[]) {
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);

  useEffect(() => {
    const available = new Set(files.map((f) => f.name));

    setOpenTabs((prev) => {
      const retained = prev.filter((tab) => available.has(tab));

      if (retained.length === 0 && files.length > 0) {
        return files.slice(0, INITIAL_TAB_LIMIT).map((f) => f.name);
      }

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

function Breadcrumb({ path, isEdited }: { path: string; isEdited?: boolean }) {
  const segments = path.split("/");
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-white/[0.03] bg-[#080c16]/60 px-4 py-1.5 text-[11px]">
      <nav className="text-slate-600" aria-label="File path">
        {segments.map((segment, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-1 text-slate-700" aria-hidden="true">›</span>}
            <span className={i === segments.length - 1 ? "text-slate-400 font-medium" : ""}>{segment}</span>
          </span>
        ))}
      </nav>
      {isEdited && (
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-amber-400/90">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Edited
        </span>
      )}
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
    <div className="flex h-full items-center justify-center p-6">
      <div className="text-center max-w-md">
        {isRouting ? (
          <>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-400" />
            <p className="text-sm text-slate-400 font-medium">Routing your task through the agent pipeline…</p>
            <p className="mt-1 text-xs text-slate-600">Selecting optimal models for each stage</p>
          </>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-5 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-sm font-medium text-rose-200">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              ← Start over
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Select a file to view or edit its contents</p>
        )}
      </div>
    </div>
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

/* ── Code Editor Component ─────────────────────────────── */

interface CodeEditorProps {
  content: string;
  filename: string;
  onChange: (newContent: string) => void;
}

function CodeEditor({ content, filename, onChange }: CodeEditorProps) {
  const lines = useMemo(() => content.split("\n"), [content]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  function handleScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const updated = content.substring(0, start) + "  " + content.substring(end);
      onChange(updated);

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      });
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden font-mono text-[13px] leading-6">
      {/* Line numbers */}
      <div
        className="select-none border-r border-white/[0.03] bg-[#060a14]/60 py-3 pr-3 text-right text-slate-600 font-mono text-xs h-full shrink-0"
        aria-hidden="true"
        style={{ width: `${Math.max(3, String(lines.length).length + 1)}rem` }}
      >
        {lines.map((_, i) => (
          <div key={i} className="h-6 leading-6">{i + 1}</div>
        ))}
      </div>

      {/* Syntax-highlighted overlay + transparent editable textarea */}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {/* Highlighted display code */}
        <pre
          ref={preRef}
          className="pointer-events-none absolute inset-0 m-0 overflow-hidden p-3 font-mono text-[13px] leading-6 text-slate-300 whitespace-pre"
          aria-hidden="true"
        >
          {lines.map((line, lineIdx) => {
            const tokens = tokenizeLine(line);
            return (
              <div key={lineIdx} className="h-6 leading-6 whitespace-pre">
                {tokens.length === 0 ? (
                  " "
                ) : (
                  tokens.map((token, tokIdx) => (
                    <span key={tokIdx} style={{ color: TOKEN_PALETTE[token.kind] ?? "#c9d1d9" }}>
                      {token.text}
                    </span>
                  ))
                )}
              </div>
            );
          })}
        </pre>

        {/* Editable transparent textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          className="absolute inset-0 m-0 h-full w-full resize-none border-0 bg-transparent p-3 font-mono text-[13px] leading-6 text-transparent caret-white outline-none selection:bg-cyan-500/30 whitespace-pre overflow-auto ide-scrollbar"
          aria-label={`Code editor for ${filename}`}
        />
      </div>
    </div>
  );
}

/* ── IDE Canvas (main export) ──────────────────────────── */

interface IdeCanvasProps {
  runs: RunEntry[];
  files: CanvasFile[];
  isRouting: boolean;
  mode: RouteMode;
  error: string | null;
  onFileChange: (filename: string, newContent: string) => void;
  onRefine: (prompt: string, image?: string) => void;
  onClose: () => void;
}

export function IdeCanvas({ runs, files, isRouting, mode, error, onFileChange, onRefine, onClose }: IdeCanvasProps) {
  const { activeFileName, activeFileData, openTabs, selectFile, closeTab, setActiveFileName } = useFileTabs(files);

  const [editedFiles, setEditedFiles] = useState<Set<string>>(new Set());
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [isLivePreviewOpen, setIsLivePreviewOpen] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const handleContentChange = useCallback(
    (newContent: string) => {
      if (!activeFileName) return;
      setEditedFiles((prev) => new Set(prev).add(activeFileName));
      onFileChange(activeFileName, newContent);
    },
    [activeFileName, onFileChange],
  );

  async function handleDownloadZip() {
    if (files.length === 0 || isDownloadingZip) return;
    setIsDownloadingZip(true);
    try {
      await downloadCodebaseZip(files, `feather-router-${mode}-codebase.zip`);
    } catch {
      // Graceful download fallback
    } finally {
      setIsDownloadingZip(false);
    }
  }

  const showLivePreview = isPureBaseWeb(files);
  const latestTaskPrompt = runs.length > 0 ? runs[runs.length - 1]?.prompt ?? "" : "";

  return (
    <section className="flex flex-1 flex-col py-4 sm:py-6" aria-label="Code workspace">
      {/* ── Top bar ──────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
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
          {/* Live Web Preview Button: Displayed ONLY for base HTML/CSS/JS web applications */}
          {files.length > 0 && showLivePreview && (
            <button
              onClick={() => setIsLivePreviewOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-200 transition-all hover:bg-emerald-400/20 hover:text-white"
              title="Open live web app preview"
            >
              <svg className="h-3.5 w-3.5 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
              <span>Live Web Preview</span>
            </button>
          )}

          {/* How to Test & Deploy Button: Clean, minimalist terminal icon without stacked layers */}
          {files.length > 0 && (
            <button
              onClick={() => setIsDeployModalOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/80 px-3.5 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-800 hover:text-white"
              title="View local testing and deployment steps"
            >
              <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
              <span>How to Test & Deploy ?</span>
            </button>
          )}

          {/* Download Codebase (.zip) Button */}
          {files.length > 0 && (
            <button
              onClick={handleDownloadZip}
              disabled={isDownloadingZip}
              className="flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-gradient-to-r from-cyan-500/10 via-sky-500/10 to-violet-500/10 px-3.5 py-1.5 text-xs font-semibold text-cyan-200 shadow-sm transition-all hover:border-cyan-400/60 hover:bg-cyan-400/20 hover:text-white disabled:opacity-50"
              title="Download entire workspace as a ZIP archive"
            >
              {isDownloadingZip ? (
                <RoutingSpinner />
              ) : (
                <svg className="h-3.5 w-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              )}
              <span>Download Codebase (.zip)</span>
            </button>
          )}

          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-medium capitalize tracking-wide text-slate-400">
            {mode} mode
          </span>
          {isRouting && (
            <span className="flex items-center gap-1.5 text-xs text-cyan-300 font-medium">
              <RoutingSpinner />
              Routing…
            </span>
          )}
        </div>
      </div>

      {/* ── IDE grid (Spacious 380px sidebar for router evaluations) ── */}
      <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border border-white/[0.06] bg-[#080c16]/95 shadow-2xl shadow-black/50 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_380px]">
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
              const isEdited = editedFiles.has(tabPath);
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
                  {isEdited && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />}
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
          {activeFileName && <Breadcrumb path={activeFileName} isEdited={editedFiles.has(activeFileName)} />}

          {/* Code area */}
          <div className="flex-1 overflow-hidden bg-[#0b0f1a] flex flex-col min-h-0">
            {!activeFileData && files.length === 0 ? (
              <EmptyState isRouting={isRouting} error={error} onClose={onClose} />
            ) : activeFileData ? (
              <CodeEditor
                key={activeFileData.name}
                filename={activeFileData.name}
                content={activeFileData.content}
                onChange={handleContentChange}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-slate-500">Select a file to view or edit its contents</p>
              </div>
            )}
          </div>

          {/* Inline error banner */}
          {error && files.length > 0 && (
            <div role="alert" className="shrink-0 border-t border-rose-400/20 bg-rose-950/40 px-4 py-2.5 text-xs font-medium text-rose-200">
              {error}
            </div>
          )}

          {/* Refinement input */}
          <RefinementInput onSubmit={onRefine} isRouting={isRouting} />
        </div>

        {/* Right: Decision History (spacious 380px box) */}
        <aside className="hidden border-l border-white/[0.04] bg-[#060a14]/85 xl:block">
          <DecisionHistory runs={runs} />
        </aside>
      </div>

      {/* Decision History (mobile / tablet fallback) */}
      <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.06] bg-[#080c16]/95 xl:hidden">
        <DecisionHistory runs={runs} />
      </div>

      {/* Floating Modals */}
      {isDeployModalOpen && (
        <DeployModal
          task={latestTaskPrompt}
          files={files}
          onClose={() => setIsDeployModalOpen(false)}
        />
      )}

      {isLivePreviewOpen && (
        <LivePreviewModal
          files={files}
          onClose={() => setIsLivePreviewOpen(false)}
        />
      )}
    </section>
  );
}
