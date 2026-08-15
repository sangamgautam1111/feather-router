"use client";

import { useState, useMemo } from "react";
import type { CanvasFile } from "@/lib/canvas";
import { styleForFile, basename, downloadCodebaseZip } from "@/lib/file-utils";
import { checkWebPreviewability } from "@/lib/live-renderer";
import { tokenizeLine, TOKEN_PALETTE } from "@/lib/tokenizer";
import type { RouteMode, RunEntry } from "@/lib/types";
import { FileExplorer } from "@/components/file-explorer";
import { DeployModal } from "@/components/deploy-modal";
import { LivePreviewModal } from "@/components/live-preview-modal";

interface ArenaCanvasProps {
  task: string;
  mode: RouteMode;
  isRouting: boolean;
  error: string | null;

  /* Left Side: Single Model Agent */
  singleFiles: CanvasFile[];
  singleRun?: RunEntry;

  /* Right Side: Multi-Agent Router */
  multiFiles: CanvasFile[];
  multiRun?: RunEntry;

  onClose: () => void;
}

function isPureBaseWeb(files: CanvasFile[]): boolean {
  if (!files || files.length === 0) return false;
  return files.every((f) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    return ext === "html" || ext === "css" || ext === "js" || ext === "svg" || ext === "md" || ext === "txt";
  });
}

function FileTypeIcon({ filename }: { filename: string }) {
  const { label, colorClass } = styleForFile(filename);
  return <span className={`text-[10px] font-bold ${colorClass}`}>{label}</span>;
}

/* ── Single Side Workspace Column ────────────────────────── */

interface SingleWorkspacePaneProps {
  title: string;
  badge: string;
  badgeColor: string;
  modelName: string;
  files: CanvasFile[];
  run?: RunEntry;
  isRouting: boolean;
  task: string;
}

function SingleWorkspacePane({
  title,
  badge,
  badgeColor,
  modelName,
  files,
  run,
  isRouting,
  task,
}: SingleWorkspacePaneProps) {
  const [activeFileName, setActiveFileName] = useState<string | null>(files[0]?.name ?? null);
  const [isDeployOpen, setIsDeployOpen] = useState(false);
  const [isLivePreviewOpen, setIsLivePreviewOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const activeFile = useMemo(
    () => files.find((f) => f.name === activeFileName) ?? files[0] ?? null,
    [files, activeFileName],
  );

  const showLivePreview = isPureBaseWeb(files);

  async function handleDownloadZip() {
    if (files.length === 0 || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadCodebaseZip(files, `${title.toLowerCase().replace(/\s+/g, "-")}-codebase.zip`);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#070b16]/95 shadow-xl">
      {/* Pane Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-[#090e1c] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-white">{title}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
            {badge}
          </span>
        </div>
        <span className="text-xs text-slate-400 font-mono" title="Assigned model profile">
          {modelName}
        </span>
      </div>

      {/* Pane Toolbar: Live Preview & Local Deploy */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.04] bg-[#060a14]/60 px-3 py-1.5">
        <div className="flex items-center gap-2">
          {files.length > 0 && showLivePreview && (
            <button
              onClick={() => setIsLivePreviewOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
            >
              <svg className="h-3 w-3 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
              Preview
            </button>
          )}

          {files.length > 0 && (
            <button
              onClick={() => setIsDeployOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              <svg className="h-3 w-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
              Deploy Guide
            </button>
          )}
        </div>

        {files.length > 0 && (
          <button
            onClick={handleDownloadZip}
            disabled={isDownloading}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/[0.08]"
          >
            <svg className="h-3 w-3 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            ZIP
          </button>
        )}
      </div>

      {/* Main Grid: File Tabs & Code Display */}
      <div className="flex min-h-0 flex-1">
        {/* Sub File Explorer Sidebar */}
        <aside className="w-44 shrink-0 border-r border-white/[0.04] bg-[#050812]/90 p-2 overflow-y-auto ide-scrollbar">
          <FileExplorer
            files={files}
            activeFile={activeFileName ?? files[0]?.name ?? null}
            onFileSelect={(name) => setActiveFileName(name)}
          />
        </aside>

        {/* Code Editor Pane */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#060913]">
          {/* File Tabs */}
          <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/[0.04] bg-[#070b15]/80 px-2 py-1 ide-scrollbar">
            {files.map((file) => {
              const isActive = file.name === (activeFileName ?? files[0]?.name);
              const name = basename(file.name);
              return (
                <button
                  key={file.name}
                  onClick={() => setActiveFileName(file.name)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono transition ${
                    isActive
                      ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/30"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <FileTypeIcon filename={name} />
                  <span className="truncate max-w-[100px]">{name}</span>
                </button>
              );
            })}
          </div>

          {/* Code Body */}
          <div className="relative min-h-0 flex-1 overflow-auto p-3 font-mono text-xs leading-5 text-slate-300 ide-scrollbar">
            {isRouting && files.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400 mb-3" />
                <p className="text-xs text-slate-400">Generating codebase for {title}…</p>
              </div>
            ) : activeFile ? (
              <pre className="whitespace-pre">
                {activeFile.content.split("\n").map((line, idx) => {
                  const tokens = tokenizeLine(line);
                  return (
                    <div key={idx} className="table-row">
                      <span className="table-cell select-none pr-3 text-right text-[10px] text-slate-600 font-mono">
                        {idx + 1}
                      </span>
                      <span className="table-cell whitespace-pre">
                        {tokens.map((token, tIdx) => (
                          <span key={tIdx} style={{ color: TOKEN_PALETTE[token.kind] ?? "#c9d1d9" }}>
                            {token.text}
                          </span>
                        ))}
                      </span>
                    </div>
                  );
                })}
              </pre>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-600">
                No active file selected
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Modals per Pane */}
      {isDeployOpen && (
        <DeployModal task={task} files={files} onClose={() => setIsDeployOpen(false)} />
      )}
      {isLivePreviewOpen && (
        <LivePreviewModal files={files} onClose={() => setIsLivePreviewOpen(false)} />
      )}
    </div>
  );
}

/* ── Arena Comparison Main Export ────────────────────────── */

export function ArenaCanvas({
  task,
  mode,
  isRouting,
  error,
  singleFiles,
  singleRun,
  multiFiles,
  multiRun,
  onClose,
}: ArenaCanvasProps) {
  return (
    <section className="flex flex-1 flex-col py-4 sm:py-6" aria-label="Arena Side-by-Side Comparison">
      {/* Top Arena Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-200"
          >
            ← Back to Prompt
          </button>
          <span className="font-serif text-lg text-white">FeatherRouter Arena Benchmark</span>
          <span className="rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-0.5 text-xs font-semibold text-purple-200">
            Side-by-Side Mode
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">
            {singleFiles.length + multiFiles.length} Total Files Generated
          </span>
        </div>
      </div>

      {/* Side-by-Side Split Windows */}
      <div className="grid flex-1 gap-4 lg:grid-cols-2 min-h-0">
        {/* Left Window: Single Model Agent */}
        <SingleWorkspacePane
          title="⚡ Single Model Agent"
          badge="Monolithic Direct"
          badgeColor="bg-amber-400/20 text-amber-200 border border-amber-400/40"
          modelName="Qwen2.5-Coder-32B-Instruct"
          files={singleFiles}
          run={singleRun}
          isRouting={isRouting}
          task={task}
        />

        {/* Right Window: FeatherRouter Multi-Agent */}
        <SingleWorkspacePane
          title="🔀 FeatherRouter Multi-Agent"
          badge="Dynamic 3-Stage Pipeline"
          badgeColor="bg-cyan-400/20 text-cyan-200 border border-cyan-400/40"
          modelName="Plan: Qwen3-VL · Build: Qwen2.5-Coder · Review: Mistral"
          files={multiFiles}
          run={multiRun}
          isRouting={isRouting}
          task={task}
        />
      </div>
    </section>
  );
}
