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
