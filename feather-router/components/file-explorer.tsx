"use client";

import { useState, useMemo } from "react";
import type { CanvasFile } from "@/lib/canvas";
import { styleForFile } from "@/lib/file-utils";

/* ── Tree builder ──────────────────────────────────────── */

interface TreeNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  children: TreeNode[];
}

/**
 * Build a nested folder tree from a flat list of slash-delimited
 * file paths. Directories are sorted before files at every level.
 */
function buildTree(files: CanvasFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const segments = file.name.split("/");
    let level = root;

    for (let depth = 0; depth < segments.length; depth++) {
      const segment = segments[depth];
      const fullPath = segments.slice(0, depth + 1).join("/");
      const isLeaf = depth === segments.length - 1;

      let node = level.find((n) => n.name === segment);
      if (!node) {
        node = { name: segment, fullPath, isDir: !isLeaf, children: [] };
        level.push(node);
      }
      level = node.children;
    }
  }

  return sortTree(root);
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  return nodes
    .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1))
    .map((n) => ({ ...n, children: sortTree(n.children) }));
}

/* ── Collapse arrow SVG ────────────────────────────────── */

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 shrink-0 text-slate-500 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M6 4l4 4-4 4z" />
    </svg>
  );
}

/* ── Component ─────────────────────────────────────────── */

interface FileExplorerProps {
  files: CanvasFile[];
  activeFile: string | null;
  onFileSelect: (path: string) => void;
}

export function FileExplorer({ files, activeFile, onFileSelect }: FileExplorerProps) {
  const tree = useMemo(() => buildTree(files), [files]);

  /* Auto-expand every directory on first render. */
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const dirs = new Set<string>();
    for (const file of files) {
      const parts = file.name.split("/");
      for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
    }
    return dirs;
  });

  function toggleDirectory(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }

  function renderNode(node: TreeNode, depth: number = 0): React.ReactNode {
    const indent = `${8 + depth * 14}px`;

    if (node.isDir) {
      const isExpanded = expanded.has(node.fullPath);
      return (
        <div key={node.fullPath}>
          <button
            className="flex w-full items-center gap-1.5 py-[3px] text-left text-[13px] text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200"
            style={{ paddingLeft: indent }}
            onClick={() => toggleDirectory(node.fullPath)}
          >
            <ChevronIcon open={isExpanded} />
            <span className="truncate font-medium">{node.name}</span>
          </button>
          {isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    const isActive = node.fullPath === activeFile;
    const { label, colorClass } = styleForFile(node.name);

    return (
      <button
        key={node.fullPath}
        className={`flex w-full items-center gap-2 py-[3px] text-left text-[13px] transition-colors ${
          isActive
            ? "bg-cyan-400/[0.08] text-cyan-100"
            : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
        }`}
        style={{ paddingLeft: `${20 + depth * 14}px` }}
        onClick={() => onFileSelect(node.fullPath)}
      >
        <span className={`shrink-0 text-[10px] font-bold tracking-tight ${colorClass}`}>{label}</span>
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  return (
    <nav className="flex h-full flex-col overflow-hidden" aria-label="File explorer">
      <div className="px-4 pb-2 pt-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Explorer</span>
      </div>
      <div className="border-t border-white/[0.04] px-1 pt-2">
        <span className="px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          FEATHERROUTER
        </span>
      </div>
      <div className="ide-scrollbar flex-1 overflow-y-auto pt-1">
        {tree.map((node) => renderNode(node))}
      </div>
    </nav>
  );
}
