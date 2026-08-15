"use client";

import { useState } from "react";
import { resolveRuntimeTarget, type ProjectFile } from "@/lib/project-runtime";
import type { CanvasFile } from "@/lib/canvas";

interface DeployModalProps {
  task: string;
  files: CanvasFile[];
  onClose: () => void;
}

export function DeployModal({ task, files, onClose }: DeployModalProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const projectFiles: ProjectFile[] = files.map((f) => ({ name: f.name, content: f.content }));
  const runtime = resolveRuntimeTarget(task, projectFiles);

  function copyToClipboard(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-fadeIn" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#090d1b] p-6 shadow-2xl shadow-cyan-500/10 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-5 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </span>
              <h2 className="text-xl font-bold text-slate-100">How to Test Locally & Deploy</h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Target detected: <span className="font-semibold text-cyan-300">{runtime.label}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="ide-scrollbar max-h-[70vh] overflow-y-auto space-y-6 pt-5">
          {/* Runtime Detail Banner */}
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-950/20 p-4 text-xs leading-relaxed text-cyan-200/90">
            {runtime.detail}
          </div>

          {/* Section 1: Test Locally */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400/20 text-[11px] font-bold text-cyan-300">
                1
              </span>
              Run & Test Locally
            </h3>

            {runtime.kind === "static" ? (
              <div className="space-y-3 text-xs text-slate-300">
                <p>Since this is a <strong>Static Web App</strong> (HTML / CSS / JS):</p>
                <ol className="list-decimal space-y-2 pl-5 text-slate-400">
                  <li>Click <strong>"Download Codebase (.zip)"</strong> in the top right bar.</li>
                  <li>Unzip the files into a folder on your computer.</li>
                  <li>Double-click <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-cyan-200">index.html</code> to open it directly in any browser!</li>
                </ol>
                <div className="mt-2 rounded-lg border border-white/[0.06] bg-[#050812] p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                    <span>Optional local dev server via terminal:</span>
                    <button
                      onClick={() => copyToClipboard("npx serve .", 1)}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      {copiedIndex === 1 ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="font-mono text-xs text-cyan-300">npx serve .</pre>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-300">
                <p>Steps to run the generated source in your terminal:</p>
                <ol className="list-decimal space-y-2 pl-5 text-slate-400">
                  <li>Click <strong>"Download Codebase (.zip)"</strong> and extract to your project directory.</li>
                  <li>Open your terminal in that folder and run the commands below:</li>
                </ol>

                {runtime.setupCommand && (
                  <div className="rounded-lg border border-white/[0.06] bg-[#050812] p-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                      <span>Step A: Setup Dependencies</span>
                      <button
                        onClick={() => copyToClipboard(runtime.setupCommand!, 2)}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        {copiedIndex === 2 ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    <pre className="font-mono text-xs text-cyan-300">{runtime.setupCommand}</pre>
                  </div>
                )}

                {runtime.startCommand && (
                  <div className="rounded-lg border border-white/[0.06] bg-[#050812] p-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                      <span>Step B: Start Local Server</span>
                      <button
                        onClick={() => copyToClipboard(runtime.startCommand!, 3)}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        {copiedIndex === 3 ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    <pre className="font-mono text-xs text-cyan-300">{runtime.startCommand}</pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: One-Click Production Deployment */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400/20 text-[11px] font-bold text-cyan-300">
                2
              </span>
              Deploy to Production
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition-colors hover:border-cyan-400/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-200">Vercel (Recommended)</span>
                  <span className="rounded bg-cyan-400/10 px-1.5 py-0.5 text-[10px] text-cyan-300">Instant</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Push your repository to GitHub, connect your account at <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline">vercel.com</a>, and click <strong>Deploy</strong> for zero-config hosting.
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition-colors hover:border-cyan-400/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-200">Netlify / GitHub Pages</span>
                  <span className="rounded bg-violet-400/10 px-1.5 py-0.5 text-[10px] text-violet-300">Static / Fullstack</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Drag and drop the downloaded ZIP or folder directly into <a href="https://app.netlify.com/drop" target="_blank" rel="noreferrer" className="text-cyan-400 underline">Netlify Drop</a> for immediate live URL deployment.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-end border-t border-white/[0.08] pt-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-cyan-400 px-5 py-2 text-xs font-semibold text-slate-950 transition-all hover:bg-cyan-300"
          >
            Got it, ready to build!
          </button>
        </div>
      </div>
    </div>
  );
}
