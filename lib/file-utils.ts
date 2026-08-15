import JSZip from "jszip";
import type { CanvasFile } from "@/lib/canvas";

/**
 * Shared file-type display properties.
 *
 * Centralises extension → label / colour mapping so the file explorer
 * and the editor tab bar stay in sync without duplication.
 */

export interface FileTypeStyle {
  /** Short label rendered beside the filename (e.g. "TS", "◈"). */
  label: string;
  /** Tailwind colour class applied to the label. */
  colorClass: string;
}

const EXTENSION_MAP: Record<string, FileTypeStyle> = {
  tsx:  { label: "TS",  colorClass: "text-sky-400" },
  ts:   { label: "TS",  colorClass: "text-sky-400" },
  jsx:  { label: "JS",  colorClass: "text-amber-400" },
  js:   { label: "JS",  colorClass: "text-amber-400" },
  mjs:  { label: "JS",  colorClass: "text-amber-400" },
  css:  { label: "◈",   colorClass: "text-violet-400" },
  html: { label: "◇",   colorClass: "text-rose-400" },
  htm:  { label: "◇",   colorClass: "text-rose-400" },
  json: { label: "{}",  colorClass: "text-emerald-400" },
  md:   { label: "M↓",  colorClass: "text-slate-400" },
  py:   { label: "PY",  colorClass: "text-sky-300" },
  sh:   { label: "$_",  colorClass: "text-emerald-300" },
};

const FALLBACK_STYLE: FileTypeStyle = { label: "○", colorClass: "text-slate-500" };

export function extensionOf(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function styleForFile(filename: string): FileTypeStyle {
  return EXTENSION_MAP[extensionOf(filename)] ?? FALLBACK_STYLE;
}

/** Extract just the filename from a potentially nested path. */
export function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

/**
 * Packages the generated files into a ZIP archive and triggers a browser download.
 *
 * @param files Array of CanvasFile items to package
 * @param zipFilename Name of the generated zip file (defaults to "feather-router-codebase.zip")
 */
export async function downloadCodebaseZip(files: CanvasFile[], zipFilename = "feather-router-codebase.zip"): Promise<void> {
  if (files.length === 0) return;

  const zip = new JSZip();

  for (const file of files) {
    // Standardise relative path
    const cleanPath = file.name.replace(/^\/+/, "");
    zip.file(cleanPath, file.content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = zipFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
